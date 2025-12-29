/**
 * Parse MusicBrainz Bulk Data to JSON
 *
 * Converts downloaded MusicBrainz TSV files to lightweight JSON format
 * Only extracts artists with country data to minimize file size
 *
 * TOS Compliance: ✅ CC0 Public Domain data
 * Source: MusicBrainz database dumps
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TEMP_DIR = '/tmp/musicbrainz-bulk/mbdump'
const OUTPUT_FILE = path.join(__dirname, '../client/data/musicbrainz-artists.json')

interface Artist {
  id: string
  name: string
  country?: string
  area?: string
  begin_date?: string
}

interface Area {
  id: string
  name: string
  type: string
}

/**
 * Parse area table (countries and cities)
 */
async function parseAreas(): Promise<Map<string, Area>> {
  const areaFile = path.join(TEMP_DIR, 'area')
  const areas = new Map<string, Area>()

  console.log('📍 Parsing areas (countries/cities)...')

  const fileStream = fs.createReadStream(areaFile)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  let count = 0
  for await (const line of rl) {
    const parts = line.split('\t')
    if (parts.length < 3) continue

    const area: Area = {
      id: parts[0],
      name: parts[2], // area name
      type: parts[1]  // type ID (1=Country, 2=Subdivision, 3=City, etc.)
    }

    areas.set(area.id, area)
    count++
  }

  console.log(`   ✓ Parsed ${count} areas`)
  return areas
}

/**
 * Parse tags table
 */
async function parseTags(): Promise<Map<string, string>> {
  const tagFile = path.join(TEMP_DIR, 'tag')
  const tags = new Map<string, string>()

  console.log('🏷️  Parsing tags...')

  const fileStream = fs.createReadStream(tagFile)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  let count = 0
  for await (const line of rl) {
    const parts = line.split('\t')
    if (parts.length < 2) continue

    tags.set(parts[0], parts[1]) // id -> tag name
    count++
  }

  console.log(`   ✓ Parsed ${count.toLocaleString()} tags`)
  return tags
}

/**
 * Parse ISO 3166-1 country codes
 */
async function parseIsoCountryCodes(): Promise<Map<string, string>> {
  const isoFile = path.join(TEMP_DIR, 'iso_3166_1')
  const isoCodes = new Map<string, string>()

  console.log('🌍 Parsing ISO country codes...')

  const fileStream = fs.createReadStream(isoFile)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  let count = 0
  for await (const line of rl) {
    const parts = line.split('\t')
    if (parts.length < 2) continue

    isoCodes.set(parts[0], parts[1]) // area_id -> ISO code (e.g., "222" -> "US")
    count++
  }

  console.log(`   ✓ Parsed ${count.toLocaleString()} country codes`)
  return isoCodes
}

/**
 * Parse artist tags
 */
async function parseArtistTags(tags: Map<string, string>): Promise<Map<string, Array<{name: string, count: number}>>> {
  const artistTagFile = path.join(TEMP_DIR, 'artist_tag')
  const artistTags = new Map<string, Array<{name: string, count: number}>>()

  console.log('🎵 Parsing artist tags...')

  const fileStream = fs.createReadStream(artistTagFile)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  let count = 0
  for await (const line of rl) {
    const parts = line.split('\t')
    if (parts.length < 3) continue

    const artistId = parts[0]
    const tagId = parts[1]
    const voteCount = parseInt(parts[2]) || 1

    if (tags.has(tagId)) {
      if (!artistTags.has(artistId)) {
        artistTags.set(artistId, [])
      }
      artistTags.get(artistId)!.push({
        name: tags.get(tagId)!,
        count: voteCount
      })
      count++
    }
  }

  console.log(`   ✓ Parsed ${count.toLocaleString()} artist-tag relationships`)
  return artistTags
}

/**
 * Parse link types (relationship types)
 */
async function parseLinkTypes(): Promise<Map<string, string>> {
  const linkTypeFile = path.join(TEMP_DIR, 'link_type')
  const linkTypes = new Map<string, string>()

  console.log('🔗 Parsing link types...')

  const fileStream = fs.createReadStream(linkTypeFile)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  let count = 0
  for await (const line of rl) {
    const parts = line.split('\t')
    if (parts.length < 8) continue

    // Column 7 (index 6) contains the relationship name
    const linkTypeName = parts[6]
    if (linkTypeName && linkTypeName !== '\\N') {
      linkTypes.set(parts[0], linkTypeName) // id -> link type name
      count++
    }
  }

  console.log(`   ✓ Parsed ${count.toLocaleString()} link types`)
  return linkTypes
}

