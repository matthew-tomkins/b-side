#!/usr/bin/env tsx
/**
 * Extract Every Noise Genres from Alexa Skill JSON
 *
 * Source: https://github.com/quadule/everynoise-alexa
 * License: MIT (from everynoise-alexa project by Glenn McDonald)
 *
 * Purpose:
 * - Fetch 3,447 curated genre names from Every Noise at Once
 * - Extract canonical names + synonyms
 * - Create base ontology structure for enrichment
 *
 * Output: client/data/everynoise-genres.json
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface AlexaGenreEntry {
  id: string
  name: {
    value: string
    synonyms?: string[]
  }
}

interface AlexaSkillModel {
  interactionModel: {
    languageModel: {
      types: Array<{
        name: string
        values: AlexaGenreEntry[]
      }>
    }
  }
}

interface EveryNoiseGenre {
  canonical: string
  aliases: string[]
  source: string
}

interface EveryNoiseOutput {
  version: string
  source: string
  license: string
  attribution: string
  extracted_at: string
  total_genres: number
  genres: Record<string, EveryNoiseGenre>
}

async function fetchAlexaJSON(): Promise<AlexaSkillModel> {
  const url = 'https://raw.githubusercontent.com/quadule/everynoise-alexa/master/models/en-US.json'
  console.log(`📥 Fetching Every Noise genres from: ${url}`)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
  }

  return await response.json()
}

function extractGenres(alexaModel: AlexaSkillModel): Record<string, EveryNoiseGenre> {
  const genres: Record<string, EveryNoiseGenre> = {}

  // Find the EVERYNOISE_GENRES type
  const genreType = alexaModel.interactionModel.languageModel.types.find(
    t => t.name === 'EVERYNOISE_GENRES'
  )

  if (!genreType) {
    throw new Error('EVERYNOISE_GENRES type not found in Alexa model')
  }

  console.log(`📊 Processing ${genreType.values.length} genre entries...`)

  for (const entry of genreType.values) {
    const canonical = entry.name.value.toLowerCase()
    const aliases = entry.name.synonyms?.map(s => s.toLowerCase()) || []

    genres[canonical] = {
      canonical,
      aliases,
      source: 'everynoise-alexa'
    }
  }

  return genres
}

async function main() {
  console.log('🎵 Every Noise Genre Extraction Tool\n')

  try {
    // Fetch data
    const alexaModel = await fetchAlexaJSON()

    // Extract genres
    const genres = extractGenres(alexaModel)

    // Build output structure
    const output: EveryNoiseOutput = {
      version: '1.0.0',
      source: 'Every Noise at Once (via everynoise-alexa)',
      license: 'MIT',
      attribution: 'Glenn McDonald - https://everynoise.com',
      extracted_at: new Date().toISOString(),
      total_genres: Object.keys(genres).length,
      genres
    }

    // Write to file
    const outputPath = path.join(__dirname, '..', 'client', 'data', 'everynoise-genres.json')
    const outputDir = path.dirname(outputPath)

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))

    console.log(`\n✅ Success!`)
    console.log(`   Extracted: ${output.total_genres} genres`)
    console.log(`   Output: ${outputPath}`)
    console.log(`   Size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`)

    // Show some examples
    console.log(`\n📋 Sample genres:`)
    const sampleGenres = Object.entries(genres).slice(0, 10)
    for (const [name, info] of sampleGenres) {
      const aliasStr = info.aliases.length > 0 ? ` (aliases: ${info.aliases.join(', ')})` : ''
      console.log(`   - ${name}${aliasStr}`)
    }

    // African genres check
    console.log(`\n🌍 African genre coverage:`)
    const africanGenres = Object.keys(genres).filter(g =>
      g.includes('afro') || g.includes('african') ||
      g.includes('highlife') || g.includes('benga') ||
      g.includes('mbalax') || g.includes('soukous')
    )
    for (const genre of africanGenres.slice(0, 15)) {
      console.log(`   - ${genre}`)
    }
    console.log(`   Total: ${africanGenres.length} African-related genres`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
