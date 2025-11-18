import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { getCurrentUser } from "../services/spotify"
import { SpotifyUser } from "../models/spotify"

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
    <div className="min-h-screen p-8">
      <h1 className="mb-4 text-3xl font-bold">
        Welcome to B-Side
      </h1>
      {user && (
        <div>
          <p className="text-xl">Hey {user.display_name}!</p>
          <p className="text-gray-600">{user.email}</p>
      
        </div>
        )}
    </div>
  )
}