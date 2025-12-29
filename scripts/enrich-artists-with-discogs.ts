#!/usr/bin/env tsx

/**
 * Enrich MusicBrainz artist data with Discogs genres/styles
 *
 * Strategy:
 * 1. Stream-parse 10GB releases XML (memory-efficient)
 * 2. Extract artist ID → genres/styles mapping
 * 3. Aggregate per artist (multiple releases → unified genre list)
 * 4. Load MusicBrainz artists JSON
 * 5. Match by artist name (fuzzy matching)
 * 6. Merge Discogs genres/styles into MusicBrainz data
 * 7. Write enriched JSON
 *
 * Performance:
 * - Streaming XML parser (SAX-style, ~100MB RAM)
 * - Process ~11M releases in ~30-60 minutes
 * - Output: Enhanced musicbrainz-artists.json with Discogs genres
 */

import { createReadStream } from 'fs'
import { createGunzip } from 'zlib'
import { createInterface } from 'readline'
import { writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Artist genre aggregation
interface ArtistGenres {
  discogsId: string
  name: string
  genres: Set<string>
  styles: Set<string>
  releaseCount: number
}

// MusicBrainz artist (existing)
interface MusicBrainzArtist {
  id: string
  name: string
  sort_name: string
  type?: string
  country?: string
  begin?: string
  area?: string
  // Enhanced with Discogs
  discogsGenres?: string[]
  discogsStyles?: string[]
}

/**
 * Simple XML parser for Discogs releases
 * Extracts artist→genres/styles without loading entire XML into memory
 */
class DiscogsReleasesParser {
  private artistGenres: Map<string, ArtistGenres> = new Map()
  private processedCount = 0

  async parseReleases(filePath: string): Promise<Map<string, ArtistGenres>> {
    console.log('🔍 Parsing Discogs releases XML...')
    console.log(`📂 File: ${filePath}`)

    const startTime = Date.now()

    // Create streaming pipeline: gzip → line reader
    const fileStream = createReadStream(filePath)
    const gunzip = createGunzip()
    const lineReader = createInterface({
      input: fileStream.pipe(gunzip),
      crlfDelay: Infinity
    })

    for await (const line of lineReader) {
      // Each master/release is on a single line, parse it completely
      if (line.includes('<master ') || line.includes('<release ')) {
        this.parseReleaseLine(line)
        this.processedCount++

        // Progress logging every 100k entries
        if (this.processedCount > 0 && this.processedCount % 100000 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
          const rate = Math.round(this.processedCount / (Date.now() - startTime) * 1000)
          console.log(`  ⏳ Processed ${this.processedCount.toLocaleString()} entries (${elapsed}s, ${rate}/s)`)
          console.log(`     Artists discovered: ${this.artistGenres.size.toLocaleString()}`)
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n✅ Parsing complete!`)
    console.log(`   Releases processed: ${this.processedCount.toLocaleString()}`)
    console.log(`   Artists discovered: ${this.artistGenres.size.toLocaleString()}`)
    console.log(`   Time elapsed: ${elapsed}s`)

    return this.artistGenres
  }

  /**
   * Parse a complete release line (each release is one line in the XML)
   */
  private parseReleaseLine(line: string): void {
    // Extract all artists in <artists> section (not <extraartists>)
    const artistsMatch = line.match(/<artists>(.*?)<\/artists>/)
    if (!artistsMatch) return

    const artistsSection = artistsMatch[1]

    // Extract individual artists
    const artistMatches = artistsSection.matchAll(/<artist><id>(\d+)<\/id><name>([^<]+)<\/name><\/artist>/g)
    const artists: Array<{ id: string; name: string }> = []

    for (const match of artistMatches) {
      artists.push({ id: match[1], name: match[2] })
    }

    if (artists.length === 0) return

    // Extract genres
    const genres: string[] = []
    const genresMatch = line.match(/<genres>(.*?)<\/genres>/)
    if (genresMatch) {
      const genreMatches = genresMatch[1].matchAll(/<genre>([^<]+)<\/genre>/g)
      for (const match of genreMatches) {
        genres.push(match[1])
      }
    }

    // Extract styles
    const styles: string[] = []
    const stylesMatch = line.match(/<styles>(.*?)<\/styles>/)
    if (stylesMatch) {
      const styleMatches = stylesMatch[1].matchAll(/<style>([^<]+)<\/style>/g)
      for (const match of styleMatches) {
        styles.push(match[1])
      }
    }

    // Associate genres/styles with all artists
    for (const artist of artists) {
      let artistGenres = this.artistGenres.get(artist.id)

      if (!artistGenres) {
        artistGenres = {
          discogsId: artist.id,
          name: artist.name,
          genres: new Set(),
          styles: new Set(),
          releaseCount: 0
        }
        this.artistGenres.set(artist.id, artistGenres)
      }

      // Add genres/styles
      genres.forEach(g => artistGenres!.genres.add(g))
      styles.forEach(s => artistGenres!.styles.add(s))
      artistGenres.releaseCount++
    }
  }
}

/**
 * Match Discogs artists to MusicBrainz artists by name (object-based)
 * Uses normalized name comparison (case-insensitive, trimmed)
 * Modifies mbArtistsObject in place
 */
function matchArtistsToObject(
  mbArtistsObject: Record<string, any>,
  discogsArtists: Map<string, ArtistGenres>
): { matched: number; total: number } {
  console.log('\n🔗 Matching Discogs → MusicBrainz artists...')

  // Build lookup by normalized name
  const discogsLookup = new Map<string, ArtistGenres>()

  for (const artist of discogsArtists.values()) {
    const normalized = normalizeName(artist.name)
    discogsLookup.set(normalized, artist)
  }

  let matchedCount = 0
  const totalArtists = Object.keys(mbArtistsObject).length

  for (const [artistName, artistData] of Object.entries(mbArtistsObject)) {
    const normalized = normalizeName(artistName)
    const discogsMatch = discogsLookup.get(normalized)

    if (discogsMatch) {
      artistData.discogsGenres = Array.from(discogsMatch.genres).sort()
      artistData.discogsStyles = Array.from(discogsMatch.styles).sort()
      matchedCount++
    }
  }

  console.log(`   Matched: ${matchedCount.toLocaleString()} / ${totalArtists.toLocaleString()} (${(matchedCount/totalArtists*100).toFixed(1)}%)`)

  return { matched: matchedCount, total: totalArtists }
}

/**
 * Normalize artist name for matching
 * Rules:
 * - Lowercase
 * - Trim whitespace
 * - Remove "The " prefix
 * - Remove punctuation
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
 * Main execution
 */
async function main() {
  console.log('🎵 Discogs → MusicBrainz Genre Enrichment Tool\n')

  const projectRoot = join(__dirname, '..')
  // Use masters XML (564MB) instead of releases (10GB) - much more memory efficient
  const discogsPath = '/Users/matttomkins/devacademy/PersonalPro/discogs/discogs_20251201_masters.xml.gz'
  const mbPath = join(projectRoot, 'client', 'data', 'musicbrainz-artists.json')
  const outputPath = join(projectRoot, 'client', 'data', 'musicbrainz-artists-enriched.json')

  // Step 1: Parse Discogs releases
  const parser = new DiscogsReleasesParser()
  const discogsArtists = await parser.parseReleases(discogsPath)

  // Step 2: Load MusicBrainz artists
  console.log('\n📖 Loading MusicBrainz artists...')
  const mbDataRaw = JSON.parse(readFileSync(mbPath, 'utf-8'))
  const mbArtistsObject = mbDataRaw.artists || {}
  console.log(`   Loaded: ${Object.keys(mbArtistsObject).length.toLocaleString()} artists`)

  // Step 3: Match and enrich (object-based, keys are artist names)
  const stats = matchArtistsToObject(mbArtistsObject, discogsArtists)

  // Step 4: Write enriched data
  console.log('\n💾 Writing enriched data...')
  const enrichedData = {
    ...mbDataRaw,
    artists: mbArtistsObject
  }
  writeFileSync(outputPath, JSON.stringify(enrichedData, null, 2))
  console.log(`   Saved to: ${outputPath}`)

  // Step 5: Sample enriched artists
  console.log('\n📊 Sample enriched artists:')
  const enrichedArtists = Object.entries(mbArtistsObject)
    .filter(([_, data]: [string, any]) => data.discogsGenres && data.discogsGenres.length > 0)
    .slice(0, 10)

  enrichedArtists.forEach(([name, data]: [string, any]) => {
    console.log(`   ${name}:`)
    console.log(`      Genres: ${data.discogsGenres.join(', ')}`)
    console.log(`      Styles: ${data.discogsStyles.slice(0, 5).join(', ')}${data.discogsStyles.length > 5 ? '...' : ''}`)
  })

  const totalEnriched = Object.values(mbArtistsObject).filter((a: any) => a.discogsGenres?.length > 0).length

  console.log('\n✅ Enrichment complete!')
  console.log(`   Total enriched: ${totalEnriched.toLocaleString()} artists`)
  console.log(`   Match rate: ${(stats.matched / stats.total * 100).toFixed(1)}%`)
}

// Run main function
main().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})
