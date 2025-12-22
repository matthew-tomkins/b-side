import { MusicBrainzApi } from 'musicbrainz-api'

// Initialize MusicBrainz API client with application metadata
const mbApi = new MusicBrainzApi({
  appName: 'b-side',
  appVersion: '0.1.0',
  appContactInfo: 'https://github.com/matthew-tomkins/b-side'
})

// Artist data structure returned by this adapter
export interface MusicBrainzArtist {
  id: string
  name: string
  country?: string
  area?: string
  beginDate?: string
  genres?: string[]
  score?: number
}

// Internal type mapping for MusicBrainz API response structure
interface MBArtistResult {
  id: string
  name: string
  country?: string
  area?: { name: string }
  'life-span'?: { begin?: string }
  tags?: Array<{ name: string; count?: number }>
  score?: number
}

/**
 * Adapter for querying the MusicBrainz database
 * Provides structured artist metadata including geographic and temporal data
 */
export class MusicBrainzAdapter {
  
  /**
   * Search for artists by geographic location
   * Note: Genre filtering via tags is unreliable in MusicBrainz, so genre matching
   * is handled downstream via Last.fm tag enrichment and scoring
   * 
   * @param params.country - Country name for filtering (e.g., "Nigeria", "Japan")
   * @param params.region - Region/city name for filtering (e.g., "Seattle", "Lagos")
   * @param params.limit - Maximum number of results to return (default: 100)
   * @returns Array of artists with metadata
   */
  async searchArtists(params: {
    country?: string
    region?: string
    limit?: number
  }): Promise<MusicBrainzArtist[]> {
    try {
      console.log('MusicBrainz search:', params)
      
      // Build area-based query (most reliable MusicBrainz filter)
      let query = ''
      
      if (params.country) {
        query = `area:"${params.country}"`
      } else if (params.region) {
        query = `area:"${params.region}"`
      }
      
      if (!query) {
        console.log('No area parameter, returning empty')
        return []
      }
      
      console.log('MusicBrainz query string:', query)
      
      // Execute search against MusicBrainz API
      const response = await mbApi.search('artist', {
        query,
        limit: params.limit || 100
      })
      
      console.log('MusicBrainz found', response.artists?.length || 0, 'artists')
      
      if (!response.artists || response.artists.length === 0) {
        return []
      }
      
      // Transform API response to internal format
      const artists: MusicBrainzArtist[] = response.artists.map((artist: MBArtistResult) => ({
        id: artist.id,
        name: artist.name,
        country: artist.country,
        area: artist.area?.name,
        beginDate: artist['life-span']?.begin,
        genres: artist.tags?.map(t => t.name) || [],
        score: artist.score || 0
      }))
      
      return artists
    } catch (err) {
      console.error('MusicBrainz search error:', err)
      return []
    }
  }
  
  /**
   * Extract artist names from MusicBrainz artist objects
   * Utility method for downstream track searching
   * 
   * @param artists - Array of MusicBrainz artist objects
   * @returns Array of artist name strings
   */
  getArtistNames(artists: MusicBrainzArtist[]): string[] {
    return artists.map(a => a.name)
  }
}