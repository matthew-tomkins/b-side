// Date and era utilities for music discovery

/**
 * Convert decade string to era range
 * @param decade - Decade string (e.g., "1980s", "90s")
 * @returns Era range (e.g., "1980-1989", "1990-1999")
 */
export function decadeToEra(decade: string): string {
  const match = decade.match(/(\d{4})s/)
  if (match) {
    const startYear = parseInt(match[1])
    const endYear = startYear + 9
    return `${startYear}-${endYear}`
  }

  // Handle other decade formats like "90s" → "1990-1999"
  const shortMatch = decade.match(/(\d{2})s/)
  if (shortMatch) {
    const twoDigit = parseInt(shortMatch[1])
    const startYear = twoDigit < 50 ? 2000 + twoDigit : 1900 + twoDigit
    const endYear = startYear + 9
    return `${startYear}-${endYear}`
  }

  return decade // Return as-is if we can't parse it
}

/**
 * Parse era range string into start and end years
 * @param era - Era range (e.g., "1980-1989")
 * @returns Object with start and end years, or null if invalid
 */
export function parseEraRange(era: string): { start: number; end: number } | null {
  const match = era.match(/^(\d{4})-(\d{4})$/)
  if (!match) return null

  return {
    start: parseInt(match[1]),
    end: parseInt(match[2])
  }
}

/**
 * Check if a year falls within an era range
 * @param year - Year to check
 * @param era - Era range (e.g., "1980-1989")
 * @returns true if year is within the era range
 */
export function yearInRange(year: number, era: string): boolean {
  const range = parseEraRange(era)
  if (!range) return false

  return year >= range.start && year <= range.end
}
