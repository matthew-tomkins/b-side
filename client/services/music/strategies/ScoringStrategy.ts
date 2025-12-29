/**
 * Scoring Strategy
 *
 * Handles all track scoring and filtering logic:
 * - Genre expansion via Discogs/MusicBrainz tags
 * - Track scoring based on query match
 * - Deduplication
 * - Artist diversity application
 */

import { ParsedQuery } from '../QueryParser'
import { genreMapper } from '../GenreMapper'
import { deduplicateBy } from '../../../utils/arrayUtils'
import { SimplifiedTrack } from './TrackFetchingStrategy'
import { ArtistSearchStrategy } from './ArtistSearchStrategy'

export class ScoringStrategy {
  private artistSearchStrategy: ArtistSearchStrategy
  private trackFetchingCallback: (artistNames: string[], query: ParsedQuery) => Promise<SimplifiedTrack[]>

  constructor(
    artistSearchStrategy: ArtistSearchStrategy,
    trackFetchingCallback: (artistNames: string[], query: ParsedQuery) => Promise<SimplifiedTrack[]>
  ) {
    this.artistSearchStrategy = artistSearchStrategy
    this.trackFetchingCallback = trackFetchingCallback
  }

  /**
   * Expand search using Discogs genre/style data when initial results are low
   * Strategy: Use GenreMapper to aggregate tags from MB + Discogs, find related genres
   *
   * Attribution: Uses Every Noise genre ontology (Glenn McDonald - https://everynoise.com)
   */
  async expandWithDiscogsGenres(query: ParsedQuery, currentArtists: string[]): Promise<SimplifiedTrack[]> {
    // Enrich current artists to get their Discogs genres/styles + MusicBrainz tags
    const enriched = await this.artistSearchStrategy.enrichArtistsWithMusicBrainz(currentArtists)

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

    // Use GenreMapper to aggregate and normalise tags
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
        const mbArtists = await this.artistSearchStrategy.searchMusicBrainzLocal(
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
    const expandedTracks = await this.trackFetchingCallback(uniqueNewArtists, query)

    return expandedTracks
  }

  /**
   * Score and filter tracks
   * Simple scoring based on query match
   */
  scoreAndFilter(
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
  deduplicateTracks(tracks: SimplifiedTrack[]): SimplifiedTrack[] {
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
