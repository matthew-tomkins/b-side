import express from 'express'
import Anthropic from '@anthropic-ai/sdk'

const router = express.Router()

// Initialize Anthropic client with API key from environment
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ParsedQuery {
  region?: string
  country?: string
  multiCountryRegion?: string[]
  genre: string
  era?: string
  decade?: string
  mood?: string
  popularity?: 'mainstream' | 'underground' | 'obscure'
}

/**
 * Continent to country mappings
 * Focus on countries with rich music history and MusicBrainz coverage
 */
const CONTINENT_MAPPINGS: Record<string, string[]> = {
  'africa': ['Nigeria', 'Ghana', 'Senegal', 'South Africa', 'Kenya', 'Mali', 'Ethiopia', 'Egypt', 'Tanzania', 'Uganda', 'Zimbabwe', 'Cameroon'],
  'asia': ['Japan', 'South Korea', 'China', 'India', 'Thailand', 'Indonesia', 'Philippines', 'Vietnam', 'Malaysia', 'Singapore', 'Taiwan', 'Pakistan'],
  'europe': ['United Kingdom', 'France', 'Germany', 'Sweden', 'Italy', 'Spain', 'Netherlands', 'Norway', 'Finland', 'Belgium', 'Denmark', 'Switzerland', 'Austria', 'Poland', 'Portugal', 'Ireland', 'Greece'],
  'south america': ['Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela', 'Uruguay', 'Ecuador', 'Bolivia'],
  'latin america': ['Brazil', 'Argentina', 'Mexico', 'Colombia', 'Chile', 'Peru', 'Venezuela', 'Uruguay', 'Ecuador', 'Bolivia', 'Cuba', 'Dominican Republic', 'Puerto Rico'],
  'north america': ['United States', 'Canada', 'Mexico'],
  'oceania': ['Australia', 'New Zealand'],
  'middle east': ['Turkey', 'Israel', 'Lebanon', 'Iran', 'Egypt', 'Jordan', 'UAE', 'Saudi Arabia']
}

/**
 * Check if a word is a continent name
 */
function getContinentCountries(word: string): string[] | null {
  const normalized = word.toLowerCase()

  // Check exact matches
  if (CONTINENT_MAPPINGS[normalized]) {
    return CONTINENT_MAPPINGS[normalized]
  }

  // Check partial matches for multi-word continents
  for (const [continent, countries] of Object.entries(CONTINENT_MAPPINGS)) {
    if (normalized.includes(continent) || continent.includes(normalized)) {
      return countries
    }
  }

  return null
}

/**
 * Fallback regex-based parser when AI is unavailable
 * Handles common patterns like "genre country year-range"
 */
function parseWithRegex(query: string): ParsedQuery {
  const normalized = query.trim()

  // Pattern: "genre continent YYYY-YYYY" (e.g., "funk africa 1970-1979")
  const continentPattern1 = /^(\w+(?:\s+\w+)?)\s+([a-zA-Z\s]+?)\s+(\d{4})-(\d{4})$/
  const continentMatch1 = normalized.match(continentPattern1)

  if (continentMatch1) {
    const [, genre, location, startYear, endYear] = continentMatch1
    const countries = getContinentCountries(location)

    if (countries) {
      console.log(`[QueryParser] Regex parsed continent: genre="${genre}", continent="${location}" → ${countries.length} countries, era="${startYear}-${endYear}"`)
      return {
        genre,
        multiCountryRegion: countries,
        era: `${startYear}-${endYear}`
      }
    }
  }

  // Pattern: "genre continent" (e.g., "funk africa")
  const continentPattern2 = /^(\w+(?:\s+\w+)?)\s+([a-zA-Z\s]+)$/
  const continentMatch2 = normalized.match(continentPattern2)

  if (continentMatch2) {
    const [, genre, location] = continentMatch2
    const countries = getContinentCountries(location)

    if (countries) {
      console.log(`[QueryParser] Regex parsed continent: genre="${genre}", continent="${location}" → ${countries.length} countries`)
      return {
        genre,
        multiCountryRegion: countries
      }
    }
  }

  // Pattern: "genre country YYYY-YYYY" (e.g., "funk Nigeria 1980-1989")
  const pattern1 = /^(\w+(?:\s+\w+)?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d{4})-(\d{4})$/
  const match1 = normalized.match(pattern1)

  if (match1) {
    const [, genre, country, startYear, endYear] = match1
    console.log(`[QueryParser] Regex parsed: genre="${genre}", country="${country}", era="${startYear}-${endYear}"`)
    return {
      genre,
      country,
      era: `${startYear}-${endYear}`
    }
  }

  // Pattern: "genre YYYY-YYYY" (e.g., "punk 1970-1979")
  const pattern2 = /^(.+?)\s+(\d{4})-(\d{4})$/
  const match2 = normalized.match(pattern2)

  if (match2) {
    const [, genre, startYear, endYear] = match2
    console.log(`[QueryParser] Regex parsed: genre="${genre}", era="${startYear}-${endYear}"`)
    return {
      genre,
      era: `${startYear}-${endYear}`
    }
  }

  // Pattern: "genre country" (e.g., "funk Nigeria")
  const pattern3 = /^(\w+(?:\s+\w+)?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)$/
  const match3 = normalized.match(pattern3)

  if (match3) {
    const [, genre, country] = match3
    console.log(`[QueryParser] Regex parsed: genre="${genre}", country="${country}"`)
    return {
      genre,
      country
    }
  }

  // Fallback: treat entire query as genre
  console.log(`[QueryParser] Regex fallback: treating "${normalized}" as genre`)
  return { genre: normalized }
}

