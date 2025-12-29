/**
 * Build Artist Similarity Data Script
 *
 * Fetches artist similarity data from Spotify's Related Artists API
 * and updates artist-similarity.json
 *
 * Usage:
 *   SPOTIFY_TOKEN=your_token npm run build-similarity-data
 *
 * TOS Compliance:
 *   - Uses official Spotify Web API (100% compliant)
 *   - Uses /v1/artists/{id}/related-artists endpoint
 *   - Respects Spotify rate limits (~100 req/30s)
 *   - Requires valid OAuth token
 */

import { SpotifyAdapter } from '../client/services/music/SpotifyAdapter'
import * as fs from 'fs'
import * as path from 'path'

// File paths
const DATA_DIR = path.join(__dirname, '../client/data')
const GEOGRAPHY_FILE = path.join(DATA_DIR, 'artist-geography.json')
const OUTPUT_FILE = path.join(DATA_DIR, 'artist-similarity.json')

// Rate limiting configuration (Spotify allows ~100 req/30s, we'll be conservative)
const RATE_LIMIT_MS = 500 // 2 requests per second

// Sleep helper for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface ArtistSimilarityInfo {
  similar: string[]
  genre?: string
  influence_score?: number
  spotify_id?: string
}

interface SimilarityData {
  version: string
  last_updated: string
  source: string
  description: string
  artists: Record<string, ArtistSimilarityInfo>
}

interface GeographyData {
  artists: Record<string, { country: string; city?: string }>
}

/**
 * Load existing similarity data if available
 */
function loadExistingData(): SimilarityData {
  if (fs.existsSync(OUTPUT_FILE)) {
    console.log('📂 Loading existing similarity data...')
    const content = fs.readFileSync(OUTPUT_FILE, 'utf-8')
    return JSON.parse(content)
  }

  console.log('📂 No existing data found, starting fresh')
  return {
    version: '1.0',
    last_updated: new Date().toISOString().split('T')[0],
    source: 'Spotify Related Artists API',
    description: 'Artist similarity relationships for discovery and expansion',
    artists: {}
  }
}

/**
 * Load geography data to get seed artists
 */
function loadGeographyData(): string[] {
  if (!fs.existsSync(GEOGRAPHY_FILE)) {
    console.log('⚠️  No geography data found, using empty seed list')
    return []
  }

  const content = fs.readFileSync(GEOGRAPHY_FILE, 'utf-8')
  const data: GeographyData = JSON.parse(content)
  return Object.keys(data.artists)
}

/**
 * Save similarity data to JSON file
 */
function saveData(data: SimilarityData): void {
  // Update timestamp
  data.last_updated = new Date().toISOString().split('T')[0]

  // Ensure directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  // Write with pretty formatting
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2))
  console.log(`\n✅ Saved to ${OUTPUT_FILE}`)
}

/**
 * Fetch similarity data for a single artist from Spotify
 */
async function fetchArtistSimilarity(
  spotify: SpotifyAdapter,
  artistName: string
): Promise<ArtistSimilarityInfo | null> {
  try {
    // 1. Search for artist on Spotify
    const searchResults = await spotify.searchArtists({ query: artistName, limit: 1 })

    if (!searchResults || searchResults.length === 0) {
      console.log(`   ⚠️  Not found on Spotify`)
      return null
    }

    const artist = searchResults[0]
    console.log(`   🎵 Found: ${artist.name} (ID: ${artist.id})`)

    // 2. Get related artists
    const relatedArtists = await spotify.getRelatedArtists(artist.id)

    if (!relatedArtists || relatedArtists.length === 0) {
      console.log(`   ⚠️  No related artists found`)
      return {
        similar: [],
        spotify_id: artist.id,
        genre: artist.genres?.[0]
      }
    }

    console.log(`   ✓ Found ${relatedArtists.length} related artists`)

    return {
      similar: relatedArtists.map(a => a.name),
      genre: artist.genres?.[0],
      influence_score: artist.popularity || 50,
      spotify_id: artist.id
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error}`)
    return null
  }
}

/**
 * Main function to build similarity data
 */
async function buildSimilarityData(artistNames: string[]): Promise<void> {
  console.log('🚀 Building Artist Similarity Data')
  console.log(`📋 Processing ${artistNames.length} artists`)
  console.log(`⏱️  Rate limit: ${RATE_LIMIT_MS}ms between requests`)
  console.log(`⏱️  Estimated time: ~${Math.ceil(artistNames.length * RATE_LIMIT_MS / 1000 / 60)} minutes\n`)

  // Check for Spotify token
  const token = process.env.SPOTIFY_TOKEN || localStorage.getItem('spotify_access_token')
  if (!token) {
    console.error('❌ No Spotify token found!')
    console.error('   Set SPOTIFY_TOKEN env var or log in via the app')
    process.exit(1)
  }

  const spotify = new SpotifyAdapter()
  const data = loadExistingData()

  let processed = 0
  let updated = 0
  let skipped = 0
  let notFound = 0

  for (const artistName of artistNames) {
    processed++
    console.log(`[${processed}/${artistNames.length}] ${artistName}`)

    // Skip if already have data (unless you want to update)
    if (data.artists[artistName]) {
      console.log(`   ✓ Already have data, skipping`)
      skipped++

      // Still respect rate limit
      await sleep(RATE_LIMIT_MS)
      continue
    }

    // Fetch from Spotify
    const similarity = await fetchArtistSimilarity(spotify, artistName)

    if (similarity) {
      data.artists[artistName] = similarity
      updated++
    } else {
      notFound++
    }

    // Rate limiting
    await sleep(RATE_LIMIT_MS)
  }

  // Save results
  saveData(data)

  // Summary
  console.log('\n📊 Summary:')
  console.log(`   Total artists: ${Object.keys(data.artists).length}`)
  console.log(`   Processed: ${processed}`)
  console.log(`   Updated: ${updated}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Not found: ${notFound}`)
}

/**
 * Run the script
 */
if (require.main === module) {
  // Load seed artists from geography data
  const seedArtists = loadGeographyData()

  if (seedArtists.length === 0) {
    console.error('❌ No seed artists found. Run build-geography-data first!')
    process.exit(1)
  }

  console.log(`📋 Loaded ${seedArtists.length} seed artists from geography data\n`)

  buildSimilarityData(seedArtists)
    .then(() => {
      console.log('\n✅ Complete!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Error:', error)
      process.exit(1)
    })
}

export { buildSimilarityData }
