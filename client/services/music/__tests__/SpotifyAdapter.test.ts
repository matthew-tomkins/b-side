import { describe, it, expect, beforeEach } from 'vitest'
import { SpotifyAdapter } from '../SpotifyAdapter'

describe('SpotifyAdapter - Discovery Engine Methods', () => {
  let spotify: SpotifyAdapter

  beforeEach(() => {
    localStorage.setItem('spotify_access_token', 'test-token')
    spotify = new SpotifyAdapter()
  })

  describe('searchArtists', () => {
    it('searches for artists successfully', async () => {
      const artists = await spotify.searchArtists({
        query: 'Fela Kuti',
        limit: 3,
      })

      expect(artists).toHaveLength(2)
      expect(artists[0].name).toBe('Fela Kuti')
      expect(artists[0].genres).toContain('afrobeat')
      expect(artists[0].popularity).toBe(65)
      expect(artists[0].followers).toBe(500000)
    })

    it('returns empty array on error', async () => {
      localStorage.clear()

      const artists = await spotify.searchArtists({
        query: 'test',
        limit: 5,
      })

      expect(artists).toEqual([])
    })
  })

  describe('getArtist', () => {
    it('gets artist details by ID', async () => {
      const artist = await spotify.getArtist('artist-fela')

      expect(artist).not.toBeNull()
      expect(artist?.name).toBe('Fela Kuti')
      expect(artist?.genres).toContain('afrobeat')
      expect(artist?.popularity).toBe(65)
    })

    it('returns null on error', async () => {
      localStorage.clear()

      const artist = await spotify.getArtist('test-id')

      expect(artist).toBeNull()
    })
  })

  describe('getArtistTopTracks', () => {
    it('gets top tracks for an artist', async () => {
      const tracks = await spotify.getArtistTopTracks('artist-ramones')

      expect(tracks).toHaveLength(10)
      expect(tracks[0].name).toBe('Blitzkrieg Bop')
      expect(tracks[0].artists[0].name).toBe('Ramones')
      expect(tracks[0].popularity).toBeGreaterThan(0)
      expect(tracks[0].uri).toBeTruthy()
    })

    it('returns empty array on error', async () => {
      localStorage.clear()

      const tracks = await spotify.getArtistTopTracks('invalid-id')

      expect(tracks).toEqual([])
    })

    it('uses correct market parameter', async () => {
      const tracks = await spotify.getArtistTopTracks('artist-ramones', 'NZ')

      expect(tracks).toHaveLength(10)
      expect(tracks[0].name).toBeTruthy()
    })
  })

  describe('getExtendedAudioFeatures', () => {
    it('gets audio features for a track', async () => {
      const features = await spotify.getExtendedAudioFeatures('track-123')

      expect(features).not.toBeNull()
      expect(features?.danceability).toBe(0.756)
      expect(features?.energy).toBe(0.842)
      expect(features?.valence).toBe(0.678)
      expect(features?.tempo).toBe(118.5)
      expect(features?.acousticness).toBe(0.124)
      expect(features?.instrumentalness).toBe(0.321)
    })

    it('returns null on error', async () => {
      localStorage.clear()

      const features = await spotify.getExtendedAudioFeatures('track-id')

      expect(features).toBeNull()
    })
  })

  describe('getExtendedAudioFeaturesForTracks', () => {
    it('gets audio features for multiple tracks', async () => {
      const features = await spotify.getExtendedAudioFeaturesForTracks([
        'track-1',
        'track-2',
        'track-3',
      ])

      expect(features).toHaveLength(3)
      expect(features[0].danceability).toBeCloseTo(0.7, 2)
      expect(features[1].danceability).toBeCloseTo(0.75, 2)
      expect(features[2].danceability).toBeCloseTo(0.8, 2)
    })

    it('returns empty array for empty input', async () => {
      const features = await spotify.getExtendedAudioFeaturesForTracks([])

      expect(features).toEqual([])
    })

    it('returns empty array on error', async () => {
      localStorage.clear()

      const features = await spotify.getExtendedAudioFeaturesForTracks([
        'track-1',
      ])

      expect(features).toEqual([])
    })
  })

  describe('buildSoundProfile', () => {
    it('builds sound profile from multiple tracks', async () => {
      const profile = await spotify.buildSoundProfile([
        'track-1',
        'track-2',
        'track-3',
      ])

      expect(profile).not.toBeNull()
      expect(profile?.danceability).toBeGreaterThan(0)
      expect(profile?.energy).toBeGreaterThan(0)
      expect(profile?.valence).toBeGreaterThan(0)
      expect(profile?.tempo).toBeGreaterThan(0)
      expect(profile?.acousticness).toBeGreaterThan(0)
      expect(profile?.instrumentalness).toBeGreaterThan(0)
    })

    it('calculates median values correctly', async () => {
      const profile = await spotify.buildSoundProfile([
        'track-1',
        'track-2',
        'track-3',
      ])

      // Middle track should be the median
      expect(profile?.danceability).toBeCloseTo(0.75, 2)
    })

    it('returns null for empty input', async () => {
      const profile = await spotify.buildSoundProfile([])

      expect(profile).toBeNull()
    })

    it('returns null when no features retrieved', async () => {
      localStorage.clear()

      const profile = await spotify.buildSoundProfile(['track-1'])

      expect(profile).toBeNull()
    })
  })
})