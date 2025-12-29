/**
 * Simplified Discovery Engine - Prototype
 *
 * Goal: 90% faster with 85% less code
 * Approach: Last.fm + Spotify only, no MusicBrainz, no Discogs
 *
 * Performance target: < 15 seconds (vs 2+ minutes currently)
 */

import { SpotifyAdapter } from './SpotifyAdapter'
import { LastFmAdapter } from './LastFmAdapter'
import { QueryParser, ParsedQuery } from './QueryParser'
import { genreMapper } from './GenreMapper'
import { normaliseCountry } from '../../utils/countryUtils'
import { decadeToEra } from '../../utils/dateUtils'
import { normaliseArtistName, artistNamesMatch } from '../../utils/stringMatching'
import { deduplicateBy } from '../../utils/arrayUtils'

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

export interface SimplifiedTrack {
  id: string
  name: string
  artist: string
  album: string
  popularity: number
  releaseDate: string
  score: number
  scoreReasons: string[]
}

export class SimplifiedDiscoveryEngine {
  private spotify: SpotifyAdapter
  private lastfm: LastFmAdapter
  private parser: QueryParser
  private musicbrainzCache: Map<string, ArtistGeography> = new Map()
  private genreTaxonomy: GenreTaxonomyData | null = null
  private artistSimilarity: ArtistSimilarityData | null = null
  private configLoaded: boolean = false

  constructor(spotifyAdapter: SpotifyAdapter, lastfmAdapter: LastFmAdapter) {
    this.spotify = spotifyAdapter
    this.lastfm = lastfmAdapter
    this.parser = new QueryParser()
  }

  /**
   * Load config data from server API
   * Call this once before using the engine
   */
  async loadConfig(): Promise<void> {
    if (this.configLoaded) {
      return
    }

    try {
      const [taxonomyRes, similarityRes] = await Promise.all([
        fetch('/api/config/genre-taxonomy'),
        fetch('/api/config/artist-similarity')
      ])

      if (!taxonomyRes.ok || !similarityRes.ok) {
        throw new Error('Failed to load config data from server')
      }

      this.genreTaxonomy = await taxonomyRes.json()
      this.artistSimilarity = await similarityRes.json()
      this.configLoaded = true

      console.log('[SimplifiedEngine] Config data loaded from server')
    } catch (error) {
      console.error('[SimplifiedEngine] Failed to load config:', error)
      throw error
    }
  }

