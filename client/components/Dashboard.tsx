import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { getCurrentUser } from "../services/spotify"
import { SpotifyUser } from "../models/spotify"
import TopArtists from "./TopArtists"
import TopTracks from "./TopTracks"
import Recommendations from "./Recommendations"

export default function Dashboard() {
  const [user, setUser] = useState<SpotifyUser | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getCurrentUser()
      .then((data) => {
        setUser(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to get user:', err)
        navigate('/')
      })
  }, [navigate])
  
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <h2 className="text-2xl">Loading...</h2>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
       <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <h1 className="mb-2 text-4xl font-bold">
              Welcome to B-Side
            </h1>
            {user && (
              <p className="text-xl text-gray-600">Hey {user.display_name}!</p>
            )}
          </div>

          <div className="space-y-8">
            <TopArtists />
            <TopTracks />
            <Recommendations />
          </div>
        </div>
    </div>
  )
}