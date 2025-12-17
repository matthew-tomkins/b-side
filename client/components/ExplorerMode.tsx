import { useState } from 'react'
import { getCurrentUser, createPlaylist, addTracksToPlaylist } from '../services/spotify/index'
import { Track } from '../services/music/types'
import { SpotifyAdapter } from '../services/music/SpotifyAdapter'
import { DiscoveryEngine } from '../services/music/DiscoveryEngine'
import Section from './Section'
import { LoadingState, ErrorState, EmptyState } from './StateMessages'

export default function ExplorerMode() {
  const [searchQuery, setSearchQuery] = useState('')
  const [minPopularity, setMinPopularity] = useState(40)
  const [showLibraryTracks, setShowLibraryTracks] = useState(false)
  const [results, setResults] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)

  async function handleExplore() {
    if (!searchQuery.trim()) {
      setError('Please enter a search term')
      return
    }

    setLoading(true)
    setError(null)
    setPlaylistUrl(null)

    try {
      const spotify = new SpotifyAdapter()
      const engine = new DiscoveryEngine(spotify)

      // Pass the showLibraryTracks parameter
      const tracks = await engine.exploreByAttributes({
        query: searchQuery,
        minPopularity,
        includeLibraryTracks: showLibraryTracks, // NEW
        limit: 20,
      })

      setResults(tracks)
    } catch (err) {
      console.error('Explorer mode error:', err)
      setError('Failed to explore. Try a different search term.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePlaylist() {
    setSaving(true)
    setPlaylistUrl(null)

    try {
      const user = await getCurrentUser()
      
      const playlist = await createPlaylist(
        user.id,
        `B-Side Explorer: ${searchQuery}`,
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
      {/* Search Input */}
      <div className="space-y-4">
        <div>
          <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-2">
            What do you want to explore?
          </label>
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleExplore()}
            placeholder="e.g., Nigerian funk, Japanese city pop, Ethiopian jazz"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Try: "West Africa funk", "1970s jazz", "Japanese electronic"
          </p>
        </div>

        {/* Quality Slider */}
        <div className="bg-white p-4 rounded-lg shadow">
          <label htmlFor="quality-slider" className="block text-sm font-medium text-gray-700 mb-2">
            Quality Threshold
          </label>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">Hidden</span>
            <input
              id="quality-slider"
              type="range"
              min="10"
              max="100"
              value={minPopularity}
              onChange={(e) => setMinPopularity(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-gray-500">Popular</span>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Minimum quality: <strong>{minPopularity}</strong>
          </p>
        </div>

        {/* Show Library Tracks Toggle */}
        <div className="flex items-center gap-3 bg-white p-4 rounded-lg shadow">
          <input
            id="show-library"
            type="checkbox"
            checked={showLibraryTracks}
            onChange={(e) => setShowLibraryTracks(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <label htmlFor="show-library" className="text-sm text-gray-700 cursor-pointer">
            Include tracks already in my library
          </label>
        </div>

        {/* Explore Button */}
        <button
          onClick={handleExplore}
          disabled={loading || !searchQuery.trim()}
          className="w-full rounded-lg bg-purple-500 px-6 py-3 font-semibold text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Exploring...' : '🔍 Explore'}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-6 space-y-4">
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
          <div className="mt-6">
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
        <div className="mt-6">
          <EmptyState message="Enter a search term to start exploring!" />
        </div>
      )}
    </Section>
  )
}