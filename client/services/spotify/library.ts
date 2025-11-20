import request from 'superagent'
import { SpotifyTrack, SpotifyArtist } from '../../models/spotify'
import { getAuthHeaders } from './auth'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

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
