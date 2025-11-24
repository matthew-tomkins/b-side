import request from 'superagent'
import { LastFmSimilarTrack, LastFmSimilarArtist, LastFmTrackResponse, LastFmArtistResponse } from '../../models/lastfm'

const LASTFM_API_BASE = 'http://ws.audioscrobbler.com/2.0/'
const API_KEY = import.meta.env.VITE_LASTFM_API_KEY

export class LastFmAdapter {
  // Get similar tracks based on a seed track
  async getSimilarTracks(trackName: string, artistName: string, limit: number = 20): Promise<LastFmSimilarTrack[]> {
    try {
      const response = await request
        .get(LASTFM_API_BASE)
        .query({
          method: 'track.getSimilar',
          artist: artistName,
          track: trackName,
          api_key: API_KEY,
          format: 'json',
          limit
        })

      if(!response.body.similartracks?.track) {
        return []
      }

      const tracks = Array.isArray(response.body.similartracks.track)
        ? response.body.similartracks.track
        : [response.body.similartracks.track]

      return tracks.map((track: LastFmTrackResponse) => ({
        name: track.name,
        artist: track.artist.name,
        mbid: track.mbid
      }))
    } catch (err) {
      console.error('Last.fm getSimilarTracks error:', err)
      return []
    }
  }

  // Get similar artists based on a seed artist
  async getSimilarArtists(artistName: string, limit: number = 10): Promise<LastFmSimilarArtist[]> {
    try {
      const response = await request
        .get(LASTFM_API_BASE)
        .query({
          method: 'artist.getSimilar',
          artist: artistName,
          api_key: API_KEY,
          format: 'json',
          limit
        })
      
      if(!response.body.similarartists?.artist) {
        return []
      }

      const artists = Array.isArray(response.body.similarartists.artist)
        ? response.body.similarartists.artist
        : [response.body.similarartists.artist]

      return artists.map((artist: LastFmArtistResponse) => ({
        name: artist.name,
        mbid: artist.mbid
      }))
    } catch (err) {
      console.error('Last.fm getSimilarArtists error:', err)
      return []
    }
  }

  // Get top tracks for an artist
  async getArtistTopTracks(artistName: string, limit: number = 10): Promise<LastFmSimilarTrack[]> {
    try {
      const response = await request
        .get(LASTFM_API_BASE)
        .query({
          method: 'artist.getTopTracks',
          artist: artistName,
          api_key: API_KEY,
          format: 'json',
          limit
        })

      if(!response.body.toptracks?.track) {
        return []
      }

      const tracks = Array.isArray(response.body.toptracks.track)
        ? response.body.toptracks.track
        : [response.body.toptracks.track]

      return tracks.map((track: LastFmTrackResponse) => ({
        name: track.name,
        artist: track.artist.name,
        mbid: track.mbid
      }))
    } catch (err) {
      console.error('Last.fm getArtistTopTracks error:', err)
      return []
    }
  }
}