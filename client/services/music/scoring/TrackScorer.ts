import { Track } from '../types'
import { ParsedQuery } from '../QueryParser'
import { ScoredArtist } from '../ArtistScorer'
import { DiscogsAdapter } from '../DiscogsAdapter'

/**
 * Track with composite scoring from multiple factors
 *
 * Scoring Components:
 * - Artist Score: 0-120 (country + genre + era matching)
 * - Album Score: 0-40 (era accuracy, not compilation)
 * - Track Quality: 0-30 (popularity, audio features)
 * - Source Score: 0-10 (Discogs community rating - future)
 *
 * Total possible: 0-200 points (weighted composite ~0-95 pts)
 * Threshold: 50 points minimum
 */
export interface ScoredTrack extends Track {
  // Component scores
  artistScore: number         // From artist matching (0-120)
  albumScore: number          // Era accuracy, not compilation (0-40)
  trackQualityScore: number   // Popularity, features (0-30)
  sourceScore: number         // Community validation (0-10, future)

  // Composite
  totalScore: number          // Weighted sum of all components
  scoreBreakdown: string[]    // Human-readable score explanation

  // Metadata for debugging/display
  artistName: string          // Primary artist name
  isCompilation: boolean      // Is this from a compilation album?
  albumReleaseYear?: number   // Year album was released
  isPrimaryArtist: boolean    // Is this artist the primary on track?
}

/**
 * Scores individual tracks based on multiple criteria
 *
 * Philosophy: Tracks compete individually, not limited by artist rank
 */
export class TrackScorer {
  private discogs?: DiscogsAdapter

  constructor(discogs?: DiscogsAdapter) {
    this.discogs = discogs
  }

  /**
   * Score a single track against search criteria
   *
   * @param track - The track to score
   * @param scoredArtist - Pre-scored artist data
   * @param criteria - Search criteria (genre, country, era)
   * @returns ScoredTrack with composite score
   */
  async scoreTrack(
    track: Track,
    scoredArtist: ScoredArtist,
    criteria: ParsedQuery
  ): Promise<ScoredTrack> {
    const breakdown: string[] = []

    // HARD REQUIREMENT: If genre specified, artist MUST have genre match
    if (criteria.genre) {
      const hasGenreMatch = scoredArtist.matchReasons.some(reason =>
        reason.startsWith('Genre:') && !reason.includes('FAILED')
      )

      if (!hasGenreMatch) {
        // Reject track entirely - no genre match when genre required
        breakdown.push(`REJECTED: No genre match for "${criteria.genre}"`)
        return this.createRejectedTrack(track, scoredArtist, breakdown)
      }
    }

    // 1. Artist Score (0-120) - Pre-calculated
    const artistScore = scoredArtist.matchScore
    breakdown.push(`Artist: ${artistScore} pts (${scoredArtist.matchReasons.join(', ')})`)

    // 2. Album Score (0-40)
    const albumScore = this.scoreAlbum(track, criteria)
    if (albumScore > 0) {
      breakdown.push(`Album: ${albumScore} pts`)
    }

    // 3. Track Quality Score (0-30)
    const trackQualityScore = this.scoreTrackQuality(track)
    breakdown.push(`Quality: ${trackQualityScore} pts`)

    // 4. Source Score (0-10) - Discogs community rating
    let sourceScore = 0
    if (this.discogs) {
      try {
        const validation = await this.discogs.validateAlbum(
          scoredArtist.name,
          track.album.name,
          criteria.genre
        )

        if (validation.found) {
          sourceScore = validation.sourceScore
          if (sourceScore > 0) {
            breakdown.push(`Discogs: ${sourceScore} pts`)
          }

          // Enhanced genre validation: If Discogs has data and genre doesn't match, reject
          if (criteria.genre && !validation.genreMatch) {
            breakdown.push(`REJECTED: Discogs genre mismatch for "${criteria.genre}"`)
            return this.createRejectedTrack(track, scoredArtist, breakdown)
          }

          // Independent label bonus (adds to source score)
          if (validation.isIndependent) {
            sourceScore = Math.min(sourceScore + 2, 10)
            breakdown.push(`Independent label bonus`)
          }
        }
      } catch (error) {
        console.warn('Discogs validation failed:', error)
        // Continue without Discogs data
      }
    }

    // Calculate weighted total
    // Weights: Artist 50%, Album 25%, Quality 15%, Source 10%
    const totalScore =
      (artistScore * 0.5) +
      (albumScore * 0.25) +
      (trackQualityScore * 0.15) +
      (sourceScore * 0.10)

    // Extract metadata
    const isPrimaryArtist = track.artists[0]?.name === scoredArtist.name
    const isCompilation = track.album.album_type === 'compilation'
    const albumReleaseYear = track.album.release_date
      ? parseInt(track.album.release_date.substring(0, 4))
      : undefined

    return {
      ...track,
      artistScore,
      albumScore,
      trackQualityScore,
      sourceScore,
      totalScore: Math.round(totalScore * 10) / 10, // Round to 1 decimal
      scoreBreakdown: breakdown,
      artistName: scoredArtist.name,
      isCompilation,
      albumReleaseYear,
      isPrimaryArtist
    }
  }

