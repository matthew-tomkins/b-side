/**
 * Build Geography Data Script
 *
 * Fetches artist geography data from MusicBrainz API and updates artist-geography.json
 *
 * Usage:
 *   npm run build-geography-data
 *
 * TOS Compliance:
 *   - Uses official MusicBrainz API (100% compliant)
 *   - Respects 1 req/sec rate limit
 *   - Data is CC0 licensed (public domain)
 *   - Includes proper User-Agent header
 */

import { MusicBrainzAdapter } from '../client/services/music/MusicBrainzAdapter'
import * as fs from 'fs'
import * as path from 'path'

// File paths
const DATA_DIR = path.join(__dirname, '../client/data')
const OUTPUT_FILE = path.join(DATA_DIR, 'artist-geography.json')

// Rate limiting configuration (MusicBrainz requires 1 req/sec)
const RATE_LIMIT_MS = 1000

// Sleep helper for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface ArtistGeography {
  country: string
  city?: string
  mbid?: string
}

interface GeographyData {
  version: string
  last_updated: string
  source: string
  description: string
  artists: Record<string, ArtistGeography>
}

/**
 * Load existing geography data if available
 */
function loadExistingData(): GeographyData {
  if (fs.existsSync(OUTPUT_FILE)) {
    console.log('📂 Loading existing geography data...')
    const content = fs.readFileSync(OUTPUT_FILE, 'utf-8')
    return JSON.parse(content)
  }

  console.log('📂 No existing data found, starting fresh')
  return {
    version: '1.0',
    last_updated: new Date().toISOString().split('T')[0],
    source: 'MusicBrainz API (CC0 License)',
    description: 'Artist geography data for filtering by country',
    artists: {}
  }
}

/**
 * Save geography data to JSON file
 */
function saveData(data: GeographyData): void {
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
 * Fetch geography data for a single artist
 */
async function fetchArtistGeography(
  mb: MusicBrainzAdapter,
  artistName: string
): Promise<ArtistGeography | null> {
  try {
    const artist = await mb.searchArtistByName(artistName)

    if (!artist || !artist.country) {
      console.log(`   ⚠️  No country data found`)
      return null
    }

    return {
      country: artist.country,
      city: artist.area,
      mbid: artist.id
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error}`)
    return null
  }
}

/**
 * Main function to build geography data
 */
async function buildGeographyData(artistNames: string[]): Promise<void> {
  console.log('🚀 Building Artist Geography Data')
  console.log(`📋 Processing ${artistNames.length} artists`)
  console.log(`⏱️  Rate limit: ${RATE_LIMIT_MS}ms between requests`)
  console.log(`⏱️  Estimated time: ~${Math.ceil(artistNames.length * RATE_LIMIT_MS / 1000 / 60)} minutes\n`)

  const mb = new MusicBrainzAdapter()
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

    // Fetch from MusicBrainz
    const geography = await fetchArtistGeography(mb, artistName)

    if (geography) {
      data.artists[artistName] = geography
      console.log(`   ✓ ${geography.country} ${geography.city ? `(${geography.city})` : ''}`)
      updated++
    } else {
      notFound++
    }

    // Rate limiting: 1 request per second
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
 * Artist seed list - expand this over time
 * Start with popular artists across key genres
 */
const SEED_ARTISTS = [
  // US Punk (1970s-1980s)
  'Ramones', 'Dead Kennedys', 'Black Flag', 'Misfits', 'Bad Brains',
  'Minor Threat', 'Fugazi', 'Hüsker Dü', 'Minutemen', 'X',
  'Descendents', 'Circle Jerks', 'Fear', 'Germs', 'The Wipers',

  // UK Punk (1970s-1980s)
  'Sex Pistols', 'The Clash', 'Buzzcocks', 'The Damned', 'Siouxsie and the Banshees',
  'Wire', 'Magazine', 'Gang of Four', 'The Slits', 'X-Ray Spex',

  // Proto-Punk / New Wave (US)
  'Patti Smith', 'Television', 'Talking Heads', 'The Velvet Underground', 'The Stooges',
  'Iggy Pop', 'Richard Hell and the Voidoids', 'The Modern Lovers', 'Suicide',

  // Nigerian Funk / Afrobeat
  'Fela Kuti', 'Tony Allen', 'King Sunny Adé', 'William Onyeabor', 'Ebo Taylor',
  'Orlando Julius', 'Seun Kuti', 'Femi Kuti', 'Antibalas',

  // Japanese Indie / City Pop
  'Lamp', 'Fishmans', 'Cornelius', 'Pizzicato Five', 'Shintaro Sakamoto',
  'Happy End', 'Haruomi Hosono', 'Tatsuro Yamashita', 'Mariya Takeuchi',

  // Post-Punk / Alternative (UK)
  'Joy Division', 'New Order', 'The Cure', 'The Smiths', 'Cocteau Twins',
  'Echo & the Bunnymen', 'Bauhaus', 'The Fall', 'My Bloody Valentine',

  // US Alternative / Indie (1980s-1990s)
  'Sonic Youth', 'Pixies', 'Dinosaur Jr.', 'Pavement', 'Guided by Voices',
  'Built to Spill', 'Modest Mouse', 'The Replacements', 'Yo La Tengo',

  // Add more as needed...
]

/**
 * Run the script
 */
if (require.main === module) {
  buildGeographyData(SEED_ARTISTS)
    .then(() => {
      console.log('\n✅ Complete!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Error:', error)
      process.exit(1)
    })
}

export { buildGeographyData, SEED_ARTISTS }
