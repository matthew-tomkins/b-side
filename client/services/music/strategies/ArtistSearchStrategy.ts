/**
 * Artist Search Strategy
 *
 * Handles all artist discovery logic:
 * - MusicBrainz local database searches (geographic queries)
 * - Last.fm searches (global queries)
 * - Genre normalization and regional subgenre expansion
 * - Artist similarity expansion
 */

import { LastFmAdapter } from '../LastFmAdapter'
import { ParsedQuery } from '../QueryParser'
import { normaliseCountry } from '../../../utils/countryUtils'

interface ArtistGeography {
  country: string
  city?: string
  mbid?: string
  begin_year?: number
  end_year?: number
  tags?: string[]
  relationships?: Record<string, string[]>
  discogsGenres?: string[]
  discogsStyles?: string[]
  releaseYears?: number[]
}

interface GenreInfo {
  canonical_name: string
  aliases: string[]
  subgenres: string[]
  related: string[]
  typical_countries: string[]
  peak_era: string
}

interface GenreTaxonomyData {
  version: string
  last_updated: string
  source: string
  description: string
  genres: Record<string, GenreInfo>
}

interface ArtistSimilarityInfo {
  similar: string[]
  genre: string
  influence_score: number
}

interface ArtistSimilarityData {
  version: string
  last_updated: string
  source: string
  description: string
  artists: Record<string, ArtistSimilarityInfo>
}

export class ArtistSearchStrategy {
  private lastfm: LastFmAdapter
  private musicbrainzCache: Map<string, ArtistGeography> = new Map()
  private genreTaxonomy: GenreTaxonomyData | null = null
  private artistSimilarity: ArtistSimilarityData | null = null

  constructor(
    lastfmAdapter: LastFmAdapter,
    genreTaxonomy: GenreTaxonomyData | null,
    artistSimilarity: ArtistSimilarityData | null
  ) {
    this.lastfm = lastfmAdapter
    this.genreTaxonomy = genreTaxonomy
    this.artistSimilarity = artistSimilarity
  }

  /**
   * Update taxonomy and similarity data (called when config is reloaded)
   */
  updateConfig(genreTaxonomy: GenreTaxonomyData | null, artistSimilarity: ArtistSimilarityData | null): void {
    this.genreTaxonomy = genreTaxonomy
    this.artistSimilarity = artistSimilarity
  }

