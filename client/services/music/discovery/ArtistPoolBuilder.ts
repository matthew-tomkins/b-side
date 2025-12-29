import { MusicBrainzAdapter } from '../MusicBrainzAdapter'
import { LastFmAdapter } from '../LastFmAdapter'
import { SpotifyAdapter } from '../SpotifyAdapter'
import { ParsedQuery } from '../QueryParser'
import {
  ArtistPool,
  MusicBrainzData,
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
    console.log('[ArtistPoolBuilder] Building pool with sequential enrichment')

    // Step 1: Choose primary source based on query type
    let primaryArtists: Array<{name: string, tags: string[]}> = []
    let primarySource = ''

    // CRITICAL: When both genre AND geography are specified, use Last.fm + geography filter
    // MusicBrainz doesn't support genre filtering reliably, so searching by country alone
    // returns random popular artists (Bruce Springsteen, Elvis) instead of genre-specific artists
    if (query.genre) {
      // Genre-based search: Use Last.fm as primary (works with or without geography)
      primarySource = 'lastfm'
      console.log(`[ArtistPoolBuilder] Primary source: Last.fm (genre: ${query.genre}${query.country ? ` + country filter: ${query.country}` : ''})`)

      const lfmArtists = await this.lastfm.getArtistsByTag(query.genre, 100)

      // Enrich with tags
      const enrichedPromises = lfmArtists.map(async (artist) => {
        try {
          const info = await this.lastfm.getArtistInfo(artist.name)
          return { name: artist.name, tags: info.tags }
        } catch (err) {
          return { name: artist.name, tags: [] }
        }
      })

      primaryArtists = await Promise.all(enrichedPromises)

    } else if (query.country || query.multiCountryRegion) {
      // Geography-only (no genre): Use MusicBrainz as primary
      primarySource = 'musicbrainz'
      console.log(`[ArtistPoolBuilder] Primary source: MusicBrainz (country: ${query.country || query.multiCountryRegion})`)

      const mbArtists = await this.searchMusicBrainz(query)
      primaryArtists = mbArtists.map(a => ({
        name: a.name,
        tags: a.tags?.map(t => t.name) || []
      }))

    } else {
      // Fallback to Spotify
      primarySource = 'spotify'
      console.log('[ArtistPoolBuilder] Primary source: Spotify (text search)')

      const spotifyArtists = await this.searchSpotify(query)
      primaryArtists = spotifyArtists.map(a => ({
        name: a.name,
        tags: a.genres
      }))
    }

    console.log(`[ArtistPoolBuilder] Primary search returned ${primaryArtists.length} artists`)

    // Step 2: Enrich artists ONE AT A TIME to respect API rate limits
    console.log('[ArtistPoolBuilder] Starting enrichment with MusicBrainz + Spotify...')
    console.log('[ArtistPoolBuilder] Processing sequentially to respect rate limits (~2 min)')

    const enrichedCandidates = []

    for (let i = 0; i < primaryArtists.length; i++) {
      const artist = primaryArtists[i]

      // Log progress every 10 artists
      if (i % 10 === 0 || i === 0) {
        console.log(`[ArtistPoolBuilder] Enriching artist ${i + 1}/${primaryArtists.length}`)
      }

      // Enrich with MusicBrainz (country + dates)
      const mbData = await this.musicbrainz.searchArtistByName(artist.name)

      // Delay to respect MusicBrainz 1 req/sec limit
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Enrich with Spotify (ID + genres)
      const spotifyData = await this.spotify.searchArtistByName(artist.name)

      // Small delay after Spotify to avoid rate limiting (200ms = ~5 req/sec)
      await new Promise(resolve => setTimeout(resolve, 200))

      // Combine all tags/genres (deduplicated)
      const allTags = [
        ...artist.tags,
        ...(mbData?.genres || []),
        ...(spotifyData?.genres || [])
      ]
      const uniqueTags = [...new Set(allTags.map(t => t.toLowerCase()))]

      enrichedCandidates.push({
        name: artist.name,
        country: mbData?.country,
        beginDate: mbData?.beginDate,
        area: mbData?.area,
        spotifyId: spotifyData?.id,
        tags: uniqueTags,
        sources: {
          primary: primarySource,
          musicbrainz: mbData ? true : false,
          spotify: spotifyData ? true : false
        }
      })
    }

    // Step 3: Report enrichment success
    const withCountry = enrichedCandidates.filter(a => a.country).length
    const withSpotifyId = enrichedCandidates.filter(a => a.spotifyId).length
    const withTags = enrichedCandidates.filter(a => a.tags.length > 0).length

    console.log(`[ArtistPoolBuilder] Enrichment complete:`)
    console.log(`  - ${withCountry}/${enrichedCandidates.length} have country data (${Math.round(withCountry/enrichedCandidates.length*100)}%)`)
    console.log(`  - ${withSpotifyId}/${enrichedCandidates.length} have Spotify ID (${Math.round(withSpotifyId/enrichedCandidates.length*100)}%)`)
    console.log(`  - ${withTags}/${enrichedCandidates.length} have genre tags (${Math.round(withTags/enrichedCandidates.length*100)}%)`)

    // Show sample enriched artists
    console.log('[ArtistPoolBuilder] Sample enriched artists:')
    enrichedCandidates.slice(0, 5).forEach(artist => {
      console.log(`  ${artist.name}:`, {
        country: artist.country || 'NONE',
        beginDate: artist.beginDate || 'NONE',
        spotifyId: artist.spotifyId ? 'YES' : 'NO',
        tags: artist.tags.slice(0, 3)
      })
    })

    return {
      candidates: enrichedCandidates,
      sources: {
        primary: primaryArtists.length,
        enriched: withCountry,
        total: enrichedCandidates.length
      }
    }
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
        // Phase 2: Increased from 100 → 200 for more artist diversity
        const artists = await this.musicbrainz.searchArtists({
          country: query.country,
          limit: 200,
        })
        return artists
      }
    } catch (error) {
      console.error('MusicBrainz search error:', error)
      return []
    }
  }

  private async searchSpotify(query: ParsedQuery): Promise<Array<{name: string, genres: string[]}>> {
    if (!query.genre) {
      return []
    }

    try {
      const artists = await this.spotify.searchArtists({
        query: query.genre,
        limit: 50,
      })

      return artists.map((artist) => ({
        name: artist.name,
        genres: artist.genres
      }))
    } catch (error) {
      console.error('Spotify search error:', error)
      return []
    }
  }
}