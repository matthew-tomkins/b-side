import request from 'superagent'
import { SpotifyUser } from '../../models/spotify'
import { getAuthHeaders } from './auth'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

export async function getCurrentUser(): Promise<SpotifyUser> {
  const response = await request  
    .get(`${SPOTIFY_API_BASE}/me`)
    .set(getAuthHeaders())
  
  return response.body
}