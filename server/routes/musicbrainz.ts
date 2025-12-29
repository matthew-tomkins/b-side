import express from 'express'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

const router = express.Router()

// Load MusicBrainz data once at startup (server-side only)
let musicbrainzData: {
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
} | null = null

let loadError: string | null = null
let isLoading = true

// Load data asynchronously at module initialization
// Uses chunked files to avoid V8's string size limit (~536MB)
async function loadMusicBrainzData() {
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

// Load from multiple chunk files
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

// Load from single file (fallback for original data)
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

// Start loading immediately
loadMusicBrainzData()

// Simple in-memory cache (replace with node-cache later if needed)
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL_MS = 3600000 // 1 hour

function getCached(key: string): any | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }
  cache.delete(key)
  return null
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() })
}

/**
 * Get server status and metadata
 * GET /api/musicbrainz/status
 */
router.get('/status', (req, res) => {
  if (loadError) {
    return res.status(503).json({
      status: 'error',
      error: loadError,
      loaded: false,
      loading: false
    })
  }

  if (isLoading) {
    return res.status(503).json({
      status: 'loading',
      message: 'MusicBrainz data is still loading...',
      loaded: false,
      loading: true
    })
  }

  res.json({
    status: 'ok',
    loaded: true,
    loading: false,
    artist_count: Object.keys(musicbrainzData?.artists || {}).length,
    version: musicbrainzData?.version,
    last_updated: musicbrainzData?.last_updated,
    cache_size: cache.size
  })
})

/**
 * Calculate adaptive relevance score for an artist
 */
