export default function Login() {
  const handleLogin = () => {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID
    const redirectUri = import.meta.env.VITE_REDIRECT_URI
    const scopes = [
      'user-read-private',
      'user-read-email',
      'user-top-read',
      'user-read-recently-played',
      'user-library-read',
      'playlist-modify-public',
      'playlist-modify-private'
    ].join(' ')

    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`

    window.location.href = authUrl
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-8 text-4xl font-bold">B-Side</h1>
        <p className="mb-8 text-gray-600">
          Find music you don't know you're into
        </p>
        <button 
          onClick={handleLogin}
          className="rounded-lg bg-green-500 px-8 py-3 font-semibold text-white hover:bg-green-600"
        >
          Login with Spotify
        </button>
      </div>
    </div>
  )
}