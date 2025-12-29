export interface ArtistCandidate {
  name: string
  country?: string
  beginDate?: string
  area?: string
  spotifyId?: string
  tags: string[]
  sources: {
    primary: string
    musicbrainz: boolean
    spotify: boolean
  }
}

// Legacy interface for backwards compatibility
export interface LegacyArtistCandidate {
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
    primary: number
    enriched: number
    total: number
  }
}