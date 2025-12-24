import { MusicPlatform, Track, TasteProfile } from './types'
import { LastFmAdapter } from './LastFmAdapter'
import { MusicBrainzAdapter, MusicBrainzArtist } from './MusicBrainzAdapter'
import { ArtistScorer } from './ArtistScorer'
import { QueryParser } from './QueryParser'
import { QueryCache } from './QueryCache'
import { ArtistPoolBuilder } from './discovery/ArtistPoolBuilder'
import { SpotifyAdapter } from './SpotifyAdapter'

export class DiscoveryEngine {
  private lastfm: LastFmAdapter
  private parser: QueryParser
  private cache: QueryCache
  private musicbrainz: MusicBrainzAdapter
  private scorer: ArtistScorer
  private spotify: SpotifyAdapter  // ← CHANGED: Added spotify property

  constructor(private platform: MusicPlatform) {
    this.lastfm = new LastFmAdapter()
    this.parser = new QueryParser()
    this.cache = new QueryCache()
    this.musicbrainz = new MusicBrainzAdapter()
    this.spotify = platform as SpotifyAdapter  // ← CHANGED: Cast platform
    this.scorer = new ArtistScorer(this.spotify)  // ← CHANGED: Pass spotify to scorer
  }

  async analyzeTaste(): Promise<TasteProfile> {
    const topTracks = await this.platform.getTopTracks()

    const featuresPromises = topTracks
      .slice(0, 10)
      .map((track) => this.platform.getAudioFeatures(track.id))

    const features = await Promise.all(featuresPromises)

    const avgBPM =
      features.reduce((sum, f) => sum + f.bpm, 0) / features.length
    const avgEnergy =
      features.reduce((sum, f) => sum + f.energy, 0) / features.length
    const avgDanceability =
      features.reduce((sum, f) => sum + f.danceability, 0) / features.length

    const genres: string[] = []

    return {
      avgBPM,
      avgEnergy,
      avgDanceability,
      genres,
    }
  }

