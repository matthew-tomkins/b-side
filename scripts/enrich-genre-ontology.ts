#!/usr/bin/env tsx
/**
 * Enrich Genre Ontology with MusicBrainz/Discogs Data
 *
 * Purpose:
 * 1. Load Every Noise genres (2,680 canonical names)
 * 2. Map to MusicBrainz tags and Discogs styles via our 1.2M artist dataset
 * 3. Infer genre relationships through tag co-occurrence analysis
 * 4. Infer typical countries from artist geography
 *
 * Strategy:
 * - Use our enriched MusicBrainz dataset (client/data/musicbrainz-artists-enriched.json)
 * - For each Every Noise genre, find matching tags in our data
 * - Analyze which other tags co-occur frequently → related genres
 * - Analyze artist countries → typical_countries
 *
 * Output: client/data/genre-ontology.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Input types
interface EveryNoiseGenre {
  canonical: string
  aliases: string[]
  source: string
}

interface EveryNoiseData {
  version: string
  source: string
  license: string
  attribution: string
  extracted_at: string
  total_genres: number
  genres: Record<string, EveryNoiseGenre>
}

interface MusicBrainzArtist {
  country?: string
  city?: string
  mbid?: string
  begin_year?: number
  end_year?: number
  tags?: string[]
  discogsGenres?: string[]
  discogsStyles?: string[]
  releaseYears?: number[]
}

// Output types
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
    country_frequency: Record<string, number>
  }
  stats: {
    artist_count: number
    mb_tag_frequency: number
    discogs_frequency: number
    co_occurrence_confidence: number
  }
}

interface GenreOntology {
  version: string
  source: string
  license: string
  attribution: string
  generated_at: string
  total_genres: number
  enriched_genres: number
  stats: {
    total_artists_analyzed: number
    genres_with_mb_mapping: number
    genres_with_discogs_mapping: number
    genres_with_relationships: number
  }
  genres: Record<string, GenreOntologyEntry>
}

// Tag normalization utilities
function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[-_\s]+/g, ' ') // Normalize separators to space
    .replace(/\s+/g, ' ')     // Collapse multiple spaces
}

function tagsMatch(tag1: string, tag2: string): boolean {
  const norm1 = normalizeTag(tag1)
  const norm2 = normalizeTag(tag2)

  // Exact match
  if (norm1 === norm2) return true

  // Remove separators entirely for looser match
  const stripped1 = norm1.replace(/\s/g, '')
  const stripped2 = norm2.replace(/\s/g, '')
  if (stripped1 === stripped2) return true

  // Handle plurals (simple check)
  if (norm1 + 's' === norm2 || norm2 + 's' === norm1) return true

  return false
}

function findMatchingTag(everyNoiseGenre: string, allAliases: string[], tags: string[]): string[] {
  const matches: string[] = []

  // Check canonical name + aliases
  const searchTerms = [everyNoiseGenre, ...allAliases]

  for (const term of searchTerms) {
    for (const tag of tags) {
      if (tagsMatch(term, tag)) {
        matches.push(tag)
      }
    }
  }

  return Array.from(new Set(matches)) // Deduplicate
}

// Co-occurrence analysis
interface CoOccurrence {
  genre: string
  count: number
  confidence: number // 0-1, based on overlap percentage
}

function analyzeCoOccurrence(
  genre: string,
  artistsWithGenre: MusicBrainzArtist[],
  allGenreNames: string[]
): CoOccurrence[] {
  const coOccurrenceCounts = new Map<string, number>()
  const totalArtists = artistsWithGenre.length

  if (totalArtists === 0) return []

  // For each artist with this genre, check what other genres they have
  for (const artist of artistsWithGenre) {
    const tags = Array.isArray(artist.tags) ? artist.tags : []
    const discogsGenres = Array.isArray(artist.discogsGenres) ? artist.discogsGenres : []
    const discogsStyles = Array.isArray(artist.discogsStyles) ? artist.discogsStyles : []

    const allTags = [...tags, ...discogsGenres, ...discogsStyles].map(t => normalizeTag(t))

    // Check for other genre matches
    for (const otherGenre of allGenreNames) {
      if (normalizeTag(otherGenre) === normalizeTag(genre)) continue // Skip self

      const hasMatch = allTags.some(tag => tagsMatch(tag, otherGenre))
      if (hasMatch) {
        coOccurrenceCounts.set(otherGenre, (coOccurrenceCounts.get(otherGenre) || 0) + 1)
      }
    }
  }

  // Convert to array with confidence scores
  const results: CoOccurrence[] = []
  for (const [coGenre, count] of coOccurrenceCounts.entries()) {
    const confidence = count / totalArtists // Percentage of artists with both genres
    results.push({ genre: coGenre, count, confidence })
  }

  // Sort by confidence
  return results.sort((a, b) => b.confidence - a.confidence)
}

async function loadEveryNoiseGenres(): Promise<EveryNoiseData> {
  const filePath = path.join(__dirname, '..', 'client', 'data', 'everynoise-genres.json')
  console.log(`📖 Loading Every Noise genres from: ${filePath}`)
  const data = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(data)
}

async function loadMusicBrainzData(): Promise<Record<string, MusicBrainzArtist>> {
  const filePath = path.join(__dirname, '..', 'client', 'data', 'musicbrainz-artists-enriched.json')
  console.log(`📖 Loading MusicBrainz data from: ${filePath}`)

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  MusicBrainz data not found at ${filePath}`)
    return {}
  }

  const data = fs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(data)

  // Check if data has "artists" wrapper
  if (parsed.artists) {
    return parsed.artists
  }

  return parsed
}

async function enrichGenres(
  everyNoiseData: EveryNoiseData,
  mbData: Record<string, MusicBrainzArtist>
): Promise<GenreOntology> {
  const enrichedGenres: Record<string, GenreOntologyEntry> = {}
  const allGenreNames = Object.keys(everyNoiseData.genres)

  console.log(`\n🔄 Enriching ${allGenreNames.length} genres with MusicBrainz/Discogs data...\n`)

  let genresWithMB = 0
  let genresWithDiscogs = 0
  let genresWithRelationships = 0

  for (const [genreName, genreInfo] of Object.entries(everyNoiseData.genres)) {
    const allAliases = genreInfo.aliases
    const allSearchTerms = [genreName, ...allAliases]

    // Find all artists tagged with this genre (via MB tags or Discogs)
    const artistsWithGenre: MusicBrainzArtist[] = []
    const mbTags: string[] = []
    const discogsTerms: string[] = []
    const countryFrequency: Record<string, number> = {}

    for (const [, artist] of Object.entries(mbData)) {
      // Safely extract tags/genres/styles as arrays
      const tags = Array.isArray(artist.tags) ? artist.tags : []
      const discogsGenres = Array.isArray(artist.discogsGenres) ? artist.discogsGenres : []
      const discogsStyles = Array.isArray(artist.discogsStyles) ? artist.discogsStyles : []

      const allArtistTags = [...tags, ...discogsGenres, ...discogsStyles]

      // Check if any of our search terms match
      const matches = findMatchingTag(genreName, allAliases, allArtistTags)

      if (matches.length > 0) {
        artistsWithGenre.push(artist)

        // Track which specific tags matched
        for (const match of matches) {
          if (tags.includes(match)) {
            mbTags.push(match)
          }
          if (discogsGenres.includes(match) || discogsStyles.includes(match)) {
            discogsTerms.push(match)
          }
        }

        // Track country
        if (artist.country) {
          countryFrequency[artist.country] = (countryFrequency[artist.country] || 0) + 1
        }
      }
    }

    const mbTagsUnique = Array.from(new Set(mbTags))
    const discogsUnique = Array.from(new Set(discogsTerms))

    if (mbTagsUnique.length > 0) genresWithMB++
    if (discogsUnique.length > 0) genresWithDiscogs++

    // Analyze co-occurrence for relationships
    const coOccurrences = analyzeCoOccurrence(genreName, artistsWithGenre, allGenreNames)

    // Infer parent/children based on co-occurrence
    // Parent = genre that appears in >60% of artists (very strong overlap)
    // Related = genres that appear in 20-60% of artists
    const parent = coOccurrences.find(c => c.confidence > 0.6)?.genre
    const related = coOccurrences.filter(c => c.confidence >= 0.2 && c.confidence <= 0.6).map(c => c.genre)

    if (related.length > 0 || parent) genresWithRelationships++

    // Calculate typical countries (top countries by frequency)
    const topCountries = Object.entries(countryFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([country]) => country)

    // Build enriched entry
    enrichedGenres[genreName] = {
      canonical: genreName,
      aliases: allAliases,
      sources: {
        everynoise: genreName,
        musicbrainz: mbTagsUnique,
        discogs: discogsUnique
      },
      relationships: {
        parent,
        children: [], // Will be inferred in second pass
        related
      },
      geography: {
        typical_countries: topCountries,
        country_frequency: countryFrequency
      },
      stats: {
        artist_count: artistsWithGenre.length,
        mb_tag_frequency: mbTags.length,
        discogs_frequency: discogsTerms.length,
        co_occurrence_confidence: coOccurrences[0]?.confidence || 0
      }
    }

    // Progress indicator
    if (Object.keys(enrichedGenres).length % 100 === 0) {
      console.log(`   Processed ${Object.keys(enrichedGenres).length}/${allGenreNames.length} genres...`)
    }
  }

  // Second pass: Infer children from parent relationships
  for (const [genreName, entry] of Object.entries(enrichedGenres)) {
    if (entry.relationships.parent) {
      const parent = enrichedGenres[entry.relationships.parent]
      if (parent) {
        parent.relationships.children.push(genreName)
      }
    }
  }

  console.log(`\n✅ Enrichment complete!`)
  console.log(`   Genres with MusicBrainz mapping: ${genresWithMB}`)
  console.log(`   Genres with Discogs mapping: ${genresWithDiscogs}`)
  console.log(`   Genres with inferred relationships: ${genresWithRelationships}`)

  return {
    version: '1.0.0',
    source: 'Every Noise at Once + MusicBrainz + Discogs',
    license: 'MIT (Every Noise data), CC BY-NC-SA (MusicBrainz), Fair Use (Discogs)',
    attribution: 'Glenn McDonald (Every Noise), MusicBrainz Community, Discogs Community',
    generated_at: new Date().toISOString(),
    total_genres: allGenreNames.length,
    enriched_genres: Object.keys(enrichedGenres).length,
    stats: {
      total_artists_analyzed: Object.keys(mbData).length,
      genres_with_mb_mapping: genresWithMB,
      genres_with_discogs_mapping: genresWithDiscogs,
      genres_with_relationships: genresWithRelationships
    },
    genres: enrichedGenres
  }
}

async function main() {
  console.log('🎵 Genre Ontology Enrichment Tool\n')

  try {
    // Load input data
    const everyNoiseData = await loadEveryNoiseGenres()
    console.log(`   Loaded ${everyNoiseData.total_genres} Every Noise genres`)

    const mbData = await loadMusicBrainzData()
    console.log(`   Loaded ${Object.keys(mbData).length} MusicBrainz artists`)

    // Enrich
    const ontology = await enrichGenres(everyNoiseData, mbData)

    // Write output
    const outputPath = path.join(__dirname, '..', 'client', 'data', 'genre-ontology.json')
    fs.writeFileSync(outputPath, JSON.stringify(ontology, null, 2))

    console.log(`\n💾 Output: ${outputPath}`)
    console.log(`   Size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`)

    // Show examples
    console.log(`\n📋 Example enriched genres:\n`)

    const examples = ['afrobeat', 'funk', 'jazz', 'rock', 'highlife']
    for (const genreName of examples) {
      const entry = ontology.genres[genreName]
      if (entry) {
        console.log(`   ${genreName}:`)
        console.log(`     Artists: ${entry.stats.artist_count}`)
        console.log(`     MusicBrainz tags: ${entry.sources.musicbrainz.join(', ') || 'none'}`)
        console.log(`     Discogs: ${entry.sources.discogs.join(', ') || 'none'}`)
        console.log(`     Parent: ${entry.relationships.parent || 'none'}`)
        console.log(`     Related: ${entry.relationships.related.slice(0, 3).join(', ') || 'none'}`)
        console.log(`     Countries: ${entry.geography.typical_countries.join(', ') || 'none'}`)
        console.log()
      }
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
