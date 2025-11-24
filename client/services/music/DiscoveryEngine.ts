import { MusicPlatform, Track, TasteProfile } from './types'
import { LastFmAdapter } from './LastFmAdapter'

export class DiscoveryEngine {
  private lastfm: LastFmAdapter

  constructor(private platform: MusicPlatform) {
    this.lastfm = new LastFmAdapter()
  }

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
    maxPopularity?: number
  }): Promise<Track[]> {
    // Strategy 1: Get user's library for filtering
    const library = await this.platform.getUserLibrary()
    const libraryTrackIds = new Set(library.map(t => t.id))
    
    console.log('Library tracks:', library.length)

    // Strategy 2: If seeds provided, use Last.fm to find similar tracks
    if (params.seedTracks && params.seedTracks.length > 0) {
      console.log('Using Last.fm to find similar tracks based on', params.seedTracks.length, 'seeds')
      
      const allSimilar: Array<{ name: string; artist: string }> = []
      
      // Try track-based similarity first
      for (const seed of params.seedTracks.slice(0, 3)) {
        try {
          const similar = await this.lastfm.getSimilarTracks(
            seed.name,
            seed.artists[0].name,
            10
          )
          console.log(`Track "${seed.name}" - ${similar.length} similar tracks found`)
          allSimilar.push(...similar)
        } catch (err) {
          console.log(`Track "${seed.name}" - no results, trying artist fallback`)
        }
      }
      
      // If no track results, try artist-based discovery
      if (allSimilar.length === 0) {
        console.log('No track matches, using artist-based discovery')
        
        // Get unique artists from seeds
        const seedArtists = Array.from(new Set(
          params.seedTracks.flatMap(t => t.artists.map(a => a.name))
        ))
        
        for (const artistName of seedArtists.slice(0, 3)) {
          try {
            // Get similar artists
            const similarArtists = await this.lastfm.getSimilarArtists(artistName, 5)
            console.log(`Artist "${artistName}" - ${similarArtists.length} similar artists found`)
            
            // Get top tracks from each similar artist
            for (const artist of similarArtists) {
              const topTracks = await this.lastfm.getArtistTopTracks(artist.name, 3)
              allSimilar.push(...topTracks)
            }
          } catch (err) {
            console.log(`Artist "${artistName}" - no results`)
          }
        }
      }
      
      console.log('Last.fm returned', allSimilar.length, 'similar tracks total')
      
      if (allSimilar.length === 0) {
        console.log('No Last.fm results, returning library B-Sides')
        return library
          .filter(track => track.popularity <= (params.maxPopularity || 40))
          .sort((a, b) => a.popularity - b.popularity)
          .slice(0, params.limit || 10)
      }
      
      // Search Spotify for these tracks
      const spotifyPromises = allSimilar.slice(0, 30).map(async (track) => {
        try {
          const response = await this.platform.searchTracks({ 
            query: `track:"${track.name}" artist:"${track.artist}"`,
            limit: 1 
          })
          
          return response[0] || null
        } catch (err) {
          return null
        }
      })
      
      const spotifyResults = (await Promise.all(spotifyPromises)).filter(t => t !== null) as Track[]
      
      console.log('Found', spotifyResults.length, 'tracks on Spotify')
      
      // Filter out tracks already in library
      const newTracks = spotifyResults.filter(track => !libraryTrackIds.has(track.id))
      
      console.log('After removing library tracks:', newTracks.length, 'NEW tracks')
      
      // Filter by popularity and return
      const maxPop = params.maxPopularity || 40
      const bSides = newTracks
        .filter(track => track.popularity <= maxPop)
        .sort((a, b) => a.popularity - b.popularity)

      console.log(`B-Sides found (popularity <= ${maxPop}):`, bSides.length)
      
      if (bSides.length > 0) {
        return bSides.slice(0, params.limit || 10)
      }
      
      // If not enough B-Sides, return what we have
      return newTracks.slice(0, params.limit || 10)
    }

    // No seeds - return B-Sides from library
    const libraryBSides = library
      .filter(track => track.popularity <= (params.maxPopularity || 40))
      .sort((a, b) => a.popularity - b.popularity)
      .slice(0, params.limit || 10)
    
    console.log('No seeds provided, returning', libraryBSides.length, 'library B-Sides')
    
    return libraryBSides
  }

  // Find tracks similar to seed tracks (user-seeded search)
  async findSimilar(seedTracks: Track[], limit: number = 10, maxPopularity: number = 40): Promise<Track[]> {
    return this.findBSides({ seedTracks, limit, maxPopularity })
  }
}