  async findBSides(params: {
    genre?: string
    seedTracks?: Track[]
    limit?: number
    maxPopularity?: number
  }): Promise<Track[]> {
    const library = await this.platform.getUserLibrary()
    const libraryTrackIds = new Set(library.map((t) => t.id))

    console.log('Library tracks:', library.length)

    if (params.seedTracks && params.seedTracks.length > 0) {
      console.log(
        'Using Last.fm to find similar tracks based on',
        params.seedTracks.length,
        'seeds'
      )

      const allSimilar: Array<{ name: string; artist: string }> = []

      // Try track-based similarity
      for (const seed of params.seedTracks.slice(0, 3)) {
        try {
          const similar = await this.lastfm.getSimilarTracks(
            seed.name,
            seed.artists[0].name,
            10
          )
          console.log(
            `Track "${seed.name}" - ${similar.length} similar tracks found`
          )
          allSimilar.push(...similar)
        } catch (err) {
          console.log(
            `Track "${seed.name}" - no results, trying artist fallback`
          )
        }
      }

      // Fallback to artist-based discovery if no track results
      if (allSimilar.length === 0) {
        console.log('No track matches, using artist-based discovery')

        const seedArtists = Array.from(
          new Set(params.seedTracks.flatMap((t) => t.artists.map((a) => a.name)))
        )

        for (const artistName of seedArtists.slice(0, 3)) {
          try {
            const similarArtists = await this.lastfm.getSimilarArtists(
              artistName,
              5
            )
            console.log(
              `Artist "${artistName}" - ${similarArtists.length} similar artists found`
            )

            for (const artist of similarArtists) {
              const topTracks = await this.lastfm.getArtistTopTracks(
                artist.name,
                3
              )
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
          .filter((track) => track.popularity <= (params.maxPopularity || 40))
          .sort((a, b) => a.popularity - b.popularity)
          .slice(0, params.limit || 10)
      }

      // Search Spotify for Last.fm results
      const spotifyPromises = allSimilar.slice(0, 30).map(async (track) => {
        try {
          const response = await this.platform.searchTracks({
            query: `track:"${track.name}" artist:"${track.artist}"`,
            limit: 1,
          })

          return response[0] || null
        } catch (err) {
          return null
        }
      })

      const spotifyResults = (await Promise.all(spotifyPromises)).filter(
        (t) => t !== null
      ) as Track[]

      console.log('Found', spotifyResults.length, 'tracks on Spotify')

      const newTracks = spotifyResults.filter(
        (track) => !libraryTrackIds.has(track.id)
      )

      console.log('After removing library tracks:', newTracks.length, 'NEW tracks')

      const maxPop = params.maxPopularity || 40
      const bSides = newTracks
        .filter((track) => track.popularity <= maxPop)
        .sort((a, b) => a.popularity - b.popularity)

      console.log(`B-Sides found (popularity <= ${maxPop}):`, bSides.length)

      if (bSides.length > 0) {
        return bSides.slice(0, params.limit || 10)
      }

      return newTracks.slice(0, params.limit || 10)
    }

    // No seeds - return library B-Sides
    const libraryBSides = library
      .filter((track) => track.popularity <= (params.maxPopularity || 40))
      .sort((a, b) => a.popularity - b.popularity)
      .slice(0, params.limit || 10)

    console.log('No seeds provided, returning', libraryBSides.length, 'library B-Sides')

    return libraryBSides
  }

  async findSimilar(
    seedTracks: Track[],
    limit: number = 10,
    maxPopularity: number = 40
  ): Promise<Track[]> {
    return this.findBSides({ seedTracks, limit, maxPopularity })
  }

  // Helper: Infer country from genre tags
  private inferCountryFromGenres(tags: string[]): string | undefined {
    const lowerTags = tags.map(t => t.toLowerCase())
    
    const countryMarkers: Record<string, string> = {
      'japanese': 'JP',
      'j-pop': 'JP',
      'j-rock': 'JP',
      'city pop': 'JP',
      'shibuya-kei': 'JP',
      'k-pop': 'KR',
      'k-rock': 'KR',
      'french': 'FR',
      'french house': 'FR',
      'chanson': 'FR',
      'german': 'DE',
      'krautrock': 'DE',
      'british': 'GB',
      'uk': 'GB',
      'american': 'US',
    }
    
    for (const tag of lowerTags) {
      for (const [marker, countryCode] of Object.entries(countryMarkers)) {
        if (tag.includes(marker)) {
          return countryCode
        }
      }
    }
    
    return undefined
  }

  async exploreByAttributes(params: {
    query: string
    minPopularity: number
    includeLibraryTracks?: boolean
    limit?: number
  }): Promise<Track[]> {
    console.log('Explorer Mode search:', params)

    // Parse query with AI (cached for performance)
    let parsed = this.cache.get(params.query)

    if (!parsed) {
      console.log('Cache MISS - parsing with AI...')
      parsed = await this.parser.parse(params.query)
      this.cache.set(params.query, parsed)
    } else {
      console.log('Cache HIT - using cached parse')
    }

    console.log('Parsed query:', parsed)

    const library = await this.platform.getUserLibrary()
    const libraryTrackIds = new Set(library.map((t) => t.id))
    console.log('Library tracks:', library.length)

    const allSuggestions: Array<{ name: string; artist: string; spotifyTrack?: Track }> = []

    // Map known regions to countries for multi-country searches
    const regionToCountries: Record<string, string[]> = {
      'West Africa': ['Nigeria', 'Ghana', 'Senegal', 'Mali', 'Ivory Coast', 'Benin', 'Burkina Faso', 'Guinea'],
      'East Africa': ['Kenya', 'Tanzania', 'Uganda', 'Ethiopia', 'Rwanda', 'Burundi', 'Somalia'],
      'North Africa': ['Morocco', 'Egypt', 'Algeria', 'Tunisia', 'Libya', 'Sudan'],
      'Southern Africa': ['South Africa', 'Zimbabwe', 'Botswana', 'Namibia', 'Zambia', 'Mozambique'],
      'Central Africa': ['Democratic Republic of the Congo', 'Cameroon', 'Congo', 'Gabon', 'Chad'],
      Caribbean: ['Jamaica', 'Trinidad and Tobago', 'Barbados', 'Cuba', 'Haiti', 'Dominican Republic', 'Puerto Rico'],
      'Central America': ['Mexico', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Belize'],
      'South America': ['Brazil', 'Argentina', 'Colombia', 'Peru', 'Chile', 'Venezuela', 'Ecuador', 'Bolivia'],
      'Andean Region': ['Peru', 'Bolivia', 'Ecuador', 'Colombia'],
      Scandinavia: ['Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland'],
      'Nordic Countries': ['Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland'],
      'Baltic States': ['Estonia', 'Latvia', 'Lithuania'],
      Balkans: ['Serbia', 'Croatia', 'Bosnia and Herzegovina', 'Albania', 'North Macedonia', 'Slovenia', 'Montenegro'],
      Iberia: ['Spain', 'Portugal'],
      'British Isles': ['United Kingdom', 'Ireland'],
      'Eastern Europe': ['Poland', 'Czech Republic', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria', 'Ukraine'],
      'Middle East': ['Lebanon', 'Syria', 'Jordan', 'Israel', 'Palestine', 'Iraq', 'Saudi Arabia', 'Yemen', 'Oman'],
      'Arabian Peninsula': ['Saudi Arabia', 'Yemen', 'Oman', 'United Arab Emirates', 'Kuwait', 'Bahrain', 'Qatar'],
      Levant: ['Lebanon', 'Syria', 'Jordan', 'Israel', 'Palestine'],
      'Southeast Asia': ['Thailand', 'Vietnam', 'Indonesia', 'Malaysia', 'Philippines', 'Singapore', 'Myanmar', 'Cambodia', 'Laos'],
      'East Asia': ['China', 'Japan', 'South Korea', 'Taiwan', 'Mongolia'],
      'South Asia': ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan'],
      'Central Asia': ['Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan'],
      Oceania: ['Australia', 'New Zealand', 'Fiji', 'Papua New Guinea', 'Samoa', 'Tonga'],
      Polynesia: ['Samoa', 'Tonga', 'Tahiti', 'Hawaii'],
      Melanesia: ['Fiji', 'Papua New Guinea', 'Solomon Islands', 'Vanuatu'],
      'North America': ['United States', 'Canada', 'Mexico'],
    }

    // Convert region to multi-country if applicable
    if (parsed.region && regionToCountries[parsed.region]) {
      console.log(
        `Mapping region "${parsed.region}" to countries:`,
        regionToCountries[parsed.region]
      )
      parsed.multiCountryRegion = regionToCountries[parsed.region]
      parsed.region = undefined
    }

    const hasStructuredData =
      parsed.country || parsed.region || parsed.era || parsed.multiCountryRegion

    if (hasStructuredData) {
      console.log('Using Multi-Source Discovery + Scoring pipeline')

      // Build artist pool from MusicBrainz, Last.fm, and Spotify
      const poolBuilder = new ArtistPoolBuilder()
      const artistPool = await poolBuilder.buildPool(parsed)

      console.log(
        `Artist pool: ${artistPool.candidates.length} unique artists from`,
        artistPool.sources
      )

      // ← CHANGED: Updated enrichedArtists to include spotifyId
      const enrichedArtists: Array<{
        artist: MusicBrainzArtist & { spotifyId?: string }
        combinedTags: string[]
      }> = artistPool.candidates.map((candidate) => {
        const mbData = candidate.sources.musicbrainz || {
          id: '',
          name: candidate.name,
          country: undefined,
          beginDate: undefined,
          tags: [],
        }
        
        // Collect all tags from all sources
        const mbTags = (mbData.tags || []).map(t => (typeof t === 'string' ? t : t.name))
        const lfmTags = candidate.sources.lastfm?.tags || []
        const spotifyGenres = candidate.sources.spotify?.genres || []
        const tags = [...mbTags, ...lfmTags, ...spotifyGenres]
        
        // Infer country from genre tags if missing
        if (!mbData.country && tags.length > 0) {
          mbData.country = this.inferCountryFromGenres(tags)
        }
        
        // ← CHANGED: Attach Spotify ID if available
        const spotifyId = candidate.sources.spotify?.id
        
        return {
          artist: { ...mbData, spotifyId },
          combinedTags: tags,
        }
      })

      console.log(`Prepared ${enrichedArtists.length} artists for scoring`)

      // DEBUGGING
      const lampOrVaundy = enrichedArtists.filter((a) => 
        a.artist.name === 'Lamp' || a.artist.name === 'Vaundy'
      )
      console.log('Lamp/Vaundy in enriched artists:')
      lampOrVaundy.forEach((a) => {
        console.log(`  ${a.artist.name}: tags=[${a.combinedTags.join(', ')}]`)
      })
      
      // Show what tags we actually got
      console.log('Sample artist tags:')
      enrichedArtists.slice(0, 5).forEach(({ artist, combinedTags }) => {
        console.log(`  ${artist.name}: [${combinedTags.join(', ')}]`)
      })

      // ← CHANGED: Make scoring async with Promise.all
      const scoredArtists = await Promise.all(
        enrichedArtists.map(async (enriched) => {
          const spotifyId = enriched.artist.spotifyId
          
          return await this.scorer.scoreArtist(
            enriched.artist,
            enriched.combinedTags,
            parsed,
            spotifyId
          )
        })
      )

      // DEBUGGING
      const lampVaundyScored = scoredArtists.filter((a) => 
        a.name === 'Lamp' || a.name === 'Vaundy'
      )
      console.log('Lamp/Vaundy scores:')
      lampVaundyScored.forEach((artist) => {
        console.log(`  ${artist.name}: ${artist.matchScore} points - ${artist.matchReasons.join(', ')} - Country: ${artist.country || 'NONE'}`)
      })
      
      // Log score distribution for debugging
      console.log('Score distribution:')
      const scoreGroups = {
        '0-20': 0,
        '21-40': 0,
        '41-60': 0,
        '61-80': 0,
        '81-100': 0,
        '100+': 0,
      }
      scoredArtists.forEach((artist) => {
        if (artist.matchScore <= 20) scoreGroups['0-20']++
        else if (artist.matchScore <= 40) scoreGroups['21-40']++
        else if (artist.matchScore <= 60) scoreGroups['41-60']++
        else if (artist.matchScore <= 80) scoreGroups['61-80']++
        else if (artist.matchScore <= 100) scoreGroups['81-100']++
        else scoreGroups['100+']++
      })
      console.log(scoreGroups)

      console.log('Top 5 scored artists:')
      scoredArtists
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 5)
        .forEach((artist) => {
          console.log(
            `  ${artist.name}: ${artist.matchScore} points - ${artist.matchReasons.join(', ')} (Country: ${artist.country})`
          )
        })

      // DEBUG: Show some 1970s artists that should match
      const shouldMatch = scoredArtists.filter(a => 
        ['Bruce Springsteen', 'Bob Dylan', 'Grateful Dead', 'Eagles', 'Fleetwood Mac'].includes(a.name)
      )
      console.log('Expected 1970s artists:')
      shouldMatch.forEach(artist => {
        console.log(`  ${artist.name}: ${artist.matchScore} points - reasons: ${artist.matchReasons.join(', ')} - beginDate: ${artist.beginDate}`)
      })

      // Filter artists by threshold (with fallback to lower thresholds)
      // When era is specified, be more lenient (many artists lack era data)
      const threshold = parsed.era ? 50 : 60
      let filteredArtists = this.scorer.filterAndSort(scoredArtists, threshold)

      if (filteredArtists.length === 0) {
        console.log(`No results at threshold ${threshold}, trying ${threshold - 10}...`)
        filteredArtists = this.scorer.filterAndSort(scoredArtists, threshold - 10)
      }

      if (filteredArtists.length === 0) {
        console.log(`No results at threshold ${threshold - 10}, trying 40...`)
        filteredArtists = this.scorer.filterAndSort(scoredArtists, 40)
      }

      // If era specified: Prioritize era matches, but keep country+genre matches too
      // (Many classic artists lack era data in MusicBrainz)
      if (parsed.era) {
        const beforeEraFilter = filteredArtists.length

        const eraMatches = filteredArtists.filter(artist =>
          artist.matchReasons.some(reason => reason.startsWith('Era:') && !reason.includes('FAILED'))
        )

        // Also keep artists with BOTH country AND genre match IF they have missing era data
        // EXCLUDE artists that explicitly failed era validation (Era: FAILED)
        const countryGenreMatches = filteredArtists.filter(artist => {
          const hasEraMatch = artist.matchReasons.some(reason => reason.startsWith('Era:'))
          const failedEraValidation = artist.matchReasons.some(reason => reason.includes('Era: FAILED'))
          const hasCountry = artist.matchReasons.some(reason => reason.includes('Country:'))
          const hasGenre = artist.matchReasons.some(reason => reason.includes('Genre:'))

          // Only include if: no era data (no Era: reason) OR has country+genre
          // But EXCLUDE if they explicitly failed era validation
          return !hasEraMatch && !failedEraValidation && hasCountry && hasGenre
        })

        filteredArtists = [...eraMatches, ...countryGenreMatches]

        console.log(`Era filter: ${beforeEraFilter} total → ${eraMatches.length} era + ${countryGenreMatches.length} country+genre = ${filteredArtists.length} artists`)
      }

      // DEBUG: Show top 10 to see who's getting through
      console.log('Top 10 after era filter:')
      filteredArtists
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10)
        .forEach(artist => {
          console.log(`  ${artist.name}: ${artist.matchScore} pts - ${artist.matchReasons.join(', ')} (begin: ${artist.beginDate})`)
        })

      console.log('After scoring/filtering:', filteredArtists.length, 'artists')

      filteredArtists.slice(0, 5).forEach((artist) => {
        console.log(
          `  ${artist.name}: ${artist.matchScore} points - ${artist.matchReasons.join(', ')}`
        )
      })

      // Get top tracks from best-matching artists
      // Strategy: Search Spotify for artist, then get their top tracks (reduces API calls)
      // Phase 1: Increased from 15 to 30 artists to reduce bottleneck
      const artistLimit = Math.min(30, filteredArtists.length)
      console.log(`Fetching tracks from top ${artistLimit} artists`)

      for (const artist of filteredArtists.slice(0, artistLimit)) {
        try {
          // Search for artist on Spotify
          const spotifyArtists = await this.spotify.searchArtists({
            query: artist.name,
            limit: 1
          })

          if (spotifyArtists.length > 0) {
            const spotifyArtist = spotifyArtists[0]
            console.log(`  Found ${artist.name} on Spotify (ID: ${spotifyArtist.id})`)

            // Get their top tracks directly (1 API call instead of 5)
            const topTracks = await this.spotify.getArtistTopTracks(spotifyArtist.id)

            // Filter tracks to only include ones where this artist is the primary artist
            // This prevents compilation tracks and collaborations from polluting results
            let primaryTracks = topTracks.filter(track => {
              // Check if the queried artist is the first (primary) artist on the track
              const primaryArtistId = track.artists[0]?.id
              return primaryArtistId === spotifyArtist.id
            })

            // Phase 1: Filter out compilation albums
            primaryTracks = primaryTracks.filter(track => {
              return track.album.album_type !== 'compilation'
            })

            // Phase 1: Filter by album release date if era is specified
            if (parsed.era) {
              const [startYear, endYear] = parsed.era.split('-').map(Number)
              primaryTracks = primaryTracks.filter(track => {
                if (!track.album.release_date) return false
                const albumYear = parseInt(track.album.release_date.substring(0, 4))
                return albumYear >= startYear && albumYear <= endYear
              })
            }

            console.log(`    ${topTracks.length} total tracks, ${primaryTracks.length} after filtering`)

            // Phase 1: Increased from 5 to 10 tracks per artist
            const trackSuggestions = primaryTracks.slice(0, 10).map(track => ({
              name: track.name,
              artist: artist.name,
              spotifyTrack: track // Store the full track object
            }))

            allSuggestions.push(...trackSuggestions)
          } else {
            // Fallback to Last.fm if artist not found on Spotify
            console.log(`  ${artist.name} not found on Spotify, using Last.fm fallback`)
            // Phase 1: Increased from 5 to 10 tracks
            const tracks = await this.lastfm.getArtistTopTracks(artist.name, 10)
            allSuggestions.push(...tracks)
          }

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 50))
        } catch (error) {
          console.error(`Error fetching tracks for ${artist.name}:`, error)
        }
      }

      console.log('Got', allSuggestions.length, 'tracks from scored artists')
    }

    // Fallback to Last.fm if no structured data or insufficient results
    // BUT: Skip fallback if era was specified (Last.fm can't filter by era)
    if (allSuggestions.length < 30 && !parsed.era) {
      console.log('Supplementing with Last.fm tag search')

      const searchTerm = parsed.genre
      console.log('Searching Last.fm for:', searchTerm)

      const [lastfmTracks, lastfmArtists] = await Promise.all([
        this.lastfm.getTracksByTag(searchTerm, 50),
        this.lastfm.getArtistsByTag(searchTerm, 30),
      ])

      console.log('Last.fm tracks by tag:', lastfmTracks.length)
      console.log('Last.fm artists by tag:', lastfmArtists.length)

      allSuggestions.push(...lastfmTracks)

      if (lastfmArtists.length > 0) {
        console.log('Getting tracks from', lastfmArtists.length, 'Last.fm artists')

        for (const artist of lastfmArtists.slice(0, 15)) {
          const tracks = await this.lastfm.getArtistTopTracks(artist.name, 5)
          allSuggestions.push(...tracks)
        }
      }
    }

    console.log('Total suggestions:', allSuggestions.length)

    // Separate tracks that already have Spotify data from those that need searching
    const tracksWithSpotify: Track[] = []
    const tracksNeedingSearch: Array<{ name: string; artist: string }> = []

    for (const suggestion of allSuggestions.slice(0, 100)) {
      if ('spotifyTrack' in suggestion && suggestion.spotifyTrack) {
        tracksWithSpotify.push(suggestion.spotifyTrack as Track)
      } else {
        tracksNeedingSearch.push(suggestion)
      }
    }

    console.log(`Tracks already on Spotify: ${tracksWithSpotify.length}`)
    console.log(`Tracks needing search: ${tracksNeedingSearch.length}`)

    // Search Spotify only for tracks that need it (batched to avoid rate limits)
    const spotifyResults: Track[] = [...tracksWithSpotify]
    const batchSize = 20

    for (let i = 0; i < tracksNeedingSearch.length; i += batchSize) {
      const batch = tracksNeedingSearch.slice(i, i + batchSize)

      const batchPromises = batch.map(async (track) => {
        try {
          const results = await this.platform.searchTracks({
            query: `track:"${track.name}" artist:"${track.artist}"`,
            limit: 1,
          })
          return results[0] || null
        } catch (err) {
          console.error(`Search failed for "${track.name}" by ${track.artist}:`, err)
          return null
        }
      })

      const batchResults = await Promise.all(batchPromises)
      spotifyResults.push(...(batchResults.filter((t) => t !== null) as Track[]))

      // Rate limiting: Wait between batches
      if (i + batchSize < tracksNeedingSearch.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    console.log('Total Spotify tracks:', spotifyResults.length)

    // Remove duplicates
    const uniqueTracks = spotifyResults.filter(
      (track, index, self) => index === self.findIndex((t) => t.id === track.id)
    )

    console.log('After deduplication:', uniqueTracks.length, 'tracks')

    // Filter by library and popularity
    const filtered = uniqueTracks.filter((track) => {
      if (!params.includeLibraryTracks && libraryTrackIds.has(track.id)) return false
      if (track.popularity < params.minPopularity) return false
      return true
    })

    console.log('After filtering:', filtered.length, 'tracks')
    console.log(`Min popularity: ${params.minPopularity}`)
    console.log(`Include library tracks: ${params.includeLibraryTracks || false}`)

    // Sort by popularity ascending (most obscure first)
    const sorted = filtered.sort((a, b) => a.popularity - b.popularity)

    return sorted.slice(0, params.limit || 20)
  }
}