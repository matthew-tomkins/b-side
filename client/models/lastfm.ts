export interface LastFmSimilarTrack {
  name: string
  artist: string
  mbid?: string
}

export interface LastFmSimilarArtist {
  name: string
  mbid?: string
}

export interface LastFmTrackResponse {
  name: string
  mbid: string
  artist: {
    name: string
    mbid: string
  }
}

export interface LastFmArtistResponse {
  name: string
  mbid: string
}