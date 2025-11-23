import { useEffect, useState } from "react"
import { getRecentlyPlayed, getSavedTracks, createPlaylist, addTracksToPlaylist } from "../services/spotify/index"
import { getCurrentUser } from "../services/spotify/index"
import { SpotifyTrack } from '../models/spotify'
import Section from "./Section"
import { LoadingState, ErrorState, EmptyState } from './StateMessages'

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState<SpotifyTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)

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

  useEffect(() => {
    async function fetchCustomRecommendations() {
      try {
        // Get user's recently played and saved tracks
        const [recentlyPlayed, savedTracks] = await Promise.all([
          getRecentlyPlayed(50),
          getSavedTracks(50)
        ])

        // Combine all tracks
        const recentTracks = recentlyPlayed.items.map((item: { track: SpotifyTrack; played_at: string }) => item.track)
        const libraryTracks = savedTracks.items.map((item: { track: SpotifyTrack; added_at: string }) => item.track)
        const allTracks = [...recentTracks, ...libraryTracks]

        // Deduplicate by track ID
        const uniqueTracks = new Map<string, SpotifyTrack>()
        allTracks.forEach(track => {
          if (!uniqueTracks.has(track.id)) {
            uniqueTracks.set(track.id, track)
          }
        })

        // Filter for "B-Sides" (low popularity tracks)
        const bSides = Array.from(uniqueTracks.values())
          .filter(track => track.popularity < 40) // Low popularity = hidden gems
          .sort((a, b) => a.popularity - b.popularity) // Sort by least popular first
          .slice(0, 10) // Take top 10

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