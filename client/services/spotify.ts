import request from 'superagent'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

function getAccessToken(): string | null {
  return localStorage.getItem('spotify_access_token')
}

export async function getCurrentUser() {
  const token = getAccessToken()
  if (!token) throw new Error('No access token')
  
  const response = await request  
    .get(`${SPOTIFY_API_BASE}/me`)
    .set('Authorization', `Bearer ${token}`)
  
  return response.body
}

export async function getTopTracks(timeRange = 'medium_term', limit = 20) {
  const token = getAccessToken()
  if (!token) throw new Error('No access token')

  const response = await request
    .get(`${SPOTIFY_API_BASE}/me/top/tracks`)
    .query({ time_range: timeRange, limit })
    .set('Authorization', `Bearer ${token}`)

  return response.body
}

export async function getTopArtists(timeRange = 'medium_term', limit = 20) {
  const token = getAccessToken()
  if (!token) throw new Error('No access token')

  const response = await request
    .get(`${SPOTIFY_API_BASE}/me/top/artists`)
    .query({ time_range: timeRange, limit })
    .set('Authorization', `Bearer ${token}`)
  
  return response.body
}