import request from 'superagent'
import { SpotifyBaseAdapter, SPOTIFY_API_BASE } from './SpotifyBaseAdapter'
import { ExtendedAudioFeatures, SoundProfile } from '../types'

interface SpotifyAudioFeaturesResponse {
  danceability: number
  energy: number
  valence: number
  tempo: number
  acousticness: number
  instrumentalness: number
  speechiness: number
  liveness: number
  loudness: number
  key: number
  mode: number
  time_signature: number
}

/**
 * Spotify adapter for extended audio features
 * Handles detailed audio analysis and sound profiles
 */
export class SpotifyAudioFeaturesAdapter extends SpotifyBaseAdapter {
  /**
   * Get extended audio features for a single track
   */
  async getExtendedAudioFeatures(trackId: string): Promise<ExtendedAudioFeatures | null> {
    try {
      const response = await request
        .get(`${SPOTIFY_API_BASE}/audio-features/${trackId}`)
        .set(this.getHeaders())

      const f = response.body

      return {
        danceability: f.danceability,
        energy: f.energy,
        valence: f.valence,
        tempo: f.tempo,
        acousticness: f.acousticness,
        instrumentalness: f.instrumentalness,
        speechiness: f.speechiness,
        liveness: f.liveness,
        loudness: f.loudness,
        key: f.key,
        mode: f.mode,
        timeSignature: f.time_signature
      }
    } catch (error) {
      console.error('Spotify extended audio features error:', error)
      return null
    }
  }

  /**
   * Get extended audio features for multiple tracks
   */
  async getExtendedAudioFeaturesForTracks(trackIds: string[]): Promise<ExtendedAudioFeatures[]> {
    if (trackIds.length === 0) return []

    try {
      const chunks = []
      for (let i = 0; i < trackIds.length; i += 100) {
        chunks.push(trackIds.slice(i, i + 100))
      }

      const allFeatures: ExtendedAudioFeatures[] = []

      for (const chunk of chunks) {
        const response = await request
          .get(`${SPOTIFY_API_BASE}/audio-features`)
          .set(this.getHeaders())
          .query({ ids: chunk.join(',') })

        const features = response.body.audio_features
          .filter((f: SpotifyAudioFeaturesResponse | null) => f !== null)
          .map((f: SpotifyAudioFeaturesResponse) => ({
            danceability: f.danceability,
            energy: f.energy,
            valence: f.valence,
            tempo: f.tempo,
            acousticness: f.acousticness,
            instrumentalness: f.instrumentalness,
            speechiness: f.speechiness,
            liveness: f.liveness,
            loudness: f.loudness,
            key: f.key,
            mode: f.mode,
            timeSignature: f.time_signature
          }))

        allFeatures.push(...features)
      }

      return allFeatures
    } catch (error) {
      console.error('Spotify batch extended audio features error:', error)
      return []
    }
  }

  /**
   * Build a sound profile from multiple tracks
   * Calculates median values for key audio features
   */
  async buildSoundProfile(trackIds: string[]): Promise<SoundProfile | null> {
    const features = await this.getExtendedAudioFeaturesForTracks(trackIds)

    if (features.length === 0) return null

    const median = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid]
    }

    return {
      danceability: median(features.map(f => f.danceability)),
      energy: median(features.map(f => f.energy)),
      valence: median(features.map(f => f.valence)),
      tempo: median(features.map(f => f.tempo)),
      acousticness: median(features.map(f => f.acousticness)),
      instrumentalness: median(features.map(f => f.instrumentalness))
    }
  }
}
