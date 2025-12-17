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

  // Find B-Sides based on user taste (seed-based or library)
  async findBSides(params: {
    genre?: string
    seedTracks?: Track[]
    limit?: number
    maxPopularity?: number
  }): Promise<Track[]> {
    // Get user's library for filtering
    const library = await this.platform.getUserLibrary()
    const libraryTrackIds = new Set(library.map(t => t.id))
    
    console.log('Library tracks:', library.length)

    // If seeds provided, use Last.fm to find similar tracks
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
        
        const seedArtists = Array.from(new Set(
          params.seedTracks.flatMap(t => t.artists.map(a => a.name))
        ))
        
        for (const artistName of seedArtists.slice(0, 3)) {
          try {
            const similarArtists = await this.lastfm.getSimilarArtists(artistName, 5)
            console.log(`Artist "${artistName}" - ${similarArtists.length} similar artists found`)
            
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

  // Find tracks similar to seed tracks (wrapper for findBSides)
  async findSimilar(seedTracks: Track[], limit: number = 10, maxPopularity: number = 40): Promise<Track[]> {
    return this.findBSides({ seedTracks, limit, maxPopularity })
  }

  // Explorer Mode: discover music by tag/genre using Last.fm + Spotify
  async exploreByAttributes(params: {
    query: string
    minPopularity: number
    includeLibraryTracks?: boolean
    limit?: number
  }): Promise<Track[]> {
    console.log('Explorer Mode search:', params)

    // Get user's library for filtering
    const library = await this.platform.getUserLibrary()
    const libraryTrackIds = new Set(library.map(t => t.id))
    console.log('Library tracks:', library.length)

    // Search Last.fm for tracks and artists by tag
    console.log('Searching Last.fm for:', params.query)
    
    const [lastfmTracks, lastfmArtists] = await Promise.all([
      this.lastfm.getTracksByTag(params.query, 50),
      this.lastfm.getArtistsByTag(params.query, 30)
    ])

    console.log('Last.fm tracks by tag:', lastfmTracks.length)
    console.log('Last.fm artists by tag:', lastfmArtists.length)

    const allSuggestions: Array<{ name: string; artist: string }> = [...lastfmTracks]

    // Get top tracks from discovered artists
    if (lastfmArtists.length > 0) {
      console.log('Getting tracks from', lastfmArtists.length, 'artists')
      
      for (const artist of lastfmArtists.slice(0, 15)) {
        const tracks = await this.lastfm.getArtistTopTracks(artist.name, 5)
        allSuggestions.push(...tracks)
      }
    }

    console.log('Total Last.fm suggestions:', allSuggestions.length)

    // Search Spotify for these tracks (with rate limiting)
    const spotifyResults: Track[] = []
    const batchSize = 20  // Process 20 at a time
    const allSuggestionsToSearch = allSuggestions.slice(0, 100)

    for (let i = 0; i < allSuggestionsToSearch.length; i += batchSize) {
      const batch = allSuggestionsToSearch.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (track) => {
        try {
          const results = await this.platform.searchTracks({ 
            query: `track:"${track.name}" artist:"${track.artist}"`,
            limit: 1 
          })
          return results[0] || null
        } catch (err) {
          return null
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      spotifyResults.push(...batchResults.filter(t => t !== null) as Track[])
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < allSuggestionsToSearch.length) {
        await new Promise(resolve => setTimeout(resolve, 100))  // 100ms delay
      }
    }

    console.log('Found on Spotify:', spotifyResults.length, 'tracks')

    // Remove duplicates by track ID
    const uniqueTracks = spotifyResults.filter((track, index, self) => 
      index === self.findIndex(t => t.id === track.id)
    )

    console.log('After deduplication:', uniqueTracks.length, 'tracks')

    // Filter by library and popularity
    const filtered = uniqueTracks.filter(track => {
      if (!params.includeLibraryTracks && libraryTrackIds.has(track.id)) return false
      if (track.popularity < params.minPopularity) return false
      return true
    })

    console.log('After filtering:', filtered.length, 'tracks')
    console.log(`Min popularity: ${params.minPopularity}`)
    console.log(`Include library tracks: ${params.includeLibraryTracks || false}`)

    // Sort by popularity (ascending - obscure first)
    const sorted = filtered.sort((a, b) => a.popularity - b.popularity)

    return sorted.slice(0, params.limit || 20)
  }
}