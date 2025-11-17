import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import request from 'superagent'

export default function Callback () {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setError('Authorisation failed')
      return
    }

    if (code) {
      request
        .post('/api/auth/token')
        .send({ code })
        .then((res) => {
          localStorage.setItem('spotify_access_token', res.body.access_token)
          localStorage.setItem('spotify_refresh_token', res.body.refresh_token)

          navigate('/dashboard')
        })
        .catch((err) => {
          console.error('Token exchange failed:', err)
          setError('Failed to authenticate')
        })
      }
  }, [searchParams, navigate])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">{error}</h2>
          <button
            onClick={() => navigate('/')}
            className="mt-4 rounded bg-gray-200 px-4 py-2"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }
    
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Authenticating...</h2>
      </div>
    </div>
  )
}
