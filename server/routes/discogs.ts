import express from 'express'

const router = express.Router()

// Discogs API configuration
const DISCOGS_API_BASE = 'https://api.discogs.com'
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN

// Rate limiting: 60 requests per minute (authenticated)
// Using 1100ms to be conservative and avoid hitting the limit
const RATE_LIMIT_MS = 1100
let lastRequestTime = 0
let requestCount = 0

/**
 * Rate limiting helper - ensures we don't exceed 60/min
 * Conservative rate limiting with 1.1 second delay between requests
 */
async function rateLimit(): Promise<void> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    const waitTime = RATE_LIMIT_MS - timeSinceLastRequest
    console.log(`[Discogs] Rate limiting: waiting ${waitTime}ms (request #${requestCount + 1})`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  lastRequestTime = Date.now()
  requestCount++
  console.log(`[Discogs] Request #${requestCount} - proceeding`)
}

/**
 * Search for a release by artist and album name
 * GET /api/discogs/search?artist=Artist&album=Album
 */
router.get('/search', async (req, res) => {
  try {
    const { artist, album } = req.query

    if (!artist || !album) {
      return res.status(400).json({ error: 'Missing artist or album parameter' })
    }

    if (!DISCOGS_TOKEN) {
      console.warn('DISCOGS_TOKEN not configured')
      return res.status(503).json({ error: 'Discogs integration not configured' })
    }

    await rateLimit()

    const query = `${artist} ${album}`
    const url = new URL(`${DISCOGS_API_BASE}/database/search`)
    url.searchParams.set('q', query)
    url.searchParams.set('type', 'release')
    url.searchParams.set('per_page', '5')

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
        'User-Agent': 'b-side/0.1.0 +https://github.com/matthew-tomkins/b-side'
      }
    })

    if (!response.ok) {
      console.error('Discogs search error:', response.status, response.statusText)
      return res.status(response.status).json({ error: 'Discogs API error' })
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Discogs search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Get release details by Discogs release ID
 * GET /api/discogs/release/:releaseId
 */
router.get('/release/:releaseId', async (req, res) => {
  try {
    const { releaseId } = req.params

    if (!releaseId) {
      return res.status(400).json({ error: 'Missing releaseId parameter' })
    }

    if (!DISCOGS_TOKEN) {
      console.warn('DISCOGS_TOKEN not configured')
      return res.status(503).json({ error: 'Discogs integration not configured' })
    }

    await rateLimit()

    const response = await fetch(`${DISCOGS_API_BASE}/releases/${releaseId}`, {
      headers: {
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
        'User-Agent': 'b-side/0.1.0 +https://github.com/matthew-tomkins/b-side'
      }
    })

    if (!response.ok) {
      console.error('Discogs release error:', response.status, response.statusText)
      return res.status(response.status).json({ error: 'Discogs API error' })
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Discogs release error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
