import express from 'express'
import { getMusicBrainzData, getLoadingStatus, getCached, setCache, scoreArtist } from './utils'

const router = express.Router()

/**
 * Search artists by name, country, or tags
 * GET /api/musicbrainz/artists/search?q=Ramones&country=US&tag=punk&limit=50&era=1990s
 */
router.get('/artists/search', (req, res) => {
  try {
    const { isLoading } = getLoadingStatus()
    if (isLoading) {
      return res.status(503).json({ error: 'MusicBrainz data is still loading, please try again in a moment' })
    }

    const musicbrainzData = getMusicBrainzData()
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
 * Get artists by country
 * GET /api/musicbrainz/countries/:country/artists?limit=100
 */
router.get('/countries/:country/artists', (req, res) => {
  try {
    const musicbrainzData = getMusicBrainzData()
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
    const musicbrainzData = getMusicBrainzData()
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
