import request from 'superagent'

// Backend proxy endpoints (no CORS issues, server handles Discogs API)
const BACKEND_API_BASE = '/api/discogs'

/**
 * Discogs release/album data structure
 */
export interface DiscogsRelease {
  id: number
  title: string
  year: number
  genres: string[]        // Broad categories: ["Punk", "Rock"]
  styles: string[]        // Specific sub-genres: ["Hardcore", "Oi"]
  formats: Array<{
    name: string          // "Vinyl", "CD", "Compilation"
    descriptions?: string[]
  }>
  labels: Array<{
    name: string
    catno: string
  }>
  community: {
    rating?: {
      average: number     // 0-5 stars
      count: number
    }
    have: number          // Number of users who own it
    want: number          // Number of users who want it
  }
  isCompilation: boolean  // Derived from format
}

/**
 * Simple search result for album lookup
 */
export interface DiscogsSearchResult {
  id: number
  title: string
  year: number
  type: string            // "release", "master"
  format?: string[]
}

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  data: T
  timestamp: number
}

/**
 * Adapter for querying Discogs database
 * Provides album-level metadata: genres, styles, compilation detection, community ratings
 */
export class DiscogsAdapter {
  private cache: Map<string, CacheEntry<DiscogsRelease | null>>
  private readonly CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
  private requestQueue: Promise<any> = Promise.resolve()

  constructor() {
    this.cache = new Map()
  }

  /**
   * Queue a request to ensure sequential execution
   * Prevents overwhelming the backend proxy and Discogs API with parallel requests
   */
  private async queueRequest<T>(fn: () => Promise<T>): Promise<T> {
    const request = this.requestQueue.then(() => fn())
    this.requestQueue = request.catch(() => {}) // Don't let failures block queue
    return request
  }

  /**
   * Search for a release by artist and album name
   * Returns best match or null if not found
   * Now calls backend proxy to avoid CORS issues
   */
  async searchRelease(
    artistName: string,
    albumName: string
  ): Promise<DiscogsSearchResult | null> {
    return this.queueRequest(async () => {
      try {
        const response = await request
          .get(`${BACKEND_API_BASE}/search`)
          .query({
            artist: artistName,
            album: albumName
          })

        const results = response.body.results as DiscogsSearchResult[]

        if (!results || results.length === 0) {
          return null
        }

        // Return first result (Discogs returns best matches first)
        return results[0]
      } catch (error) {
        console.warn(`Discogs search error for "${artistName} - ${albumName}":`, error)
        return null
      }
    })
  }

  /**
   * Get full release details by Discogs release ID
   * Uses aggressive caching (30-day TTL)
   * Now calls backend proxy to avoid CORS issues
   */
  async getRelease(releaseId: number): Promise<DiscogsRelease | null> {
    const cacheKey = `release:${releaseId}`

    return this.queueRequest(async () => {
      // Check cache inside queue to avoid duplicate requests for same release
      const cached = this.cache.get(cacheKey)

      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
        console.log(`Discogs cache HIT: release ${releaseId}`)
        return cached.data
      }

      try {
        const response = await request
          .get(`${BACKEND_API_BASE}/release/${releaseId}`)

        const data = response.body

        // Check if this is a compilation
        const isCompilation = data.formats?.some((f: any) =>
          f.descriptions?.some((d: string) =>
            d.toLowerCase().includes('compilation')
          )
        ) || false

        const release: DiscogsRelease = {
          id: data.id,
          title: data.title,
          year: data.year,
          genres: data.genres || [],
          styles: data.styles || [],
          formats: data.formats || [],
          labels: data.labels || [],
          community: {
            rating: data.community?.rating ? {
              average: data.community.rating.average,
              count: data.community.rating.count
            } : undefined,
            have: data.community?.have || 0,
            want: data.community?.want || 0
          },
          isCompilation
        }

        // Cache the result
        this.cache.set(cacheKey, {
          data: release,
          timestamp: Date.now()
        })

        return release
      } catch (error) {
        console.warn(`Discogs get release error for ID ${releaseId}:`, error)

        // Cache null result to avoid repeated failed requests
        this.cache.set(cacheKey, {
          data: null,
          timestamp: Date.now()
        })

        return null
      }
    })
  }

  /**
   * Validate if an album matches the specified genre
   * Checks both broad genres and specific styles
   */
  validateGenre(release: DiscogsRelease, searchGenre: string): boolean {
    const normalizedSearch = searchGenre.toLowerCase()

    // Check genres (broad categories)
    const genreMatch = release.genres.some(g =>
      g.toLowerCase().includes(normalizedSearch) ||
      normalizedSearch.includes(g.toLowerCase())
    )

    // Check styles (specific sub-genres)
    const styleMatch = release.styles.some(s =>
      s.toLowerCase().includes(normalizedSearch) ||
      normalizedSearch.includes(s.toLowerCase())
    )

    return genreMatch || styleMatch
  }

  /**
   * Calculate source score based on Discogs community data
   * Returns 0-10 points based on rating and ownership
   */
  calculateSourceScore(release: DiscogsRelease): number {
    let score = 0

    // Community rating (0-5 stars → 0-5 points)
    if (release.community.rating && release.community.rating.count >= 5) {
      score += release.community.rating.average
    }

    // Ownership/demand signals (0-5 points)
    // More "want" relative to "have" = higher B-side potential
    const totalInterest = release.community.have + release.community.want

    if (totalInterest > 0) {
      const wantRatio = release.community.want / totalInterest

      // High want ratio (>50%) = obscure but desired = B-side gold
      if (wantRatio > 0.5 && totalInterest > 10) {
        score += 5
      } else if (wantRatio > 0.3 && totalInterest > 5) {
        score += 3
      } else if (totalInterest > 50) {
        // Well-known release
        score += 1
      }
    }

    return Math.min(score, 10) // Cap at 10
  }

  /**
   * Check if album is from an independent label
   * Independent labels often release B-sides and deep cuts
   */
  isIndependentLabel(release: DiscogsRelease): boolean {
    const independentIndicators = [
      'records',
      'recordings',
      'self-released',
      'independent',
      'indie',
      'diy'
    ]

    return release.labels.some(label => {
      const labelName = label.name.toLowerCase()
      return independentIndicators.some(indicator =>
        labelName.includes(indicator)
      )
    })
  }

  /**
   * Get album validation for track scoring
   * Combines genre validation, compilation check, and source score
   */
  async validateAlbum(
    artistName: string,
    albumName: string,
    searchGenre?: string
  ): Promise<{
    found: boolean
    genreMatch: boolean
    isCompilation: boolean
    sourceScore: number
    isIndependent: boolean
  }> {
    // Search for the release
    const searchResult = await this.searchRelease(artistName, albumName)

    if (!searchResult) {
      return {
        found: false,
        genreMatch: false,
        isCompilation: false,
        sourceScore: 0,
        isIndependent: false
      }
    }

    // Get full release details
    const release = await this.getRelease(searchResult.id)

    if (!release) {
      return {
        found: false,
        genreMatch: false,
        isCompilation: false,
        sourceScore: 0,
        isIndependent: false
      }
    }

    return {
      found: true,
      genreMatch: searchGenre ? this.validateGenre(release, searchGenre) : true,
      isCompilation: release.isCompilation,
      sourceScore: this.calculateSourceScore(release),
      isIndependent: this.isIndependentLabel(release)
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    }
  }
}
