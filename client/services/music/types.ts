export interface Track {
  id: string
  name: string
  artists: Array<{ id: string; name: string }>
  album: {
    id: string
    name: string
    images: Array<{ url: string }>
    release_date?: string      // YYYY-MM-DD or YYYY
    album_type?: string         // 'album' | 'single' | 'compilation'
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
  popularity?: { max: number }
  limit?: number
}

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

export interface SpotifyArtist {
  id: string
  name: string
  genres: string[]
  popularity: number
  followers: number
  images: Array<{ url: string; height: number; width: number }>
}

// Extended audio features from Spotify API
export interface ExtendedAudioFeatures {
  danceability: number      // 0-1
  energy: number            // 0-1
  valence: number           // 0-1: happiness/positivity
  tempo: number             // BPM
  acousticness: number      // 0-1
  instrumentalness: number  // 0-1
  speechiness: number       // 0-1
  liveness: number          // 0-1
  loudness: number          // dB
  key: number               // 0-11: pitch class
  mode: number              // 0=minor, 1=major
  timeSignature: number     // beats per bar
}

// Median audio characteristics for genre/artist matching
export interface SoundProfile {
  danceability: number
  energy: number
  valence: number
  tempo: number
  acousticness: number
  instrumentalness: number
}