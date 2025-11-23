import { http, HttpResponse } from 'msw'

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

export const handlers = [
  //  Mock GET /me/top/tracks
  http.get(`${SPOTIFY_API_BASE}/me/top/tracks` ,() => {
    return HttpResponse.json({
      items: [
        {
          id: 'track1', 
          name: 'Test Track 1',
          popularity: 75,
          artists : [{ id: 'artist1', name: 'Test Artist 1' }],
          album: {
            id: 'album1',
            name: 'Test Album',
            images: [{ url: 'https://example.com/image.jpg' }]
          }
        },
        {
          id: 'track2', 
          name: 'Test Track 2',
          popularity: 30,
          artists : [{ id: 'artist2', name: 'Fringe Artist' }],
          album: {
            id: 'album2',
            name: 'Obscure Album',
            images: [{ url: 'https://example.com/image2.jpg' }],
          }
        }
      ]
    })
  }),

  // Mock GET me/top/artists
  http.get(`${SPOTIFY_API_BASE}/me/top/artists`, () => {
    return HttpResponse.json({
      items: [
        {
          id: 'artist1',
          name: 'Test Artist',
          popularity: 80,
          genres: ['rock', 'indie'],
          images: [{ url: 'https://example.com/artist.jpg' }]
        }
      ]
    })
  }),

  // Mock GET me/player/recently-played
  http.get(`${SPOTIFY_API_BASE}/me/player/recently-played`, () => {
    return HttpResponse.json({
      items: [
        {
          track: {
            id: 'recent1',
            name: 'Recently Played',
            popularity: 50,
            artists : [{ id: 'artist3', name: 'Recent Artist' }],
            album: {
              id: 'album3',
              name: 'Recent Album',
              images: [{ url: 'https://example.com/recent.jpg' }]
            }
          },
          played_at: '2024-11-20T10:00:00Z'
        }
      ]
    })
  }),

  //  Mock GET /me/tracks (saved tracks)
  http.get(`${SPOTIFY_API_BASE}/me/tracks`, () => {
    return HttpResponse.json({
      items: [
        {
          track: {
            id: 'saved1',
            name: 'Saved Track',
            popularity: 25,
            artists : [{ id: 'artist4', name: 'Saved Artist' }],
            album: {
              id: 'album4',
              name: 'Saved Album',
              images: [{ url: 'https://example.com/saved.jpg' }]
            }
          },
          added_at: '2024-11-15T12:00:00Z'
        }
      ]
    })
  })
]