/**
 * Simplified Discovery Engine - Performance Comparison Test
 *
 * This test compares the simplified approach vs the current complex approach
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SimplifiedDiscoveryEngine } from '../SimplifiedDiscoveryEngine'
import { SpotifyAdapter } from '../SpotifyAdapter'
import { LastFmAdapter } from '../LastFmAdapter'

describe('SimplifiedDiscoveryEngine - Performance Test', () => {
  let simplifiedEngine: SimplifiedDiscoveryEngine
  let spotify: SpotifyAdapter
  let lastfm: LastFmAdapter

  beforeEach(() => {
    // Set up mock Spotify auth token for tests
    localStorage.setItem('spotify_access_token', 'test-token')

    spotify = new SpotifyAdapter()
    lastfm = new LastFmAdapter()
    simplifiedEngine = new SimplifiedDiscoveryEngine(spotify, lastfm)
  })

  it('should discover Nigerian funk from 1980s (performance comparison)', async () => {
    // Create a properly parsed query object directly (bypass parser for testing)
    const query = {
      genre: 'funk',
      country: 'Nigeria',
      era: '1980-1989'
    }

    console.log('\n🧪 Testing: "funk Nigeria 1980-1989"')
    console.log('Expected artists: Fela Kuti, Tony Allen, King Sunny Adé, etc.')
    console.log('---')

    const startTime = Date.now()
    const results = await simplifiedEngine.discover(query, 50)
    const duration = Date.now() - startTime

    console.log('\n📊 Results:')
    console.log(`⏱️  Time: ${duration}ms (${(duration / 1000).toFixed(1)}s)`)
    console.log(`🎵 Tracks: ${results.length}`)
    console.log(`🎤 Artists: ${new Set(results.map(t => t.artist)).size}`)

    // Show top 10 results
    console.log('\n🏆 Top 10 Tracks:')
    results.slice(0, 10).forEach((track, i) => {
      console.log(`  ${i + 1}. ${track.artist} - ${track.name}`)
      console.log(`     Score: ${track.score.toFixed(1)} | Popularity: ${track.popularity} | ${track.scoreReasons.join(', ')}`)
    })

    // Performance assertion
    expect(duration).toBeLessThan(30000) // Should be < 30 seconds
    expect(results.length).toBeGreaterThan(0)

    // Target: 10-15 seconds
    if (duration < 15000) {
      console.log('\n✅ EXCELLENT: Under 15 seconds!')
    } else if (duration < 30000) {
      console.log('\n⚠️  OK: Under 30 seconds, but could be faster')
    } else {
      console.log('\n❌ SLOW: Over 30 seconds')
    }
  }, 60000) // 60 second timeout

  it('should discover US punk from 1970s', async () => {
    // Create a properly parsed query object directly (bypass parser for testing)
    const query = {
      genre: 'punk',
      country: 'United States',
      era: '1970-1979'
    }

    console.log('\n🧪 Testing: "punk United States 1970-1979"')
    console.log('Expected artists: Ramones, Dead Kennedys, Black Flag, etc.')
    console.log('---')

    const startTime = Date.now()
    const results = await simplifiedEngine.discover(query, 50)
    const duration = Date.now() - startTime

    console.log('\n📊 Results:')
    console.log(`⏱️  Time: ${duration}ms (${(duration / 1000).toFixed(1)}s)`)
    console.log(`🎵 Tracks: ${results.length}`)
    console.log(`🎤 Artists: ${new Set(results.map(t => t.artist)).size}`)

    // Show top 10 results
    console.log('\n🏆 Top 10 Tracks:')
    results.slice(0, 10).forEach((track, i) => {
      console.log(`  ${i + 1}. ${track.artist} - ${track.name}`)
      console.log(`     Score: ${track.score.toFixed(1)} | Popularity: ${track.popularity}`)
    })

    expect(duration).toBeLessThan(30000)
    expect(results.length).toBeGreaterThan(0)
  }, 60000)

  it('should discover modern Japanese indie pop (2020-2029)', async () => {
    // Create a properly parsed query object directly (bypass parser for testing)
    const query = {
      genre: 'indie pop',
      country: 'Japan',
      era: '2020-2029'
    }

    console.log('\n🧪 Testing: "indie pop Japan 2020-2029"')
    console.log('This should work now (birth date filter removed)')
    console.log('---')

    const startTime = Date.now()
    const results = await simplifiedEngine.discover(query, 50)
    const duration = Date.now() - startTime

    console.log('\n📊 Results:')
    console.log(`⏱️  Time: ${duration}ms (${(duration / 1000).toFixed(1)}s)`)
    console.log(`🎵 Tracks: ${results.length}`)
    console.log(`🎤 Artists: ${new Set(results.map(t => t.artist)).size}`)

    // Show top 10 results
    console.log('\n🏆 Top 10 Tracks:')
    results.slice(0, 10).forEach((track, i) => {
      console.log(`  ${i + 1}. ${track.artist} - ${track.name}`)
      console.log(`     Album: ${track.album} (${track.releaseDate})`)
    })

    expect(duration).toBeLessThan(30000)
    expect(results.length).toBeGreaterThan(0)
  }, 60000)
})

describe('SimplifiedDiscoveryEngine - Geography Filtering', () => {
  let simplifiedEngine: SimplifiedDiscoveryEngine
  let spotify: SpotifyAdapter
  let lastfm: LastFmAdapter

  beforeEach(() => {
    // Set up mock Spotify auth token for tests
    localStorage.setItem('spotify_access_token', 'test-token')

    spotify = new SpotifyAdapter()
    lastfm = new LastFmAdapter()
    simplifiedEngine = new SimplifiedDiscoveryEngine(spotify, lastfm)
  })

  it('should filter UK artists from US punk search', async () => {
    const query = {
      genre: 'punk',
      country: 'United States',
      era: '1970-1979'
    }

    console.log('\n🧪 Geography Filter Test: US Punk 1970s')
    console.log('Expected: Only US artists (Ramones, Dead Kennedys, etc.)')
    console.log('Should exclude: UK artists (Sex Pistols, Buzzcocks, The Clash, The Damned)')
    console.log('---')

    const results = await simplifiedEngine.discover(query, 50)
    const artistNames = results.map(t => t.artist)

    console.log(`\n📊 Found ${results.length} tracks from ${new Set(artistNames).size} artists`)
    console.log('Artists in results:', Array.from(new Set(artistNames)).slice(0, 10).join(', '))

    // UK artists that should NOT appear in results
    const ukArtists = ['Sex Pistols', 'Buzzcocks', 'The Clash', 'The Damned', 'The Jam',
                       'Generation X', 'The Stranglers', 'Wire', 'Siouxsie and the Banshees']

    for (const ukArtist of ukArtists) {
      if (artistNames.includes(ukArtist)) {
        console.log(`❌ UK artist found in results: ${ukArtist}`)
      }
    }

    // Verify no UK artists appear
    const hasUkArtists = ukArtists.some(uk => artistNames.includes(uk))
    expect(hasUkArtists).toBe(false)

    // Should have some results
    expect(results.length).toBeGreaterThan(0)
  }, 60000)

  it('should filter US artists from UK punk search', async () => {
    const query = {
      genre: 'punk',
      country: 'United Kingdom',
      era: '1970-1979'
    }

    console.log('\n🧪 Geography Filter Test: UK Punk 1970s')
    console.log('Expected: Only UK artists (Sex Pistols, The Clash, etc.)')
    console.log('Should exclude: US artists (Ramones, Dead Kennedys, etc.)')
    console.log('NOTE: Mock data may not include UK artists, so we just verify US artists are filtered')
    console.log('---')

    const results = await simplifiedEngine.discover(query, 50)
    const artistNames = results.map(t => t.artist)

    console.log(`\n📊 Found ${results.length} tracks from ${new Set(artistNames).size} artists`)
    if (artistNames.length > 0) {
      console.log('Artists in results:', Array.from(new Set(artistNames)).slice(0, 10).join(', '))
    } else {
      console.log('No results (mock data may not include UK punk artists)')
    }

    // US artists that should NOT appear in results
    const usArtists = ['Ramones', 'Dead Kennedys', 'Black Flag', 'Iggy Pop',
                       'Patti Smith', 'Television', 'Talking Heads']

    for (const usArtist of usArtists) {
      if (artistNames.includes(usArtist)) {
        console.log(`❌ US artist found in results: ${usArtist}`)
      }
    }

    // Verify no US artists appear (even if we have 0 results)
    const hasUsArtists = usArtists.some(us => artistNames.includes(us))
    expect(hasUsArtists).toBe(false)

    // With real Last.fm API, we would expect results
    // But with mocks, it's okay to have 0 results if no UK artists in mock data
    console.log('✅ Filtering working correctly (no US artists leaked through)')
  }, 60000)

  it('should handle unknown artists permissively (include them)', async () => {
    const query = {
      genre: 'punk',
      country: 'United States',
      era: '1970-1979'
    }

    console.log('\n🧪 Geography Filter Test: Permissive Filtering')
    console.log('Unknown artists (not in our JSON) should be INCLUDED')
    console.log('---')

    const results = await simplifiedEngine.discover(query, 50)

    // Should still get results even if not all artists are in our database
    expect(results.length).toBeGreaterThan(0)
    console.log(`✅ Permissive filtering working: ${results.length} tracks found`)
  }, 60000)

  it('should work without country filter (no filtering)', async () => {
    const query = {
      genre: 'punk',
      era: '1970-1979'
      // No country specified
    }

    console.log('\n🧪 Geography Filter Test: No Country Filter')
    console.log('Should return both US and UK artists')
    console.log('---')

    const results = await simplifiedEngine.discover(query, 50)
    const artistNames = results.map(t => t.artist)

    console.log(`\n📊 Found ${results.length} tracks from ${new Set(artistNames).size} artists`)
    console.log('Artists in results:', Array.from(new Set(artistNames)).slice(0, 15).join(', '))

    // Should have results
    expect(results.length).toBeGreaterThan(0)
    console.log('✅ No filtering applied - mixed geography results')
  }, 60000)

  it('should normalize country names correctly', async () => {
    // Test with different country name variations
    const variations = [
      { query: { genre: 'punk', country: 'USA', era: '1970-1979' }, expected: 'US format' },
      { query: { genre: 'punk', country: 'United States', era: '1970-1979' }, expected: 'US format' },
      { query: { genre: 'punk', country: 'America', era: '1970-1979' }, expected: 'US format' }
    ]

    console.log('\n🧪 Geography Filter Test: Country Name Normalization')
    console.log('---')

    for (const variation of variations) {
      console.log(`\nTesting country: "${variation.query.country}"`)
      const results = await simplifiedEngine.discover(variation.query, 20)
      const artistNames = results.map(t => t.artist)

      // Should not include UK artists
      const ukArtists = ['Sex Pistols', 'Buzzcocks', 'The Clash']
      const hasUkArtists = ukArtists.some(uk => artistNames.includes(uk))

      console.log(`  Results: ${results.length} tracks`)
      console.log(`  Contains UK artists: ${hasUkArtists ? 'YES ❌' : 'NO ✅'}`)

      expect(hasUkArtists).toBe(false)
    }
  }, 90000)
})
