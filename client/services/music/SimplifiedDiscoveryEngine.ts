/**
 * Simplified Discovery Engine - Orchestrator
 *
 * Goal: 90% faster with 85% less code
 * Approach: Delegates to focused strategies for artist search, track fetching, and scoring
 *
 * Performance target: < 15 seconds (vs 2+ minutes currently)
 */

import { SpotifyAdapter } from './SpotifyAdapter'
import { LastFmAdapter } from './LastFmAdapter'
import { QueryParser, ParsedQuery } from './QueryParser'
import { decadeToEra } from '../../utils/dateUtils'
import { ArtistSearchStrategy } from './strategies/ArtistSearchStrategy'
import { TrackFetchingStrategy, SimplifiedTrack } from './strategies/TrackFetchingStrategy'
import { ScoringStrategy } from './strategies/ScoringStrategy'

// Re-export SimplifiedTrack for external consumers
export type { SimplifiedTrack } from './strategies/TrackFetchingStrategy'

interface GenreTaxonomyData {
  version: string
  last_updated: string
  source: string
  description: string
  genres: Record<string, any>
}

interface ArtistSimilarityData {
  version: string
  last_updated: string
  source: string
  description: string
  artists: Record<string, any>
}

export class SimplifiedDiscoveryEngine {
  private parser: QueryParser
  private configLoaded: boolean = false
  private genreTaxonomy: GenreTaxonomyData | null = null
  private artistSimilarity: ArtistSimilarityData | null = null

  // Strategy instances
  private artistSearchStrategy: ArtistSearchStrategy
  private trackFetchingStrategy: TrackFetchingStrategy
  private scoringStrategy: ScoringStrategy

  constructor(spotifyAdapter: SpotifyAdapter, lastfmAdapter: LastFmAdapter) {
    this.parser = new QueryParser()

    // Initialize strategies
    this.artistSearchStrategy = new ArtistSearchStrategy(
      lastfmAdapter,
      this.genreTaxonomy,
      this.artistSimilarity
    )

    this.trackFetchingStrategy = new TrackFetchingStrategy(spotifyAdapter)

    // ScoringStrategy needs callbacks to artist search and track fetching
    this.scoringStrategy = new ScoringStrategy(
      this.artistSearchStrategy,
      (artistNames: string[], query: ParsedQuery) =>
        this.trackFetchingStrategy.getTracksFromArtists(artistNames, query)
    )
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

      // Update strategies with config data
      this.artistSearchStrategy.updateConfig(this.genreTaxonomy, this.artistSimilarity)

      console.log('[SimplifiedEngine] Config data loaded from server')
    } catch (error) {
      console.error('[SimplifiedEngine] Failed to load config:', error)
      throw error
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

    // Phase 1: Get artist candidates (delegated to ArtistSearchStrategy)
    const artists = await this.artistSearchStrategy.getArtistCandidates(query)

    // Phase 2: Get tracks from Spotify (delegated to TrackFetchingStrategy)
    const tracks = await this.trackFetchingStrategy.getTracksFromArtists(artists, query)

    // Phase 3: Score and filter (delegated to ScoringStrategy)
    // Note: Album tracks don't have popularity data, so we use 0 as threshold
    let scored = this.scoringStrategy.scoreAndFilter(tracks, query, 0)

    // Phase 4: Genre expansion if results are low (niche search detected)
    if (scored.length < 30 && query.genre && (query.country || query.multiCountryRegion)) {
      console.log(`⚠️  Low yield (${scored.length} tracks) - attempting genre expansion via ontology...`)
      const expandedTracks = await this.scoringStrategy.expandWithDiscogsGenres(query, artists)

      if (expandedTracks.length > 0) {
        // Merge with original results, re-score, and deduplicate
        const allTracks = [...tracks, ...expandedTracks]
        const uniqueTracks = this.scoringStrategy.deduplicateTracks(allTracks)
        scored = this.scoringStrategy.scoreAndFilter(uniqueTracks, query, 0)
        console.log(`✅ Genre expansion added ${expandedTracks.length} tracks (total: ${scored.length})`)
      }
    }

    const topTracks = scored.slice(0, limit)
    console.log(`🎉 Discovery complete: ${topTracks.length} tracks from ${artists.length} artists (${Date.now() - startTime}ms)`)

    return topTracks
  }
}
