#!/usr/bin/env tsx
/**
 * Enrich Genre Ontology with MusicBrainz/Discogs Data (OPTIMIZED)
 *
 * Uses inverted index for O(1) lookups instead of O(n) iteration
 * Processes 2,680 genres against 1.24M artists in reasonable time
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
}

interface EveryNoiseData {
  total_genres: number
  genres: Record<string, EveryNoiseGenre>
}

interface MusicBrainzArtist {
  country?: string
  tags?: string[]
  discogsGenres?: string[]
  discogsStyles?: string[]
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
  }
  stats: {
    artist_count: number
  }
}

interface GenreOntology {
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

function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/[-_\s]+/g, ' ').replace(/\s+/g, ' ')
}

async function main() {
  console.log('🎵 Genre Ontology Enrichment Tool (Optimized)\n')

  // Load data
  const everyNoisePath = path.join(__dirname, '..', 'client', 'data', 'everynoise-genres.json')
  const mbPath = path.join(__dirname, '..', 'client', 'data', 'musicbrainz-artists-enriched.json')

  console.log('📖 Loading data...')
  const everyNoiseData: EveryNoiseData = JSON.parse(fs.readFileSync(everyNoisePath, 'utf-8'))
  const mbDataRaw = JSON.parse(fs.readFileSync(mbPath, 'utf-8'))
  const mbData: Record<string, MusicBrainzArtist> = mbDataRaw.artists || mbDataRaw

  console.log(`   Every Noise genres: ${everyNoiseData.total_genres}`)
  console.log(`   MusicBrainz artists: ${Object.keys(mbData).length}`)

  // Build inverted index: normalized_tag → artists
  console.log('\n⚡ Building inverted index...')
  const tagIndex = new Map<string, MusicBrainzArtist[]>()

  let artistCount = 0
  for (const artist of Object.values(mbData)) {
    const tags = Array.isArray(artist.tags) ? artist.tags : []
    const discogsGenres = Array.isArray(artist.discogsGenres) ? artist.discogsGenres : []
    const discogsStyles = Array.isArray(artist.discogsStyles) ? artist.discogsStyles : []

    for (const tag of [...tags, ...discogsGenres, ...discogsStyles]) {
      const norm = normalizeTag(tag)
      if (!tagIndex.has(norm)) {
        tagIndex.set(norm, [])
      }
      tagIndex.get(norm)!.push(artist)
    }

    artistCount++
    if (artistCount % 100000 === 0) {
      console.log(`   Processed ${artistCount.toLocaleString()} artists...`)
    }
  }

  console.log(`✅ Indexed ${tagIndex.size.toLocaleString()} unique tags\n`)

  // Enrich genres
  console.log('🔄 Enriching genres...\n')
  const enrichedGenres: Record<string, GenreOntologyEntry> = {}
  let genresWithMB = 0
  let genresWithDiscogs = 0
  let processed = 0

  for (const [genreName, genreInfo] of Object.entries(everyNoiseData.genres)) {
    const searchTerms = [genreName, ...genreInfo.aliases].map(t => normalizeTag(t))

    // Use index for fast lookup
    const artistSet = new Set<MusicBrainzArtist>()
    const mbTags = new Set<string>()
    const discogsTerms = new Set<string>()
    const countryFreq: Record<string, number> = {}

    for (const searchTerm of searchTerms) {
      const artists = tagIndex.get(searchTerm) || []

      for (const artist of artists) {
        artistSet.add(artist)

        // Track matched tags
        const tags = Array.isArray(artist.tags) ? artist.tags : []
        const dGenres = Array.isArray(artist.discogsGenres) ? artist.discogsGenres : []
        const dStyles = Array.isArray(artist.discogsStyles) ? artist.discogsStyles : []

        for (const tag of tags) {
          if (normalizeTag(tag) === searchTerm) mbTags.add(tag)
        }
        for (const g of [...dGenres, ...dStyles]) {
          if (normalizeTag(g) === searchTerm) discogsTerms.add(g)
        }

        // Country
        if (artist.country) {
          countryFreq[artist.country] = (countryFreq[artist.country] || 0) + 1
        }
      }
    }

    const mbArray = Array.from(mbTags)
    const discogsArray = Array.from(discogsTerms)

    if (mbArray.length > 0) genresWithMB++
    if (discogsArray.length > 0) genresWithDiscogs++

    // Top countries
    const topCountries = Object.entries(countryFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([c]) => c)

    // Skip co-occurrence analysis for now (too slow - can add in Phase 2)
    const related: string[] = []
    let parent: string | undefined
    const totalArtists = artistSet.size

    enrichedGenres[genreName] = {
      canonical: genreName,
      aliases: genreInfo.aliases,
      sources: {
        everynoise: genreName,
        musicbrainz: mbArray,
        discogs: discogsArray
      },
      relationships: {
        parent,
        children: [],
        related: related.slice(0, 10) // Limit to top 10
      },
      geography: {
        typical_countries: topCountries
      },
      stats: {
        artist_count: totalArtists
      }
    }

    processed++
    if (processed % 500 === 0) {
      console.log(`   Processed ${processed}/${everyNoiseData.total_genres} genres...`)
    }
  }

  // Infer children from parents
  for (const [genreName, entry] of Object.entries(enrichedGenres)) {
    if (entry.relationships.parent) {
      const parent = enrichedGenres[entry.relationships.parent]
      if (parent) {
        parent.relationships.children.push(genreName)
      }
    }
  }

  console.log('\n✅ Enrichment complete!')
  console.log(`   Genres with MusicBrainz: ${genresWithMB}`)
  console.log(`   Genres with Discogs: ${genresWithDiscogs}`)

  // Build output
  const ontology: GenreOntology = {
    version: '1.0.0',
    source: 'Every Noise at Once + MusicBrainz + Discogs',
    license: 'MIT (Every Noise), CC BY-NC-SA (MusicBrainz), Fair Use (Discogs)',
    generated_at: new Date().toISOString(),
    total_genres: everyNoiseData.total_genres,
    stats: {
      total_artists_analyzed: Object.keys(mbData).length,
      genres_with_mb_mapping: genresWithMB,
      genres_with_discogs_mapping: genresWithDiscogs
    },
    genres: enrichedGenres
  }

  // Write
  const outputPath = path.join(__dirname, '..', 'client', 'data', 'genre-ontology.json')
  fs.writeFileSync(outputPath, JSON.stringify(ontology, null, 2))

  console.log(`\n💾 Output: ${outputPath}`)
  console.log(`   Size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`)

  // Examples
  console.log(`\n📋 Example enriched genres:\n`)
  const examples = ['afrobeat', 'funk', 'jazz', 'rock', 'highlife']
  for (const name of examples) {
    const entry = ontology.genres[name]
    if (entry) {
      console.log(`   ${name}:`)
      console.log(`     Artists: ${entry.stats.artist_count}`)
      console.log(`     MB: ${entry.sources.musicbrainz.slice(0, 3).join(', ')}`)
      console.log(`     Discogs: ${entry.sources.discogs.slice(0, 3).join(', ')}`)
      console.log(`     Related: ${entry.relationships.related.slice(0, 3).join(', ')}`)
      console.log(`     Countries: ${entry.geography.typical_countries.join(', ')}`)
      console.log()
    }
  }
}

main()
