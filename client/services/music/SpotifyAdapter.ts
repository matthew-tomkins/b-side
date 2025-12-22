import request from 'superagent'
import { getAuthHeaders } from '../spotify/auth'
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
        images: track.album.images
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
        images: item.track.album.images
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

  // NEW (20-05-2025) METHODS FOR DISCOVERY ENGINE

  async searchArtists(params: {
    query: string
    limit?: number
  }): Promise<SpotifyArtist[]> {
    try {
      const response = await request
        .get(`${SPOTIFY_API_BASE}/search`)
        .set(getAuthHeaders())
        .query({
          q: params.query,
          type: 'artist',
          limit: params.limit || 20
        })

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