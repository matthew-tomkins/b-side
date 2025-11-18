import { useEffect, useState } from "react"
import { getRecommendations, getTopTracks, getTopArtists } from "../services/spotify"
import { SpotifyTrack } from '../models/spotify'
import Section from "./Section"
import { LoadingState, ErrorState, EmptyState } from './StateMessages'

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState<SpotifyTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        //  Get user's top tracks and artists as seeds
        const [topTracks, topArtists] = await Promise.all([
          getTopTracks('medium_term', 5),
          getTopArtists('medium_term', 5),
        ])

        // Get recommendations with lower popularity (fringe music!)
        const seedTrackIds = topTracks.items.slice(0, 3).map((t) => t.id)
        const seedArtistIds = topArtists.items.slice(0, 2).map((a) => a.id)

        console.log('Seed Track IDs:', seedTrackIds)
        console.log('Seed Artist IDs:', seedArtistIds)

        if (seedTrackIds.length === 0 && seedArtistIds.length === 0) {
          throw new Error('No listening history available')
        }

        const recs = await getRecommendations({
          seedTracks: ['3n3Ppam7vgaVa1iaRUc9Lp'],
          // seedTracks: seedTrackIds.length > 0 ? seedTrackIds : undefined,
          // seedArtists: seedArtistIds.length > 0 ? seedArtistIds : undefined,
          limit: 10,
          targetPopularity: 30,
        })

        setRecommendations(recs.tracks)
        setLoading(false)
      } catch (err) {
        console.error('Failed to get recommendations:', err)
        setError('Could not load recommendations')
        setLoading(false)
      }
    }

    fetchRecommendations()
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
        <EmptyState message="No recommendations found. Try listening to more music!" />
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