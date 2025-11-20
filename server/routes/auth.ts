import express from 'express'
// import { error } from 'node:console'
import request from 'superagent'

const router = express.Router()

router.post('/token', async (req, res) => {
  const { code } = req.body

  if (!code) {
    return res.status(400).json({ error: 'Authorisation code required' })
  }

  try {
    const response = await request
      .post('https://accounts.spotify.com/api/token')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.VITE_REDIRECT_URI,
        client_id: process.env.VITE_SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      })

      res.json({
          access_token: response.body.access_token,
          refresh_token: response.body.refresh_token,
          expires_in: response.body.expires_in,
      })
  } catch (error) {
    console.error('Token exchange error:', error)
    res.status(500).json({ error: 'Failed to exchange token' })
  }
})

// router.get('/recommendations', async (req, res) => {
//   try {
//     const { seed_tracks, seed_artists, limit, min_popularity, max_popularity } = req.query

//     const params = new URLSearchParams()
//     if (seed_tracks) params.append('seed_tracks', seed_tracks as string)
//     if (seed_artists) params.append('seed_artists', seed_artists as string)
//     if (limit) params.append('limit', limit as string)
//     if (min_popularity) params.append('min_popularity', min_popularity as string)
//     if (max_popularity) params.append('max_popularity', max_popularity as string)

//     const authHeader = req.headers.authorization
//     if (!authHeader) {
//       return res.status(401).json({ error: 'No authorisation header' })
//     }

//     const url = `https://api.spotify.com/v1/recommendations?${params}`
//     console.log('Requesting Spotify URL:', url)
//     console.log('With auth header:', authHeader)
    
//     const response = await request
//       .get(url)
//       .set('Authorization', authHeader)

//     res.json(response.body)

router.get('/recommendations', async (req, res) => {
  try {
    const {seed_tracks, seed_artists, limit, min_popularity, max_popularity } = req.query

    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorisation header' })
    }
    const queryParts = []
    if (seed_tracks) queryParts.push(`seed_tracks=${seed_tracks}`)
    if (seed_artists) queryParts.push(`seed_artists=${seed_artists}`)
    if (limit) queryParts.push(`limit=${limit}`)
    if (min_popularity) queryParts.push(`min_popularity=${min_popularity}`)
    if (max_popularity) queryParts.push(`max_popularity=${max_popularity}`)
      queryParts.push('market=NZ')
    
    const queryString = queryParts.join('&')
    const url = `https://api.spotify.com/v1/recommendations${queryString ? '?' + queryString : ''}`
    console.log('Requesting Spotify URL:', url)
    console.log('With auth header:', authHeader)

    const response = await request
      .get(url)
      .set('Authorization', authHeader)
    
      res.json(response.body)

  } catch (error: unknown) {
    const err = error as { response?: { text?: string; body?: unknown }; status?: number; message?: string }
    console.error('Full error:', err)
    console.error('Error status:', err.status)
    console.error('Error response body:', err.response?.body)
    console.error('Error response text', err.response?.text)
    res.status(err.status || 500).json({
      error: 'Failed to get recommendations',
      details: err.response?.text || err.response?.body || err.message
    })
  }
})

export default router