import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router"
import { getCurrentUser } from "../services/spotify/index"
import { SpotifyUser } from "../models/spotify"
import TopArtists from "./TopArtists"
import TopTracks from "./TopTracks"
import Recommendations from "./Recommendations"
import ExplorerMode from "./ExplorerMode"

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
            {/* Your Music Profile */}
            <TopArtists />
            <TopTracks />

            {/* Discovery Section */}
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                  Discover New B-Sides
                </h2>
                <p className="text-sm text-gray-600">
                  Find hidden gems from similar artists you&apos;ve never heard before
                </p>
              </div>
              <Recommendations />
            </div>

            {/* Explorer Mode Section */}
            <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                  🌍 Explorer Mode
                </h2>
                <p className="text-sm text-gray-600">
                  Discover music by region, genre, and era
                </p>
              </div>
              <ExplorerMode />
            </div>

            {/* Engine Comparison Section */}
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                  🔬 Engine Comparison (Experimental)
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Test the new simplified engine vs the current complex engine side-by-side
                </p>
                <Link
                  to="/compare"
                  className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Launch Comparison Mode →
                </Link>
              </div>
            </div>
          </div>
        </div>
    </div>
  )
}