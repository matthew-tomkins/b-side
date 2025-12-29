import { useState } from 'react'
import { SpotifyAdapter } from '../services/music/SpotifyAdapter'
import { LastFmAdapter } from '../services/music/LastFmAdapter'
import { SimplifiedDiscoveryEngine, SimplifiedTrack } from '../services/music/SimplifiedDiscoveryEngine'
import { DiscoveryEngine } from '../services/music/DiscoveryEngine'
import { Track } from '../services/music/types'
import { LoadingState } from './StateMessages'

type EngineType = 'simplified' | 'complex'

interface SearchResult {
  tracks: SimplifiedTrack[] | Track[]
  duration: number
  engine: EngineType
}

export default function SimplifiedExplorerMode() {
  const [query, setQuery] = useState('')
  const [selectedEngine, setSelectedEngine] = useState<EngineType>('simplified')
  const [compareMode, setCompareMode] = useState(false)

  // Results state
  const [simplifiedResult, setSimplifiedResult] = useState<SearchResult | null>(null)
  const [complexResult, setComplexResult] = useState<SearchResult | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const spotify = new SpotifyAdapter()
  const lastfm = new LastFmAdapter()
  const simplifiedEngine = new SimplifiedDiscoveryEngine(spotify, lastfm)
  const complexEngine = new DiscoveryEngine(spotify)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()

    if (!query.trim()) {
      setError('Please enter a search term')
      return
    }

    setLoading(true)
    setError(null)
    setSimplifiedResult(null)
    setComplexResult(null)

    try {
      if (compareMode) {
        // Run both engines for comparison
        await Promise.all([
          runSimplifiedEngine(),
          runComplexEngine()
        ])
      } else {
        // Run selected engine only
        if (selectedEngine === 'simplified') {
          await runSimplifiedEngine()
        } else {
          await runComplexEngine()
        }
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function runSimplifiedEngine() {
    console.log('🚀 Running SIMPLIFIED engine...')
    console.log('Query string:', query)
    const startTime = Date.now()

    try {
      // Pass the query string - the engine will parse it
      const tracks = await simplifiedEngine.discover(query, 50)
      const duration = Date.now() - startTime
      console.log(`✅ Simplified engine complete in ${duration}ms`)
      console.log(`   Found ${tracks.length} tracks`)

      setSimplifiedResult({ tracks, duration, engine: 'simplified' })
    } catch (err) {
      console.error('Simplified engine error:', err)
      throw err
    }
  }

  async function runComplexEngine() {
    console.log('🚀 Running COMPLEX engine...')
    const startTime = Date.now()

    try {
      const tracks = await complexEngine.exploreByAttributes({
        query,
        minPopularity: 25,
        includeLibraryTracks: true,
        limit: 50,
      })

      const duration = Date.now() - startTime
      console.log(`✅ Complex engine complete in ${duration}ms`)

      setComplexResult({ tracks, duration, engine: 'complex' })
    } catch (err) {
      console.error('Complex engine error:', err)
      throw err
    }
  }

  const currentResult = selectedEngine === 'simplified' ? simplifiedResult : complexResult

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">🔬 Engine Comparison Mode</h2>
          <p className="text-gray-400">
            Test the simplified engine vs the complex engine side-by-side
          </p>
        </div>

        {/* Engine Selection */}
        <div className="mb-6 bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Engine Selection</h3>

            {/* Compare Mode Toggle */}
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={compareMode}
                onChange={(e) => setCompareMode(e.target.checked)}
                className="mr-2"
              />
              <span className="text-white">Compare Both</span>
            </label>
          </div>

          {!compareMode && (
            <div className="flex gap-4">
              <button
                onClick={() => setSelectedEngine('simplified')}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  selectedEngine === 'simplified'
                    ? 'border-green-500 bg-green-500/20'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="text-white font-semibold mb-1">⚡ Simplified Engine</div>
                <div className="text-sm text-gray-400">
                  Fast (10-15s) • Last.fm + Spotify • 250 lines
                </div>
              </button>

              <button
                onClick={() => setSelectedEngine('complex')}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  selectedEngine === 'complex'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="text-white font-semibold mb-1">🔬 Complex Engine</div>
                <div className="text-sm text-gray-400">
                  Slow (2+ min) • 4 APIs • 3,286 lines
                </div>
              </button>
            </div>
          )}

          {compareMode && (
            <div className="text-yellow-400 text-sm">
              ⚠️ Compare mode will run both engines simultaneously. This may take 2+ minutes.
            </div>
          )}
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try: "funk Nigeria 1980-1989" or "punk United States 1970-1979"'
              className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <LoadingState message={
            compareMode
              ? "Running both engines for comparison..."
              : `Running ${selectedEngine} engine...`
          } />
        )}

        {/* Results - Compare Mode */}
        {compareMode && !loading && (simplifiedResult || complexResult) && (
          <div className="grid grid-cols-2 gap-6">
            <ResultCard result={simplifiedResult} color="green" />
            <ResultCard result={complexResult} color="blue" />
          </div>
        )}

        {/* Results - Single Engine Mode */}
        {!compareMode && !loading && currentResult && (
          <ResultCard
            result={currentResult}
            color={selectedEngine === 'simplified' ? 'green' : 'blue'}
          />
        )}
      </div>
    </div>
  )
}

// Result Card Component
interface ResultCardProps {
  result: SearchResult | null
  color: 'green' | 'blue'
}

function ResultCard({ result, color }: ResultCardProps) {
  if (!result) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-gray-500 text-center py-8">
          Waiting for results...
        </div>
      </div>
    )
  }

  const { tracks, duration, engine } = result
  const artistCount = new Set(
    tracks.map(t => ('artist' in t ? t.artist : t.artists?.[0]?.name || 'Unknown'))
  ).size

  const colorClasses = {
    green: 'text-green-500 bg-green-500/20 border-green-500',
    blue: 'text-blue-500 bg-blue-500/20 border-blue-500'
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4">
        {engine === 'simplified' ? '⚡ Simplified Engine' : '🔬 Complex Engine'}
      </h3>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <div className="text-2xl font-bold">{(duration / 1000).toFixed(1)}s</div>
          <div className="text-sm opacity-80">Time</div>
        </div>

        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <div className="text-2xl font-bold">{tracks.length}</div>
          <div className="text-sm opacity-80">Tracks</div>
        </div>

        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <div className="text-2xl font-bold">{artistCount}</div>
          <div className="text-sm opacity-80">Artists</div>
        </div>
      </div>

      {/* Track List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {tracks.slice(0, 20).map((track, index) => {
          const trackName = track.name
          const artistName = 'artist' in track ? track.artist : track.artists?.[0]?.name || 'Unknown'
          const popularity = track.popularity || 0

          return (
            <div
              key={`${trackName}-${index}`}
              className="bg-gray-700/50 p-3 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="text-white font-medium">{trackName}</div>
                  <div className="text-gray-400 text-sm">{artistName}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-gray-400">Pop: {popularity}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {tracks.length > 20 && (
        <div className="mt-4 text-center text-gray-500 text-sm">
          Showing 20 of {tracks.length} tracks
        </div>
      )}
    </div>
  )
}
