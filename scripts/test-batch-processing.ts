#!/usr/bin/env tsx

/**
 * Test the batch processing system on a small sample
 * Processes only 2 batches of 10k releases each to verify the pipeline
 *
 * Usage:
 *   tsx scripts/test-batch-processing.ts
 */

import { BatchParser, serializeArtistGenres } from './lib/batch-parser.js'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TEST_CONFIG = {
  releasesFile: '/Users/matttomkins/devacademy/PersonalPro/discogs/discogs_20251201_releases.xml.gz',
  batchSize: 10_000,  // Small batches for testing
  numBatches: 2,      // Just 2 batches
  outputDir: join(__dirname, '..', 'client', 'data', 'test-batches')
}

async function testBatchProcessing() {
  console.log('🧪 Testing Batch Processing System\n')
  console.log('⚙️  Test Configuration:')
  console.log(`   Batch size: ${TEST_CONFIG.batchSize.toLocaleString()} releases`)
  console.log(`   Number of batches: ${TEST_CONFIG.numBatches}`)
  console.log(`   Total releases to process: ${(TEST_CONFIG.batchSize * TEST_CONFIG.numBatches).toLocaleString()}\n`)

  // Create test output directory
  if (!existsSync(TEST_CONFIG.outputDir)) {
    mkdirSync(TEST_CONFIG.outputDir, { recursive: true })
  }

  const startTime = Date.now()

  // Process test batches
  for (let i = 0; i < TEST_CONFIG.numBatches; i++) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📦 TEST BATCH ${i}`)
    console.log('='.repeat(60))

    const parser = new BatchParser()
    const batchStartTime = Date.now()

    const result = await parser.parseBatch(
      TEST_CONFIG.releasesFile,
      i * TEST_CONFIG.batchSize,
      (i + 1) * TEST_CONFIG.batchSize
    )

    // Save batch
    const batchData = {
      metadata: {
        batchNumber: i,
        startLine: i * TEST_CONFIG.batchSize,
        endLine: (i + 1) * TEST_CONFIG.batchSize,
        processedCount: result.processedCount,
        artistCount: result.artists.size,
        errorCount: result.errorCount,
        durationSeconds: (Date.now() - batchStartTime) / 1000
      },
      artists: serializeArtistGenres(result.artists)
    }

    const outputPath = join(TEST_CONFIG.outputDir, `test-batch-${i}.json`)
    writeFileSync(outputPath, JSON.stringify(batchData, null, 2))

    console.log(`💾 Saved: ${outputPath}`)
    console.log(`   Artists: ${result.artists.size.toLocaleString()}`)
    console.log(`   Errors: ${result.errorCount}`)

    // Sample some artists
    const sampleArtists = Array.from(result.artists.values()).slice(0, 3)
    console.log('\n   Sample artists:')
    sampleArtists.forEach(artist => {
      console.log(`   - ${artist.name}`)
      console.log(`     Genres: ${Array.from(artist.genres).join(', ') || 'None'}`)
      console.log(`     Styles: ${Array.from(artist.styles).slice(0, 3).join(', ') || 'None'}`)
    })
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n' + '='.repeat(60))
  console.log('✅ TEST COMPLETE!')
  console.log('='.repeat(60))
  console.log(`⏱️  Total time: ${totalTime}s`)
  console.log(`📂 Test batches saved to: ${TEST_CONFIG.outputDir}`)
  console.log('\n📊 Extrapolation for full dataset:')

  const releasesPerSecond = (TEST_CONFIG.batchSize * TEST_CONFIG.numBatches) / parseFloat(totalTime)
  const estimatedTotalTime = (11_000_000 / releasesPerSecond) / 60

  console.log(`   Releases/sec: ${releasesPerSecond.toFixed(0)}`)
  console.log(`   Estimated time for 11M releases: ${estimatedTotalTime.toFixed(1)} minutes (${(estimatedTotalTime / 60).toFixed(1)} hours)`)
  console.log(`   Estimated batches needed (1M each): ${Math.ceil(11_000_000 / 1_000_000)}`)

  console.log('\n✅ If test looks good, run full batch processing:')
  console.log('   tsx scripts/batch-process-discogs.ts')
}

testBatchProcessing().catch(error => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})
