import request from 'superagent'
import { SpotifyTrack, SpotifyArtist } from '../../models/spotify'
import { getAuthHeaders } from './auth'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

export async function getRelatedArtists(
  artistId: string
): Promise<{ artists: SpotifyArtist[] }> {
  const response = await request
    .get(`${SPOTIFY_API_BASE}/artists/${artistId}/related-artists`)
    .set(getAuthHeaders())
  
  return response.body
}

export async function getArtistTopTracks(
  artistId: string,
  market: string = 'NZ'
): Promise<{ tracks: SpotifyTrack[] }> {
  const response = await request
    .get(`${SPOTIFY_API_BASE}/artists/${artistId}/top-tracks`)
    .query({ market })
    .set(getAuthHeaders())
  
  return response.body
}