  /**
   * Create a rejected track with zero score
   * Used when hard requirements aren't met (e.g., no genre match)
   */
  private createRejectedTrack(
    track: Track,
    scoredArtist: ScoredArtist,
    breakdown: string[]
  ): ScoredTrack {
    const isPrimaryArtist = track.artists[0]?.name === scoredArtist.name
    const isCompilation = track.album.album_type === 'compilation'
    const albumReleaseYear = track.album.release_date
      ? parseInt(track.album.release_date.substring(0, 4))
      : undefined

    return {
      ...track,
      artistScore: 0,
      albumScore: 0,
      trackQualityScore: 0,
      sourceScore: 0,
      totalScore: 0,
      scoreBreakdown: breakdown,
      artistName: scoredArtist.name,
      isCompilation,
      albumReleaseYear,
      isPrimaryArtist
    }
  }

  /**
   * Score album based on era accuracy and type
   *
   * Scoring:
   * - Released in target era: +30 pts
   * - Not a compilation: +10 pts
   *
   * Max: 40 points
   */
  private scoreAlbum(track: Track, criteria: ParsedQuery): number {
    let score = 0

    // Era accuracy (30 pts)
    if (criteria.era && track.album.release_date) {
      const [startYear, endYear] = criteria.era.split('-').map(Number)
      const albumYear = parseInt(track.album.release_date.substring(0, 4))

      if (albumYear >= startYear && albumYear <= endYear) {
        score += 30
      }
    }

    // Not a compilation (10 pts)
    if (track.album.album_type !== 'compilation') {
      score += 10
    }

    return score
  }

  /**
   * Score track quality based on popularity
   *
   * Scoring:
   * - Popularity 80-100: 30 pts (very popular)
   * - Popularity 60-79: 25 pts (popular)
   * - Popularity 40-59: 20 pts (moderate)
   * - Popularity 20-39: 15 pts (obscure)
   * - Popularity 0-19: 10 pts (very obscure)
   *
   * Max: 30 points
   */
  private scoreTrackQuality(track: Track): number {
    const pop = track.popularity

    if (pop >= 80) return 30
    if (pop >= 60) return 25
    if (pop >= 40) return 20
    if (pop >= 20) return 15
    return 10
  }

  /**
   * Filter and sort tracks by total score
   *
   * @param tracks - Array of scored tracks
   * @param minScore - Minimum score threshold (default: 40, max possible ~75)
   * @returns Filtered and sorted tracks (highest score first)
   */
  filterAndSort(
    tracks: ScoredTrack[],
    minScore: number = 40
  ): ScoredTrack[] {
    return tracks
      .filter(track => track.totalScore >= minScore)
      .sort((a, b) => b.totalScore - a.totalScore)
  }

  /**
   * Get score distribution for debugging
   */
  getScoreDistribution(tracks: ScoredTrack[]): Record<string, number> {
    const distribution = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0,
      '100+': 0
    }

    tracks.forEach(track => {
      const score = track.totalScore
      if (score <= 20) distribution['0-20']++
      else if (score <= 40) distribution['21-40']++
      else if (score <= 60) distribution['41-60']++
      else if (score <= 80) distribution['61-80']++
      else if (score <= 100) distribution['81-100']++
      else distribution['100+']++
    })

    return distribution
  }
}
