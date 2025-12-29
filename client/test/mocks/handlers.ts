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
    const query = url.searchParams.get('q')?.toLowerCase() || ''

    if (type === 'artist') {
      // Return different artists based on search query
      let items = []

      // Punk artists
      if (query.includes('ramones')) {
        items = [{
          id: 'artist-ramones',
          name: 'Ramones',
          genres: ['punk', 'punk rock'],
          popularity: 72,
          followers: { total: 1000000 },
          images: [{ url: 'https://example.com/ramones.jpg', height: 640, width: 640 }],
        }]
      } else if (query.includes('dead kennedys')) {
        items = [{
          id: 'artist-dead-kennedys',
          name: 'Dead Kennedys',
          genres: ['punk', 'hardcore punk'],
          popularity: 68,
          followers: { total: 800000 },
          images: [{ url: 'https://example.com/dk.jpg', height: 640, width: 640 }],
        }]
      } else if (query.includes('black flag')) {
        items = [{
          id: 'artist-black-flag',
          name: 'Black Flag',
          genres: ['punk', 'hardcore punk'],
          popularity: 65,
          followers: { total: 700000 },
          images: [{ url: 'https://example.com/blackflag.jpg', height: 640, width: 640 }],
        }]
      }
      // Indie pop artists
      else if (query.includes('perfume')) {
        items = [{
          id: 'artist-perfume',
          name: 'Perfume',
          genres: ['j-pop', 'electropop', 'indie pop'],
          popularity: 70,
          followers: { total: 900000 },
          images: [{ url: 'https://example.com/perfume.jpg', height: 640, width: 640 }],
        }]
      } else if (query.includes('the xx')) {
        items = [{
          id: 'artist-thexx',
          name: 'The xx',
          genres: ['indie pop', 'dream pop'],
          popularity: 75,
          followers: { total: 1200000 },
          images: [{ url: 'https://example.com/thexx.jpg', height: 640, width: 640 }],
        }]
      }
      // Default funk artists
      else {
        items = [
          {
            id: 'artist-fela',
            name: 'Fela Kuti',
            genres: ['afrobeat', 'afro-funk', 'funk'],
            popularity: 65,
            followers: { total: 500000 },
            images: [{ url: 'https://example.com/fela.jpg', height: 640, width: 640 }],
          },
          {
            id: 'artist-tony',
            name: 'Tony Allen',
            genres: ['afrobeat', 'jazz', 'funk'],
            popularity: 58,
            followers: { total: 200000 },
            images: [{ url: 'https://example.com/tony.jpg', height: 640, width: 640 }],
          },
        ]
      }

      return HttpResponse.json({
        artists: { items },
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

  // Mock GET /artists/{id}/albums
  http.get(`${SPOTIFY_API_BASE}/artists/:id/albums`, ({ params }) => {
    const { id } = params

    // Return mock albums with different dates based on artist
    // Default albums (1980s for funk artists)
    let albums = [
      {
        id: `album-1-${id}`,
        name: 'Album 1',
        release_date: '1985-01-01',
        total_tracks: 10,
        images: [{ url: 'https://example.com/album1.jpg' }],
        album_type: 'album',
      },
      {
        id: `album-2-${id}`,
        name: 'Album 2',
        release_date: '1988-06-15',
        total_tracks: 12,
        images: [{ url: 'https://example.com/album2.jpg' }],
        album_type: 'album',
      },
      {
        id: `album-3-${id}`,
        name: 'Album 3',
        release_date: '1990-03-20',
        total_tracks: 8,
        images: [{ url: 'https://example.com/album3.jpg' }],
        album_type: 'album',
      },
    ]

    // If this looks like a punk band artist ID, return 1970s albums
    if (id && (id.toString().includes('ramones') || id.toString().includes('punk') || id.toString().includes('dk') || id.toString().includes('flag'))) {
      albums = [
        {
          id: `album-1-${id}`,
          name: 'Debut Album',
          release_date: '1976-04-23',
          total_tracks: 14,
          images: [{ url: 'https://example.com/punk1.jpg' }],
          album_type: 'album',
        },
        {
          id: `album-2-${id}`,
          name: 'Second Album',
          release_date: '1977-11-10',
          total_tracks: 12,
          images: [{ url: 'https://example.com/punk2.jpg' }],
          album_type: 'album',
        },
        {
          id: `album-3-${id}`,
          name: 'Live Album',
          release_date: '1979-06-05',
          total_tracks: 16,
          images: [{ url: 'https://example.com/punk3.jpg' }],
          album_type: 'album',
        },
      ]
    }

    // If this looks like an indie pop artist ID, return 2020s albums
    if (id && (id.toString().includes('perfume') || id.toString().includes('thexx') || id.toString().includes('indie'))) {
      albums = [
        {
          id: `album-1-${id}`,
          name: 'Modern Album 1',
          release_date: '2021-03-15',
          total_tracks: 10,
          images: [{ url: 'https://example.com/indie1.jpg' }],
          album_type: 'album',
        },
        {
          id: `album-2-${id}`,
          name: 'Modern Album 2',
          release_date: '2023-08-20',
          total_tracks: 12,
          images: [{ url: 'https://example.com/indie2.jpg' }],
          album_type: 'album',
        },
        {
          id: `album-3-${id}`,
          name: 'Latest EP',
          release_date: '2024-11-01',
          total_tracks: 6,
          images: [{ url: 'https://example.com/indie3.jpg' }],
          album_type: 'album',
        },
      ]
    }

    return HttpResponse.json({ items: albums })
  }),

  // Mock GET /albums/{id}/tracks
  http.get(`${SPOTIFY_API_BASE}/albums/:albumId/tracks`, ({ params }) => {
    const { albumId } = params

    return HttpResponse.json({
      items: [
        {
          id: `track-1-${albumId}`,
          name: 'Track 1',
          track_number: 1,
          duration_ms: 240000,
          popularity: 65,
        },
        {
          id: `track-2-${albumId}`,
          name: 'Track 2',
          track_number: 2,
          duration_ms: 210000,
          popularity: 58,
        },
        {
          id: `track-3-${albumId}`,
          name: 'Track 3',
          track_number: 3,
          duration_ms: 195000,
          popularity: 52,
        },
      ],
    })
  }),

  // Mock GET /artists/{id}/top-tracks
  http.get(`${SPOTIFY_API_BASE}/artists/:id/top-tracks`, ({ params }) => {
    const { id } = params

    // Return different tracks based on artist ID for testing
    if (id === 'artist-ramones') {
      return HttpResponse.json({
        tracks: [
          {
            id: 'track-blitzkrieg',
            name: 'Blitzkrieg Bop',
            artists: [{ id: 'artist-ramones', name: 'Ramones' }],
            album: {
              id: 'album-ramones',
              name: 'Ramones',
              images: [{ url: 'https://example.com/ramones.jpg' }],
            },
            popularity: 78,
            uri: 'spotify:track:blitzkrieg',
          },
          {
            id: 'track-sheena',
            name: 'Sheena Is a Punk Rocker',
            artists: [{ id: 'artist-ramones', name: 'Ramones' }],
            album: {
              id: 'album-ramones2',
              name: 'Rocket to Russia',
              images: [{ url: 'https://example.com/rocket.jpg' }],
            },
            popularity: 72,
            uri: 'spotify:track:sheena',
          },
          {
            id: 'track-rockaway',
            name: 'Rockaway Beach',
            artists: [{ id: 'artist-ramones', name: 'Ramones' }],
            album: {
              id: 'album-ramones2',
              name: 'Rocket to Russia',
              images: [{ url: 'https://example.com/rocket.jpg' }],
            },
            popularity: 70,
            uri: 'spotify:track:rockaway',
          },
          {
            id: 'track-wanna-be',
            name: 'I Wanna Be Sedated',
            artists: [{ id: 'artist-ramones', name: 'Ramones' }],
            album: {
              id: 'album-ramones3',
              name: 'Road to Ruin',
              images: [{ url: 'https://example.com/ruin.jpg' }],
            },
            popularity: 75,
            uri: 'spotify:track:wanna-be',
          },
          {
            id: 'track-pet',
            name: 'Pet Sematary',
            artists: [{ id: 'artist-ramones', name: 'Ramones' }],
            album: {
              id: 'album-ramones4',
              name: 'Brain Drain',
              images: [{ url: 'https://example.com/brain.jpg' }],
            },
            popularity: 68,
            uri: 'spotify:track:pet',
          },
          {
            id: 'track-judy',
            name: 'Judy Is a Punk',
            artists: [{ id: 'artist-ramones', name: 'Ramones' }],
            album: {
              id: 'album-ramones',
              name: 'Ramones',
              images: [{ url: 'https://example.com/ramones.jpg' }],
            },
            popularity: 65,
            uri: 'spotify:track:judy',
          },
          {
            id: 'track-today',
            name: 'Today Your Love, Tomorrow the World',
            artists: [{ id: 'artist-ramones', name: 'Ramones' }],
            album: {
              id: 'album-ramones',
              name: 'Ramones',
              images: [{ url: 'https://example.com/ramones.jpg' }],
            },
            popularity: 62,
            uri: 'spotify:track:today',
          },
          {
            id: 'track-beat',
            name: 'Beat on the Brat',
            artists: [{ id: 'artist-ramones', name: 'Ramones' }],
            album: {
              id: 'album-ramones',
              name: 'Ramones',
              images: [{ url: 'https://example.com/ramones.jpg' }],
            },
            popularity: 60,
            uri: 'spotify:track:beat',
          },
          {
            id: 'track-pinhead',
            name: 'Pinhead',
            artists: [{ id: 'artist-ramones', name: 'Ramones' }],
            album: {
              id: 'album-ramones5',
              name: 'Leave Home',
              images: [{ url: 'https://example.com/leave.jpg' }],
            },
            popularity: 58,
            uri: 'spotify:track:pinhead',
          },
          {
            id: 'track-commando',
            name: 'Commando',
            artists: [{ id: 'artist-ramones', name: 'Ramones' }],
            album: {
              id: 'album-ramones5',
              name: 'Leave Home',
              images: [{ url: 'https://example.com/leave.jpg' }],
            },
            popularity: 57,
            uri: 'spotify:track:commando',
          },
        ],
      })
    }

    // Default response for other artists
    return HttpResponse.json({
      tracks: [
        {
          id: `track-1-${id}`,
          name: 'Top Track 1',
          artists: [{ id, name: 'Test Artist' }],
          album: {
            id: 'album-1',
            name: 'Test Album',
            images: [{ url: 'https://example.com/album.jpg' }],
          },
          popularity: 70,
          uri: `spotify:track:1-${id}`,
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

    if (tag === 'punk') {
      return HttpResponse.json({
        topartists: {
          artist: [
            { name: 'Ramones', mbid: 'mb-ramones' },
            { name: 'Dead Kennedys', mbid: 'mb-dk' },
            { name: 'Black Flag', mbid: 'mb-black-flag' },
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

      if (tag === 'punk') {
        return HttpResponse.json({
          topartists: {
            artist: [
              { name: 'Ramones', mbid: 'mb-ramones' },
              { name: 'Dead Kennedys', mbid: 'mb-dk' },
              { name: 'Black Flag', mbid: 'mb-black-flag' },
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