import express from 'express'
import { getMusicBrainzData, getLoadingStatus, getCacheSize } from './utils'

const router = express.Router()

/**
 * Get server status and metadata
 * GET /api/musicbrainz/status
 */
router.get('/status', (req, res) => {
  const { isLoading, loadError, data } = getLoadingStatus()

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

  const musicbrainzData = getMusicBrainzData()

  res.json({
    status: 'ok',
    loaded: true,
    loading: false,
    artist_count: Object.keys(musicbrainzData?.artists || {}).length,
    version: musicbrainzData?.version,
    last_updated: musicbrainzData?.last_updated,
    cache_size: getCacheSize()
  })
})

export default router