/**
 * Parse artist relationships
 */
async function parseArtistRelationships(linkTypes: Map<string, string>): Promise<Map<string, Map<string, string[]>>> {
  const linkFile = path.join(TEMP_DIR, 'link')
  const linkArtistArtistFile = path.join(TEMP_DIR, 'l_artist_artist')

  // First, load links to get type IDs
  const links = new Map<string, string>() // link_id -> link_type_id

  console.log('🔗 Loading link metadata...')
  const linkStream = fs.createReadStream(linkFile)
  const linkRl = readline.createInterface({
    input: linkStream,
    crlfDelay: Infinity
  })

  for await (const line of linkRl) {
    const parts = line.split('\t')
    if (parts.length < 2) continue
    links.set(parts[0], parts[1]) // link_id -> link_type_id
  }

  console.log(`   ✓ Loaded ${links.size.toLocaleString()} links`)

  // Now parse artist-artist relationships
  const relationships = new Map<string, Map<string, string[]>>()

  console.log('🎭 Parsing artist relationships...')
  const aaStream = fs.createReadStream(linkArtistArtistFile)
  const aaRl = readline.createInterface({
    input: aaStream,
    crlfDelay: Infinity
  })

  let count = 0
  for await (const line of aaRl) {
    const parts = line.split('\t')
    if (parts.length < 4) continue

    const linkId = parts[0]
    const artist0 = parts[1]
    const artist1 = parts[2]

    if (links.has(linkId)) {
      const linkTypeId = links.get(linkId)!
      const linkTypeName = linkTypes.get(linkTypeId) || 'unknown'

      // Store bidirectional relationships
      if (!relationships.has(artist0)) {
        relationships.set(artist0, new Map())
      }
      if (!relationships.get(artist0)!.has(linkTypeName)) {
        relationships.get(artist0)!.set(linkTypeName, [])
      }
      relationships.get(artist0)!.get(linkTypeName)!.push(artist1)
      count++
    }
  }

  console.log(`   ✓ Parsed ${count.toLocaleString()} artist relationships`)
  return relationships
}

/**
 * Parse artist table and join with all data
 */