function scoreArtist(
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
    // Normalize within this result pool (0 to mbidWeight points)
    const normalizedScore = ((mbidStats.max - mbidNum) / mbidStats.range) * mbidWeight
    score += normalizedScore
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
        // Small penalty to deprioritize (but don't eliminate entirely)
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
function getEraStart(era: string): number {
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
function getEraEnd(era: string): number {
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

/**
 * Search artists by name, country, or tags
 * GET /api/musicbrainz/artists/search?q=Ramones&country=US&tag=punk&limit=50&era=1990s
 */
router.get('/artists/search', (req, res) => {
  try {
    if (isLoading) {
      return res.status(503).json({ error: 'MusicBrainz data is still loading, please try again in a moment' })
    }

    if (!musicbrainzData) {
      return res.status(503).json({ error: 'MusicBrainz data not loaded' })
    }

    const { q, country, tag, era, limit = '50' } = req.query
    const maxResults = Math.min(parseInt(limit as string) || 50, 500) // Allow up to 500 for scoring

    console.log(`[DEBUG MusicBrainz] Search query:`, { q, country, tag, era, limit })

    // Create cache key
    const cacheKey = `search:${q}:${country}:${tag}:${era}:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      return res.json({ ...cached, cached: true })
    }

    const allResults: Array<{ name: string; data: any }> = []
    const queryLower = (q as string || '').toLowerCase()
    const countryLower = (country as string || '').toLowerCase()
    const tagLower = (tag as string || '').toLowerCase()

    // Collect ALL matching artists - no limit!
    // We need to score every match to ensure high-quality artists (like AC/DC) aren't missed
    // Geographic + genre queries typically return <1000 artists, which is fast enough
    for (const [artistName, artistData] of Object.entries(musicbrainzData.artists)) {
      // Apply filters
      if (q && !artistName.toLowerCase().includes(queryLower)) continue

      // Country filter: Use exact match for 2-letter codes, partial match for full names
      if (country) {
        if (!artistData.country) continue
        const artistCountryLower = artistData.country.toLowerCase()
        // Exact match for ISO codes (2 letters) to avoid false positives like "NG" matching "Washington"
        const isExactMatch = countryLower.length === 2
          ? artistCountryLower === countryLower
          : artistCountryLower.includes(countryLower)
        if (!isExactMatch) continue
      }

      if (tag && (!artistData.tags || !artistData.tags.some(t => t.toLowerCase().includes(tagLower)))) continue

      allResults.push({ name: artistName, data: artistData })
    }

    // Calculate MBID statistics for adaptive weighting
    const mbids = allResults
      .map(r => parseInt(r.data.mbid))
      .filter(m => !isNaN(m))

    const mbidStats = {
      min: mbids.length > 0 ? Math.min(...mbids) : 0,
      max: mbids.length > 0 ? Math.max(...mbids) : 0,
      range: mbids.length > 0 ? Math.max(...mbids) - Math.min(...mbids) : 0
    }

    // Score and sort all results
    const scoredResults = allResults.map(result => ({
      ...result,
      score: scoreArtist(result.data, mbidStats, { tag: tag as string, era: era as string })
    }))

    scoredResults.sort((a, b) => b.score - a.score)

    // Take top N results
    const results = scoredResults.slice(0, maxResults)

    console.log(`[DEBUG MusicBrainz] Total matches: ${allResults.length}, Returning top: ${results.length}`)
    if (results.length > 0) {
      console.log(`[DEBUG MusicBrainz] Top 3 results:`, results.slice(0, 3).map(r => ({
        name: r.name,
        country: r.data.country,
        mbid: r.data.mbid,
        score: r.score
      })))
    }

    const response = {
      results,
      total: results.length,
      totalMatches: allResults.length,
      mbidStats,
      query: { q, country, tag, era, limit: maxResults },
      cached: false
    }

    setCache(cacheKey, response)
    res.json(response)
  } catch (error) {
    console.error('[MusicBrainz] Search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Get single artist by name
 * GET /api/musicbrainz/artists/:name
 */
router.get('/artists/:name', (req, res) => {
  try {
    if (!musicbrainzData) {
      return res.status(503).json({ error: 'MusicBrainz data not loaded' })
    }

    const { name } = req.params
    const artistData = musicbrainzData.artists[name]

    if (!artistData) {
      return res.status(404).json({ error: 'Artist not found', name })
    }

    res.json({
      name,
      ...artistData
    })
  } catch (error) {
    console.error('[MusicBrainz] Get artist error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Enrich multiple artists with MusicBrainz data
 * POST /api/musicbrainz/artists/enrich
 * Body: { artists: ["Ramones", "Black Flag", "Dead Kennedys"] }
 */
router.post('/artists/enrich', (req, res) => {
  try {
    if (!musicbrainzData) {
      return res.status(503).json({ error: 'MusicBrainz data not loaded' })
    }

    const { artists } = req.body

    if (!Array.isArray(artists)) {
      return res.status(400).json({ error: 'artists must be an array' })
    }

    // Create cache key from sorted artist list
    const cacheKey = `enrich:${artists.slice().sort().join(',')}`
    const cached = getCached(cacheKey)
    if (cached) {
      return res.json({ ...cached, cached: true })
    }

    const enriched: Record<string, any> = {}
    let found = 0
    let notFound = 0

    for (const artistName of artists) {
      const artistData = musicbrainzData.artists[artistName]
      if (artistData) {
        enriched[artistName] = artistData
        found++
      } else {
        notFound++
      }
    }

    const response = {
      enriched,
      stats: {
        requested: artists.length,
        found,
        notFound
      },
      cached: false
    }

    setCache(cacheKey, response)
    res.json(response)
  } catch (error) {
    console.error('[MusicBrainz] Enrich error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Get artists by country
 * GET /api/musicbrainz/countries/:country/artists?limit=100
 */
router.get('/countries/:country/artists', (req, res) => {
  try {
    if (!musicbrainzData) {
      return res.status(503).json({ error: 'MusicBrainz data not loaded' })
    }

    const { country } = req.params
    const { limit = '100' } = req.query
    const maxResults = Math.min(parseInt(limit as string) || 100, 500)

    const cacheKey = `country:${country}:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      return res.json({ ...cached, cached: true })
    }

    const results: Array<{ name: string; data: any }> = []
    const countryLower = country.toLowerCase()

    for (const [artistName, artistData] of Object.entries(musicbrainzData.artists)) {
      if (artistData.country) {
        const artistCountryLower = artistData.country.toLowerCase()
        // Exact match for ISO codes (2 letters), partial match for full names
        const isMatch = countryLower.length === 2
          ? artistCountryLower === countryLower
          : artistCountryLower.includes(countryLower)
        if (isMatch) {
          results.push({ name: artistName, data: artistData })
          if (results.length >= maxResults) break
        }
      }
    }

    const response = {
      country,
      results,
      total: results.length,
      cached: false
    }

    setCache(cacheKey, response)
    res.json(response)
  } catch (error) {
    console.error('[MusicBrainz] Country search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Get artists by tag
 * GET /api/musicbrainz/tags/:tag/artists?limit=100
 */
router.get('/tags/:tag/artists', (req, res) => {
  try {
    if (!musicbrainzData) {
      return res.status(503).json({ error: 'MusicBrainz data not loaded' })
    }

    const { tag } = req.params
    const { limit = '100' } = req.query
    const maxResults = Math.min(parseInt(limit as string) || 100, 500)

    const cacheKey = `tag:${tag}:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      return res.json({ ...cached, cached: true })
    }

    const results: Array<{ name: string; data: any }> = []
    const tagLower = tag.toLowerCase()

    for (const [artistName, artistData] of Object.entries(musicbrainzData.artists)) {
      if (artistData.tags?.some(t => t.toLowerCase().includes(tagLower))) {
        results.push({ name: artistName, data: artistData })
        if (results.length >= maxResults) break
      }
    }

    const response = {
      tag,
      results,
      total: results.length,
      cached: false
    }

    setCache(cacheKey, response)
    res.json(response)
  } catch (error) {
    console.error('[MusicBrainz] Tag search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
