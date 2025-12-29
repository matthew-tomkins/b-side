import express from 'express'
import { getMusicBrainzData, getCached, setCache } from './utils'

const router = express.Router()

/**
 * Get single artist by name
 * GET /api/musicbrainz/artists/:name
 */
router.get('/artists/:name', (req, res) => {
  try {
    const musicbrainzData = getMusicBrainzData()
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
    const musicbrainzData = getMusicBrainzData()
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

export default router
