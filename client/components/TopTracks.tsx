import { getTopTracks } from "../services/spotify"
import { SpotifyTrack } from "../models/spotify"
import { useSpotifyData } from "../hooks/useSpotifyData"

export default function TopTracks() {
  const { items: tracks, loading, error } = useSpotifyData<
    { items: SpotifyTrack[] },
    SpotifyTrack
  >({
    fetchFn: () => getTopTracks('medium_term', 10),
    extractItems: (data) => data.items,
  })

  if (loading) {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-bold">Your Top Tracks</h2>
        <p className="text-gray-600">Loading tracks...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-bold">Your Top Tracks</h2>
        <p className="text-red-600">{error}</p>
      </div>
    )  
  }

  if (tracks.length === 0 ) {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-bold">Your Top Tracks</h2>
        <p className="text-gray-600">
          No top tracks found. Listen to more music on Spotify!
        </p>
      </div>
    )
  }


  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Your Top Tracks</h2>
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
    </div>
  )
}