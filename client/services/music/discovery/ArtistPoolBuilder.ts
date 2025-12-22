import { MusicBrainzAdapter } from '../MusicBrainzAdapter'
import { LastFmAdapter } from '../LastFmAdapter'
import { SpotifyAdapter } from '../SpotifyAdapter'
import { ParsedQuery } from '../QueryParser'
import {
  ArtistPool,
  ArtistCandidate,
  MusicBrainzData,
  LastFmData,
  SpotifyData,
} from './types'

export class ArtistPoolBuilder {
  private musicbrainz: MusicBrainzAdapter
  private lastfm: LastFmAdapter
  private spotify: SpotifyAdapter

  constructor() {
    this.musicbrainz = new MusicBrainzAdapter()
    this.lastfm = new LastFmAdapter()
    this.spotify = new SpotifyAdapter()
  }

  async buildPool(query: ParsedQuery): Promise<ArtistPool> {
    const pool: ArtistPool = {
      candidates: [],
      sources: {
        musicbrainz: 0,
        lastfm: 0,
        spotify: 0,
      },
    }

    // Run all searches in parallel
    const [mbArtists, lfmArtists, spotifyArtists] = await Promise.all([
      this.searchMusicBrainz(query),
      this.searchLastFm(query),
      this.searchSpotify(query),
    ])

    pool.sources.musicbrainz = mbArtists.length
    pool.sources.lastfm = lfmArtists.length
    pool.sources.spotify = spotifyArtists.length

    // Convert to candidates
    const mbCandidates = mbArtists.map((artist) => ({
      name: artist.name,
      sources: { musicbrainz: artist },
    }))

    const lfmCandidates = lfmArtists.map((artist) => ({
      name: artist.name,
      sources: { lastfm: artist },
    }))

    const spotifyCandidates = spotifyArtists.map((artist) => ({
      name: artist.name,
      sources: { spotify: artist },
    }))

    // Merge all candidates
    pool.candidates = this.mergeCandidates([
      ...mbCandidates,
      ...lfmCandidates,
      ...spotifyCandidates,
    ])

    console.log(
      `Built artist pool: ${pool.candidates.length} unique artists from`,
      pool.sources
    )

    // Find artists with ANY tags
    const artistsWithTags = pool.candidates.filter((c) => {
      const mbTags = c.sources.musicbrainz?.tags?.length || 0
      const lfmTags = c.sources.lastfm?.tags?.length || 0
      const spotifyGenres = c.sources.spotify?.genres?.length || 0
      return mbTags > 0 || lfmTags > 0 || spotifyGenres > 0
    })

    console.log(`Artists with tags: ${artistsWithTags.length}`)
    // Find the Spotify artists we care about
    const spotifyArtistsWithGenres = pool.candidates.filter((c) => 
      c.sources.spotify?.genres && c.sources.spotify.genres.length > 0
    )

    console.log(`Spotify artists with genres: ${spotifyArtistsWithGenres.length}`)
    spotifyArtistsWithGenres.slice(0, 5).forEach((candidate) => {
      console.log(`  ${candidate.name}: ${candidate.sources.spotify?.genres.join(', ')}`)
    })
    artistsWithTags.slice(0, 5).forEach((candidate) => {
      const mbTags = candidate.sources.musicbrainz?.tags || []
      const lfmTags = candidate.sources.lastfm?.tags || []
      const spotifyGenres = candidate.sources.spotify?.genres || []
      
      console.log(`  ${candidate.name}:`, {
        mbTags: mbTags.map(t => typeof t === 'string' ? t : t.name),
        lfmTags,
        spotifyGenres,
      })
    })
    
    // DEBUG: Show sample candidates with their source data
    console.log('Sample candidates:')
    pool.candidates.slice(0, 10).forEach((candidate) => {
      const mbTags = candidate.sources.musicbrainz?.tags || []
      const lfmTags = candidate.sources.lastfm?.tags || []
      const spotifyGenres = candidate.sources.spotify?.genres || []
      
      console.log(`  ${candidate.name}:`, {
        hasMusicBrainz: !!candidate.sources.musicbrainz,
        hasLastFm: !!candidate.sources.lastfm,
        hasSpotify: !!candidate.sources.spotify,
        mbTags: mbTags.length,
        lfmTags: lfmTags.length,
        spotifyGenres: spotifyGenres.length,
        allTags: [...mbTags.map(t => t.name || t), ...lfmTags, ...spotifyGenres],
      })
    })

    return pool
  }

