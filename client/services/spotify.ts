import request from 'superagent'
import { SpotifyUser, SpotifyTrack, SpotifyArtist } from '../models/spotify'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

function getAccessToken(): string | null {
  return localStorage.getItem('spotify_access_token')
}

function getAuthHeaders() {
  const token = getAccessToken()
  if (!token) throw new Error('No access token')
  return { Authorization: `Bearer ${token}` }
}

export async function getCurrentUser(): Promise<SpotifyUser> {
  const response = await request  
    .get(`${SPOTIFY_API_BASE}/me`)
    .set(getAuthHeaders())
  
  return response.body
}

export async function getTopTracks(
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
    limit = 20
 ): Promise<{ items: SpotifyTrack[] }> {
  const response = await request
    .get(`${SPOTIFY_API_BASE}/me/top/tracks`)
    .query({ time_range: timeRange, limit })
    .set(getAuthHeaders())

  return response.body
}

export async function getTopArtists(
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
    limit = 20
 ): Promise<{ items: SpotifyArtist[] }> {
  const response = await request
    .get(`${SPOTIFY_API_BASE}/me/top/artists`)
    .query({ time_range: timeRange, limit })
    .set(getAuthHeaders())
  
  return response.body
}

export async function getRecentlyPlayed(
  limit = 50
): Promise<{ items: Array<{ track: SpotifyTrack; played_at: string }> }> {
  const response = await request
    .get(`${SPOTIFY_API_BASE}/me/player/recently-played`)
    .query({ limit })
    .set(getAuthHeaders())
  
  return response.body
}

export async function getSavedTracks(
  limit = 50
): Promise<{ items: Array<{ track: SpotifyTrack; added_at: string }> }> {
  const response = await request
    .get(`${SPOTIFY_API_BASE}/me/tracks`)
    .query({ limit })
    .set(getAuthHeaders())
  
  return response.body
}

export async function getAudioFeatures(
  trackIds: string[]
): Promise<{
    audio_features: Array<{
      id: string
      energy: number
      danceability: number
      valence: number
      tempo: number
      acousticness: number
      instrumentalness: number
      speechiness: number
      }>
  }> {
  const response = await request
    .get(`${SPOTIFY_API_BASE}/audio-features`)
    .query({ ids: trackIds.join(',') })
  
  return response.body
}