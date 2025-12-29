import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * MusicBrainz data structure
 */
export interface MusicBrainzData {
  version: string
  last_updated: string
  source: string
  description: string
  artist_count: number
  artists: Record<string, {
    country?: string
    mbid?: string
    begin_year?: number
    end_year?: number
    tags?: string[]
    relationships?: Record<string, string[]>
    releaseYears?: number[]
    discogsGenres?: string[]
    discogsStyles?: string[]
  }>
}

// Shared data state
let musicbrainzData: MusicBrainzData | null = null
let loadError: string | null = null
let isLoading = true

/**
 * Load MusicBrainz data from chunks
 * Uses chunked files to avoid V8's string size limit (~536MB)
 */
async function loadFromChunks(chunksDir: string) {
  const startTime = Date.now()
  console.log('[MusicBrainz] Loading enriched data from chunks...')

  // Find all chunk files
  const files = readdirSync(chunksDir)
    .filter(f => f.startsWith('chunk-') && f.endsWith('.json'))
    .sort() // Ensure chunks are loaded in order

  if (files.length === 0) {
    throw new Error(`No chunk files found in ${chunksDir}`)
  }

  console.log(`[MusicBrainz] Found ${files.length} chunk files`)

  const data: any = {
    version: '',
    last_updated: '',
    source: '',
    description: '',
    artist_count: 0,
    artists: {}
  }

  // Load each chunk and merge
  for (let i = 0; i < files.length; i++) {
    const chunkPath = join(chunksDir, files[i])
    const chunkData = JSON.parse(readFileSync(chunkPath, 'utf-8'))

    // Copy metadata from first chunk
    if (i === 0) {
      data.version = chunkData.version || ''
      data.last_updated = chunkData.last_updated || ''
      data.source = chunkData.source || ''
      data.description = chunkData.description || ''
    }

    // Merge artists from this chunk
    Object.assign(data.artists, chunkData.artists)

    const progress = ((i + 1) / files.length * 100).toFixed(0)
    console.log(`[MusicBrainz] Loaded chunk ${i + 1}/${files.length} (${progress}%)`)
  }

  const loadTime = ((Date.now() - startTime) / 1000).toFixed(2)
  const artistCount = Object.keys(data.artists).length

  data.artist_count = artistCount
  musicbrainzData = data
  isLoading = false

  console.log(`[MusicBrainz] ✅ Loaded ${artistCount.toLocaleString()} artists in ${loadTime}s`)
}

/**
 * Load from single file (fallback for original data)
 */
async function loadFromSingleFile(filePath: string) {
  const startTime = Date.now()
  console.log(`[MusicBrainz] Loading from single file: ${filePath}`)

  const fileContent = readFileSync(filePath, 'utf-8')
  const data = JSON.parse(fileContent)

  const loadTime = ((Date.now() - startTime) / 1000).toFixed(2)
  const artistCount = Object.keys(data.artists).length

  musicbrainzData = data
  isLoading = false

  console.log(`[MusicBrainz] ✅ Loaded ${artistCount.toLocaleString()} artists in ${loadTime}s`)
}

/**
 * Load MusicBrainz data asynchronously at module initialization
 */
export async function loadMusicBrainzData() {
  try {
    const chunksDir = join(process.cwd(), 'server/data/musicbrainz-enriched-chunks')
    const originalPath = join(process.cwd(), 'server/data/musicbrainz-artists.json')

    // Check if we have chunked enriched data
    if (existsSync(chunksDir)) {
      await loadFromChunks(chunksDir)
    } else {
      // Fall back to original single file
      console.log('[MusicBrainz] Enriched chunks not found, loading original data...')
      await loadFromSingleFile(originalPath)
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Unknown error loading MusicBrainz data'
    isLoading = false
    console.error('[MusicBrainz] ❌ Failed to load data:', loadError)
  }
}

/**
 * Get MusicBrainz data
 */
export function getMusicBrainzData(): MusicBrainzData | null {
  return musicbrainzData
}

/**
 * Get loading status
 */
export function getLoadingStatus() {
  return {
    isLoading,
    loadError,
    data: musicbrainzData
  }
}

// Simple in-memory cache (replace with node-cache later if needed)
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL_MS = 3600000 // 1 hour

/**
 * Get cached data if available and not expired
 */
export function getCached(key: string): any | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }
  cache.delete(key)
  return null
}

/**
 * Set cache data
 */
export function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() })
}

