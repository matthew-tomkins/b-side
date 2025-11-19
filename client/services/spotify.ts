import request from 'superagent'
import { SpotifyUser, SpotifyTrack, SpotifyArtist, AudioFeatures } from '../models/spotify'

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
): Promise<{ audio_features: AudioFeatures[] }> {
    const response = await request
    .get(`${SPOTIFY_API_BASE}/audio-features`)
    .query({ ids: trackIds.join(',') })
    .set(getAuthHeaders())
  
  return response.body
}

export async function getRecommendations({
  seedArtists,
  seedTracks,
  limit = 20,
  targetPopularity,
}: {
  seedArtists?: string[]
  seedTracks?: string[]
  limit?: number
  targetPopularity?: number
}): Promise<{tracks: SpotifyTrack[] }> {
  const params: Record<string, string | number> = {
    limit,
  }

  if (seedTracks && seedTracks.length > 0) {
    params.seed_tracks = seedTracks.join(',')
  }

  if (seedArtists && seedArtists.length > 0) {
    params.seed_artists = seedArtists.join(',')
  }

  if (targetPopularity !== undefined) {
    params.max_popularity = targetPopularity +20
    params.min_popularity = Math.max(0, targetPopularity - 20)
  }
  
  const token = getAccessToken()
  if (!token) throw new Error('No access token')

  const response = await request
    .get('http://localhost:3000/api/auth/recommendations')
    .query(params)
    .set('Authorization', `Bearer ${token}`)

  return response.body
}