/**
 * Parse a music search query using AI (with regex fallback)
 * POST /api/query-parser/parse
 * Body: { query: string }
 */
router.post('/parse', async (req, res) => {
  try {
    const { query } = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid query parameter' })
    }

    console.log(`[QueryParser] Parsing query: "${query}"`)

    // Try AI parsing if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Parse this music search query into structured data. Return ONLY valid JSON, no other text.

Query: "${query}"

Extract:
- region: city name only (e.g., "Seattle", "Tokyo", "Lagos")
- country: ISO country name (e.g., "USA", "Japan", "Nigeria", "Ghana")
- multiCountryRegion: for continents or regions spanning multiple countries, list primary countries with rich music history
  - "africa" → ["Nigeria", "Ghana", "Senegal", "South Africa", "Kenya", "Mali", "Ethiopia", "Egypt", "Tanzania", "Uganda", "Zimbabwe", "Cameroon"]
  - "asia" → ["Japan", "South Korea", "China", "India", "Thailand", "Indonesia", "Philippines", "Vietnam", "Malaysia", "Singapore", "Taiwan", "Pakistan"]
  - "europe" → ["United Kingdom", "France", "Germany", "Sweden", "Italy", "Spain", "Netherlands", "Norway", "Finland", "Belgium", "Denmark", "Switzerland", "Austria", "Poland", "Portugal", "Ireland", "Greece"]
  - "latin america" or "south america" → ["Brazil", "Argentina", "Mexico", "Colombia", "Chile", "Peru", "Venezuela", "Uruguay", "Ecuador", "Bolivia", "Cuba", "Dominican Republic", "Puerto Rico"]
- genre: music genre (e.g., "funk", "grunge", "city pop")
- era: time period as "YYYY-YYYY" (e.g., "1970-1979", "1990-1999")
- decade: decade if mentioned (e.g., "1980s", "1990s")
- mood: mood/vibe (e.g., "upbeat", "melancholic", "underground")
- popularity: "mainstream", "underground", or "obscure" if implied

Example:
Query: "grunge from seattle in the 90s"
Output: {"region":"Seattle","country":"USA","genre":"grunge","era":"1990-1999","decade":"1990s"}

Example:
Query: "funk africa 1970-1979"
Output: {"multiCountryRegion":["Nigeria","Ghana","Senegal","South Africa","Kenya","Mali","Ethiopia","Egypt","Tanzania","Uganda","Zimbabwe","Cameroon"],"genre":"funk","era":"1970-1979"}

Example:
Query: "west africa funk"
Output: {"multiCountryRegion":["Nigeria","Ghana","Senegal","Mali"],"genre":"funk"}

Now parse: "${query}"`
          }]
        })

        // Extract JSON from response
        const content = message.content[0]
        if (content.type === 'text') {
          const jsonMatch = content.text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            console.log('[QueryParser] AI parsed result:', parsed)
            return res.json(parsed)
          }
        }

        throw new Error('Failed to extract JSON from AI response')
      } catch (aiError) {
        console.error('[QueryParser] AI parsing failed:', aiError)
        console.log('[QueryParser] Falling back to regex parser')
      }
    } else {
      console.log('[QueryParser] No API key configured, using regex parser')
    }

    // Fallback to regex parser
    const parsed = parseWithRegex(query)
    res.json(parsed)

  } catch (error) {
    console.error('[QueryParser] Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
