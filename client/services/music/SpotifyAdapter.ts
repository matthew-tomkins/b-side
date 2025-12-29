import request from 'superagent'
import { getAuthHeaders } from '../spotify/auth'
import { getAccessToken } from '../spotify/auth'
import {
  MusicPlatform,
  Track,
  AudioFeatures,
  SearchParams,
  SpotifyArtist,
  ExtendedAudioFeatures,
  SoundProfile
} from './types'
import { SpotifyTrack, SpotifyAudioFeatures } from '../../models/spotify'
import { calculateNameSimilarity } from '../../utils/stringMatching'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

interface SpotifyArtistResponse {
  id: string
  name: string
  genres: string[]
  popularity: number
  followers: { total: number }
  images: Array<{ url: string; height: number; width: number }>
}

interface SpotifyAudioFeaturesResponse {
  danceability: number
  energy: number
  valence: number
  tempo: number
  acousticness: number
  instrumentalness: number
  speechiness: number
  liveness: number
  loudness: number
  key: number
  mode: number
  time_signature: number
}
export class SpotifyAdapter implements MusicPlatform {
  /**
   * Retry a Spotify API call with exponential backoff on rate limit (429) errors
   * Handles Spotify's rate limiting gracefully
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error: unknown) {
        lastError = error

        // Check if it's a rate limit error (429)
        const is429 = (error as { status?: number })?.status === 429 ||
                      (error as { response?: { status?: number } })?.response?.status === 429 ||
                      ((error as Error)?.message && (error as Error).message.includes('429'))

        if (!is429 || attempt === maxRetries) {
          // Not a rate limit error, or we've exhausted retries
          throw error
        }

        // Calculate exponential backoff delay
        const delay = initialDelay * Math.pow(2, attempt)
        console.warn(`⏳ Spotify rate limit hit (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`)

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

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
      .set(getAuthHeaders())
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

  async getAudioFeatures(trackId: string): Promise<AudioFeatures> {
    const response = await request
      .get(`${SPOTIFY_API_BASE}/audio-features/${trackId}`)
      .set(getAuthHeaders())

    return {
      bpm: response.body.tempo,
      energy: response.body.energy,
      danceability: response.body.danceability,
      valence: response.body.valence
    }
  }

  async getUserLibrary(): Promise<Track[]> {
    const response = await request
      .get(`${SPOTIFY_API_BASE}/me/tracks`)
      .set(getAuthHeaders())
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

  async getTopTracks(): Promise<Track[]> {
    const response = await request
      .get(`${SPOTIFY_API_BASE}/me/top/tracks`)
      .set(getAuthHeaders())
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

  async getBatchAudioFeatures(trackIds: string[]): Promise<AudioFeatures[]> {
    const response = await request
      .get(`${SPOTIFY_API_BASE}/audio-features`)
      .set(getAuthHeaders())
      .query({ ids: trackIds.join(',') })

    return response.body.audio_features.map((f: SpotifyAudioFeatures) => ({
      bpm: f.tempo,
      energy: f.energy,
      danceability: f.danceability,
      valence: f.valence
    }))
  }

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
      .set(getAuthHeaders())
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

  async searchArtists(params: {
    query: string
    limit?: number
  }): Promise<SpotifyArtist[]> {
    try {
      // Wrap in retry logic for rate limiting
      const response = await this.retryWithBackoff(async () =>
        request
          .get(`${SPOTIFY_API_BASE}/search`)
          .set(getAuthHeaders())
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
          .set(getAuthHeaders())
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
        .set(getAuthHeaders())
        .query({ limit: 50 })

      return response.body.items || []
    } catch (error) {
      console.error(`Error fetching album tracks for ${albumId}:`, error)
      return []
    }
  }

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
  
  async getArtist(artistId: string): Promise<SpotifyArtist | null> {
    try {
      const response = await request
        .get(`${SPOTIFY_API_BASE}/artists/${artistId}`)
        .set(getAuthHeaders())

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

  async getArtistTopTracks(artistId: string, market: string = 'US'): Promise<Track[]> {
    try {
      const response = await request
        .get(`${SPOTIFY_API_BASE}/artists/${artistId}/top-tracks`)
        .set(getAuthHeaders())
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
        .set(getAuthHeaders())

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

  async getArtistTracksFromEra(artistId: string, era: string, limit: number = 10): Promise<Track[]> {
    try {
      // Parse era (e.g., "1970-1979")
      const [startYear, endYear] = era.split('-').map(Number)

      // Get all albums from the artist
      const albums = await this.getArtistAlbums(artistId)

      // Filter albums by era
      const eraAlbums = albums.filter(album => {
        if (!album.release_date) return false
        const albumYear = parseInt(album.release_date.substring(0, 4))
        return albumYear >= startYear && albumYear <= endYear
      })

      if (eraAlbums.length === 0) {
        return []
      }

      // Get tracks from these albums (prioritize albums, then singles)
      const albumsOnly = eraAlbums.filter(a => a.album_type === 'album')
      const prioritizedAlbums = albumsOnly.length > 0 ? albumsOnly : eraAlbums

      // OPTIMIZED: Fetch tracks from ALL albums to get the best quality tracks
      // This increases API calls but ensures we get the most popular tracks from the era
      const tracksPromises = prioritizedAlbums.map(async album => {
        try {
          const response = await request
            .get(`${SPOTIFY_API_BASE}/albums/${album.id}/tracks`)
            .set(getAuthHeaders())
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
      // We need to do this because the album tracks endpoint doesn't include popularity
      // Spotify allows up to 50 tracks per request, so we'll batch them
      const allFullTracks: Track[] = []

      for (let i = 0; i < allTrackIds.length; i += 50) {
        const batch = allTrackIds.slice(i, i + 50)
        const trackIds = batch.map(t => t.id).join(',')

        try {
          const response = await this.retryWithBackoff(async () =>
            request
              .get(`${SPOTIFY_API_BASE}/tracks`)
              .set(getAuthHeaders())
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

  async getExtendedAudioFeatures(trackId: string): Promise<ExtendedAudioFeatures | null> {
    try {
      const response = await request
        .get(`${SPOTIFY_API_BASE}/audio-features/${trackId}`)
        .set(getAuthHeaders())

      const f = response.body

      return {
        danceability: f.danceability,
        energy: f.energy,
        valence: f.valence,
        tempo: f.tempo,
        acousticness: f.acousticness,
        instrumentalness: f.instrumentalness,
        speechiness: f.speechiness,
        liveness: f.liveness,
        loudness: f.loudness,
        key: f.key,
        mode: f.mode,
        timeSignature: f.time_signature
      }
    } catch (error) {
      console.error('Spotify extended audio features error:', error)
      return null
    }
  }

  async getExtendedAudioFeaturesForTracks(trackIds: string[]): Promise<ExtendedAudioFeatures[]> {
    if (trackIds.length === 0) return []
    
    try {
      const chunks = []
      for (let i = 0; i < trackIds.length; i += 100) {
        chunks.push(trackIds.slice(i, i + 100))
      }
      
      const allFeatures: ExtendedAudioFeatures[] = []
      
      for (const chunk of chunks) {
        const response = await request
          .get(`${SPOTIFY_API_BASE}/audio-features`)
          .set(getAuthHeaders())
          .query({ ids: chunk.join(',') })
        
        const features = response.body.audio_features
          .filter((f: SpotifyAudioFeaturesResponse | null) => f !== null)
          .map((f: SpotifyAudioFeaturesResponse) => ({
            danceability: f.danceability,
            energy: f.energy,
            valence: f.valence,
            tempo: f.tempo,
            acousticness: f.acousticness,
            instrumentalness: f.instrumentalness,
            speechiness: f.speechiness,
            liveness: f.liveness,
            loudness: f.loudness,
            key: f.key,
            mode: f.mode,
            timeSignature: f.time_signature
          }))
        
        allFeatures.push(...features)
      }
      
      return allFeatures
    } catch (error) {
      console.error('Spotify batch extended audio features error:', error)
      return []
    }
  }

  async buildSoundProfile(trackIds: string[]): Promise<SoundProfile | null> {
    const features = await this.getExtendedAudioFeaturesForTracks(trackIds)
    
    if (features.length === 0) return null
    
    const median = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid]
    }
    
    return {
      danceability: median(features.map(f => f.danceability)),
      energy: median(features.map(f => f.energy)),
      valence: median(features.map(f => f.valence)),
      tempo: median(features.map(f => f.tempo)),
      acousticness: median(features.map(f => f.acousticness)),
      instrumentalness: median(features.map(f => f.instrumentalness))
    }
  }
}