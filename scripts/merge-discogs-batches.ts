#!/usr/bin/env tsx

/**
 * Merge all Discogs batch files into final enriched MusicBrainz dataset
 *
 * Strategy:
 * 1. Load all batch files
 * 2. Merge artist genre data (union of genres/styles from all batches)
 * 3. Load MusicBrainz artists
 * 4. Match and enrich
 * 5. Write final output
 *
 * Usage:
 *   tsx scripts/merge-discogs-batches.ts
 */

import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { deserializeArtistGenres, type ArtistGenres } from './lib/batch-parser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CONFIG = {
  batchesDir: join(__dirname, '..', 'client', 'data', 'discogs-batches'),
  mbArtistsPath: join(__dirname, '..', 'client', 'data', 'musicbrainz-artists.json'),
  outputPath: join(__dirname, '..', 'client', 'data', 'musicbrainz-artists-enriched.json')
}

/**
 * Normalize artist name for matching
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^the\s+/, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Load and merge all batch files
 */
function loadAndMergeBatches(): Map<string, ArtistGenres> {
  console.log('📂 Loading batch files...')

  const batchFiles = readdirSync(CONFIG.batchesDir)
    .filter(f => f.startsWith('batch-') && f.endsWith('.json') && !f.includes('summary'))
    .sort()

  console.log(`   Found ${batchFiles.length} batch files`)

  const mergedArtists = new Map<string, ArtistGenres>()

  for (const batchFile of batchFiles) {
    const batchPath = join(CONFIG.batchesDir, batchFile)
    const batchData = JSON.parse(readFileSync(batchPath, 'utf-8'))

    console.log(`   Loading ${batchFile}...`)
    console.log(`      Artists in batch: ${batchData.artists.length.toLocaleString()}`)

    // Deserialize batch artists
    const batchArtists = deserializeArtistGenres(batchData.artists)

    // Merge into main map
    for (const [artistId, artistData] of batchArtists.entries()) {
      const existing = mergedArtists.get(artistId)

      if (existing) {
        // Merge genres/styles/release years
        artistData.genres.forEach(g => existing.genres.add(g))
        artistData.styles.forEach(s => existing.styles.add(s))
        artistData.releaseYears.forEach(y => existing.releaseYears.add(y))
        existing.releaseCount += artistData.releaseCount
      } else {
        // New artist
        mergedArtists.set(artistId, artistData)
      }
    }

    console.log(`      Total merged artists: ${mergedArtists.size.toLocaleString()}`)
  }

  console.log(`\n✅ Merge complete: ${mergedArtists.size.toLocaleString()} unique artists`)

  return mergedArtists
}

/**
 * Match Discogs artists to MusicBrainz artists
 */
function matchToMusicBrainz(
  mbArtistsObject: Record<string, any>,
  discogsArtists: Map<string, ArtistGenres>
): { matched: number; total: number } {
  console.log('\n🔗 Matching Discogs → MusicBrainz artists...')

  // Build lookup by normalized name
  const discogsLookup = new Map<string, ArtistGenres>()

  for (const artist of discogsArtists.values()) {
    const normalized = normalizeName(artist.name)
    const existing = discogsLookup.get(normalized)

    if (existing) {
      // Multiple Discogs artists with same normalized name - merge them
      artist.genres.forEach(g => existing.genres.add(g))
      artist.styles.forEach(s => existing.styles.add(s))
      artist.releaseYears.forEach(y => existing.releaseYears.add(y))
      existing.releaseCount += artist.releaseCount
    } else {
      discogsLookup.set(normalized, artist)
    }
  }

  console.log(`   Discogs lookup index: ${discogsLookup.size.toLocaleString()} unique names`)

  let matchedCount = 0
  const totalArtists = Object.keys(mbArtistsObject).length

  for (const [artistName, artistData] of Object.entries(mbArtistsObject)) {
    const normalized = normalizeName(artistName)
    const discogsMatch = discogsLookup.get(normalized)

    if (discogsMatch) {
      artistData.discogsGenres = Array.from(discogsMatch.genres).sort()
      artistData.discogsStyles = Array.from(discogsMatch.styles).sort()
      artistData.releaseYears = Array.from(discogsMatch.releaseYears).sort((a, b) => a - b)
      matchedCount++
    }
  }

  console.log(`   Matched: ${matchedCount.toLocaleString()} / ${totalArtists.toLocaleString()} (${(matchedCount/totalArtists*100).toFixed(1)}%)`)

  return { matched: matchedCount, total: totalArtists }
}

/**
 * Main merge process
 */
