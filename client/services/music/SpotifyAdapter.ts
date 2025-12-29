import { SpotifyTracksAdapter } from './spotify/SpotifyTracksAdapter'
import { SpotifyArtistsAdapter } from './spotify/SpotifyArtistsAdapter'
import { SpotifyAudioFeaturesAdapter } from './spotify/SpotifyAudioFeaturesAdapter'
import {
  MusicPlatform,
  Track,
  AudioFeatures,
  SearchParams,
  SpotifyArtist,
  ExtendedAudioFeatures,
  SoundProfile
} from './types'

/**
 * Unified Spotify adapter implementing the MusicPlatform interface
 * Delegates to specialised adapters for different concerns
 */
export class SpotifyAdapter implements MusicPlatform {
  private tracksAdapter: SpotifyTracksAdapter
  private artistsAdapter: SpotifyArtistsAdapter
  private audioFeaturesAdapter: SpotifyAudioFeaturesAdapter

  constructor() {
    this.tracksAdapter = new SpotifyTracksAdapter()
    this.artistsAdapter = new SpotifyArtistsAdapter()
    this.audioFeaturesAdapter = new SpotifyAudioFeaturesAdapter()
  }

  // Track methods - delegated to SpotifyTracksAdapter
  async searchTracks(params: SearchParams): Promise<Track[]> {
    return this.tracksAdapter.searchTracks(params)
  }

  async getAudioFeatures(trackId: string): Promise<AudioFeatures> {
    return this.tracksAdapter.getAudioFeatures(trackId)
  }

  async getBatchAudioFeatures(trackIds: string[]): Promise<AudioFeatures[]> {
    return this.tracksAdapter.getBatchAudioFeatures(trackIds)
  }

  async getUserLibrary(): Promise<Track[]> {
    return this.tracksAdapter.getUserLibrary()
  }

  async getTopTracks(): Promise<Track[]> {
    return this.tracksAdapter.getTopTracks()
  }

  async getRecommendations(params: {
    seedTracks?: string[]
    seedArtists?: string[]
    limit?: number
  }): Promise<Track[]> {
    return this.tracksAdapter.getRecommendations(params)
  }

  async getAlbumTracks(albumId: string): Promise<Array<{
    id: string
    name: string
    track_number: number
    duration_ms: number
    popularity?: number
  }>> {
    return this.tracksAdapter.getAlbumTracks(albumId)
  }

  async getArtistTracksFromEra(artistId: string, era: string, limit: number = 10): Promise<Track[]> {
    return this.tracksAdapter.getArtistTracksFromEra(
      artistId,
      era,
      limit,
      // Pass the getArtistAlbums method from artistsAdapter
      (id: string) => this.artistsAdapter.getArtistAlbums(id)
    )
  }

  // Artist methods - delegated to SpotifyArtistsAdapter
  async searchArtists(params: {
    query: string
    limit?: number
  }): Promise<SpotifyArtist[]> {
    return this.artistsAdapter.searchArtists(params)
  }

  async searchArtistByName(artistName: string): Promise<SpotifyArtist | null> {
    return this.artistsAdapter.searchArtistByName(artistName)
  }

  async getArtist(artistId: string): Promise<SpotifyArtist | null> {
    return this.artistsAdapter.getArtist(artistId)
  }

  async getArtistAlbums(artistId: string): Promise<Array<{
    id: string
    name: string
    release_date: string
    album_type: string
  }>> {
    return this.artistsAdapter.getArtistAlbums(artistId)
  }

  async hasReleasesInEra(artistId: string, era: string): Promise<boolean> {
    return this.artistsAdapter.hasReleasesInEra(artistId, era)
  }

  async getArtistTopTracks(artistId: string, market: string = 'US'): Promise<Track[]> {
    return this.artistsAdapter.getArtistTopTracks(artistId, market)
  }

  async getRelatedArtists(artistId: string): Promise<SpotifyArtist[]> {
    return this.artistsAdapter.getRelatedArtists(artistId)
  }

  // Extended audio features methods - delegated to SpotifyAudioFeaturesAdapter
  async getExtendedAudioFeatures(trackId: string): Promise<ExtendedAudioFeatures | null> {
    return this.audioFeaturesAdapter.getExtendedAudioFeatures(trackId)
  }

  async getExtendedAudioFeaturesForTracks(trackIds: string[]): Promise<ExtendedAudioFeatures[]> {
    return this.audioFeaturesAdapter.getExtendedAudioFeaturesForTracks(trackIds)
  }

  async buildSoundProfile(trackIds: string[]): Promise<SoundProfile | null> {
    return this.audioFeaturesAdapter.buildSoundProfile(trackIds)
  }
}
