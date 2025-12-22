import { popGenres } from './pop'
import { funkGenres } from './funk'
import { rockGenres } from './rock'
import { GenreRelationship } from './types'

export type { GenreRelationship } from './types'

// Combine all genre categories
export const genreRegistry: Record<string, GenreRelationship> = {
  ...popGenres,
  ...funkGenres,
  ...rockGenres,
  // Add more as project expands
}

// Helper function for smart genre matching
export function getGenreScore(artistTag: string, searchGenre: string): number {
  const normalizedTag = artistTag.toLowerCase().trim()
  const normalizedSearch = searchGenre.toLowerCase().trim()

  // Exact match - highest score
  if (normalizedTag === normalizedSearch) {
    return 30
  }

  // Check registry for relationship matches
  const relationship = genreRegistry[normalizedSearch]
  
  if (relationship) {
    // Exact synonym match
    if (relationship.synonyms.some(s => s.toLowerCase() === normalizedTag)) {
      return 30
    }
    
    // Related genre match
    if (relationship.related.some(r => r.toLowerCase() === normalizedTag)) {
      return 15
    }
  }

  // Partial substring matching
  if (normalizedTag.includes(normalizedSearch) || normalizedSearch.includes(normalizedTag)) {
    return 25
  }

  // Word-by-word matching for compound genres
  const searchWords = normalizedSearch.split(/[\s-]+/).filter(w => w.length >= 3)
  const tagWords = normalizedTag.split(/[\s-]+/).filter(w => w.length >= 3)

  for (const searchWord of searchWords) {
    for (const tagWord of tagWords) {
      // Exact word match
      if (searchWord === tagWord) {
        return 20
      }
      // Partial word match
      if (tagWord.includes(searchWord) || searchWord.includes(tagWord)) {
        return 15
      }
    }
  }

  return 0
}