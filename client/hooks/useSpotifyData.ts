import { useState, useEffect } from "react"

interface UseSpotifyDataOptions<T, I = unknown> {
  fetchFn: () => Promise<T>
  extractItems?: (data: T) => I[]
}

interface UseSpotifyDataResult<T, I = unknown> {
  data: T | null
  items: I[]
  loading: boolean
  error: string | null
}

export function useSpotifyData<T, I = unknown>({
  fetchFn,
  extractItems,
}: UseSpotifyDataOptions<T, I>): UseSpotifyDataResult<T, I> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchFn()
      .then((result) => {
        console.log('Spotify data:', result)
        setData(result)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to fetch Spotify data:', err)
        setError('Could not load data')
        setLoading(false)
      })
  }, [])

  const items = data && extractItems ? extractItems(data) : []

  return { data, items, loading, error }
}