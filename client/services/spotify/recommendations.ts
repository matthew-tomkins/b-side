import request from 'superagent'
import { SpotifyTrack } from '../../models/spotify'
import { getAccessToken } from './auth'

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