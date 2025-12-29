import { describe, it, expect } from 'vitest'
import { TrackScorer } from './TrackScorer'
import { ScoredArtist } from '../ArtistScorer'
import { Track } from '../types'
import { ParsedQuery } from '../QueryParser'

describe('TrackScorer', () => {
  const scorer = new TrackScorer() // No Discogs for basic tests

  // Mock track data
  const mockTrack: Track = {
    id: 'track1',
    name: 'Test Track',
    uri: 'spotify:track:123',
    popularity: 50,
    artists: [{ id: 'artist123', name: 'Test Artist' }],
    album: {
      id: 'album123',
      name: 'Test Album',
      album_type: 'album',
      release_date: '1975-06-15',
      images: []
    }
  }

  describe('Genre Hard Requirement', () => {
    it('should reject track when genre specified but artist has no genre match', async () => {
      const scoredArtist: ScoredArtist = {
        id: 'artist1',
        name: 'KISS',
        country: 'US',
        lastfmTags: ['hard rock', 'glam rock'],
        matchScore: 90, // High score from country + era
        matchReasons: ['Country: US', 'Era: 1970-1979']
      }

      const criteria: ParsedQuery = {
        genre: 'punk',
        country: 'United States',
        era: '1970-1979'
      }

      const result = await scorer.scoreTrack(mockTrack, scoredArtist, criteria)

      expect(result.totalScore).toBe(0)
      expect(result.scoreBreakdown[0]).toContain('REJECTED')
      expect(result.scoreBreakdown[0]).toContain('punk')
    })

    it('should score track normally when genre specified and artist has genre match', async () => {
      const scoredArtist: ScoredArtist = {
        id: 'artist2',
        name: 'Ramones',
        country: 'US',
        lastfmTags: ['punk', 'punk rock'],
        matchScore: 120, // Max score from country + genre + era
        matchReasons: ['Country: US', 'Genre: punk', 'Era: 1970-1979']
      }

      const criteria: ParsedQuery = {
        genre: 'punk',
        country: 'United States',
        era: '1970-1979'
      }

      const result = await scorer.scoreTrack(mockTrack, scoredArtist, criteria)

      expect(result.totalScore).toBeGreaterThan(0)
      expect(result.scoreBreakdown.some((b: string) => b.includes('REJECTED'))).toBe(false)
    })

    it('should score track normally when no genre specified', async () => {
      const scoredArtist: ScoredArtist = {
        id: 'artist3',
        name: 'Beach Boys',
        country: 'US',
        lastfmTags: ['pop', 'surf rock'],
        matchScore: 90, // Country + era only
        matchReasons: ['Country: US', 'Era: 1970-1979']
      }

      const criteria: ParsedQuery = {
        country: 'United States',
        era: '1970-1979'
      }

      const result = await scorer.scoreTrack(mockTrack, scoredArtist, criteria)

      expect(result.totalScore).toBeGreaterThan(0)
      expect(result.scoreBreakdown.some((b: string) => b.includes('REJECTED'))).toBe(false)
    })
  })
})
