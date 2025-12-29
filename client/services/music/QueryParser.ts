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
 * Client-side fallback regex parser (same as server-side)
 * Used if server is unavailable
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
      console.log(`[Client] Regex parsed continent: genre="${genre}", continent="${location}" → ${countries.length} countries, era="${startYear}-${endYear}"`)
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
      console.log(`[Client] Regex parsed continent: genre="${genre}", continent="${location}" → ${countries.length} countries`)
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
    console.log(`[Client] Regex parsed: genre="${genre}", country="${country}", era="${startYear}-${endYear}"`)
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
    console.log(`[Client] Regex parsed: genre="${genre}", era="${startYear}-${endYear}"`)
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
    console.log(`[Client] Regex parsed: genre="${genre}", country="${country}"`)
    return {
      genre,
      country
    }
  }

  // Fallback: treat entire query as genre
  console.log(`[Client] Regex fallback: treating "${normalized}" as genre`)
  return { genre: normalized }
}

export class QueryParser {
  async parse(userQuery: string): Promise<ParsedQuery> {
    try {
      console.log('[QueryParser] Sending query to server:', userQuery)

      // Call server-side parser endpoint
      const response = await fetch('/api/query-parser/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: userQuery })
      })

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`)
      }

      const parsed = await response.json()
      console.log('[QueryParser] Server parsed result:', parsed)
      console.log(`  - country: ${parsed.country || 'none'}`)
      console.log(`  - multiCountryRegion: ${parsed.multiCountryRegion?.join(', ') || 'none'}`)
      console.log(`  - genre: ${parsed.genre || 'none'}`)
      console.log(`  - era: ${parsed.era || 'none'}`)
      return parsed

    } catch (err) {
      console.error('[QueryParser] Server parsing failed:', err)
      console.log('[QueryParser] Falling back to client-side regex parser')
      // Fallback: use client-side regex parser
      return parseWithRegex(userQuery)
    }
  }
}