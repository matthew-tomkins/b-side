export interface SpotifyUser {
  display_name: string
  email: string
  id: string
  images: Array<{ url: string }>
}

export interface SpotifyTrack {
  id: string
  name: string
  artists: Array<{ id: string; name: string }>
  album: {
    id: string
    name: string
    images: Array<{ url: string }>
  }
  popularity: number
  uri?: string
}

export interface SpotifyArtist {
  id: string
  name: string
  genres: string[]
  images: Array<{ url: string }>
  popularity: number
}

export interface AudioFeatures {
  id: string
  energy: number
  danceability: number
  valence: number
  tempo: number
  acousticness: number
  instrumentalness: number
  speechiness: number
}