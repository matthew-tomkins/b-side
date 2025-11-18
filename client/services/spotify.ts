import request from 'superagent'
import { SpotifyUser, SpotifyTrack, SpotifyArtist } from '../models/spotify'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

function getAccessToken(): string | null {
  return localStorage.getItem('spotify_access_token')
}

export async function getCurrentUser(): Promise<SpotifyUser> {
  const token = getAccessToken()
  if (!token) throw new Error('No access token')
  
  const response = await request  
    .get(`${SPOTIFY_API_BASE}/me`)
    .set('Authorization', `Bearer ${token}`)
  
  return response.body
}

export async function getTopTracks(
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
    limit = 20
 ): Promise<{ items: SpotifyTrack[] }> {
  const token = getAccessToken()
  if (!token) throw new Error('No access token')

  const response = await request
    .get(`${SPOTIFY_API_BASE}/me/top/tracks`)
    .query({ time_range: timeRange, limit })
    .set('Authorization', `Bearer ${token}`)

  return response.body
}

export async function getTopArtists(
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
    limit = 20
 ): Promise<{ items: SpotifyArtist[] }> {
  const token = getAccessToken()
  if (!token) throw new Error('No access token')

  const response = await request
    .get(`${SPOTIFY_API_BASE}/me/top/artists`)
    .query({ time_range: timeRange, limit })
    .set('Authorization', `Bearer ${token}`)
  
  return response.body
}