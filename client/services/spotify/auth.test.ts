import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getAccessToken, getAuthHeaders } from './auth'

describe('Spotify Auth Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getAccessToken', () => {
    it('returns null if no token is stored', () => {
      const token = getAccessToken()
      expect(token).toBeNull()
    })

    it('returns the token when one is stored', () => {
        localStorage.setItem('spotify_access_token', 'test_token-123')
        const token = getAccessToken()
        expect(token).toBe('test_token-123')
      })
  })

  describe('getAuthHeaders', () => {
    it('throws an error if no token is exists', () => {
      expect(() => getAuthHeaders()).toThrow('No access token')
    })

    it('returns Authorization header with token', () => {
      localStorage.setItem('spotify_access_token', 'valid_token-456')
      const headers = getAuthHeaders()
      expect(headers).toEqual({ Authorization: 'Bearer valid_token-456' })
    })
  })
})
  
  