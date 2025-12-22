export interface ArtistCandidate {
  name: string
  sources: {
    musicbrainz?: MusicBrainzData
    lastfm?: LastFmData
    spotify?: SpotifyData
  }
}

export interface MusicBrainzData {
  id: string
  name: string
  country?: string
  area?: string
  beginDate?: string
  tags?: Array<{ name: string; count: number }>
}

export interface LastFmData {
  name: string
  mbid?: string
  tags: string[]
  listeners: number
  playcount: number
}

export interface SpotifyData {
  id: string
  name: string
  genres: string[]
  popularity: number
  followers: number
}

export interface ArtistPool {
  candidates: ArtistCandidate[]
  sources: {
    musicbrainz: number
    lastfm: number
    spotify: number
  }
}