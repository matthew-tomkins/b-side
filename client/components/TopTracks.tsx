import { getTopTracks } from "../services/spotify"
import { SpotifyTrack } from "../models/spotify"
import { useSpotifyData } from "../hooks/useSpotifyData"
import Section from './Section'
import { LoadingState, ErrorState, EmptyState } from './StateMessages'

export default function TopTracks() {
  const { items: tracks, loading, error } = useSpotifyData<
    { items: SpotifyTrack[] },
    SpotifyTrack
  >({
    fetchFn: () => getTopTracks('short_term', 10),
    extractItems: (data) => data.items,
  })

  if (loading) {
    return (
      <Section title="Your Top Tracks">
        <LoadingState message="Loading tracks..." />
      </Section>
    )
  }

  if (error) {
    return (
      <Section title="Your Top Tracks">
        <ErrorState message={error} />
      </Section>
    )  
  }

  if (tracks.length === 0 ) {
    return (
      <Section title="Your Top Tracks">
        <EmptyState message="No top tracks found. Listen to more music on Spotify!" />
      </Section>
    )
  }


  return (
    <Section title="Your Top Tracks">
      <div className="space-y-3">
        {tracks.map((track, index) => (
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
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}