  /**
   * Enrich artists with MusicBrainz data via API
   * This replaces the old static JSON import with server-side API calls
   */
  private async enrichArtistsWithMusicBrainz(artistNames: string[]): Promise<Map<string, ArtistGeography>> {
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
   * Main discovery method - simplified flow
   * Accepts either a parsed query or a raw query string
   */
  async discover(queryInput: ParsedQuery | string, limit: number = 50): Promise<SimplifiedTrack[]> {
    // Parse query if it's a string
    let query = typeof queryInput === 'string'
      ? await this.parser.parse(queryInput)
      : queryInput

    // Convert decade to era if needed (e.g., "2000s" → "2000-2009")
    if (query.decade && !query.era) {
      query = { ...query, era: decadeToEra(query.decade) }
    }

    const startTime = Date.now()

    // Phase 1: Get artist candidates from Last.fm (FAST - one API call)
    const artists = await this.getArtistCandidates(query)

    // Phase 2: Get tracks from Spotify (parallel where possible)
    const tracks = await this.getTracksFromArtists(artists, query)

    // Phase 3: Score and filter
    // Note: Album tracks don't have popularity data, so we use 0 as threshold
    let scored = this.scoreAndFilter(tracks, query, 0)

    // Phase 4: Genre expansion if results are low (niche search detected)
    if (scored.length < 30 && query.genre && (query.country || query.multiCountryRegion)) {
      console.log(`⚠️  Low yield (${scored.length} tracks) - attempting genre expansion via ontology...`)
      const expandedTracks = await this.expandWithDiscogsGenres(query, artists)

      if (expandedTracks.length > 0) {
        // Merge with original results, re-score, and deduplicate
        const allTracks = [...tracks, ...expandedTracks]
        const uniqueTracks = this.deduplicateTracks(allTracks)
        scored = this.scoreAndFilter(uniqueTracks, query, 0)
        console.log(`✅ Genre expansion added ${expandedTracks.length} tracks (total: ${scored.length})`)
      }
    }

    const topTracks = scored.slice(0, limit)
    console.log(`🎉 Discovery complete: ${topTracks.length} tracks from ${artists.length} artists (${Date.now() - startTime}ms)`)

    return topTracks
  }

  /**
   * Phase 1: Get artist candidates
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
  private async getArtistCandidates(query: ParsedQuery): Promise<string[]> {
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
  private async searchMusicBrainzLocal(genre?: string, country?: string, multiCountry?: string[], era?: string): Promise<Array<{ name: string; score: number }>> {
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
   * Expand search using Discogs genre/style data when initial results are low
   * Strategy: Use GenreMapper to aggregate tags from MB + Discogs, find related genres
   *
   * Attribution: Uses Every Noise genre ontology (Glenn McDonald - https://everynoise.com)
   */
  private async expandWithDiscogsGenres(query: ParsedQuery, currentArtists: string[]): Promise<SimplifiedTrack[]> {
    // Enrich current artists to get their Discogs genres/styles + MusicBrainz tags
    const enriched = await this.enrichArtistsWithMusicBrainz(currentArtists)

    // Collect ALL tags from both sources
    const allMBTags: string[] = []
    const allDiscogsTags: string[] = []

    for (const artistData of enriched.values()) {
      if (artistData.tags) allMBTags.push(...artistData.tags)
      if (artistData.discogsStyles) allDiscogsTags.push(...artistData.discogsStyles)
      if (artistData.discogsGenres) allDiscogsTags.push(...artistData.discogsGenres)
    }

    console.log(`   Tag sources: MusicBrainz(${allMBTags.length}), Discogs(${allDiscogsTags.length})`)

    if (allMBTags.length === 0 && allDiscogsTags.length === 0) {
      console.log(`   No tag data available for expansion`)
      return []
    }

    // Use GenreMapper to aggregate and normalize tags
    // Weight: Discogs 2x (more specific), MusicBrainz 1x (broader coverage)
    const aggregated = genreMapper.aggregateTags({
      musicbrainzTags: allMBTags,
      discogsTags: allDiscogsTags,
      weightMB: 1,
      weightDiscogs: 2
    })

    // Filter out the original search genre to avoid duplicate searches
    const originalGenre = query.genre ? genreMapper.mapToCanonical(query.genre) : null
    const relatedGenres = aggregated
      .filter(g => g.genre !== originalGenre)
      .filter(g => g.sources.length >= 1) // At least one source
      .slice(0, 5) // Top 5 related genres

    console.log(`   Top genres by consensus:`, relatedGenres.map(g => `${g.genre}(${g.sources.join('+')}:${g.count})`).join(', '))

    if (relatedGenres.length === 0) {
      console.log(`   No related genres found for expansion`)
      return []
    }

    const relatedTags = relatedGenres.map(g => g.genre).slice(0, 3) // Top 3
    console.log(`   Expanding with: ${relatedTags.join(', ')}`)

    // Search for additional artists using these related tags
    // CRITICAL FIX: Preserve scores to enable cross-genre sorting
    // This ensures Hugh Masekela (afrobeat, score 86) beats Rebel Clef (electronic, score 71)
    const expandedArtistsWithScores: Array<{ name: string; score: number; genre: string }> = []

    for (const tag of relatedTags) {
      try {
        // Use MusicBrainz local search (already filtered by geography!)
        // IMPORTANT: Pass era filter to prioritize artists active in target era
        // This ensures we get Fela Kuti (1980s) instead of modern afrobeat artists
        const mbArtists = await this.searchMusicBrainzLocal(
          tag,
          query.country,
          query.multiCountryRegion,
          query.era // Pass era to boost artists with releases in target timeframe
        )

        // Preserve scores AND track which genre this artist came from
        expandedArtistsWithScores.push(...mbArtists.map(a => ({ ...a, genre: tag })))
        console.log(`   ${tag}: Found ${mbArtists.length} artists, top scores:`,
          mbArtists.slice(0, 3).map(a => `${a.name}(${a.score})`).join(', '))
      } catch (error) {
        console.warn(`   Failed to expand with genre "${tag}":`, error)
      }
    }

    // Sort ALL artists by score ACROSS ALL GENRES
    // This is the FIX: Hugh Masekela (86) now beats Rebel Clef (71) regardless of genre order
    expandedArtistsWithScores.sort((a, b) => b.score - a.score)

    // Remove artists we already searched
    const newArtists = expandedArtistsWithScores.filter(a => !currentArtists.includes(a.name))

    // Deduplicate by name (keep highest score)
    const seen = new Set<string>()
    const uniqueNewArtists: string[] = []
    for (const artist of newArtists) {
      if (!seen.has(artist.name) && uniqueNewArtists.length < 10) {
        seen.add(artist.name)
        uniqueNewArtists.push(artist.name)
      }
    }

    if (uniqueNewArtists.length === 0) {
      console.log(`   No new artists found via genre expansion`)
      return []
    }

    console.log(`   Found ${uniqueNewArtists.length} new artists via CROSS-GENRE SCORE SORTING:`)
    console.log(`   Top 10 by score:`,
      newArtists.slice(0, 10).map(a => `${a.name}(${a.genre}:${a.score})`).join(', '))

    // Get tracks from the new artists
    const expandedTracks = await this.getTracksFromArtists(uniqueNewArtists, query)

    return expandedTracks
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


  /**
   * Phase 2: Get tracks from artists via Spotify
   * COMPLETELY SEQUENTIAL to avoid rate limiting
   */
  private async getTracksFromArtists(
    artistNames: string[],
    query: ParsedQuery
  ): Promise<SimplifiedTrack[]> {
    const allTracks: SimplifiedTrack[] = []

    console.log(`\n🎯 [getTracksFromArtists] Processing ${artistNames.length} artists:`)
    console.log(`   Artists: ${artistNames.join(', ')}`)

    // ULTRA-CONSERVATIVE: Process artists ONE AT A TIME (no parallelism)
    // This is the ONLY way to avoid rate limiting with era-based searches
    // Each artist makes 3-4 API calls, so we process sequentially with 1s delays
    //
    // Performance: 20 artists × 1 second = 20 seconds (acceptable)
    for (let i = 0; i < artistNames.length; i++) {
      const artistName = artistNames[i]
      console.log(`\n[${i + 1}/${artistNames.length}] Processing artist: "${artistName}"`)

      const tracks = await this.getArtistTracks(artistName, query)
      allTracks.push(...tracks)

      // CRITICAL: Wait 1 full second between EACH artist
      // This gives Spotify's API time to recover and prevents 429 errors
      if (i < artistNames.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return allTracks
  }

  /**
   * Get tracks for a single artist
   */
  private async getArtistTracks(
    artistName: string,
    query: ParsedQuery
  ): Promise<SimplifiedTrack[]> {
    try {
      // Search for artist on Spotify (limit 5 to handle ambiguous names)
      console.log(`🔍 [getArtistTracks] Searching Spotify for: "${artistName}"`)
      const searchResults = await this.spotify.searchArtists({ query: artistName, limit: 5 })

      if (searchResults.length === 0) {
        console.warn(`   ❌ NO Spotify results for "${artistName}"`)
        return []
      }

      console.log(`   ✓ Found ${searchResults.length} Spotify results:`, searchResults.map(r => r.name).join(', '))

      // Find best match from top 5 results
      const artist = searchResults[0]
      console.log(`   → Using top result: "${artist.name}" (ID: ${artist.id})`)

      // Validate that the artist name roughly matches what we searched for
      // Spotify's search can return wrong artists (e.g., "The Cure" for "The Clash")
      // IMPORTANT: Normalise both names to handle Unicode variations (hyphens, accents, etc.)
      const searchNormalized = normaliseArtistName(artistName)
      const resultNormalized = normaliseArtistName(artist.name)

      console.log(`   📝 Name validation:`)
      console.log(`      Search normalised: "${searchNormalized}"`)
      console.log(`      Result normalised: "${resultNormalized}"`)

      const hasMatch = artistNamesMatch(artistName, artist.name)
      console.log(`      Has match: ${hasMatch}`)

      if (!hasMatch) {
        console.warn(`   ❌ REJECTED: Name mismatch - "${artistName}" vs "${artist.name}"`)
        return []
      }

      // Get tracks based on whether we have an era filter
      let spotifyTracks: any[]
      if (query.era) {
        // Get tracks from albums released in the target era
        // Increased from 10 to 15 since we're processing fewer artists (20 instead of 50)
        console.log(`   🎵 Fetching tracks from era: ${query.era}`)
        spotifyTracks = await this.spotify.getArtistTracksFromEra(artist.id, query.era, 15)
        console.log(`   → Found ${spotifyTracks.length} tracks from era`)
      } else {
        // Get artist's top tracks (most popular)
        console.log(`   🎵 Fetching top tracks (no era filter)`)
        spotifyTracks = await this.spotify.getArtistTopTracks(artist.id)
        console.log(`   → Found ${spotifyTracks.length} top tracks`)
      }

      // Convert to SimplifiedTrack format
      const tracks: SimplifiedTrack[] = spotifyTracks.map(track => ({
        id: track.id,
        name: track.name,
        artist: artist.name,
        album: track.album?.name || 'Unknown Album',
        popularity: track.popularity || 0,
        releaseDate: track.album?.release_date || '',
        score: 0, // Will be calculated later
        scoreReasons: []
      }))

      console.log(`   ✅ Returning ${tracks.length} tracks for "${artistName}"`)
      return tracks
    } catch (error) {
      console.warn(`  ⚠️  Failed to get tracks for ${artistName}:`, error)
      return []
    }
  }

  /**
   * Phase 3: Score and filter tracks
   * Simple scoring based on query match
   */
  private scoreAndFilter(
    tracks: SimplifiedTrack[],
    query: ParsedQuery,
    minPopularity: number = 25
  ): SimplifiedTrack[] {
    // Parse era for track-level filtering
    const [startYear, endYear] = query.era ? query.era.split('-').map(y => parseInt(y)) : [null, null]

    // Score each track
    const scored = tracks.map(track => {
      let score = 0
      const reasons: string[] = []

      // Era match - filter by track release date (NOT artist birth year)
      // This solves the "solo artist problem" (e.g., Fela Kuti born 1938, but released tracks in 1970s)
      if (query.era && track.releaseDate) {
        const trackYear = parseInt(track.releaseDate.substring(0, 4))
        const eraEnd = endYear || startYear!

        // Check if track was released in the target era
        if (trackYear >= startYear! && trackYear <= eraEnd) {
          score += 40
          reasons.push(`Era: ${query.era} (released ${trackYear})`)
        } else {
          // Track outside era - return null to filter out later
          return null
        }
      } else if (query.era && !track.releaseDate) {
        // No release date available, can't verify era - filter out for strictness
        return null
      } else if (query.era) {
        // Has era but track passed (legacy code path)
        score += 40
        reasons.push(`Era: ${query.era}`)
      }

      // Genre match (we got these from genre tags, so assume match)
      if (query.genre) {
        score += 30
        reasons.push(`Genre: ${query.genre}`)
      }

      // Country/region match (from Last.fm tags)
      if (query.country || query.region || query.multiCountryRegion) {
        score += 30
        reasons.push(`Region: ${query.country || query.region || 'multi-region'}`)
      }

      // Popularity-based quality score (0-30 points)
      // Higher popularity = higher quality signal
      const popularityScore = Math.min(track.popularity / 100 * 30, 30)
      score += popularityScore

      return {
        ...track,
        score,
        scoreReasons: reasons
      }
    }).filter((track): track is SimplifiedTrack => track !== null) // Remove tracks filtered out by era

    // Filter by popularity threshold
    const filtered = scored.filter(track => track.popularity >= minPopularity)

    // Sort by score
    const sorted = filtered.sort((a, b) => b.score - a.score)

    // Deduplicate by track name + artist (keep highest scored)
    const deduped = this.deduplicateTracks(sorted)

    // Apply artist diversity - interleave tracks from different artists
    const diversified = this.applyArtistDiversity(deduped)

    return diversified
  }

  /**
   * Remove duplicate tracks
   */
  private deduplicateTracks(tracks: SimplifiedTrack[]): SimplifiedTrack[] {
    return deduplicateBy(tracks, track =>
      `${track.name.toLowerCase()}|${track.artist.toLowerCase()}`
    )
  }

  /**
   * Apply artist diversity by interleaving tracks from different artists
   * Ensures no artist dominates the results (max 3 tracks per artist in sequence)
   */
  private applyArtistDiversity(tracks: SimplifiedTrack[]): SimplifiedTrack[] {
    // Group tracks by artist
    const tracksByArtist = new Map<string, SimplifiedTrack[]>()

    for (const track of tracks) {
      const artistKey = track.artist.toLowerCase()
      if (!tracksByArtist.has(artistKey)) {
        tracksByArtist.set(artistKey, [])
      }
      tracksByArtist.get(artistKey)!.push(track)
    }

    // Interleave tracks: take 1 track from each artist in rotation
    const result: SimplifiedTrack[] = []
    const maxTracksPerArtist = 3 // Limit per artist in final results
    const artistCounts = new Map<string, number>()

    // Round-robin selection: rotate through artists
    let hasMoreTracks = true
    let roundIndex = 0

    while (hasMoreTracks && result.length < tracks.length) {
      hasMoreTracks = false

      for (const [artistKey, artistTracks] of tracksByArtist) {
        // Skip if this artist has reached their limit
        const currentCount = artistCounts.get(artistKey) || 0
        if (currentCount >= maxTracksPerArtist) {
          continue
        }

        // Get the next track for this artist in this round
        if (roundIndex < artistTracks.length) {
          result.push(artistTracks[roundIndex])
          artistCounts.set(artistKey, currentCount + 1)
          hasMoreTracks = true
        }
      }

      roundIndex++
    }


    return result
  }
}
