/**
 * Reusable batch parser for Discogs releases XML
 * Processes a specific range of lines with memory efficiency
 */

import { createReadStream } from 'fs'
import { createGunzip } from 'zlib'
import { createInterface } from 'readline'

export interface ArtistGenres {
  discogsId: string
  name: string
  genres: Set<string>
  styles: Set<string>
  releaseYears: Set<number>
  releaseCount: number
}

export interface BatchResult {
  artists: Map<string, ArtistGenres>
  processedCount: number
  startLine: number
  endLine: number
  errorCount: number
}

export class BatchParser {
  private artistGenres: Map<string, ArtistGenres> = new Map()
  private processedCount = 0
  private errorCount = 0

  /**
   * Parse a specific batch of lines from the XML
   * @param filePath Path to discogs XML.gz file
   * @param startLine Starting line number (inclusive)
   * @param endLine Ending line number (exclusive)
   */
  async parseBatch(
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<BatchResult> {
    console.log(`\n📦 Processing batch: lines ${startLine.toLocaleString()} - ${endLine.toLocaleString()}`)

    const startTime = Date.now()
    let currentLine = 0

    // Create streaming pipeline
    const fileStream = createReadStream(filePath)
    const gunzip = createGunzip()
    const lineReader = createInterface({
      input: fileStream.pipe(gunzip),
      crlfDelay: Infinity
    })

    for await (const line of lineReader) {
      // Skip lines before start
      if (currentLine < startLine) {
        currentLine++
        continue
      }

      // Stop at end line
      if (currentLine >= endLine) {
        break
      }

      // Process this line
      if (line.includes('<master ') || line.includes('<release ')) {
        this.parseReleaseLine(line)
        this.processedCount++

        // Progress logging every 50k entries (more frequent for feedback)
        if (this.processedCount > 0 && this.processedCount % 50000 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
          const rate = Math.round(this.processedCount / (Date.now() - startTime) * 1000)
          console.log(`  ⏳ ${this.processedCount.toLocaleString()} entries (${elapsed}s, ${rate}/s) | Artists: ${this.artistGenres.size.toLocaleString()}`)
        }
      }

      currentLine++
    }

    // Cleanup
    lineReader.close()
    fileStream.destroy()

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n✅ Batch complete!`)
    console.log(`   Lines processed: ${this.processedCount.toLocaleString()}`)
    console.log(`   Artists found: ${this.artistGenres.size.toLocaleString()}`)
    console.log(`   Errors: ${this.errorCount.toLocaleString()}`)
    console.log(`   Time: ${elapsed}s`)

    return {
      artists: this.artistGenres,
      processedCount: this.processedCount,
      startLine,
      endLine,
      errorCount: this.errorCount
    }
  }

  /**
   * Parse a complete release line
   */
  private parseReleaseLine(line: string): void {
    try {
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

      // Extract release year from <released> tag (e.g., "1998-05-00" or "1998")
      let releaseYear: number | null = null
      const releasedMatch = line.match(/<released>(\d{4})/)
      if (releasedMatch) {
        releaseYear = parseInt(releasedMatch[1])
      }

      // Associate genres/styles/release years with all artists
      for (const artist of artists) {
        let artistGenres = this.artistGenres.get(artist.id)

        if (!artistGenres) {
          artistGenres = {
            discogsId: artist.id,
            name: artist.name,
            genres: new Set(),
            styles: new Set(),
            releaseYears: new Set(),
            releaseCount: 0
          }
          this.artistGenres.set(artist.id, artistGenres)
        }

        // Add genres/styles
        genres.forEach(g => artistGenres!.genres.add(g))
        styles.forEach(s => artistGenres!.styles.add(s))

        // Add release year if valid
        if (releaseYear !== null && releaseYear >= 1900 && releaseYear <= new Date().getFullYear()) {
          artistGenres.releaseYears.add(releaseYear)
        }

        artistGenres.releaseCount++
      }
    } catch (error) {
      this.errorCount++
      if (this.errorCount % 1000 === 0) {
        console.warn(`   ⚠️ Parse errors: ${this.errorCount}`)
      }
    }
  }
}

/**
 * Serialize artist genres to JSON-compatible format
 */
export function serializeArtistGenres(artists: Map<string, ArtistGenres>): any[] {
  return Array.from(artists.values()).map(artist => ({
    discogsId: artist.discogsId,
    name: artist.name,
    genres: Array.from(artist.genres).sort(),
    styles: Array.from(artist.styles).sort(),
    releaseYears: Array.from(artist.releaseYears).sort((a, b) => a - b),
    releaseCount: artist.releaseCount
  }))
}

/**
 * Deserialize JSON back to Map
 */
export function deserializeArtistGenres(data: any[]): Map<string, ArtistGenres> {
  const map = new Map<string, ArtistGenres>()

  for (const artist of data) {
    map.set(artist.discogsId, {
      discogsId: artist.discogsId,
      name: artist.name,
      genres: new Set(artist.genres),
      styles: new Set(artist.styles),
      releaseYears: new Set(artist.releaseYears || []),
      releaseCount: artist.releaseCount
    })
  }

  return map
}
