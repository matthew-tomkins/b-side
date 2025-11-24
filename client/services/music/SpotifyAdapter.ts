import request from 'superagent'
import { getAuthHeaders } from '../spotify/auth'
import { MusicPlatform, Track, AudioFeatures, SearchParams } from './types'
import { SpotifyTrack, SpotifyAudioFeatures } from '../../models/spotify'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

export class SpotifyAdapter implements MusicPlatform {
  async searchTracks(params: SearchParams): Promise<Track[]> {
  // Build search query - prioritise explicit query, then genre, then default
    let query = params.query || ''
    
    if (!query && params.genre) {
      query = `genre:"${params.genre}"`
    }
    
    if (!query) {
      query = 'genre:electronic' // Default
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
    // Spotify allows up to 100 track IDs at once
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

    console.log('Recommendations query:', queryParams)

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
}