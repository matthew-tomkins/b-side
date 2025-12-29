import request from 'superagent'
import { getAccessToken } from '../../spotify/auth'
import { SpotifyBaseAdapter, SPOTIFY_API_BASE } from './SpotifyBaseAdapter'
import { SpotifyArtist, Track } from '../types'
import { SpotifyTrack } from '../../../models/spotify'
import { calculateNameSimilarity } from '../../../utils/stringMatching'

interface SpotifyArtistResponse {
  id: string
  name: string
  genres: string[]
  popularity: number
  followers: { total: number }
  images: Array<{ url: string; height: number; width: number }>
}

/**
 * Spotify adapter for artist-related operations
 * Handles artist search, retrieval, albums, and related artists
 */
export class SpotifyArtistsAdapter extends SpotifyBaseAdapter {
  /**
   * Search for artists on Spotify
   */
  async searchArtists(params: {
    query: string
    limit?: number
  }): Promise<SpotifyArtist[]> {
    try {
      // Wrap in retry logic for rate limiting
      const response = await this.retryWithBackoff(async () =>
        request
          .get(`${SPOTIFY_API_BASE}/search`)
          .set(this.getHeaders())
          .query({
            q: params.query,
            type: 'artist',
            limit: params.limit || 20
          })
      )

      return response.body.artists.items.map((artist: SpotifyArtistResponse) => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres || [],
        popularity: artist.popularity,
        followers: artist.followers?.total || 0,
        images: artist.images || []
      }))
    } catch (error) {
      console.error('Spotify artist search error:', error)
      return []
    }
  }

  /**
   * Search for a specific artist by name
   * Used to get Spotify ID for track fetching
   *
   * @param artistName - Exact or close artist name
   * @returns Artist with Spotify ID and genres, or null if not found
   */
  async searchArtistByName(artistName: string): Promise<SpotifyArtist | null> {
    try {
      // Wrap in retry logic for rate limiting
      const response = await this.retryWithBackoff(async () =>
        request
          .get(`${SPOTIFY_API_BASE}/search`)
          .set(this.getHeaders())
          .query({
            q: `artist:"${artistName}"`,
            type: 'artist',
            limit: 10  // Fetch multiple results to find best match
          })
      )

      const artists = response.body.artists.items as SpotifyArtistResponse[]
      if (artists.length === 0) {
        return null
      }

      // Find best matching artist based on name similarity
      let bestMatch: SpotifyArtistResponse | null = null
      let bestScore = 0

      for (const artist of artists) {
        const similarity = calculateNameSimilarity(artistName, artist.name)

        if (similarity > bestScore) {
          bestScore = similarity
          bestMatch = artist
        }
      }

      // Require at least 0.8 similarity to accept a match
      if (!bestMatch || bestScore < 0.8) {
        return null
      }

      const result: SpotifyArtist = {
        id: bestMatch.id,
        name: bestMatch.name,
        genres: bestMatch.genres || [],
        popularity: bestMatch.popularity,
        followers: bestMatch.followers?.total || 0,
        images: bestMatch.images || []
      }

      return result
    } catch (error) {
      console.error(`[Spotify] Error searching for "${artistName}":`, error)
      return null
    }
  }

  /**
   * Get a single artist by Spotify ID
   */
  async getArtist(artistId: string): Promise<SpotifyArtist | null> {
    try {
      const response = await request
        .get(`${SPOTIFY_API_BASE}/artists/${artistId}`)
        .set(this.getHeaders())

      const artist = response.body

      return {
        id: artist.id,
        name: artist.name,
        genres: artist.genres || [],
        popularity: artist.popularity,
        followers: artist.followers?.total || 0,
        images: artist.images || []
      }
    } catch (error) {
      console.error('Spotify get artist error:', error)
      return null
    }
  }

  /**
   * Get albums for a specific artist
   */
  async getArtistAlbums(artistId: string): Promise<Array<{
    id: string
    name: string
    release_date: string
    album_type: string
  }>> {
    try {
      // Wrap in retry logic for rate limiting
      const response = await this.retryWithBackoff(async () => {
        const token = await getAccessToken()
        const res = await fetch(
          `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=50`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (!res.ok) {
          const error = new Error(`Spotify albums API error: ${res.status}`) as Error & { status?: number }
          error.status = res.status
          throw error
        }

        return res
      })

      const data = await response.json()
      return data.items || []
    } catch (error) {
      console.error('Error fetching artist albums:', error)
      return []
    }
  }

  /**
   * Check if an artist has releases in a specific era
   */
  async hasReleasesInEra(artistId: string, era: string): Promise<boolean> {
    try {
      const albums = await this.getArtistAlbums(artistId)

      const [startYear, endYear] = era.split('-').map(y => parseInt(y))

      return albums.some(album => {
        const year = parseInt(album.release_date.split('-')[0])
        return year >= startYear && year <= endYear
      })
    } catch (error) {
      // Spotify API unavailable - return false to fall back to beginDate
      console.warn(`Could not check releases for artist ${artistId}:`, error)
      return false
    }
  }

  /**
   * Get top tracks for a specific artist
   */
  async getArtistTopTracks(artistId: string, market: string = 'US'): Promise<Track[]> {
    try {
      const response = await request
        .get(`${SPOTIFY_API_BASE}/artists/${artistId}/top-tracks`)
        .set(this.getHeaders())
        .query({ market })

      return response.body.tracks.map((track: SpotifyTrack) => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map((a) => ({ id: a.id, name: a.name })),
        album: {
          id: track.album.id,
          name: track.album.name,
          images: track.album.images,
          release_date: track.album.release_date,
          album_type: track.album.album_type
        },
        popularity: track.popularity,
        uri: track.uri
      }))
    } catch (error) {
      console.error(`Spotify get artist top tracks error for ${artistId}:`, error)
      return []
    }
  }

  /**
   * Get related artists from Spotify
   * Uses the official /v1/artists/{id}/related-artists endpoint
   * TOS-compliant: Official Spotify Web API
   */
  async getRelatedArtists(artistId: string): Promise<SpotifyArtist[]> {
    try {
      const response = await request
        .get(`${SPOTIFY_API_BASE}/artists/${artistId}/related-artists`)
        .set(this.getHeaders())

      return response.body.artists.map((artist: SpotifyArtistResponse) => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres || [],
        popularity: artist.popularity || 0
      }))
    } catch (error) {
      console.error(`Spotify get related artists error for ${artistId}:`, error)
      return []
    }
  }
}
