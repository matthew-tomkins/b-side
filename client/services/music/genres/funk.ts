import { GenreRelationship } from './types'

export const funkGenres = {
  'funk': {
    synonyms: ['funk'],
    parents: ['soul', 'r&b'],
    related: ['disco', 'soul', 'jazz']
  },
  
  'afrobeat': {
    synonyms: ['afrobeat', 'afro-beat'],
    parents: ['funk', 'world music'],
    related: ['highlife', 'afro-funk', 'jazz', 'afrobeats']
  },
  
  'afrobeats': {
    synonyms: ['afrobeats', 'afro-beats'],
    parents: ['afrobeat', 'afropop'],
    related: ['afrobeat', 'afropop', 'dancehall', 'hip hop']
  },
  
  'p-funk': {
    synonyms: ['p-funk', 'p funk', 'parliament-funkadelic'],
    parents: ['funk'],
    related: ['funk', 'funk rock', 'psychedelic']
  }
} as const satisfies Record<string, GenreRelationship>