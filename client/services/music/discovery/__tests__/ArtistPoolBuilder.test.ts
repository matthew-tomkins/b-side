import { describe, it, expect, beforeEach } from 'vitest'
import { ArtistPoolBuilder } from '../ArtistPoolBuilder'
import { ParsedQuery } from '../../QueryParser'

describe('ArtistPoolBuilder', () => {
  let builder: ArtistPoolBuilder

  beforeEach(() => {
    localStorage.setItem('spotify_access_token', 'test-token')
    builder = new ArtistPoolBuilder()
  })

  describe('buildPool', () => {
    it('builds pool from multiple sources for genre + country query', async () => {
      const query: ParsedQuery = {
        country: 'Nigeria',
        genre: 'funk',
      }

      const pool = await builder.buildPool(query)

      console.log('Pool stats:', {
        totalCandidates: pool.candidates.length,
        sources: pool.sources,
      })

      // Should have artists from multiple sources
      expect(pool.candidates.length).toBeGreaterThan(0)
      expect(pool.sources.musicbrainz).toBeGreaterThan(0)
      expect(pool.sources.spotify).toBeGreaterThan(0)

      // Check that candidates have data from multiple sources
      const multiSourceCandidates = pool.candidates.filter(
        (c) =>
          Object.keys(c.sources).length > 1
      )

      console.log('Multi-source candidates:', multiSourceCandidates.length)
      console.log('Sample candidate:', pool.candidates[0])
    })

    it('builds pool for genre-only query', async () => {
      const query: ParsedQuery = {
        genre: 'indie pop',
      }

      const pool = await builder.buildPool(query)

      console.log('Genre-only pool:', {
        totalCandidates: pool.candidates.length,
        sources: pool.sources,
      })

      // Should have artists from Spotify and Last.fm
      expect(pool.candidates.length).toBeGreaterThan(0)
      expect(pool.sources.spotify).toBeGreaterThan(0)
    })

    it('merges duplicate artists from different sources', async () => {
      const query: ParsedQuery = {
        country: 'Japan',
        genre: 'indie pop',
      }

      const pool = await builder.buildPool(query)

      // Look for artists that appear in multiple sources
      const artistsWithMultipleSources = pool.candidates.filter((c) => {
        const sourceCount = Object.keys(c.sources).length
        return sourceCount > 1
      })

      console.log('Artists in multiple sources:', artistsWithMultipleSources.length)

      if (artistsWithMultipleSources.length > 0) {
        const example = artistsWithMultipleSources[0]
        console.log('Example merged artist:', {
          name: example.name,
          sources: Object.keys(example.sources),
          hasSpotify: !!example.sources.spotify,
          hasMusicBrainz: !!example.sources.musicbrainz,
          hasLastFm: !!example.sources.lastfm,
        })
      }
    })
  })
})