import { useNavigate } from 'react-router'

export function useAuth() {
  const navigate = useNavigate()

  const isLoggedIn = !!localStorage.getItem('spotify_access_token')

  const logout = () => {
    localStorage.removeItem('spotify_access_token')
    localStorage.removeItem('spotify_refresh_token')
    navigate('/')
  }

  return { isLoggedIn, logout }
}