import { describe, it, expect, beforeEach } from 'vitest'
import { getTopTracks, getTopArtists, getRecentlyPlayed, getSavedTracks } from './library'
import { server } from '../../test/mocks/server'
import { http, HttpResponse } from 'msw'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

describe('Spotify Library Service', () => {
  beforeEach(() => {
    // Set a test token
    localStorage.setItem('spotify_access_token', 'test-token')
  })

  describe('getTopTracks', () => {
    it('fetches top tracks successfully', async () => {
      const result = await getTopTracks('medium_term', 20)

      expect(result.items).toHaveLength(2)
      expect(result.items[0].name).toBe('Test Track 1')
      expect(result.items[0].popularity).toBe(75)
      expect(result.items[1].name).toBe('Test Track 2')
      expect(result.items[1].popularity).toBe(30)
    })
  })

  describe('getTopArtists', () => {
    it('fetches top artists successfully', async () => {
      const result = await getTopArtists('long_term', 10)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].name).toBe('Test Artist')
      expect(result.items[0].popularity).toBe(80)
      expect(result.items[0].genres).toContain('rock')
    })
  })

  describe('getRecentlyPlayed', () => {
    it('fetches recently played tracks successfully', async () => {
      const result = await getRecentlyPlayed(50)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].track.name).toBe('Recently Played')
      expect(result.items[0].track.popularity).toBe(50)
      expect(result.items[0].played_at).toBe('2024-11-20T10:00:00Z')
    })
  })

  describe('getSavedTracks', () => {
    it('fetches saved tracks successfully', async () => {
      const result = await getSavedTracks(50)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].track.name).toBe('Saved Track')
      expect(result.items[0].track.popularity).toBe(25)
      expect(result.items[0].added_at).toBe('2024-11-15T12:00:00Z')
    })
  })

  describe('Error Handling', () => {
    it('throws error when token is missing', async () => {
      localStorage.clear()

      await expect(getTopTracks()).rejects.toThrow('No access token')
    })

    it('handles 401 Unauthorized error', async () => {
      server.use(
        http.get(`${SPOTIFY_API_BASE}/me/top/tracks`, () => {
          return HttpResponse.json(
            { error: { status: 401, message: 'Invalid access token' } },
            { status: 401 } 
          )
        })
      )

      await expect(getTopTracks()).rejects.toThrow()
    })

    it('handles 403 Forbidden error', async () => {
      server.use(
        http.get(`${SPOTIFY_API_BASE}/me/tracks`, () => {
          return HttpResponse.json(
            { error: { status: 403, message: 'Forbidden' } },
            { status: 403 } 
          )
        })
      )

      await expect(getSavedTracks()).rejects.toThrow()
    })

    it('handles network errors gracefully', async () => {
      server.use(
        http.get(`${SPOTIFY_API_BASE}/me/top/artists`, () => {
          return HttpResponse.error()
        })
      )

      await expect(getTopArtists()).rejects.toThrow()
    })
  })
})