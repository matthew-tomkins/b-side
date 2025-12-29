import request from 'superagent'
import { SpotifyBaseAdapter, SPOTIFY_API_BASE } from './SpotifyBaseAdapter'
import { Track, SearchParams, AudioFeatures } from '../types'
import { SpotifyTrack, SpotifyAudioFeatures } from '../../../models/spotify'

/**
 * Spotify adapter for track-related operations
 * Handles track search, retrieval, and basic audio features
 */
export class SpotifyTracksAdapter extends SpotifyBaseAdapter {
  /**
   * Search for tracks on Spotify
   */
  async searchTracks(params: SearchParams): Promise<Track[]> {
    let query = params.query || ''

    if (!query && params.genre) {
      query = `genre:"${params.genre}"`
    }

    if (!query) {
      query = 'genre:electronic'
    }

    const response = await request
      .get(`${SPOTIFY_API_BASE}/search`)
      .set(this.getHeaders())
      .query({
        q: query,
        type: 'track',
        limit: params.limit || 50
      })

    return response.body.tracks.items.map((track: SpotifyTrack) => ({
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
  }

  /**
   * Get audio features for a single track
   */
  async getAudioFeatures(trackId: string): Promise<AudioFeatures> {
    const response = await request
      .get(`${SPOTIFY_API_BASE}/audio-features/${trackId}`)
      .set(this.getHeaders())

    return {
      bpm: response.body.tempo,
      energy: response.body.energy,
      danceability: response.body.danceability,
      valence: response.body.valence
    }
  }

  /**
   * Get audio features for multiple tracks in batch
   */
  async getBatchAudioFeatures(trackIds: string[]): Promise<AudioFeatures[]> {
    const response = await request
      .get(`${SPOTIFY_API_BASE}/audio-features`)
      .set(this.getHeaders())
      .query({ ids: trackIds.join(',') })

    return response.body.audio_features.map((f: SpotifyAudioFeatures) => ({
      bpm: f.tempo,
      energy: f.energy,
      danceability: f.danceability,
      valence: f.valence
    }))
  }

  /**
   * Get tracks from the user's library
   */
  async getUserLibrary(): Promise<Track[]> {
    const response = await request
      .get(`${SPOTIFY_API_BASE}/me/tracks`)
      .set(this.getHeaders())
      .query({ limit: 50 })

    return response.body.items.map((item: { track: SpotifyTrack }) => ({
      id: item.track.id,
      name: item.track.name,
      artists: item.track.artists.map((a) => ({ id: a.id, name: a.name })),
      album: {
        id: item.track.album.id,
        name: item.track.album.name,
        images: item.track.album.images,
        release_date: item.track.album.release_date,
        album_type: item.track.album.album_type
      },
      popularity: item.track.popularity,
      uri: item.track.uri
    }))
  }

  /**
   * Get user's top tracks
   */
  async getTopTracks(): Promise<Track[]> {
    const response = await request
      .get(`${SPOTIFY_API_BASE}/me/top/tracks`)
      .set(this.getHeaders())
      .query({ limit: 20, time_range: 'medium_term' })

    return response.body.items.map((track: SpotifyTrack) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((a) => ({ id: a.id, name: a.name })),
      album: {
        id: track.album.id,
        name: track.album.name,
        images: track.album.images
      },
      popularity: track.popularity,
      uri: track.uri
    }))
  }

  /**
   * Get track recommendations based on seeds
   */
  async getRecommendations(params: {
    seedTracks?: string[]
    seedArtists?: string[]
    limit?: number
  }): Promise<Track[]> {
    const queryParams: Record<string, string> = {
      limit: String(params.limit || 20)
    }

    if (params.seedTracks && params.seedTracks.length > 0) {
      queryParams.seed_tracks = params.seedTracks.slice(0, 5).join(',')
    }

    if (params.seedArtists && params.seedArtists.length > 0) {
      queryParams.seed_artists = params.seedArtists.slice(0, 5).join(',')
    }

    const response = await request
      .get(`${SPOTIFY_API_BASE}/recommendations`)
      .set(this.getHeaders())
      .query(queryParams)

    return response.body.tracks.map((track: SpotifyTrack) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((a) => ({ id: a.id, name: a.name })),
      album: {
        id: track.album.id,
        name: track.album.name,
        images: track.album.images
      },
      popularity: track.popularity,
      uri: track.uri
    }))
  }

  /**
   * Get tracks from a specific album
   */
  async getAlbumTracks(albumId: string): Promise<Array<{
    id: string
    name: string
    track_number: number
    duration_ms: number
    popularity?: number
  }>> {
    try {
      const response = await request
        .get(`${SPOTIFY_API_BASE}/albums/${albumId}/tracks`)
        .set(this.getHeaders())
        .query({ limit: 50 })

      return response.body.items || []
    } catch (error) {
      console.error(`Error fetching album tracks for ${albumId}:`, error)
      return []
    }
  }

  /**
   * Get tracks from an artist within a specific era
   * Fetches all albums from the era and returns the most popular tracks
   */
  async getArtistTracksFromEra(
    artistId: string,
    era: string,
    limit: number = 10,
    getArtistAlbums: (artistId: string) => Promise<Array<{
      id: string
      name: string
      release_date: string
      album_type: string
    }>>
  ): Promise<Track[]> {
    try {
      // Parse era (e.g., "1970-1979")
      const [startYear, endYear] = era.split('-').map(Number)

      // Get all albums from the artist
      const albums = await getArtistAlbums(artistId)

      // Filter albums by era
      const eraAlbums = albums.filter(album => {
        if (!album.release_date) return false
        const albumYear = parseInt(album.release_date.substring(0, 4))
        return albumYear >= startYear && albumYear <= endYear
      })

      if (eraAlbums.length === 0) {
        return []
      }

      // Get tracks from these albums (prioritise albums, then singles)
      const albumsOnly = eraAlbums.filter(a => a.album_type === 'album')
      const prioritisedAlbums = albumsOnly.length > 0 ? albumsOnly : eraAlbums

      // Fetch tracks from ALL albums to get the best quality tracks
      const tracksPromises = prioritisedAlbums.map(async album => {
        try {
          const response = await request
            .get(`${SPOTIFY_API_BASE}/albums/${album.id}/tracks`)
            .set(this.getHeaders())
            .query({ limit: 50 })

          return response.body.items.map((track: Record<string, unknown>) => ({
            id: track.id as string,
            name: track.name as string,
            artists: (track.artists as Array<{ id: string; name: string }>).map((a) => ({ id: a.id, name: a.name })),
            album: {
              id: album.id,
              name: album.name,
              release_date: album.release_date,
              album_type: album.album_type,
              images: []
            },
            duration_ms: track.duration_ms as number,
            popularity: 0, // Not available from album tracks endpoint
            preview_url: track.preview_url as string | undefined,
            uri: track.uri as string,
            external_urls: track.external_urls as Record<string, string>
          }))
        } catch (error) {
          console.warn(`Failed to fetch tracks from album ${album.name}:`, error)
          return []
        }
      })

      const allTrackIds = (await Promise.all(tracksPromises)).flat()

      if (allTrackIds.length === 0) {
        return []
      }

      // Fetch full track details (including popularity) for ALL track IDs
      // Spotify allows up to 50 tracks per request, so batch them
      const allFullTracks: Track[] = []

      for (let i = 0; i < allTrackIds.length; i += 50) {
        const batch = allTrackIds.slice(i, i + 50)
        const trackIds = batch.map(t => t.id).join(',')

        try {
          const response = await this.retryWithBackoff(async () =>
            request
              .get(`${SPOTIFY_API_BASE}/tracks`)
              .set(this.getHeaders())
              .query({ ids: trackIds })
          )

          const batchTracks = response.body.tracks.filter((t: unknown) => t !== null).map((track: Record<string, unknown>) => ({
            id: track.id as string,
            name: track.name as string,
            artists: (track.artists as Array<{ id: string; name: string }>).map((a) => ({ id: a.id, name: a.name })),
            album: {
              id: (track.album as Record<string, unknown>).id as string,
              name: (track.album as Record<string, unknown>).name as string,
              release_date: (track.album as Record<string, unknown>).release_date as string,
              album_type: (track.album as Record<string, unknown>).album_type as string,
              images: (track.album as Record<string, unknown>).images as Array<{ url: string; height: number; width: number }> || []
            },
            duration_ms: track.duration_ms as number,
            popularity: (track.popularity as number) || 0,
            preview_url: track.preview_url as string | undefined,
            uri: track.uri as string,
            external_urls: track.external_urls as Record<string, string>
          }))

          allFullTracks.push(...batchTracks)
        } catch (error) {
          console.warn(`Failed to fetch full track data batch:`, error)
          // Continue with other batches even if one fails
        }
      }

      // Sort by popularity (highest first) and return top N
      const sortedTracks = allFullTracks.sort((a, b) => b.popularity - a.popularity)
      const topTracks = sortedTracks.slice(0, limit)

      return topTracks
    } catch (error) {
      console.error(`Spotify get artist era tracks error for ${artistId}:`, error)
      return []
    }
  }
}