async function main() {
  console.log('🎵 Discogs Batch Merger\n')

  // Step 1: Load and merge all batches
  const mergedArtists = loadAndMergeBatches()

  // Step 2: Load MusicBrainz artists
  console.log('\n📖 Loading MusicBrainz artists...')
  const mbDataRaw = JSON.parse(readFileSync(CONFIG.mbArtistsPath, 'utf-8'))
  const mbArtistsObject = mbDataRaw.artists || {}
  console.log(`   Loaded: ${Object.keys(mbArtistsObject).length.toLocaleString()} artists`)

  // Step 3: Match and enrich
  const stats = matchToMusicBrainz(mbArtistsObject, mergedArtists)

  // Step 4: Filter to only enriched artists to reduce file size
  console.log('\n🔍 Filtering to enriched artists only...')
  const enrichedArtistsObject: Record<string, any> = {}
  let enrichedCount = 0

  for (const [name, data] of Object.entries(mbArtistsObject)) {
    if ((data as any).discogsGenres && (data as any).discogsGenres.length > 0) {
      enrichedArtistsObject[name] = data
      enrichedCount++
    }
  }

  console.log(`   Filtered: ${enrichedCount.toLocaleString()} enriched artists (from ${stats.total.toLocaleString()} total)`)

  // Step 5: Write enriched data
  console.log('\n💾 Writing enriched data...')
  const metadata = {
    enrichedAt: new Date().toISOString(),
    discogsArtistsProcessed: mergedArtists.size,
    musicBrainzArtistsTotal: stats.total,
    matchedArtists: stats.matched,
    matchRate: (stats.matched / stats.total * 100).toFixed(2) + '%'
  }

  // Write using fs streaming to avoid JSON.stringify size limits
  const fs = await import('fs')
  const stream = fs.createWriteStream(CONFIG.outputPath)

  // Manually construct JSON to avoid stringifying entire object at once
  stream.write('{\n')
  stream.write(`  "version": ${JSON.stringify(mbDataRaw.version)},\n`)
  stream.write(`  "last_updated": ${JSON.stringify(mbDataRaw.last_updated)},\n`)
  stream.write(`  "source": ${JSON.stringify(mbDataRaw.source)},\n`)
  stream.write(`  "description": ${JSON.stringify(mbDataRaw.description)},\n`)
  stream.write(`  "artist_count": ${mbDataRaw.artist_count},\n`)
  stream.write(`  "metadata": ${JSON.stringify(metadata)},\n`)
  stream.write(`  "artists": {\n`)

  const artistEntries = Object.entries(enrichedArtistsObject)
  let writeCount = 0

  for (let i = 0; i < artistEntries.length; i++) {
    const [name, data] = artistEntries[i]
    const comma = i < artistEntries.length - 1 ? ',' : ''
    stream.write(`    ${JSON.stringify(name)}: ${JSON.stringify(data)}${comma}\n`)
    writeCount++

    // Progress indicator every 10k artists
    if (writeCount % 10000 === 0) {
      console.log(`   Writing progress: ${writeCount.toLocaleString()} / ${artistEntries.length.toLocaleString()}`)
    }
  }

  stream.write('  }\n')
  stream.write('}\n')
  stream.end()

  await new Promise((resolve) => stream.on('finish', resolve))

  console.log(`   Saved to: ${CONFIG.outputPath}`)

  const stats_fs = fs.statSync(CONFIG.outputPath)
  const fileSize = (stats_fs.size / 1024 / 1024).toFixed(1)
  console.log(`   File size: ${fileSize} MB`)

  // Step 6: Sample enriched artists
  console.log('\n📊 Sample enriched artists:')
  const sampleArtists = Object.entries(enrichedArtistsObject).slice(0, 15)

  sampleArtists.forEach(([name, data]: [string, any]) => {
    console.log(`   ${name}:`)
    console.log(`      Genres: ${data.discogsGenres.join(', ')}`)
    if (data.discogsStyles.length > 0) {
      console.log(`      Styles: ${data.discogsStyles.slice(0, 5).join(', ')}${data.discogsStyles.length > 5 ? '...' : ''}`)
    }
  })

  const totalEnriched = enrichedCount

  console.log('\n' + '='.repeat(60))
  console.log('🎉 ENRICHMENT COMPLETE!')
  console.log('='.repeat(60))
  console.log(`✅ Total enriched: ${totalEnriched.toLocaleString()} artists`)
  console.log(`✅ Match rate: ${(stats.matched / stats.total * 100).toFixed(1)}%`)
  console.log(`✅ Improvement: ${((stats.matched / stats.total * 100) - 14.8).toFixed(1)}% vs masters-only`)
  console.log(`\n📄 Output: ${CONFIG.outputPath}`)
  console.log(`\n🔄 Next: Restart server to load enriched data`)
  console.log(`   npm run dev`)
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
