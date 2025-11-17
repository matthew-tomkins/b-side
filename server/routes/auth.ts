import express from 'express'
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
    res.status(500).json({ error: 'Failed to exchange tooken' })
  }
})

export default router