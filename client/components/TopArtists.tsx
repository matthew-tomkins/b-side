import { useEffect, useState } from 'react'
import { getTopArtists } from '../services/spotify'
import { SpotifyArtist } from '../models/spotify'

export default function TopArtists() {
  const [artists, setArtists] = useState<SpotifyArtist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTopArtists('medium_term', 10)
      .then((data) => {
        console.log('Artist data:', data)
        setArtists(data.items)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to get top artists:', err)
        setError('Could not load artists')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div>
      <h2 className="mb-4 text-2xl font-bold">
        Your Top Artists
      </h2>
      <p className="text-gray-600">Loading artists...</p>
    </div>

  }

  if (error) {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-bold">Your Top Artists</h2>
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (artists.length === 0) {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-bold">Your Top Artists</h2>
        <p className="text-gray-600">
          No top artists found. Listen to more music on Spotify!
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">
        Your Top Artists
      </h2>
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
    </div>
  )
}