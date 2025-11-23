import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Recommendations from './Recommendations'
import * as spotifyService from '../services/spotify/index'

// Mock the Spotify service
vi.mock('../services/spotify/index', () => ({
  getRecentlyPlayed: vi.fn(),
  getSavedTracks: vi.fn(),
}))

describe('Recommendations Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    // Mock API calls that never resolve
    vi.mocked(spotifyService.getRecentlyPlayed).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )
    vi.mocked(spotifyService.getSavedTracks).mockImplementation(
      () => new Promise(() => {})
    )

    render(<Recommendations />)
    expect(screen.getByText(/Finding your B-Sides/i)).toBeInTheDocument()
  })

  it('displays recommendations when data is fetched', async () => {
    // Mock API responses
    vi.mocked(spotifyService.getRecentlyPlayed).mockResolvedValue({
      items: [
        {
          track: {
            id: 'track1',
            name: 'Fringe Track 1',
            popularity: 25,
            artists: [{ id: 'artist1', name: 'Underground Artist' }],
            album: {
              id: 'album1',
              name: 'Obscure Album',
              images: [{ url: 'https://example.com/image.jpg' }],
            },
          },
          played_at: '2024-11-20T10:00:00Z',
        },
      ],
    })

    vi.mocked(spotifyService.getSavedTracks).mockResolvedValue({
      items: [
        {
          track: {
            id: 'track2',
            name: 'Hidden Gem',
            popularity: 15,
            artists: [{ id: 'artist2', name: 'Indie Artist' }],
            album: {
              id: 'album2',
              name: 'Deep Cut Album',
              images: [{ url: 'https://example.com/image2.jpg' }],
            },
          },
          added_at: '2024-11-15T12:00:00Z',
        },
      ],
    })

    render(<Recommendations />)

    // Wait for recommendations to load
    await waitFor(() => {
      expect(screen.getByText('Hidden Gem')).toBeInTheDocument()
    })

    expect(screen.getByText('Fringe Track 1')).toBeInTheDocument()
    expect(screen.getByText(/Popularity: 15\/100/i)).toBeInTheDocument()
  })

  it('shows empty state when no low-popularity tracks found', async () => {
    // Mock tracks with HIGH popularity (won't pass filter)
    vi.mocked(spotifyService.getRecentlyPlayed).mockResolvedValue({
      items: [
        {
          track: {
            id: 'track1',
            name: 'Popular Track',
            popularity: 85,
            artists: [{ id: 'artist1', name: 'Mainstream Artist' }],
            album: {
              id: 'album1',
              name: 'Hit Album',
              images: [{ url: 'https://example.com/image.jpg' }],
            },
          },
          played_at: '2024-11-20T10:00:00Z',
        },
      ],
    })

    vi.mocked(spotifyService.getSavedTracks).mockResolvedValue({
      items: [],
    })

    render(<Recommendations />)

    await waitFor(() => {
      expect(
        screen.getByText(/No B-Sides found in your library/i)
      ).toBeInTheDocument()
    })
  })

  it('shows error state when API fails', async () => {
    vi.mocked(spotifyService.getRecentlyPlayed).mockRejectedValue(
      new Error('API Error')
    )
    vi.mocked(spotifyService.getSavedTracks).mockRejectedValue(
      new Error('API Error')
    )

    render(<Recommendations />)

    await waitFor(() => {
      expect(screen.getByText(/Could not load recommendations/i)).toBeInTheDocument()
    })
  })

  it('deduplicates tracks correctly', async () => {
    const duplicateTrack = {
      id: 'track1',
      name: 'Duplicate Track',
      popularity: 30,
      artists: [{ id: 'artist1', name: 'Artist' }],
      album: {
        id: 'album1',
        name: 'Album',
        images: [{ url: 'https://example.com/image.jpg' }],
      },
    }

    // Same track in both recently played AND saved
    vi.mocked(spotifyService.getRecentlyPlayed).mockResolvedValue({
      items: [{ track: duplicateTrack, played_at: '2024-11-20T10:00:00Z' }],
    })

    vi.mocked(spotifyService.getSavedTracks).mockResolvedValue({
      items: [{ track: duplicateTrack, added_at: '2024-11-15T12:00:00Z' }],
    })

    render(<Recommendations />)

    await waitFor(() => {
      const trackElements = screen.getAllByText('Duplicate Track')
      expect(trackElements).toHaveLength(1) // Should only appear ONCE
    })
  })

  it('filters tracks with popularity >= 40', async () => {
    vi.mocked(spotifyService.getRecentlyPlayed).mockResolvedValue({
      items: [
        {
          track: {
            id: 'track1',
            name: 'Low Popularity',
            popularity: 25,
            artists: [{ id: 'artist1', name: 'Artist' }],
            album: {
              id: 'album1',
              name: 'Album',
              images: [{ url: 'https://example.com/image.jpg' }],
            },
          },
          played_at: '2024-11-20T10:00:00Z',
        },
        {
          track: {
            id: 'track2',
            name: 'High Popularity',
            popularity: 75,
            artists: [{ id: 'artist2', name: 'Artist 2' }],
            album: {
              id: 'album2',
              name: 'Album 2',
              images: [{ url: 'https://example.com/image2.jpg' }],
            },
          },
          played_at: '2024-11-20T11:00:00Z',
        },
      ],
    })

    vi.mocked(spotifyService.getSavedTracks).mockResolvedValue({
      items: [],
    })

    render(<Recommendations />)

    await waitFor(() => {
      expect(screen.getByText('Low Popularity')).toBeInTheDocument()
    })

    expect(screen.queryByText('High Popularity')).not.toBeInTheDocument()
  })

  it('sorts tracks by popularity (lowest first)', async () => {
    vi.mocked(spotifyService.getRecentlyPlayed).mockResolvedValue({
      items: [],
    })

    vi.mocked(spotifyService.getSavedTracks).mockResolvedValue({
      items: [
        {
          track: {
            id: 'track1',
            name: 'Track 30',
            popularity: 30,
            artists: [{ id: 'artist1', name: 'Artist' }],
            album: {
              id: 'album1',
              name: 'Album',
              images: [{ url: 'https://example.com/image.jpg' }],
            },
          },
          added_at: '2024-11-15T12:00:00Z',
        },
        {
          track: {
            id: 'track2',
            name: 'Track 10',
            popularity: 10,
            artists: [{ id: 'artist2', name: 'Artist 2' }],
            album: {
              id: 'album2',
              name: 'Album 2',
              images: [{ url: 'https://example.com/image2.jpg' }],
            },
          },
          added_at: '2024-11-15T13:00:00Z',
        },
      ],
    })

    render(<Recommendations />)

    await waitFor(() => {
      const tracks = screen.getAllByText(/Track \d+/)
      expect(tracks[0]).toHaveTextContent('Track 10') // Lowest first
      expect(tracks[1]).toHaveTextContent('Track 30')
    })
  })
})