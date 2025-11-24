import { MusicPlatform, Track, TasteProfile } from "./types"

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
  // Find B-Sides based on user taste
  async findBSides(params: {
    genre?: string
    seedTracks?: Track[]
    limit?: number
  }): Promise<Track[]> {
    // Strategy 1: Get user's library for filtering
    const library = await this.platform.getUserLibrary()
    const libraryTrackIds = new Set(library.map(t => t.id))
    
    console.log('Library tracks:', library.length)

    // Strategy 2: If seeds provided, get recommendations from Spotify
    if (params.seedTracks && params.seedTracks.length > 0) {
      console.log('Getting NEW recommendations based on', params.seedTracks.length, 'seeds')
      
      // Extract seed track IDs and artist IDs
      const seedTrackIds = params.seedTracks.map(t => t.id)
      const seedArtistIds = Array.from(new Set(
        params.seedTracks.flatMap(track => track.artists.map(a => a.id))
      ))
      
      console.log('Seed tracks:', seedTrackIds)
      console.log('Seed artists:', seedArtistIds)

      // Get recommendations from Spotify
      const recommendations = await this.platform.getRecommendations({
        seedTracks: seedTrackIds.slice(0, 3), // Use up to 3 track seeds
        seedArtists: seedArtistIds.slice(0, 2), // Use up to 2 artist seeds
        limit: 50 // Get more to filter from
      })
      
      console.log('Spotify returned', recommendations.length, 'recommendations')
      
      // Filter out tracks already in library
      const newTracks = recommendations.filter(track => !libraryTrackIds.has(track.id))
      
      console.log('After removing library tracks:', newTracks.length, 'NEW tracks')
      
      // Filter for B-Sides (popularity < 40) and sort
      const bSides = newTracks
        .filter(track => track.popularity < 40)
        .sort((a, b) => a.popularity - b.popularity)
      
      console.log('B-Sides found (popularity < 40):', bSides.length)
      
      // If not enough B-Sides, include some mid-popularity tracks
      if (bSides.length < (params.limit || 10)) {
        const moreTracks = newTracks
          .filter(track => track.popularity >= 40 && track.popularity < 60)
          .sort((a, b) => a.popularity - b.popularity)
          .slice(0, (params.limit || 10) - bSides.length)
        
        console.log('Adding', moreTracks.length, 'mid-popularity tracks to fill results')
        
        return [...bSides, ...moreTracks].slice(0, params.limit || 10)
      }

      return bSides.slice(0, params.limit || 10)
    }

    // No seeds - return B-Sides from library
    const libraryBSides = library
      .filter(track => track.popularity < 40)
      .sort((a, b) => a.popularity - b.popularity)
      .slice(0, params.limit || 10)
    
    console.log('No seeds provided, returning', libraryBSides.length, 'library B-Sides')
    
    return libraryBSides
  }

  // Find tracks similar to seed tracks (user-seeded search)
  async findSimilar(seedTracks: Track[], limit: number = 10): Promise<Track[]> {
    return this.findBSides({ seedTracks, limit })
  }
}