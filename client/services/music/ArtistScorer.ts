import { MusicBrainzArtist } from './MusicBrainzAdapter'
import { ParsedQuery } from './QueryParser'
import { countryCodeMatchesAny } from './CountryCodeMapper'
import { getGenreScore } from './genres'  // NEW IMPORT

export interface ScoredArtist extends MusicBrainzArtist {
  lastfmTags: string[]
  matchScore: number
  matchReasons: string[]
}

export class ArtistScorer {
  
  // Score artist based on search criteria
  // Country/Region: 50 points, Genre: 10-30 points (variable), Era: 40 points
  scoreArtist(
    artist: MusicBrainzArtist,
    lastfmTags: string[],
    criteria: ParsedQuery
  ): ScoredArtist {
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
    
    // Era match via begin date
    if (criteria.era && artist.beginDate) {
      const eraMatch = this.checkEraMatch(artist.beginDate, criteria.era)
      if (eraMatch) {
        score += 40
        reasons.push(`Era: ${criteria.era}`)
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
    
    // Partial credit: If no genre match but artist has substantial tags
    // (filters out non-musical entities like "Nintendo")
    if (bestScore === 0 && artistTags.length >= 3) {
      bestScore = 10
      bestTag = `active artist (${artistTags.length} tags)`
    }
    
    return {
      score: bestScore,
      matchedTag: bestTag
    }
  }
  
  private checkEraMatch(beginDate: string, era: string): boolean {
    try {
      const artistYear = parseInt(beginDate.substring(0, 4))
      const [startYear, endYear] = era.split('-').map(y => parseInt(y))
      
      // Accept if artist began within 15 years before the era start
      // OR during the era itself
      // This catches bands that formed earlier but were active during the period
      // Example: Grateful Dead (1965) active in 1970s, but filters out artists from way before (Louis Armstrong 1901) 
      const windowStart = startYear - 10
      
      return artistYear >= windowStart && artistYear <= (endYear || startYear)
    } catch {
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