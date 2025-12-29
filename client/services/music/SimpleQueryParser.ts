/**
 * Simple client-side query parser for SimplifiedDiscoveryEngine
 * No AI, no server calls - just fast regex patterns
 */

export interface SimpleParsedQuery {
  genre: string
  country?: string
  era?: string
}

/**
 * Parse search queries with simple regex patterns
 * Supports formats like:
 * - "punk" (genre only)
 * - "punk 1970-1979" (genre + era)
 * - "punk United States 1970-1979" (genre + country + era)
 */
export function parseSimpleQuery(query: string): SimpleParsedQuery {
  const normalized = query.trim()

  // Pattern 1: "genre country YYYY-YYYY" (e.g., "punk United States 1970-1979")
  // Match genre (1-3 words), country (capitalized words), and year range
  const pattern1 = /^(.+?)\s+([A-Z][a-zA-Z\s]+?)\s+(\d{4})-(\d{4})$/
  const match1 = normalized.match(pattern1)
  if (match1) {
    const [, genre, country, startYear, endYear] = match1
    return {
      genre: genre.trim().toLowerCase(),
      country: country.trim(),
      era: `${startYear}-${endYear}`
    }
  }

  // Pattern 2: "genre YYYY-YYYY" (e.g., "punk 1970-1979")
  const pattern2 = /^(.+?)\s+(\d{4})-(\d{4})$/
  const match2 = normalized.match(pattern2)
  if (match2) {
    const [, genre, startYear, endYear] = match2
    return {
      genre: genre.trim().toLowerCase(),
      era: `${startYear}-${endYear}`
    }
  }

  // Pattern 3: "genre country" (e.g., "punk Nigeria")
  // Try to detect if last word(s) look like a country (capitalized)
  const pattern3 = /^(.+?)\s+([A-Z][a-zA-Z\s]+)$/
  const match3 = normalized.match(pattern3)
  if (match3) {
    const [, genre, possibleCountry] = match3
    return {
      genre: genre.trim().toLowerCase(),
      country: possibleCountry.trim()
    }
  }

  // Pattern 4: Just genre (fallback)
  return { genre: normalized.toLowerCase() }
}
