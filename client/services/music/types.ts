export interface Track {
  id: string
  name: string
  artists: Array<{ id: string; name: string }>
  album: {
    id: string
    name: string
    images: Array<{ url: string; }>
  }
  popularity: number
  uri?: string
}

export interface AudioFeatures {
  bpm: number
  energy: number
  danceability: number
  valence: number
}

export interface SearchParams {
  genre?: string
  query?: string
  bpm?: { min: number; max: number }
  energy?: { min: number; max: number }
  popularity?: {max: number }
  limit?: number
}

// Platform interface - any music service must implement this
export interface MusicPlatform {
  searchTracks(params: SearchParams): Promise<Track[]>
  getAudioFeatures(trackId: string): Promise<AudioFeatures>
  getBatchAudioFeatures(trackIds: string[]): Promise<AudioFeatures[]>
  getUserLibrary(): Promise<Track[]>
  getTopTracks(): Promise<Track[]>
  getRecommendations(params: {
    seedTracks?: string[]
    seedArtists?: string[]
    limit?: number
  }): Promise<Track[]>  
}

export interface TasteProfile {
  avgBPM: number
  avgEnergy: number
  avgDanceability: number
  genres: string[]
}