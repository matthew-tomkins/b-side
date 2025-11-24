import { useEffect, useState } from 'react'
import { getCurrentUser, createPlaylist, addTracksToPlaylist } from '../services/spotify/index'
import { Track } from '../services/music/types'
import { SpotifyAdapter } from '../services/music/SpotifyAdapter'
import { DiscoveryEngine } from '../services/music/DiscoveryEngine'
import Section from './Section'
import { LoadingState, ErrorState, EmptyState } from './StateMessages'

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [selectedSeeds, setSelectedSeeds] = useState<Track[]>([])
  const [isSearchingSeeded, setIsSearchingSeeded] = useState(false)

  async function handleSavePlaylist() {
    setSaving(true)
    setPlaylistUrl(null)

    try {
      // Get current user ID
      const user = await getCurrentUser()
      
      // Create playlist
      const playlist = await createPlaylist(
        user.id,
        'B-Side Discoveries',
        'Hidden gems found by B-Side',
        true
      )

      // Convert track IDs to Spotify URIs
      const trackUris = recommendations.map(track => `spotify:track:${track.id}`)

      // Add tracks to playlist
      await addTracksToPlaylist(playlist.id, trackUris)

      setPlaylistUrl(playlist.external_urls.spotify)
    } catch (err) {
      console.error('Failed to save playlist:', err)
      setError('Failed to save playlist')
    } finally {
      setSaving(false)
    }
  }

  function toggleSeedSelection(track: Track) {
    setSelectedSeeds(prev => {
      const isSelected = prev.some(t => t.id === track.id)
      if (isSelected) {
        return prev.filter(t => t.id !== track.id)
      } else if (prev.length < 3) {
        // Max 3 seeds
        return [...prev, track]
      }
      return prev
    })
  }

  async function handleFindSimilar() {
    if (selectedSeeds.length === 0) return

    setIsSearchingSeeded(true)
    setLoading(true)

    try {
      const spotify = new SpotifyAdapter()
      const engine = new DiscoveryEngine(spotify)

      const similar = await engine.findSimilar(selectedSeeds, 10)

      setRecommendations(similar)
      setSelectedSeeds([]) // Clear selection
    } catch (err) {
      console.error('Failed to find similar tracks:', err)
      setError('Could not load similar tracks')
    } finally {
      setIsSearchingSeeded(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    async function fetchCustomRecommendations() {
      try {
        // Initialize platform adapter and discovery engine
        const spotify = new SpotifyAdapter()
        const engine = new DiscoveryEngine(spotify)

        // Find B-Sides using the discovery engine
        const bSides = await engine.findBSides({
          genre: 'electronic', // You can make this dynamic later
          limit: 10
        })

        setRecommendations(bSides)
        setLoading(false)
      } catch (err) {
        console.error('Failed to get custom recommendations:', err)
        setError('Could not load recommendations')
        setLoading(false)
      }
    }

    fetchCustomRecommendations()
  }, [])

  if (loading) {
    return (
      <Section title="Recommended B-Sides">
        <LoadingState message="Finding your B-Sides..." />
      </Section>
    )
  }

  if (error) {
    return (
      <Section title="Recommended B-Sides">
        <ErrorState message={error} />
      </Section>
    )
  }

  if (recommendations.length === 0) {
    return (
      <Section title="Recommended B-Sides">
        <EmptyState message="No B-Sides found in your library. Try saving more music!" />
      </Section>
    )
  }

  return (
    <Section title="Recommended B-Sides">
      <div className="space-y-3">
        {recommendations.map((track, index) => (
          <div
            key={track.id}
            className="flex items-center gap-4 rounded-lg bg-gray-100 p-3 transition hover:bg-gray-200"
          >
            <input
              type="checkbox"
              checked={selectedSeeds.some(t => t.id === track.id)}
              onChange={() => toggleSeedSelection(track)}
              disabled={selectedSeeds.length >= 3 && !selectedSeeds.some(t => t.id === track.id)}
              className="h-5 w-5 cursor-pointer"
            />
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
      {selectedSeeds.length > 0 && (
        <div className="mb-4">
          <button
            onClick={handleFindSimilar}
            disabled={isSearchingSeeded}
            className="w-full rounded-lg bg-blue-500 px-6 py-3 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {isSearchingSeeded 
              ? 'Finding Similar...' 
              : `Find Similar Tracks (${selectedSeeds.length} seeds)`
            }
          </button>
        </div>
      )}
      <div className="mt-6">
        {!playlistUrl ? (
          <button
            onClick={handleSavePlaylist}
            disabled={saving || recommendations.length === 0}
            className="w-full rounded-lg bg-green-500 px-6 py-3 font-semibold text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
      
    </Section>
  )
}