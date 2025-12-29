/**
 * Track Fetching Strategy
 *
 * Handles all track fetching logic from Spotify:
 * - Sequential artist processing to avoid rate limiting
 * - Artist search and name validation
 * - Era-based or top tracks retrieval
 */

import { SpotifyAdapter } from '../SpotifyAdapter'
import { ParsedQuery } from '../QueryParser'
import { normaliseArtistName, artistNamesMatch } from '../../../utils/stringMatching'

export interface SimplifiedTrack {
  id: string
  name: string
  artist: string
  album: string
  popularity: number
  releaseDate: string
  score: number
  scoreReasons: string[]
}

export class TrackFetchingStrategy {
  private spotify: SpotifyAdapter

  constructor(spotifyAdapter: SpotifyAdapter) {
    this.spotify = spotifyAdapter
  }

  /**
   * Get tracks from artists via Spotify
   * COMPLETELY SEQUENTIAL to avoid rate limiting
   */
  async getTracksFromArtists(
    artistNames: string[],
    query: ParsedQuery
  ): Promise<SimplifiedTrack[]> {
    const allTracks: SimplifiedTrack[] = []

    console.log(`\n🎯 [getTracksFromArtists] Processing ${artistNames.length} artists:`)
    console.log(`   Artists: ${artistNames.join(', ')}`)

    // ULTRA-CONSERVATIVE: Process artists ONE AT A TIME (no parallelism)
    // This is the ONLY way to avoid rate limiting with era-based searches
    // Each artist makes 3-4 API calls, so we process sequentially with 1s delays
    //
    // Performance: 20 artists × 1 second = 20 seconds (acceptable)
    for (let i = 0; i < artistNames.length; i++) {
      const artistName = artistNames[i]
      console.log(`\n[${i + 1}/${artistNames.length}] Processing artist: "${artistName}"`)

      const tracks = await this.getArtistTracks(artistName, query)
      allTracks.push(...tracks)

      // CRITICAL: Wait 1 full second between EACH artist
      // This gives Spotify's API time to recover and prevents 429 errors
      if (i < artistNames.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return allTracks
  }

  /**
   * Get tracks for a single artist
   */
  private async getArtistTracks(
    artistName: string,
    query: ParsedQuery
  ): Promise<SimplifiedTrack[]> {
    try {
      // Search for artist on Spotify (limit 5 to handle ambiguous names)
      console.log(`🔍 [getArtistTracks] Searching Spotify for: "${artistName}"`)
      const searchResults = await this.spotify.searchArtists({ query: artistName, limit: 5 })

      if (searchResults.length === 0) {
        console.warn(`   ❌ NO Spotify results for "${artistName}"`)
        return []
      }

      console.log(`   ✓ Found ${searchResults.length} Spotify results:`, searchResults.map(r => r.name).join(', '))

      // Find best match from top 5 results
      const artist = searchResults[0]
      console.log(`   → Using top result: "${artist.name}" (ID: ${artist.id})`)

      // Validate that the artist name roughly matches what we searched for
      // Spotify's search can return wrong artists (e.g., "The Cure" for "The Clash")
      // IMPORTANT: Normalise both names to handle Unicode variations (hyphens, accents, etc.)
      const searchNormalized = normaliseArtistName(artistName)
      const resultNormalized = normaliseArtistName(artist.name)

      console.log(`   📝 Name validation:`)
      console.log(`      Search normalised: "${searchNormalized}"`)
      console.log(`      Result normalised: "${resultNormalized}"`)

      const hasMatch = artistNamesMatch(artistName, artist.name)
      console.log(`      Has match: ${hasMatch}`)

      if (!hasMatch) {
        console.warn(`   ❌ REJECTED: Name mismatch - "${artistName}" vs "${artist.name}"`)
        return []
      }

      // Get tracks based on whether we have an era filter
      let spotifyTracks: any[]
      if (query.era) {
        // Get tracks from albums released in the target era
        // Increased from 10 to 15 since we're processing fewer artists (20 instead of 50)
        console.log(`   🎵 Fetching tracks from era: ${query.era}`)
        spotifyTracks = await this.spotify.getArtistTracksFromEra(artist.id, query.era, 15)
        console.log(`   → Found ${spotifyTracks.length} tracks from era`)
      } else {
        // Get artist's top tracks (most popular)
        console.log(`   🎵 Fetching top tracks (no era filter)`)
        spotifyTracks = await this.spotify.getArtistTopTracks(artist.id)
        console.log(`   → Found ${spotifyTracks.length} top tracks`)
      }

      // Convert to SimplifiedTrack format
      const tracks: SimplifiedTrack[] = spotifyTracks.map(track => ({
        id: track.id,
        name: track.name,
        artist: artist.name,
        album: track.album?.name || 'Unknown Album',
        popularity: track.popularity || 0,
        releaseDate: track.album?.release_date || '',
        score: 0, // Will be calculated later
        scoreReasons: []
      }))

      console.log(`   ✅ Returning ${tracks.length} tracks for "${artistName}"`)
      return tracks
    } catch (error) {
      console.warn(`  ⚠️  Failed to get tracks for ${artistName}:`, error)
      return []
    }
  }
}