/**
 * Get cache size
 */
export function getCacheSize(): number {
  return cache.size
}

/**
 * Calculate adaptive relevance score for an artist
 */
export function scoreArtist(
  artistData: any,
  mbidStats: { min: number; max: number; range: number },
  queryParams: { tag?: string; era?: string }
): number {
  let score = 0

  // Adaptive weighting based on MBID diversity in result pool
  // Wide range = MBID is discriminative, use it heavily
  // Narrow range = MBID doesn't help, rely on other factors
  const mbidWeight = mbidStats.range > 50000 ? 40 : 20
  const eraWeight = mbidStats.range > 50000 ? 30 : 40
  const tagWeight = 20
  const genreWeight = 10

  // 1. MBID Score (popularity proxy - lower MBID = earlier addition = more notable)
  const mbidNum = parseInt(artistData.mbid)
  if (!isNaN(mbidNum) && mbidStats.range > 0) {
    // Normalise within this result pool (0 to mbidWeight points)
    const normalisedScore = ((mbidStats.max - mbidNum) / mbidStats.range) * mbidWeight
    score += normalisedScore
  }

  // 2. Era Match (if era filter provided)
  if (queryParams.era) {
    const eraStart = getEraStart(queryParams.era)
    const eraEnd = getEraEnd(queryParams.era)

    // Prefer release year data over formation year (more accurate for era matching)
    if (artistData.releaseYears && artistData.releaseYears.length > 0) {
      // Count releases in target era
      const releasesInEra = artistData.releaseYears.filter(
        (year: number) => year >= eraStart && year <= eraEnd
      ).length

      if (releasesInEra > 0) {
        // Give bonus points based on release activity in era
        // More releases = more active in that era = higher score
        const releaseBonus = Math.min(eraWeight, releasesInEra * 5) // 5 points per release, capped at eraWeight
        score += releaseBonus
      } else {
        // Artist has release data but no releases in this era
        // Small penalty to deprioritise (but don't eliminate entirely)
        score -= 5
      }
    } else if (artistData.begin_year) {
      // Fallback to formation year if no release data available
      // Use reduced penalty to avoid being too harsh
      if (artistData.begin_year >= eraStart && artistData.begin_year <= eraEnd) {
        // Formed in target era
        const fallbackScore = eraWeight * 0.7
        score += fallbackScore
      } else {
        // Partial credit for nearby years (reduced penalty)
        const yearDiff = Math.min(
          Math.abs(artistData.begin_year - eraStart),
          Math.abs(artistData.begin_year - eraEnd)
        )
        const fallbackScore = Math.max(0, (eraWeight * 0.7) - (yearDiff * 1))
        score += fallbackScore
      }
    }
  }

  // 3. Tag Diversity (more tags = more notable/documented)
  const tagCount = artistData.tags?.length || 0
  const tagScore = Math.min(tagWeight, tagCount * 3)
  score += tagScore

  // 4. Genre Match Quality
  if (queryParams.tag && artistData.tags) {
    const hasExactMatch = artistData.tags.some((t: string) =>
      t.toLowerCase().includes(queryParams.tag!.toLowerCase())
    )
    if (hasExactMatch) {
      score += genreWeight
    }
  }

  return score
}

/**
 * Extract era start year from era string (e.g., "1990s" -> 1990, "1980-1989" -> 1980)
 */
export function getEraStart(era: string): number {
  // Handle range format: "1980-1989"
  const rangeMatch = era.match(/(\d{4})-(\d{4})/)
  if (rangeMatch) {
    return parseInt(rangeMatch[1])
  }

  // Handle decade format: "1980s"
  const match = era.match(/(\d{4})s?/)
  if (match) {
    return parseInt(match[1])
  }

  // Handle "1970s" format
  const decadeMatch = era.match(/(\d{3})0s/)
  if (decadeMatch) {
    return parseInt(decadeMatch[1] + '0')
  }

  return 1900 // Fallback
}

/**
 * Extract era end year from era string (e.g., "1990s" -> 1999, "1980-1989" -> 1989)
 */
export function getEraEnd(era: string): number {
  // Handle range format: "1980-1989"
  const rangeMatch = era.match(/(\d{4})-(\d{4})/)
  if (rangeMatch) {
    return parseInt(rangeMatch[2])
  }

  // Handle decade format: "1980s"
  const start = getEraStart(era)
  if (era.includes('s')) {
    return start + 9 // Decade
  }

  return start // Single year
}
