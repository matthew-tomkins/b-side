import request from 'superagent'
import { getAuthHeaders } from './auth'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

export async function createPlaylist(
  userId: string,
  name: string,
  description?: string,
  isPublic: boolean = true
): Promise<{ id: string; external_urls: { spotify: string } }> {
  const response = await request
    .post(`${SPOTIFY_API_BASE}/users/${userId}/playlists`)
    .set(getAuthHeaders())
    .send({
      name,
      description,
      public: isPublic
    })
    
  return response.body
}

export async function addTracksToPlaylist(
  playlistId: string,
  trackUris: string[]
): Promise<{ snapshot_id: string }> {
  const response = await request
    .post(`${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks`)
    .set(getAuthHeaders())
    .send({
      uris: trackUris
    })
  
  return response.body
}