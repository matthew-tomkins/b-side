import { useState } from 'react'
import { getCurrentUser, createPlaylist, addTracksToPlaylist } from '../services/spotify/index'
import { Track } from '../services/music/types'
import { SpotifyAdapter } from '../services/music/SpotifyAdapter'
import { DiscoveryEngine } from '../services/music/DiscoveryEngine'
import Section from './Section'
import { LoadingState, ErrorState, EmptyState } from './StateMessages'
import AdvancedSearch from './AdvancedSearch'

interface AdvancedSearchParams {
  genre?: string
  country?: string
  region?: string
  era?: string
  includeSurroundingRegions?: boolean
  energy?: { min: number; max: number }
  danceability?: { min: number; max: number }
  valence?: { min: number; max: number }
  acousticness?: { min: number; max: number }
  instrumentalness?: { min: number; max: number }
  tempo?: { min: number; max: number }
  minPopularity: number
  maxPopularity: number
  includeLibraryTracks: boolean
  deepCutsOnly: boolean
}

export default function ExplorerMode() {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [quickQuery, setQuickQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [lastSearchQuery, setLastSearchQuery] = useState('')

  const spotify = new SpotifyAdapter()
  const discoveryEngine = new DiscoveryEngine(spotify)

  async function handleQuickSearch(e: React.FormEvent) {
    e.preventDefault()
    
    if (!quickQuery.trim()) {
      setError('Please enter a search term')
      return
    }

    setLoading(true)
    setError(null)
    setPlaylistUrl(null)
    setLastSearchQuery(quickQuery)

    try {
      const tracks = await discoveryEngine.exploreByAttributes({
        query: quickQuery,
        minPopularity: 40,
        includeLibraryTracks: true,
        limit: 20,
      })
      setResults(tracks)
    } catch (err) {
      console.error('Quick search error:', err)
      setError('Failed to explore. Try a different search term.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdvancedSearch(params: AdvancedSearchParams) {
    setLoading(true)
    setError(null)
    setPlaylistUrl(null)

    try {
      // Build query string from advanced params
      const queryParts: string[] = []
      if (params.genre) queryParts.push(params.genre)
      if (params.country) queryParts.push(params.country)
      if (params.region) queryParts.push(params.region)
      if (params.era) queryParts.push(params.era)

      const query = queryParts.join(' ') || 'music'
      setLastSearchQuery(query)

      const results = await discoveryEngine.exploreByAttributes({
        query,
        minPopularity: params.deepCutsOnly ? 0 : params.minPopularity,
        includeLibraryTracks: params.includeLibraryTracks,
        limit: 20,
      })
      setResults(results)
    } catch (err) {
      console.error('Advanced search error:', err)
      setError('Failed to explore. Try different search criteria.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePlaylist() {
    setSaving(true)
    setPlaylistUrl(null)

    try {
      const user = await getCurrentUser()
      
      const playlistName = lastSearchQuery 
        ? `B-Side Explorer: ${lastSearchQuery}`
        : 'B-Side Explorer Playlist'

      const playlist = await createPlaylist(
        user.id,
        playlistName,
        `Discovered via Explorer Mode`,
        true
      )

      const trackUris = results.map(track => `spotify:track:${track.id}`)
      await addTracksToPlaylist(playlist.id, trackUris)

      setPlaylistUrl(playlist.external_urls.spotify)
    } catch (err) {
      console.error('Failed to save playlist:', err)
      setError('Failed to save playlist')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingState message="Exploring..." />
  }

  return (
    <Section title="">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="mb-2 text-2xl font-bold">Explorer Mode</h2>
          <p className="text-gray-600">
            Discover music by region, genre, era, and sound
          </p>
        </div>

        {/* Quick Search */}
        {!showAdvanced && (
          <div className="space-y-4">
            <form onSubmit={handleQuickSearch} className="space-y-4">
              <div>
                <label htmlFor="quick-search" className="block text-sm font-medium text-gray-700 mb-2">
                  What do you want to explore?
                </label>
                <input
                  id="quick-search"
                  type="text"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder="e.g., japanese indie pop, german hip hop, nigerian funk"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Try: "West Africa funk", "1970s jazz", "Japanese electronic"
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !quickQuery.trim()}
                className="w-full rounded-lg bg-purple-500 px-6 py-3 font-semibold text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Exploring...' : '🔍 Explore'}
              </button>
            </form>

            <button
              onClick={() => setShowAdvanced(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Advanced Search →
            </button>
          </div>
        )}

        {/* Advanced Search */}
        {showAdvanced && (
          <div className="space-y-4">
            <button
              onClick={() => setShowAdvanced(false)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Quick Search
            </button>

            <AdvancedSearch onSearch={handleAdvancedSearch} isSearching={loading} />
          </div>
        )}

        {/* Error State */}
        {error && <ErrorState message={error} />}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-800">
              Found {results.length} tracks
            </h3>

            {/* Track List */}
            <div className="space-y-3">
              {results.map((track, index) => (
                <div
                  key={track.id}
                  className="flex items-center gap-4 rounded-lg bg-gray-100 p-3 transition hover:bg-gray-200"
                >
                  <span className="text-lg font-bold text-gray-400">
                    {index + 1}
                  </span>
                  {track.album.images[0] && (
                    <img
                      src={track.album.images[0].url}
                      alt={track.album.name}
                      className="h-16 w-16 rounded object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{track.name}</p>
                    <p className="text-sm text-gray-600">
                      {track.artists.map((artist) => artist.name).join(', ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      Popularity: {track.popularity}/100
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Save Playlist */}
            <div>
              {!playlistUrl ? (
                <button
                  onClick={handleSavePlaylist}
                  disabled={saving}
                  className="w-full rounded-lg bg-green-500 px-6 py-3 font-semibold text-white hover:bg-green-600 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save as Spotify Playlist'}
                </button>
              ) : (
               <a 
                  href={playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-lg bg-green-600 px-6 py-3 text-center font-semibold text-white hover:bg-green-700"
                >
                  View Playlist on Spotify →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && !error && (
          <EmptyState 
            message={showAdvanced 
              ? 'Fill in search criteria and click Search'
              : 'Enter a search query to start exploring!'
            }
          />
        )}
      </div>
    </Section>
  )
}