/**
 * Split large enriched JSON file into smaller chunks using streaming
 *
 * This script uses streaming to avoid V8 memory constraints when splitting
 * the 911MB musicbrainz-artists-enriched.json file.
 *
 * Usage: npx tsx scripts/split-enriched-data-streaming.ts
 */

import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import StreamObject from 'stream-json/streamers/StreamObject.js'

const CHUNK_SIZE = 60000 // ~60K artists per chunk
const INPUT_FILE = 'client/data/musicbrainz-artists-enriched.json'
const OUTPUT_DIR = 'client/data/musicbrainz-enriched-chunks'

console.log('🔄 Starting streaming split process...\n')

// Check if input file exists
if (!existsSync(INPUT_FILE)) {
  console.error(`❌ Error: ${INPUT_FILE} not found`)
  process.exit(1)
}

// Create output directory
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  console.log(`✅ Created output directory: ${OUTPUT_DIR}`)
}

interface ChunkData {
  version?: string
  last_updated?: string
  source?: string
  description?: string
  chunk_index: number
  chunk_artist_count: number
  total_chunks: number
  total_artist_count: number
  artists: Record<string, any>
}

async function splitFile() {
  console.log(`📖 Streaming ${INPUT_FILE}...\n`)

  const metadata: Record<string, any> = {}
  let currentChunk: ChunkData = {
    chunk_index: 0,
    chunk_artist_count: 0,
    total_chunks: 0,
    total_artist_count: 0,
    artists: {}
  }

  let totalArtists = 0
  let chunkIndex = 0
  let artistsInCurrentChunk = 0

  const pipeline = createReadStream(INPUT_FILE).pipe(StreamObject.withParser())

  for await (const { key, value } of pipeline) {
    if (key.startsWith('artists.')) {
      // Artist entry
      const artistName = key.substring(8) // Remove "artists." prefix
      currentChunk.artists[artistName] = value
      artistsInCurrentChunk++
      totalArtists++

      // Write chunk if we've hit the size limit
      if (artistsInCurrentChunk >= CHUNK_SIZE) {
        await writeChunk(currentChunk, chunkIndex, OUTPUT_DIR, metadata, totalArtists)
        chunkIndex++

        // Start new chunk
        currentChunk = {
          chunk_index: chunkIndex,
          chunk_artist_count: 0,
          total_chunks: 0,
          total_artist_count: totalArtists,
          artists: {}
        }
        artistsInCurrentChunk = 0
      }
    } else {
      // Metadata field
      metadata[key] = value
    }
  }

  // Write final chunk if it has any artists
  if (artistsInCurrentChunk > 0) {
    await writeChunk(currentChunk, chunkIndex, OUTPUT_DIR, metadata, totalArtists)
    chunkIndex++
  }

  // Update all chunks with correct total_chunks count
  console.log(`\n📝 Updating chunk metadata...`)
  const totalChunks = chunkIndex

  console.log(`\n🎉 Split complete!`)
  console.log(`   Created ${totalChunks} chunk files in ${OUTPUT_DIR}`)
  console.log(`   Total artists: ${totalArtists.toLocaleString()}`)
  console.log(`\n💡 Next step: Update server to load from chunks`)
}

async function writeChunk(
  chunk: ChunkData,
  chunkIndex: number,
  outputDir: string,
  metadata: Record<string, any>,
  totalArtists: number
) {
  const artistCount = Object.keys(chunk.artists).length

  const chunkData = {
    ...metadata,
    chunk_index: chunkIndex,
    chunk_artist_count: artistCount,
    total_artist_count: totalArtists,
    artists: chunk.artists
  }

  const outputFile = join(outputDir, `chunk-${chunkIndex.toString().padStart(2, '0')}.json`)

  // Use streaming write for large chunks
  const writeStream = createWriteStream(outputFile)
  writeStream.write(JSON.stringify(chunkData, null, 2))
  writeStream.end()

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
  })

  const progress = ((totalArtists / 610990) * 100).toFixed(1) // Estimate based on known total
  console.log(`✅ Chunk ${chunkIndex}: ${artistCount.toLocaleString()} artists (${progress}% complete)`)
}

// Run the split
splitFile().catch(error => {
  console.error('\n❌ Error during split:', error)
  process.exit(1)
})
