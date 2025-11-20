import request from 'superagent'
import { AudioFeatures } from '../../models/spotify'
import { getAuthHeaders } from './auth'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

export async function getAudioFeatures(
  trackIds: string[]
): Promise<{ audio_features: AudioFeatures[] }> {
    const response = await request
    .get(`${SPOTIFY_API_BASE}/audio-features`)
    .query({ ids: trackIds.join(',') })
    .set(getAuthHeaders())
  
  return response.body
}