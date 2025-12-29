// String matching and normalisation utilities

/**
 * Calculate similarity between two artist/band names
 * @param name1 - First name to compare
 * @param name2 - Second name to compare
 * @returns Similarity score (0.0 to 1.0)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const normalize = (str: string) =>
    str.toLowerCase()
      .replace(/^the\s+/i, '')  // Remove leading "The"
      .replace(/[^\w\s]/g, '')  // Remove punctuation
      .trim()

  const n1 = normalize(name1)
  const n2 = normalize(name2)

  // Exact match after normalisation
  if (n1 === n2) return 1.0

  // One name contains the other (for cases like "X" vs "X-Ray Spex")
  if (n1.includes(n2) || n2.includes(n1)) {
    // Prefer shorter matches (e.g., "X" should match "X" not "X-Ray Spex")
    const lengthRatio = Math.min(n1.length, n2.length) / Math.max(n1.length, n2.length)
    return lengthRatio > 0.8 ? 0.9 : 0.6
  }

  // No good match
  return 0
}

/**
 * Normalise artist name for comparison
 * Handles Unicode variations (accents, dashes, quotes)
 * @param name - Artist name to normalise
 * @returns Normalised name
 */
export function normaliseArtistName(name: string): string {
  return name
    .toLowerCase()
    // Normalise Unicode to decomposed form, then remove accents
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Normalise all dash-like characters to regular hyphen
    .replace(/[\u2010-\u2015\u2212]/g, '-') // en-dash, em-dash, minus, etc. → hyphen
    // Normalise quotes and apostrophes
    .replace(/[\u2018\u2019\u201A]/g, "'") // smart single quotes → apostrophe
    .replace(/[\u201C\u201D\u201E]/g, '"') // smart double quotes → quote
    // Normalise whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if artist names match using smart word-based matching
 * Single-word names allow substring matching
 * Multi-word names require all words to match
 * @param searchName - Name being searched for
 * @param resultName - Name from search results
 * @returns true if names match
 */
export function artistNamesMatch(searchName: string, resultName: string): boolean {
  const searchNormalized = normaliseArtistName(searchName)
  const resultNormalized = normaliseArtistName(resultName)

  // Exact match after normalisation
  if (searchNormalized === resultNormalized) return true

  // Filter out common words that don't help with matching
  const stopWords = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'in', 'for', 'on', 'with'])
  const searchWords = searchNormalized.split(/\s+/).filter(w => !stopWords.has(w) && w.length > 1)
  const resultWords = resultNormalized.split(/\s+/).filter(w => !stopWords.has(w) && w.length > 1)

  // Smart matching: single-word vs multi-word names
  if (searchWords.length === 1) {
    // Single word like "Fela", "Madonna", "Sting"
    // Allow substring matching (handles variations)
    return resultWords.length > 0 && resultWords.some(rw =>
      rw.includes(searchWords[0]) || searchWords[0].includes(rw)
    )
  } else {
    // Multi-word like "Joan Adams", "Fela Kuti"
    // Require ALL words to match (prevents surname-only matches)
    return searchWords.every(sw =>
      resultWords.some(rw => rw.includes(sw) || sw.includes(rw))
    )
  }
}
