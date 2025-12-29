import express from 'express'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const router = express.Router()

// Load config files once at startup
let genreTaxonomy: any = null
let artistSimilarity: any = null
let genreOntology: any = null
let loadError: string | null = null

async function loadConfigData() {
  try {
    const dataDir = join(process.cwd(), 'server/data')

    const taxonomyPath = join(dataDir, 'genre-taxonomy.json')
    const similarityPath = join(dataDir, 'artist-similarity.json')
    const ontologyPath = join(dataDir, 'genre-ontology.json')

    if (existsSync(taxonomyPath)) {
      genreTaxonomy = JSON.parse(readFileSync(taxonomyPath, 'utf-8'))
      console.log('[Config] Loaded genre-taxonomy.json')
    }

    if (existsSync(similarityPath)) {
      artistSimilarity = JSON.parse(readFileSync(similarityPath, 'utf-8'))
      console.log('[Config] Loaded artist-similarity.json')
    }

    if (existsSync(ontologyPath)) {
      genreOntology = JSON.parse(readFileSync(ontologyPath, 'utf-8'))
      console.log('[Config] Loaded genre-ontology.json')
    }

    console.log('[Config] All config files loaded successfully')
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Unknown error loading config data'
    console.error('[Config] Failed to load config data:', loadError)
  }
}

// Start loading immediately
loadConfigData()

/**
 * Get genre taxonomy data
 * GET /api/config/genre-taxonomy
 */
router.get('/genre-taxonomy', (req, res) => {
  if (loadError) {
    return res.status(500).json({ error: 'Failed to load genre taxonomy', details: loadError })
  }

  if (!genreTaxonomy) {
    return res.status(503).json({ error: 'Genre taxonomy not yet loaded' })
  }

  res.json(genreTaxonomy)
})

/**
 * Get artist similarity data
 * GET /api/config/artist-similarity
 */
router.get('/artist-similarity', (req, res) => {
  if (loadError) {
    return res.status(500).json({ error: 'Failed to load artist similarity', details: loadError })
  }

  if (!artistSimilarity) {
    return res.status(503).json({ error: 'Artist similarity not yet loaded' })
  }

  res.json(artistSimilarity)
})

/**
 * Get genre ontology data
 * GET /api/config/genre-ontology
 */
router.get('/genre-ontology', (req, res) => {
  if (loadError) {
    return res.status(500).json({ error: 'Failed to load genre ontology', details: loadError })
  }

  if (!genreOntology) {
    return res.status(503).json({ error: 'Genre ontology not yet loaded' })
  }

  res.json(genreOntology)
})

/**
 * Get config status
 * GET /api/config/status
 */
router.get('/status', (req, res) => {
  res.json({
    loaded: {
      genreTaxonomy: !!genreTaxonomy,
      artistSimilarity: !!artistSimilarity,
      genreOntology: !!genreOntology
    },
    error: loadError
  })
})

export default router
