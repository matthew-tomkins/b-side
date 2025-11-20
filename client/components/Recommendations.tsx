import { useEffect, useState } from "react"
import { getRecentlyPlayed, getSavedTracks } from "../services/spotify"
import { SpotifyTrack } from '../models/spotify'
import Section from "./Section"
import { LoadingState, ErrorState, EmptyState } from './StateMessages'

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState<SpotifyTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCustomRecommendations() {
      try {
        // Get user's recently played and saved tracks
        const [recentlyPlayed, savedTracks] = await Promise.all([
          getRecentlyPlayed(50),
          getSavedTracks(50)
        ])

        // Combine all tracks
        const recentTracks = recentlyPlayed.items.map(item => item.track)
        const libraryTracks = savedTracks.items.map(item => item.track)
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
    </Section>
  )
}