async function parseArtists(
  areas: Map<string, Area>,
  isoCodes: Map<string, string>,
  artistTags: Map<string, Array<{name: string, count: number}>>,
  relationships: Map<string, Map<string, string[]>>
): Promise<Record<string, any>> {
  const artistFile = path.join(TEMP_DIR, 'artist')
  const artists: Record<string, any> = {}
  const artistIdToName = new Map<string, string>()

  console.log('🎤 Parsing artists...')

  const fileStream = fs.createReadStream(artistFile)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  let total = 0
  let withCountry = 0

  for await (const line of rl) {
    const parts = line.split('\t')
    if (parts.length < 13) continue

    const artistId = parts[0]
    const artistType = parts[1]
    const name = parts[2]
    // Correct column positions based on MusicBrainz schema:
    // parts[4-6]: begin_date (year, month, day)
    // parts[7-9]: end_date (year, month, day)
    // parts[10]: type (UUID, not simple number)
    // parts[11]: area/country ID
    const beginDateYear = parts[4]
    const endDateYear = parts[7]
    const countryAreaId = parts[11] // This is the actual country

    total++

    // Store ID -> name mapping for relationships
    artistIdToName.set(artistId, name)

    // Only include artists with country data
    if (countryAreaId && countryAreaId !== '\\N' && areas.has(countryAreaId)) {
      const area = areas.get(countryAreaId)!

      // Get ISO country code if available, otherwise use area name
      const countryCode = isoCodes.get(countryAreaId) || area.name

      artists[name] = {
        country: countryCode, // Now using ISO codes (US, GB, etc.)
        mbid: artistId
      }

      // Add type using UUIDs instead of simple numbers
      // Common type UUIDs from MusicBrainz:
      // Person: b6e035f4-3ce9-331c-97df-83397230b0df
      // Group: e431f5f6-b5d2-343d-8b36-72607fffb74b
      // Orchestra: a0b36c92-bf0b-3ae0-94e2-355e7eec5741
      if (artistType === 'b6e035f4-3ce9-331c-97df-83397230b0df') artists[name].type = 'Person'
      else if (artistType === 'e431f5f6-b5d2-343d-8b36-72607fffb74b') artists[name].type = 'Group'
      else if (artistType === 'a0b36c92-bf0b-3ae0-94e2-355e7eec5741') artists[name].type = 'Orchestra'

      // Gender is not reliably accessible in current dump format
      // Skipping for now

      // Add dates - now using correct columns
      if (beginDateYear && beginDateYear !== '\\N') {
        const year = parseInt(beginDateYear)
        if (!isNaN(year) && year > 1000 && year < 3000) {
          artists[name].begin_year = year
        }
      }
      if (endDateYear && endDateYear !== '\\N') {
        const year = parseInt(endDateYear)
        if (!isNaN(year) && year > 1000 && year < 3000) {
          artists[name].end_year = year
        }
      }

      // Add tags
      if (artistTags.has(artistId)) {
        const tags = artistTags.get(artistId)!
        // Sort by vote count and take top 5
        tags.sort((a, b) => b.count - a.count)
        artists[name].tags = tags.slice(0, 5).map(t => t.name)
      }

      // Add relationships (will resolve names in second pass)
      if (relationships.has(artistId)) {
        artists[name]._relationships = relationships.get(artistId)
        artists[name]._artistId = artistId
      }

      withCountry++
    }

    // Progress every 100k artists
    if (total % 100000 === 0) {
      console.log(`   Processed ${total.toLocaleString()} artists...`)
    }
  }

  console.log(`   ✓ Total artists: ${total.toLocaleString()}`)
  console.log(`   ✓ With country data: ${withCountry.toLocaleString()}`)

  // Second pass: resolve relationship IDs to names
  console.log('🔗 Resolving relationship names...')
  let resolvedCount = 0
  for (const [artistName, data] of Object.entries(artists)) {
    if (data._relationships) {
      const resolved: Record<string, string[]> = {}
      for (const [relType, artistIds] of data._relationships.entries()) {
        resolved[relType] = artistIds
          .map((id: string) => artistIdToName.get(id))
          .filter((name: string | undefined) => name !== undefined)
          .slice(0, 10) // Limit to top 10 per relationship type
      }
      artists[artistName].relationships = resolved
      delete artists[artistName]._relationships
      delete artists[artistName]._artistId
      resolvedCount++
    }
  }
  console.log(`   ✓ Resolved relationships for ${resolvedCount.toLocaleString()} artists`)

  return artists
}

/**
 * Main function
 */
async function parseBulkData(): Promise<void> {
  console.log('🚀 MusicBrainz Bulk Data Parser')
  console.log('================================\n')

  // Check if data files exist
  if (!fs.existsSync(TEMP_DIR)) {
    console.error('❌ MusicBrainz data not found!')
    console.error('   Run download-musicbrainz-bulk.sh first')
    process.exit(1)
  }

  // Parse all data sources
  const areas = await parseAreas()
  const tags = await parseTags()
  const isoCodes = await parseIsoCountryCodes()
  const artistTags = await parseArtistTags(tags)
  const linkTypes = await parseLinkTypes()
  const relationships = await parseArtistRelationships(linkTypes)

  // Parse artists and join with all data
  const artists = await parseArtists(areas, isoCodes, artistTags, relationships)

  // Build output JSON
  const output = {
    version: '2.0',
    last_updated: new Date().toISOString().split('T')[0],
    source: 'MusicBrainz Database Dump (CC0 License)',
    description: 'Artist geography data extracted from MusicBrainz bulk dumps',
    artist_count: Object.keys(artists).length,
    artists: artists
  }

  // Save to file
  console.log('\n💾 Saving to JSON...')

  const dataDir = path.join(__dirname, '../client/data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2))

  console.log(`   ✓ Saved ${Object.keys(artists).length.toLocaleString()} artists`)
  console.log(`   ✓ File: ${OUTPUT_FILE}`)

  // File size
  const stats = fs.statSync(OUTPUT_FILE)
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
  console.log(`   ✓ Size: ${sizeMB} MB`)

  console.log('\n✅ Complete!')
}

// Run (ES module check)
const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  parseBulkData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\n❌ Error:', error)
      process.exit(1)
    })
}

export { parseBulkData }
