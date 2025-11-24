import { MusicPlatform, Track, TasteProfile, SearchParams } from "./types"

export class DiscoveryEngine {
  constructor(private platform: MusicPlatform) {}

  // Analyse user's taste from their top tracks
  async analyzeTaste(): Promise<TasteProfile> {
    const topTracks = await this.platform.getTopTracks()

    // Get audio features for all tracks
    const featuresPromises = topTracks.slice(0, 10) // Analyze top 10 tracks
    .map(track => this.platform.getAudioFeatures(track.id))

    const features = await Promise.all(featuresPromises)

    // Calculate averages
    const avgBPM = features.reduce((sum, f) => sum + f.bpm, 0) / features.length
    const avgEnergy = features.reduce((sum, f) => sum + f.energy, 0) / features.length
    const avgDanceability = features.reduce((sum, f) => sum + f.danceability, 0) / features.length

    // Extract genres from top tracks
    const genres: string[] = []

    return {
      avgBPM,
      avgEnergy,
      avgDanceability,
      genres
    }
}

// // Find B-Sides based on user taste
// async findBSides(params: {
//   genre?: string
//   seedTracks?: Track[]
//   limit?: number
// }): Promise<Track[]> {
//   const searchParams: SearchParams = {
//     genre: params.genre || 'electronic',
//     popularity: { max: 40 }, // B-Sides only
//     limit: params.limit || 50
//   }

//   // Search for tracks
//   const tracks = await this.platform.searchTracks(searchParams)

//   console.log('Search returned tracks:', tracks.length)
//   console.log('Sample tracks:', tracks.slice(0, 3).map(t => ({ name: t.name, popularity: t.popularity })))

//   //Filter by popularity
//   const bSides = tracks.filter(track => track.popularity <= 40)

//   console.log('After filtering, B-Sides found:', bSides.length)

//   // If seed tracks provided, filter by similarity
//   if (params.seedTracks && params.seedTracks.length > 0) {
//     // Get audio features for seed tracks
//     const seedFeatures = await Promise.all(
//       params.seedTracks.map(track => this.platform.getAudioFeatures(track.id))
//     )

//     // Calculate average seed features
//     const avgSeedBPM = seedFeatures.reduce((sum, f) => sum + f.bpm, 0) / seedFeatures.length
//     const avgSeedEnergy = seedFeatures.reduce((sum, f) => sum + f.energy, 0) / seedFeatures.length

//     // Get features for candidate tracks
//     const candidateFeatures = await Promise.all(
//       bSides.slice(0, 20).map(track => this.platform.getAudioFeatures(track.id))
//     )

//     // Score tracks by similarity to seeds
//     const scoredTracks = bSides.slice(0, 20).map((track, index) => {
//       const features = candidateFeatures[index]
//       const bpmDiff = Math.abs(features.bpm - avgSeedBPM)
//       const energyDiff = Math.abs(features.energy - avgSeedEnergy)

//       // Lower score = better match
//       const score = bpmDiff + (energyDiff * 100)

//       return { track, score }
//     })

//     // Sort by score and return top matches
//     return scoredTracks
//       .sort((a, b) => a.score - b.score)
//       .slice(0, params.limit || 10)
//       .map(item => item.track)
//   }

//   // No seeds, just return lowest popularity first
//   return bSides
//     .sort((a, b) => a.popularity - b.popularity)
//     .slice(0, params.limit || 10)
// }

//   // Find tracks similar to seed tracks (user-seeded search)
//   async findSimilar(seedTracks: Track[], limit = 10): Promise<Track[]> {
//     return this.findBSides({ seedTracks, limit})
//   }
// }

// Find B-Sides based on user taste
async findBSides(params: {
  genre?: string
  seedTracks?: Track[]
  limit?: number
}): Promise<Track[]> {
  // Strategy 1: Get user's library and filter for B-Sides
  const library = await this.platform.getUserLibrary()
  
  console.log('Library tracks:', library.length)
  
  // Filter for B-Sides from library
  const libraryBSides = library.filter(track => track.popularity < 40)
  
  console.log('Library B-Sides found:', libraryBSides.length)

  // If we have enough from library, use those
  if (libraryBSides.length >= (params.limit || 10)) {
    return libraryBSides
      .sort((a, b) => a.popularity - b.popularity)
      .slice(0, params.limit || 10)
  }

  // Strategy 2: Search by very niche genres if we need more
  const searchParams: SearchParams = {
    genre: params.genre || 'experimental electronic',
    limit: 50
  }

  const searchResults = await this.platform.searchTracks(searchParams)
  
  console.log('Search results:', searchResults.length)
  console.log('Sample search results:', searchResults.slice(0, 3).map(t => ({ name: t.name, popularity: t.popularity })))
  
  const searchBSides = searchResults.filter(track => track.popularity < 40)
  
  console.log('Search B-Sides found:', searchBSides.length)

  // Combine library and search results
  const allBSides = [...libraryBSides, ...searchBSides]
  
  // Deduplicate
  const uniqueBSides = new Map<string, Track>()
  allBSides.forEach(track => {
    if (!uniqueBSides.has(track.id)) {
      uniqueBSides.set(track.id, track)
    }
  })

  return Array.from(uniqueBSides.values())
    .sort((a, b) => a.popularity - b.popularity)
    .slice(0, params.limit || 10)
}
  }