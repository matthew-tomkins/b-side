import { GenreRelationship } from './types'

export const popGenres = {
  'city pop': {
    synonyms: ['city pop', 'citypop', 'シティポップ', 'シティ・ポップ'],
    parents: [],
    related: ['j-pop', 'synthpop', 'funk', 'disco', 'yacht rock', 'soft rock', '80s']
  },
  
  'j-pop': {
    synonyms: ['j-pop', 'jpop', 'japanese pop'],
    parents: ['pop'],
    related: ['city pop', 'k-pop', 'asian pop']
  },
  
  'k-pop': {
    synonyms: ['k-pop', 'kpop', 'korean pop'],
    parents: ['pop'],
    related: ['j-pop', 'dance pop']
  },
  
  'indie pop': {
    synonyms: ['indie pop', 'indiepop'],
    parents: ['pop', 'indie'],
    related: ['indie rock', 'dream pop', 'bedroom pop']
  },
  
  'pop': {
    synonyms: ['pop', 'pop music'],
    parents: [],
    related: ['rock', 'r&b', 'dance']
  }
} as const satisfies Record<string, GenreRelationship>