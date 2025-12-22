import { GenreRelationship } from './types'

export const rockGenres = {
  'rock': {
    synonyms: ['rock', 'rock music'],
    parents: [],
    related: ['pop', 'blues', 'folk']
  },
  
  'grunge': {
    synonyms: ['grunge'],
    parents: ['rock', 'alternative rock'],
    related: ['alternative', 'punk rock', 'hard rock', 'indie rock', 'seattle']
  },
  
  'alternative rock': {
    synonyms: ['alternative rock', 'alt-rock', 'alternative'],
    parents: ['rock'],
    related: ['indie rock', 'grunge', 'post-punk']
  },
  
  'indie rock': {
    synonyms: ['indie rock', 'indie'],
    parents: ['rock', 'alternative rock'],
    related: ['indie pop', 'alternative', 'garage rock']
  }
} as const satisfies Record<string, GenreRelationship>