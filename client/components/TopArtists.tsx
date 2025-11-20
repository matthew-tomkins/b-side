
import { getTopArtists } from '../services/spotify/index'
import { SpotifyArtist } from '../models/spotify'
import { useSpotifyData } from '../hooks/useSpotifyData'
import Section from './Section'
import { LoadingState, ErrorState, EmptyState } from './StateMessages'

export default function TopArtists() {
  const { items: artists, loading, error } = useSpotifyData<{ items: SpotifyArtist[] }, SpotifyArtist>({
    fetchFn: () => getTopArtists('long_term', 10),
    extractItems: (data) => data.items,
  })

  if (loading) {
    return (
      <Section title="Your Top Artists">
        <LoadingState message="Loading artists..." />
      </Section>
    )
  }

  if (error) {
    return (
      <Section title="Your Top Artists">
        <ErrorState message={error} />
      </Section>
    )
  }

  if (artists.length === 0) {
    return (
      <Section title="Your Top Artists">
        <EmptyState message="No top artists found. Listen to more music on Spotify!" />
      </Section>
    )
  }

  return (
    <Section title="Your Top Artists">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {artists.map((artist) => (
          <div
            key={artist.id}
            className="flex flex-col items-center rounded-lg bg-gray-100 p-4 transition hover:bg-gray-200"
          >
            {artist.images && artist.images[0] ? (
              <img
                src={artist.images[0].url}
                alt={artist.name}
                className="mb-2 h-32 w-32 rounded-full object-cover"
              />
            ) : (
              <div className="mb-2 flex h-32 w-32 items-center justify-center rounded-full bg-gray-300">
                <span className="text-4xl">🎵</span>
              </div>
            )}
            <p className="text-center font-semibold">{artist.name}</p>
            {artist.genres && artist.genres.length > 0 && (
              <p className="text-xs text-gray-600">
                {artist.genres.slice(0, 2).join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}