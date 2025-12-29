/**
 * Genre Mapper - Maps between Every Noise, MusicBrainz, and Discogs genre taxonomies
 *
 * Source: genre-ontology.json (generated from Every Noise + our enriched data)
 * License: MIT (Every Noise), CC BY-NC-SA (MusicBrainz), Fair Use (Discogs)
 * Attribution: Glenn McDonald (Every Noise at Once) - https://everynoise.com
 */

import genreOntology from '../../data/genre-ontology.json'

interface GenreOntologyEntry {
  canonical: string
  aliases: string[]
  sources: {
    everynoise: string
    musicbrainz: string[]
    discogs: string[]
  }
  relationships: {
    parent?: string
    children: string[]
    related: string[]
  }
  geography: {
    typical_countries: string[]
  }
  stats: {
    artist_count: number
  }
}

interface GenreOntologyData {
  version: string
  source: string
  license: string
  generated_at: string
  total_genres: number
  stats: {
    total_artists_analyzed: number
    genres_with_mb_mapping: number
    genres_with_discogs_mapping: number
  }
  genres: Record<string, GenreOntologyEntry>
}

export class GenreMapper {
  private ontology: GenreOntologyData
  private mbTagToGenre: Map<string, string> // MusicBrainz tag → canonical genre
  private discogsToGenre: Map<string, string> // Discogs style → canonical genre
  private aliasToGenre: Map<string, string> // Any alias → canonical genre

  constructor() {
    this.ontology = genreOntology as GenreOntologyData

    // Build reverse lookup maps for fast mapping
    this.mbTagToGenre = new Map()
    this.discogsToGenre = new Map()
    this.aliasToGenre = new Map()

    for (const [canonical, entry] of Object.entries(this.ontology.genres)) {
      // Map MusicBrainz tags
      for (const mbTag of entry.sources.musicbrainz) {
        this.mbTagToGenre.set(this.normalize(mbTag), canonical)
      }

      // Map Discogs styles/genres
      for (const discogsTag of entry.sources.discogs) {
        this.discogsToGenre.set(this.normalize(discogsTag), canonical)
      }

      // Map aliases
      for (const alias of entry.aliases) {
        this.aliasToGenre.set(this.normalize(alias), canonical)
      }

      // Map canonical name itself
      this.aliasToGenre.set(this.normalize(canonical), canonical)
    }
  }

  /**
   * Normalize a genre/tag string for comparison
   */
  private normalize(str: string): string {
    return str.toLowerCase().trim().replace(/[-_\s]+/g, ' ')
  }

  /**
   * Map a MusicBrainz tag to canonical genre name
   */
  mapMusicBrainzTag(tag: string): string | null {
    return this.mbTagToGenre.get(this.normalize(tag)) || null
  }

  /**
   * Map a Discogs style/genre to canonical genre name
   */
  mapDiscogsTag(tag: string): string | null {
    return this.discogsToGenre.get(this.normalize(tag)) || null
  }

  /**
   * Map any tag (from any source) to canonical genre name
   */
  mapToCanonical(tag: string): string | null {
    const normalized = this.normalize(tag)

    // Try alias map first (includes canonical names)
    const fromAlias = this.aliasToGenre.get(normalized)
    if (fromAlias) return fromAlias

    // Try MusicBrainz
    const fromMB = this.mbTagToGenre.get(normalized)
    if (fromMB) return fromMB

    // Try Discogs
    const fromDiscogs = this.discogsToGenre.get(normalized)
    if (fromDiscogs) return fromDiscogs

    return null
  }

  /**
   * Get all possible tags for a canonical genre (for searching)
   * Returns: [canonical, ...aliases, ...mbTags, ...discogsTags]
   */
  getSearchTerms(canonicalGenre: string): string[] {
    const entry = this.ontology.genres[canonicalGenre]
    if (!entry) return []

    return [
      entry.canonical,
      ...entry.aliases,
      ...entry.sources.musicbrainz,
      ...entry.sources.discogs
    ]
  }

  /**
   * Aggregate tags from multiple sources and map to canonical genres
   * Returns genres sorted by frequency (most common first)
   */
  aggregateTags(options: {
    musicbrainzTags?: string[]
    discogsTags?: string[]
    weightMB?: number // Default 1
    weightDiscogs?: number // Default 2 (Discogs is more specific)
  }): Array<{ genre: string; count: number; sources: string[] }> {
    const {
      musicbrainzTags = [],
      discogsTags = [],
      weightMB = 1,
      weightDiscogs = 2
    } = options

    const genreFrequency = new Map<string, { count: number; sources: Set<string> }>()

    // Process MusicBrainz tags
    for (const tag of musicbrainzTags) {
      const canonical = this.mapMusicBrainzTag(tag)
      if (canonical) {
        const entry = genreFrequency.get(canonical) || { count: 0, sources: new Set() }
        entry.count += weightMB
        entry.sources.add('musicbrainz')
        genreFrequency.set(canonical, entry)
      }
    }

    // Process Discogs tags
    for (const tag of discogsTags) {
      const canonical = this.mapDiscogsTag(tag)
      if (canonical) {
        const entry = genreFrequency.get(canonical) || { count: 0, sources: new Set() }
        entry.count += weightDiscogs
        entry.sources.add('discogs')
        genreFrequency.set(canonical, entry)
      }
    }

    // Convert to array and sort
    const result = Array.from(genreFrequency.entries()).map(([genre, data]) => ({
      genre,
      count: data.count,
      sources: Array.from(data.sources)
    }))

    // Sort by: 1) number of sources (consensus), 2) frequency
    result.sort((a, b) => {
      if (a.sources.length !== b.sources.length) {
        return b.sources.length - a.sources.length // More sources first
      }
      return b.count - a.count // Higher count first
    })

    return result
  }

  /**
   * Get related genres (siblings/children/parents) for a canonical genre
   */
  getRelatedGenres(canonicalGenre: string): {
    parent?: string
    children: string[]
    related: string[]
  } {
    const entry = this.ontology.genres[canonicalGenre]
    if (!entry) return { children: [], related: [] }

    return entry.relationships
  }

  /**
   * Get typical countries for a genre
   */
  getTypicalCountries(canonicalGenre: string): string[] {
    const entry = this.ontology.genres[canonicalGenre]
    if (!entry) return []

    return entry.geography.typical_countries
  }

  /**
   * Get stats for a genre (artist count)
   */
  getStats(canonicalGenre: string): { artist_count: number } | null {
    const entry = this.ontology.genres[canonicalGenre]
    if (!entry) return null

    return entry.stats
  }
}

// Singleton instance
export const genreMapper = new GenreMapper()
