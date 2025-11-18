import { useEffect, useState } from "react"
import { getTopTracks } from "../services/spotify"
import { SpotifyTrack } from "../models/spotify"

export default function TopTracks () {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTopTracks('medium_term', 10)
      .then((data) => {
        setTracks(data.items)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to get top tracks:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="text-gray-600">Loading tracks...</div>
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