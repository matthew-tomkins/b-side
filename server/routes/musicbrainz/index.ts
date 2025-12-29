import express from 'express'
import { loadMusicBrainzData } from './utils'
import searchRoutes from './search'
import enrichRoutes from './enrich'
import statusRoutes from './status'

const router = express.Router()

// Start loading MusicBrainz data immediately
loadMusicBrainzData()

// Register route modules
router.use('/', statusRoutes)      // GET /api/musicbrainz/status
router.use('/', searchRoutes)      // GET /api/musicbrainz/artists/search, /countries/:country/artists, /tags/:tag/artists
router.use('/', enrichRoutes)      // GET /api/musicbrainz/artists/:name, POST /api/musicbrainz/artists/enrich

export default router
