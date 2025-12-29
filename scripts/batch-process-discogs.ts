#!/usr/bin/env tsx

/**
 * Batch processor for Discogs releases XML
 *
 * Processes 11M releases in batches of 1M to:
 * - Prevent memory overflow
 * - Enable resume capability
 * - Track progress granularly
 *
 * Output: Batch files that can be merged later
 *
 * Usage:
 *   tsx scripts/batch-process-discogs.ts          # Process all batches
 *   tsx scripts/batch-process-discogs.ts 0 5      # Process batches 0-4 only
 *   tsx scripts/batch-process-discogs.ts 5 11     # Resume from batch 5
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { BatchParser, serializeArtistGenres } from './lib/batch-parser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration
const CONFIG = {
  releasesFile: '/Users/matttomkins/devacademy/PersonalPro/discogs/discogs_20251201_releases.xml.gz',
  batchSize: 2_000_000,        // 2M lines per batch
  outputDir: join(__dirname, '..', 'client', 'data', 'discogs-batches'),
  totalLines: 113_150_942  // Actual line count from: gunzip -c file.gz | wc -l
}

interface BatchMetadata {
  batchNumber: number
  startLine: number
  endLine: number
  processedCount: number
  artistCount: number
  errorCount: number
  completedAt: string
  durationSeconds: number
}

/**
 * Process a single batch
 */
async function processBatch(batchNumber: number): Promise<BatchMetadata> {
  const startLine = batchNumber * CONFIG.batchSize
  const endLine = startLine + CONFIG.batchSize

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📦 BATCH ${batchNumber} (${startLine.toLocaleString()} - ${endLine.toLocaleString()})`)
  console.log('='.repeat(60))

  const parser = new BatchParser()
  const startTime = Date.now()

  const result = await parser.parseBatch(
    CONFIG.releasesFile,
    startLine,
    endLine
  )

  // Serialize and save
  const batchData = {
    metadata: {
      batchNumber,
      startLine,
      endLine,
      processedCount: result.processedCount,
      artistCount: result.artists.size,
      errorCount: result.errorCount,
      completedAt: new Date().toISOString(),
      durationSeconds: (Date.now() - startTime) / 1000
    },
    artists: serializeArtistGenres(result.artists)
  }

  const outputPath = join(CONFIG.outputDir, `batch-${batchNumber.toString().padStart(2, '0')}.json`)
  writeFileSync(outputPath, JSON.stringify(batchData, null, 2))

  console.log(`💾 Saved: ${outputPath}`)
  console.log(`   File size: ${(Buffer.byteLength(JSON.stringify(batchData)) / 1024 / 1024).toFixed(1)} MB`)

  return batchData.metadata
}

/**
 * Check which batches are already complete
 */
function getCompletedBatches(): Set<number> {
  const completed = new Set<number>()

  if (!existsSync(CONFIG.outputDir)) {
    return completed
  }

  const totalBatches = Math.ceil(CONFIG.totalLines / CONFIG.batchSize)

  for (let i = 0; i < totalBatches; i++) {
    const batchFile = join(CONFIG.outputDir, `batch-${i.toString().padStart(2, '0')}.json`)
    if (existsSync(batchFile)) {
      completed.add(i)
    }
  }

  return completed
}

/**
 * Main batch processing orchestrator
 */
async function main() {
  console.log('🎵 Discogs Releases Batch Processor\n')

  // Parse command line args
  const args = process.argv.slice(2)
  const startBatch = args[0] ? parseInt(args[0]) : 0
  const endBatch = args[1] ? parseInt(args[1]) : Math.ceil(CONFIG.totalLines / CONFIG.batchSize)

  console.log('⚙️  Configuration:')
  console.log(`   Source: ${CONFIG.releasesFile}`)
  console.log(`   Batch size: ${CONFIG.batchSize.toLocaleString()} releases`)
  console.log(`   Output: ${CONFIG.outputDir}`)
  console.log(`   Processing batches: ${startBatch} - ${endBatch - 1}`)

  // Create output directory
  if (!existsSync(CONFIG.outputDir)) {
    mkdirSync(CONFIG.outputDir, { recursive: true })
    console.log(`   Created output directory`)
  }

  // Check for existing batches
  const completed = getCompletedBatches()
  if (completed.size > 0) {
    console.log(`\n✅ Found ${completed.size} completed batch(es):`)
    Array.from(completed).sort((a, b) => a - b).forEach(batch => {
      console.log(`   - Batch ${batch}`)
    })
  }

  // Process each batch
  const allMetadata: BatchMetadata[] = []
  const processStartTime = Date.now()

  for (let batchNum = startBatch; batchNum < endBatch; batchNum++) {
    // Skip if already completed
    if (completed.has(batchNum)) {
      console.log(`\n⏭️  Skipping batch ${batchNum} (already complete)`)
      continue
    }

    try {
      const metadata = await processBatch(batchNum)
      allMetadata.push(metadata)

      // Show overall progress
      const totalProcessed = (batchNum - startBatch + 1)
      const totalBatches = (endBatch - startBatch)
      const percentComplete = (totalProcessed / totalBatches * 100).toFixed(1)
      const elapsed = ((Date.now() - processStartTime) / 1000 / 60).toFixed(1)

      console.log(`\n📊 Overall Progress: ${totalProcessed}/${totalBatches} batches (${percentComplete}%) | ${elapsed} min elapsed`)

    } catch (error) {
      console.error(`\n❌ Error processing batch ${batchNum}:`, error)
      console.log(`   You can resume by running: tsx scripts/batch-process-discogs.ts ${batchNum} ${endBatch}`)
      process.exit(1)
    }
  }

  // Save summary
  const summaryPath = join(CONFIG.outputDir, 'batch-summary.json')
  const summary = {
    completedAt: new Date().toISOString(),
    totalBatches: allMetadata.length,
    totalProcessed: allMetadata.reduce((sum, m) => sum + m.processedCount, 0),
    totalArtists: allMetadata.reduce((sum, m) => sum + m.artistCount, 0),
    totalErrors: allMetadata.reduce((sum, m) => sum + m.errorCount, 0),
    totalDurationMinutes: (Date.now() - processStartTime) / 1000 / 60,
    batches: allMetadata
  }

  writeFileSync(summaryPath, JSON.stringify(summary, null, 2))

  console.log('\n' + '='.repeat(60))
  console.log('🎉 BATCH PROCESSING COMPLETE!')
  console.log('='.repeat(60))
  console.log(`✅ Total batches: ${summary.totalBatches}`)
  console.log(`✅ Total releases: ${summary.totalProcessed.toLocaleString()}`)
  console.log(`✅ Total artists: ${summary.totalArtists.toLocaleString()}`)
  console.log(`⚠️  Total errors: ${summary.totalErrors.toLocaleString()}`)
  console.log(`⏱️  Total time: ${summary.totalDurationMinutes.toFixed(1)} minutes`)
  console.log(`\n📄 Summary saved: ${summaryPath}`)
  console.log(`\n🔄 Next step: Run merge script to combine batches`)
  console.log(`   tsx scripts/merge-discogs-batches.ts`)
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