  /**
   * Enrich artists with MusicBrainz data via API
   * This replaces the old static JSON import with server-side API calls
   */
  async enrichArtistsWithMusicBrainz(artistNames: string[]): Promise<Map<string, ArtistGeography>> {
    const enriched = new Map<string, ArtistGeography>()

    // Check cache first
    const uncached: string[] = []
    for (const name of artistNames) {
      const cached = this.musicbrainzCache.get(name)
      if (cached) {
        enriched.set(name, cached)
      } else {
        uncached.push(name)
      }
    }

    // If all cached, return early
    if (uncached.length === 0) {
      return enriched
    }

    try {
      // Call our custom API to enrich artists
      const response = await fetch('/api/musicbrainz/artists/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ artists: uncached })
      })

      if (!response.ok) {
        console.warn(`[MusicBrainz] API error: ${response.status}`)
        return enriched
      }

      const data = await response.json()

      // Cache and add to results
      for (const [artistName, artistData] of Object.entries(data.enriched)) {
        const geoData = artistData as ArtistGeography
        this.musicbrainzCache.set(artistName, geoData)
        enriched.set(artistName, geoData)
      }

      console.log(`[MusicBrainz] Enriched ${data.stats.found}/${data.stats.requested} artists`)

      return enriched
    } catch (error) {
      console.warn('[MusicBrainz] Enrichment failed:', error)
      return enriched
    }
  }

  /**
   * Get artist candidates
   *
   * SMART HYBRID APPROACH (2025-12-28):
   * - Geographic searches: MusicBrainz-first (local, unlimited, accurate)
   * - Non-geographic: Last.fm (global popularity-based discovery)
   * - Always supplement with Last.fm regional subgenres for niche coverage
   *
   * Benefits:
   * - Finds ALL country-specific artists (e.g., AC/DC for Australia)
   * - No artist name collisions (e.g., British Muse vs Australian Muse)
   * - Minimal API calls to Last.fm/Spotify = less rate limiting
   * - Fast: MusicBrainz is local, no network latency
   */
  async getArtistCandidates(query: ParsedQuery): Promise<string[]> {
    // Normalize genre using taxonomy (handles aliases like "punk rock" → "punk")
    const normalizedGenre = query.genre ? this.normalizeGenre(query.genre) : query.genre

    // SMART ROUTING: Use MusicBrainz-first when we have country filters
    if (query.country || query.multiCountryRegion) {
      return this.getArtistCandidatesWithGeography(query, normalizedGenre)
    }

    // FALLBACK: No country filter - use Last.fm for global discovery
    return this.getArtistCandidatesGlobal(normalizedGenre)
  }

  /**
   * Get artist candidates for GEOGRAPHIC searches
   * Uses MusicBrainz local database as primary source, supplements with Last.fm
   */
  private async getArtistCandidatesWithGeography(query: ParsedQuery, normalizedGenre?: string): Promise<string[]> {
    const artists: string[] = []

    // STEP 1: Get bulk artists from MusicBrainz (local, fast, unlimited, scored & sorted!)
    const mbArtistsWithScores = await this.searchMusicBrainzLocal(normalizedGenre, query.country, query.multiCountryRegion, query.era)
    artists.push(...mbArtistsWithScores.map(a => a.name))

    // STEP 2: Supplement with Last.fm for regional subgenres (edge cases)
    // This catches niche genres like "afrobeat" for "funk africa"
    if (normalizedGenre) {
      const subgenres = this.getRegionalSubgenres(normalizedGenre, query.country, query.multiCountryRegion)
      if (subgenres.length > 0) {

        for (const subgenre of subgenres) {
          // First try MusicBrainz for the subgenre
          const mbSubgenreArtistsWithScores = await this.searchMusicBrainzLocal(subgenre, query.country, query.multiCountryRegion)
          artists.push(...mbSubgenreArtistsWithScores.map(a => a.name))

          // If MusicBrainz doesn't have many results, supplement with Last.fm
          if (mbSubgenreArtistsWithScores.length < 20) {
            try {
              const lastfmArtists = await this.lastfm.getArtistsByTag(subgenre, 30)
              // Enrich with MusicBrainz to filter by country
              const enriched = await this.enrichArtistsWithMusicBrainz(lastfmArtists.map(a => a.name))
              const countryCode = query.country ? normaliseCountry(query.country) : null
              const multiCountryCodes = query.multiCountryRegion?.map(c => normaliseCountry(c)) || null

              const filtered = lastfmArtists
                .map(a => a.name)
                .filter(name => {
                  const geo = enriched.get(name)
                  if (!geo) return false
                  if (countryCode) return geo.country === countryCode
                  if (multiCountryCodes) return multiCountryCodes.includes(geo.country || '')
                  return false
                })

              artists.push(...filtered)
            } catch (error) {
              console.warn(`    ⚠️  Last.fm "${subgenre}" failed:`, error)
            }
          }
        }
      }
    }

    // Deduplicate
    const uniqueArtists = Array.from(new Set(artists))

    // FALLBACK: If we have very few results, expand the search
    if (uniqueArtists.length < 10) {
      // Don't limit - process all results for better coverage
      return uniqueArtists
    }

    // CRITICAL LIMIT: Cap at 20 artists to avoid Spotify rate limiting
    // Each artist makes 3-4 API calls (search + albums + tracks batch)
    // 20 artists × 4 calls = ~80 API requests over ~10 seconds = SAFE
    //
    // Strategy: Get MORE tracks from FEWER (but better scored) artists
    // 20 artists × 15 tracks = 300 tracks (plenty of variety)
    //
    // MusicBrainz returns artists sorted by relevance (MBID + era + tags)
    // So we're getting the TOP 20 most relevant artists (e.g., AC/DC, not obscure bands)
    //
    // NOTE: If quality is poor, we can try alternative approaches:
    // - Progressive loading (start with 10, load more on demand)
    // - Use top tracks only (1 less API call per artist)
    // - Increase to 30 artists with longer delays
    if (uniqueArtists.length > 20) {
      return uniqueArtists.slice(0, 20)
    }

    return uniqueArtists
  }

  /**
   * Search MusicBrainz local database for artists by genre + geography
   * Results are scored and sorted by relevance (MBID, era match, tag diversity)
   * Returns array of artists WITH SCORES sorted by score (highest first)
   *
   * IMPORTANT: Scores are preserved for cross-genre sorting in expandWithDiscogsGenres
   */
  async searchMusicBrainzLocal(genre?: string, country?: string, multiCountry?: string[], era?: string): Promise<Array<{ name: string; score: number }>> {
    const artistsWithScores: Array<{ name: string; score: number }> = []

    const countryCode = country ? normaliseCountry(country) : null
    const multiCountryCodes = multiCountry ? multiCountry.map(c => normaliseCountry(c)) : null

    // Build search params
    const buildParams = (cc: string) => {
      const params = new URLSearchParams()
      if (genre) params.append('tag', genre)
      params.append('country', cc)
      if (era) params.append('era', era) // Pass era for scoring
      params.append('limit', '2000') // Very large limit - we want ALL matches scored & sorted by MusicBrainz API
      return params
    }

    try {
      // Search single country or all countries in region
      const countries = countryCode ? [countryCode] : (multiCountryCodes || [])

      for (const cc of countries) {
        const response = await fetch(`/api/musicbrainz/artists/search?${buildParams(cc)}`)

        if (!response.ok) {
          console.warn(`    ⚠️  MusicBrainz search failed for ${cc}: ${response.status}`)
          continue
        }

        const data = await response.json()

        // Results are now scored and sorted by the API!
        // Preserve scores for cross-country sorting
        artistsWithScores.push(...data.results.map((r: { name: string; score: number }) => ({
          name: r.name,
          score: r.score || 0
        })))
      }

      // Sort ALL artists by score (across all countries)
      // This ensures high-scored artists like Fela Kuti aren't buried by country ordering
      artistsWithScores.sort((a, b) => b.score - a.score)

      // Deduplicate while preserving order (highest score wins)
      const seen = new Set<string>()
      const uniqueArtists: Array<{ name: string; score: number }> = []
      for (const artist of artistsWithScores) {
        if (!seen.has(artist.name)) {
          seen.add(artist.name)
          uniqueArtists.push(artist)
        }
      }

      return uniqueArtists

    } catch (error) {
      console.warn(`    ⚠️  MusicBrainz search error:`, error)
      return []
    }
  }

  /**
   * Get artist candidates for GLOBAL searches (no geography filter)
   * Uses Last.fm for popularity-based discovery
   */
  private async getArtistCandidatesGlobal(normalizedGenre?: string): Promise<string[]> {
    const artists: string[] = []

    if (normalizedGenre) {
      try {
        const genreArtists = await this.lastfm.getArtistsByTag(normalizedGenre, 50)
        artists.push(...genreArtists.map(a => a.name))
      } catch (error) {
        console.warn(`  ⚠️  Last.fm tag search failed:`, error)
      }
    }

    // Deduplicate and expand
    let uniqueArtists = Array.from(new Set(artists))
    uniqueArtists = this.expandWithSimilarArtists(uniqueArtists)

    return uniqueArtists
  }

  /**
   * Get regional subgenres for a genre based on geography
   * E.g., "funk" + Africa → ["afrobeat", "afrofunk"]
   */
  private getRegionalSubgenres(genre: string, country?: string, multiCountryRegion?: string[]): string[] {
    if (!this.genreTaxonomy) {
      return []
    }

    const taxonomy = this.genreTaxonomy
    const genreInfo = taxonomy.genres[genre]

    if (!genreInfo || !genreInfo.subgenres.length) {
      return []
    }

    // Determine target countries
    const targetCountries = country
      ? [normaliseCountry(country)]
      : multiCountryRegion?.map(c => normaliseCountry(c)) || []

    if (targetCountries.length === 0) {
      return []
    }

    // Find subgenres that match the target region
    const regionalSubgenres: string[] = []
    for (const subgenre of genreInfo.subgenres) {
      const subgenreInfo = taxonomy.genres[subgenre]
      if (subgenreInfo?.typical_countries) {
        // Check if any target country matches the subgenre's typical countries
        const hasMatch = targetCountries.some(targetCountry =>
          subgenreInfo.typical_countries.includes(targetCountry)
        )
        if (hasMatch) {
          regionalSubgenres.push(subgenre)
        }
      }
    }

    return regionalSubgenres
  }

  /**
   * Normalize genre name using taxonomy
   * Handles aliases like "punk rock" → "punk", "hip-hop" → "hip hop"
   */
  private normalizeGenre(genre: string): string {
    if (!this.genreTaxonomy) {
      return genre
    }

    const taxonomy = this.genreTaxonomy
    const lowerGenre = genre.toLowerCase()

    // Check if it's already a canonical genre
    if (taxonomy.genres[lowerGenre]) {
      return lowerGenre
    }

    // Check all genres for aliases
    for (const [canonicalName, info] of Object.entries(taxonomy.genres)) {
      if (info.aliases.some(alias => alias.toLowerCase() === lowerGenre)) {
        return canonicalName
      }
    }

    // If not found in taxonomy, return original
    return genre
  }

  /**
   * Expand artist pool with similar artists from our database
   * This increases coverage without making additional API calls
   */
  private expandWithSimilarArtists(artists: string[]): string[] {
    if (!this.artistSimilarity) {
      return artists
    }

    const similarity = this.artistSimilarity
    const expanded = new Set<string>(artists)

    // For each artist in our initial pool, add their similar artists
    for (const artist of artists) {
      const similarInfo = similarity.artists[artist]
      if (similarInfo && similarInfo.similar) {
        // Add top 3 similar artists (don't flood with too many)
        similarInfo.similar.slice(0, 3).forEach(similar => expanded.add(similar))
      }
    }

    const addedCount = expanded.size - artists.length
    if (addedCount > 0) {
    }

    return Array.from(expanded)
  }
}
