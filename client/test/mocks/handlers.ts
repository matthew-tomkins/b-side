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
  }),

  // Mock GET /search?type=artist
  http.get(`${SPOTIFY_API_BASE}/search`, ({ request }) => {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')

    if (type === 'artist') {
      return HttpResponse.json({
        artists: {
          items: [
            {
              id: 'artist-fela',
              name: 'Fela Kuti',
              genres: ['afrobeat', 'afro-funk', 'funk'],
              popularity: 65,
              followers: { total: 500000 },
              images: [
                {
                  url: 'https://example.com/fela.jpg',
                  height: 640,
                  width: 640,
                },
              ],
            },
            {
              id: 'artist-tony',
              name: 'Tony Allen',
              genres: ['afrobeat', 'jazz', 'funk'],
              popularity: 58,
              followers: { total: 200000 },
              images: [
                {
                  url: 'https://example.com/tony.jpg',
                  height: 640,
                  width: 640,
                },
              ],
            },
          ],
        },
      })
    }

    // Default track search
    return HttpResponse.json({
      tracks: {
        items: [],
      },
    })
  }),

  // Mock GET /artists/{id}
  http.get(`${SPOTIFY_API_BASE}/artists/:id`, ({ params }) => {
    const { id } = params

    return HttpResponse.json({
      id,
      name: 'Fela Kuti',
      genres: ['afrobeat', 'afro-funk'],
      popularity: 65,
      followers: { total: 500000 },
      images: [
        {
          url: 'https://example.com/artist.jpg',
          height: 640,
          width: 640,
        },
      ],
    })
  }),

  // Mock GET /audio-features/{id}
  http.get(`${SPOTIFY_API_BASE}/audio-features/:id`, () => {

    return HttpResponse.json({
      danceability: 0.756,
      energy: 0.842,
      valence: 0.678,
      tempo: 118.5,
      acousticness: 0.124,
      instrumentalness: 0.321,
      speechiness: 0.045,
      liveness: 0.112,
      loudness: -6.5,
      key: 5,
      mode: 1,
      time_signature: 4,
    })
  }),

  // Mock GET /audio-features?ids=...
  http.get(`${SPOTIFY_API_BASE}/audio-features`, ({ request }) => {
    const url = new URL(request.url)
    const ids = url.searchParams.get('ids')?.split(',') || []

    return HttpResponse.json({
      audio_features: ids.map((id, index) => ({
        danceability: 0.7 + index * 0.05,
        energy: 0.8 + index * 0.02,
        valence: 0.65 + index * 0.03,
        tempo: 115 + index * 3,
        acousticness: 0.1 + index * 0.02,
        instrumentalness: 0.3 + index * 0.05,
        speechiness: 0.04,
        liveness: 0.1,
        loudness: -7,
        key: 5,
        mode: 1,
        time_signature: 4,
      })),
    })
  }),

  // Mock MusicBrainz API
http.get('https://musicbrainz.org/ws/2/artist/', ({ request }) => {
  const url = new URL(request.url)
  const query = url.searchParams.get('query')
  
  // Mock Nigerian artists
  if (query?.includes('Nigeria')) {
    return HttpResponse.json({
      artists: [
        {
          id: 'mb-fela',
          name: 'Fela Kuti',
          country: 'NG',
          'life-span': { begin: '1938' },
          tags: [{ name: 'afrobeat', count: 5 }, { name: 'funk', count: 3 }],
        },
        {
          id: 'mb-tony',
          name: 'Tony Allen',
          country: 'NG',
          'life-span': { begin: '1940' },
          tags: [{ name: 'afrobeat', count: 4 }],
        },
      ],
    })
  }
  
  // Mock Japanese artists
  if (query?.includes('Japan')) {
    return HttpResponse.json({
      artists: [
        {
          id: 'mb-perfume',
          name: 'Perfume',
          country: 'JP',
          'life-span': { begin: '2000' },
          tags: [{ name: 'j-pop', count: 5 }, { name: 'electronic', count: 3 }],
        },
        {
          id: 'mb-nakamura',
          name: 'Toshio Nakamura',
          country: 'JP',
          'life-span': { begin: '1975' },
          tags: [{ name: 'indie pop', count: 4 }],
        },
      ],
    })
  }
  
  return HttpResponse.json({ artists: [] })
}),

// Mock Last.fm tag.getTopArtists
http.get('http://ws.audioscrobbler.com/2.0/', ({ request }) => {
  const url = new URL(request.url)
  const method = url.searchParams.get('method')
  const tag = url.searchParams.get('tag')
  
  if (method === 'tag.getTopArtists') {
    if (tag === 'funk') {
      return HttpResponse.json({
        topartists: {
          artist: [
            { name: 'Fela Kuti', mbid: 'mb-fela' },
            { name: 'Parliament', mbid: 'mb-parliament' },
          ],
        },
      })
    }
    
    if (tag === 'indie pop') {
      return HttpResponse.json({
        topartists: {
          artist: [
            { name: 'The xx', mbid: 'mb-thexx' },
            { name: 'Tame Impala', mbid: 'mb-tame' },
          ],
        },
      })
    }
  }
  
  return HttpResponse.json({ topartists: { artist: [] } })
}),

// NEW: MusicBrainz API
  http.get('https://musicbrainz.org/ws/2/artist/', ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('query')
    
    if (query?.includes('Nigeria')) {
      return HttpResponse.json({
        artists: [
          {
            id: 'mb-fela',
            name: 'Fela Kuti',
            country: 'NG',
            'life-span': { begin: '1938' },
            tags: [{ name: 'afrobeat', count: 5 }, { name: 'funk', count: 3 }],
          },
          {
            id: 'mb-tony',
            name: 'Tony Allen',
            country: 'NG',
            'life-span': { begin: '1940' },
            tags: [{ name: 'afrobeat', count: 4 }],
          },
        ],
      })
    }
    
    if (query?.includes('Japan')) {
      return HttpResponse.json({
        artists: [
          {
            id: 'mb-perfume',
            name: 'Perfume',
            country: 'JP',
            'life-span': { begin: '2000' },
            tags: [{ name: 'j-pop', count: 5 }],
          },
        ],
      })
    }
    
    return HttpResponse.json({ artists: [] })
  }),

  // NEW: Last.fm API
  http.get('http://ws.audioscrobbler.com/2.0/', ({ request }) => {
    const url = new URL(request.url)
    const method = url.searchParams.get('method')
    const tag = url.searchParams.get('tag')
    
    if (method === 'tag.getTopArtists') {
      if (tag === 'funk') {
        return HttpResponse.json({
          topartists: {
            artist: [
              { name: 'Fela Kuti', mbid: 'mb-fela' },
              { name: 'Parliament', mbid: 'mb-parliament' },
            ],
          },
        })
      }
      
      if (tag === 'indie pop') {
        return HttpResponse.json({
          topartists: {
            artist: [
              { name: 'Perfume', mbid: 'mb-perfume' },
              { name: 'The xx', mbid: 'mb-thexx' },
            ],
          },
        })
      }
    }
    
    return HttpResponse.json({ topartists: { artist: [] } })
  }),
]