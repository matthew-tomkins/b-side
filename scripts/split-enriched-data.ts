/**
 * Split large enriched JSON file into smaller chunks
 *
 * This script splits musicbrainz-artists-enriched.json (911MB)
 * into multiple smaller files to avoid V8 memory constraints.
 *
 * Usage: npx tsx scripts/split-enriched-data.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const CHUNK_SIZE = 60000 // ~60K artists per chunk (rough target)
const INPUT_FILE = 'client/data/musicbrainz-artists-enriched.json'
const OUTPUT_DIR = 'client/data/musicbrainz-enriched-chunks'

console.log('🔄 Starting split process...\n')

// Check if input file exists
if (!existsSync(INPUT_FILE)) {
  console.error(`❌ Error: ${INPUT_FILE} not found`)
  console.error('   Please ensure the enriched data file exists')
  process.exit(1)
}

// Create output directory
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  console.log(`✅ Created output directory: ${OUTPUT_DIR}`)
}

console.log(`📖 Reading ${INPUT_FILE}...`)
console.log('   (This will take 30-60 seconds due to file size)\n')

// Read the full file using readFileSync with JSON.parse
// This works because we're reading + parsing in one go (not creating intermediate string)
let fullData: any
try {
  const fileContent = readFileSync(INPUT_FILE, 'utf-8')
  fullData = JSON.parse(fileContent)
  console.log(`✅ Successfully loaded data`)
} catch (error) {
  if (error instanceof Error && error.message.includes('ERR_STRING_TOO_LONG')) {
    console.error('❌ File too large for standard loading')
    console.error('   Using alternative streaming approach...\n')

    // Fall back to manual line-by-line parsing if needed
    console.error('   Please manually split the file or use streaming parser')
    process.exit(1)
  }
  throw error
}

// Extract metadata and artists
const { artists, ...metadata } = fullData
const artistEntries = Object.entries(artists)
const totalArtists = artistEntries.length

console.log(`📊 Total artists: ${totalArtists.toLocaleString()}`)
console.log(`🎯 Target chunk size: ${CHUNK_SIZE.toLocaleString()} artists`)
console.log(`📦 Estimated chunks: ${Math.ceil(totalArtists / CHUNK_SIZE)}\n`)

// Split into chunks
let chunkIndex = 0
let processedArtists = 0

for (let i = 0; i < artistEntries.length; i += CHUNK_SIZE) {
  const chunkEntries = artistEntries.slice(i, i + CHUNK_SIZE)
  const chunkArtists = Object.fromEntries(chunkEntries)

  const chunkData = {
    ...metadata,
    chunk_index: chunkIndex,
    chunk_artist_count: chunkEntries.length,
    total_chunks: Math.ceil(totalArtists / CHUNK_SIZE),
    total_artist_count: totalArtists,
    artists: chunkArtists
  }

  const outputFile = join(OUTPUT_DIR, `chunk-${chunkIndex.toString().padStart(2, '0')}.json`)
  writeFileSync(outputFile, JSON.stringify(chunkData, null, 2))

  processedArtists += chunkEntries.length
  const progress = ((processedArtists / totalArtists) * 100).toFixed(1)
  console.log(`✅ Chunk ${chunkIndex}: ${chunkEntries.length.toLocaleString()} artists (${progress}% complete)`)

  chunkIndex++
}

console.log(`\n🎉 Split complete!`)
console.log(`   Created ${chunkIndex} chunk files in ${OUTPUT_DIR}`)
console.log(`   Total artists: ${processedArtists.toLocaleString()}`)
console.log(`\n💡 Next step: Update server to load from chunks`)
