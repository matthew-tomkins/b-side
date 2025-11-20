export function getAccessToken(): string | null {
  return localStorage.getItem('spotify_access_token')
}

export function getAuthHeaders() {
  const token = getAccessToken()
  if (!token) throw new Error('No access token')
  return { Authorization: `Bearer ${token}` }
}