  private async searchMusicBrainz(
    query: ParsedQuery
  ): Promise<MusicBrainzData[]> {
    if (!query.country && !query.multiCountryRegion) {
      return []
    }

    try {
      if (query.multiCountryRegion) {
        // Multi-country search
        const allArtists: MusicBrainzData[] = []

        for (const country of query.multiCountryRegion) {
          const artists = await this.musicbrainz.searchArtists({
            country,
            limit: 50,
          })
          allArtists.push(...artists)
        }

        return allArtists
      } else {
        // Single country
        const artists = await this.musicbrainz.searchArtists({
          country: query.country,
          limit: 100,
        })
        return artists
      }
    } catch (error) {
      console.error('MusicBrainz search error:', error)
      return []
    }

  }



  private async searchLastFm(query: ParsedQuery): Promise<LastFmData[]> {
    if (!query.genre) {
      return []
    }

    try {
      const artistResults = await this.lastfm.getArtistsByTag(query.genre, 50)

      // Enrich with actual tag data (parallel to avoid slowdown)
      const enrichedPromises = artistResults.slice(0, 30).map(async (artist) => {
        try {
          const info = await this.lastfm.getArtistInfo(artist.name)
          return {
            name: artist.name,
            mbid: undefined,
            tags: info.tags,
            listeners: 0,
            playcount: 0,
          }
        } catch (err) {
          return {
            name: artist.name,
            mbid: undefined,
            tags: [],
            listeners: 0,
            playcount: 0,
          }
        }
      })

      const enriched = await Promise.all(enrichedPromises)
      
      console.log(`Last.fm enriched ${enriched.length} artists with tags`)
      
      return enriched
    } catch (error) {
      console.error('Last.fm search error:', error)
      return []
    }
  }

  private async searchSpotify(query: ParsedQuery): Promise<SpotifyData[]> {
    if (!query.genre) {
      return []
    }

    try {
      // Build Spotify search query
      let searchQuery = query.genre
      
      // Add decade modifier if era specified
      if (query.era) {
        const [startYear] = query.era.split('-').map(y => parseInt(y))
        const decade = Math.floor(startYear / 10) * 10
        searchQuery = `${decade}s ${query.genre}`  // e.g., "70s rock"
      }
      
      // Add country adjective
      if (query.country) {
        const countryAdjectives: Record<string, string> = {
          'Germany': 'german',
          'France': 'french',
          'Japan': 'japanese',
          'Korea': 'korean',
          'Brazil': 'brazilian',
          'United Kingdom': 'british',
          'Spain': 'spanish',
          'Italy': 'italian',
          'Nigeria': 'nigerian',
          'United States': 'american',
        }
        
        const adjective = countryAdjectives[query.country]
        if (adjective) {
          searchQuery = `${adjective} ${query.genre}`
        }
      }

      // Call Spotify API
      const artists = await this.spotify.searchArtists({
        query: searchQuery,
        limit: 50,
      })

      // DEBUG LOGGING
      console.log(`Spotify search for "${searchQuery}":`, artists.length, 'artists')
      if (artists.length > 0) {
        console.log('First 5 Spotify artists:')
        artists.slice(0, 5).forEach((artist) => {
          console.log(`  ${artist.name}: genres=[${artist.genres.join(', ')}]`)
        })
      }

      return artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres,
        popularity: artist.popularity,
        followers: artist.followers,
      }))
    } catch (error) {
      console.error('Spotify search error:', error)
      return []
    }
  }

  private mergeCandidates(candidates: ArtistCandidate[]): ArtistCandidate[] {
    const merged = new Map<string, ArtistCandidate>()

    for (const candidate of candidates) {
      const key = this.normalizeArtistName(candidate.name)

      if (merged.has(key)) {
        // Merge sources
        const existing = merged.get(key)!
        existing.sources = {
          ...existing.sources,
          ...candidate.sources,
        }
      } else {
        merged.set(key, candidate)
      }
    }

    return Array.from(merged.values())
  }

  private normalizeArtistName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalise whitespace
  }
}