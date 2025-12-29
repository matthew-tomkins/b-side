import { MusicBrainzArtist } from './MusicBrainzAdapter'
import { ParsedQuery } from './QueryParser'
import { countryCodeMatchesAny } from './CountryCodeMapper'
import { getGenreScore } from './genres'
import { SpotifyAdapter } from './SpotifyAdapter'

export interface ScoredArtist extends MusicBrainzArtist {
  lastfmTags: string[]
  matchScore: number
  matchReasons: string[]
}

export class ArtistScorer {
  private spotify?: SpotifyAdapter

  constructor(spotify?: SpotifyAdapter) {
    this.spotify = spotify
  }
  
  // Score artist based on search criteria
  // Country/Region: 50 points, Genre: 10-30 points (variable), Era: 40 points
  async scoreArtist(
    artist: MusicBrainzArtist,
    lastfmTags: string[],
    criteria: ParsedQuery,
    spotifyId?: string
  ): Promise<ScoredArtist> {
    let score = 0
    const reasons: string[] = []
    
    // Country/Region match using proper country code mapping
    if (criteria.country && artist.country) {
      if (countryCodeMatchesAny(artist.country, [criteria.country])) {
        score += 50
        reasons.push(`Country: ${artist.country}`)
      }
    } else if (criteria.region && artist.area?.includes(criteria.region)) {
      score += 50
      reasons.push(`Region: ${artist.area}`)
    } else if (criteria.multiCountryRegion && criteria.multiCountryRegion.length > 0 && artist.country) {
      if (countryCodeMatchesAny(artist.country, criteria.multiCountryRegion)) {
        score += 50
        reasons.push(`Country: ${artist.country}`)
      }
    }
    
    // Genre match with smart relationship scoring
    if (criteria.genre) {
      const genreMatch = this.checkGenreMatch(lastfmTags, criteria.genre)
      if (genreMatch.score > 0) {
        score += genreMatch.score
        reasons.push(`Genre: ${genreMatch.matchedTag}`)
      }
    }
    
    // Check era match (prefer release dates over begin dates)
    if (criteria.era) {
      let eraMatched = false
      let eraValidationAttempted = false

      // First priority: Spotify release dates (most accurate)
      if (this.spotify && spotifyId) {
        eraValidationAttempted = true
        eraMatched = await this.checkEraMatchByReleases(spotifyId, criteria.era)
      }

      // Second priority: Formation dates that look reliable
      if (!eraMatched && artist.beginDate) {
        eraValidationAttempted = true
        eraMatched = this.checkFormationDateMatch(artist, criteria.era)
      }

      if (eraMatched) {
        score += 40
        reasons.push(`Era: ${criteria.era}`)
      } else if (eraValidationAttempted) {
        // Track that era validation was attempted but failed
        reasons.push(`Era: FAILED ${criteria.era}`)
      }
    }
    
    return {
      ...artist,
      lastfmTags,
      matchScore: score,
      matchReasons: reasons
    }
  }
  
  // Check if artist's tags match the search genre using relationship graph
  private checkGenreMatch(
    artistTags: string[],
    searchGenre: string
  ): { score: number; matchedTag?: string } {
    let bestScore = 0
    let bestTag: string | undefined
    
    // Check each artist tag against the search genre
    for (const tag of artistTags) {
      const score = getGenreScore(tag, searchGenre)
      if (score > bestScore) {
        bestScore = score
        bestTag = tag
      }
    }

    // No fallback bonus for genre searches
    // If artist doesn't match the genre, they get 0 points (genre is required)

    return {
      score: bestScore,
      matchedTag: bestTag
    }
  }
  
  // Check if artist has releases in the era (async, uses Spotify)
  private async checkEraMatchByReleases(artistId: string, era: string): Promise<boolean> {
    // Guard against undefined spotify
    if (!this.spotify) {
      console.warn('Spotify not available for release date checking')
      return false
    }
    
    try {
      return await this.spotify.hasReleasesInEra(artistId, era)
    } catch (error) {
      console.warn('Release date check failed, using beginDate fallback')
      return false
    }
  }
  
  // Check formation date match (fallback when Spotify unavailable)
  // Note: This is a simple check - we rely on Spotify release dates for accuracy
  private checkFormationDateMatch(artist: MusicBrainzArtist, era: string): boolean {
    if (!artist.beginDate) return false

    try {
      const artistYear = parseInt(artist.beginDate.substring(0, 4))
      const [startYear, endYear] = era.split('-').map(y => parseInt(y))

      // Use a generous 20-year window before era start
      // This allows artists who formed earlier to still be included if they released in the era
      const windowStart = startYear - 20

      console.log(`🔍 Era check for ${artist.name}:`, {
        beginDate: artist.beginDate,
        artistYear,
        era: `${startYear}-${endYear}`,
        windowStart
      })

      // Simple check: artist must have existed during or before the era
      // We don't reject based on gaps - Spotify release date check is authoritative
      const passes = artistYear >= windowStart && artistYear <= (endYear || startYear)
      console.log(`  ${passes ? '✅ ACCEPTED' : '❌ REJECTED'}: Within window check`)
      return passes
    } catch (error) {
      console.log(`  ❌ ERROR parsing date`)
      return false
    }
  }
  
  // Filter and sort artists by score
  filterAndSort(
    scoredArtists: ScoredArtist[],
    minScore: number = 70
  ): ScoredArtist[] {
    return scoredArtists
      .filter(artist => artist.matchScore >= minScore)
      .sort((a, b) => b.matchScore - a.matchScore)
  }
}