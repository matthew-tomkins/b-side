import { useState } from 'react'

interface AdvancedSearchParams {
  genre?: string
  country?: string
  region?: string
  era?: string
  includeSurroundingRegions?: boolean
  energy?: { min: number; max: number }
  danceability?: { min: number; max: number }
  valence?: { min: number; max: number }
  acousticness?: { min: number; max: number }
  instrumentalness?: { min: number; max: number }
  tempo?: { min: number; max: number }
  minPopularity: number
  maxPopularity: number
  includeLibraryTracks: boolean
  deepCutsOnly: boolean
}

interface Props {
  onSearch: (params: AdvancedSearchParams) => void
  isSearching: boolean
}

export default function AdvancedSearch({ onSearch, isSearching }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [params, setParams] = useState<AdvancedSearchParams>({
    minPopularity: 25,
    maxPopularity: 100,
    includeLibraryTracks: true,
    deepCutsOnly: false,
    includeSurroundingRegions: false,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(params)
  }

  return (
    <div className="w-full max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Geographic Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Geographic</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Genre */}
            <div>
              <label htmlFor="genre" className="block text-sm font-medium mb-2">
                Genre
              </label>
              <input
                id="genre"
                type="text"
                value={params.genre || ''}
                onChange={(e) => setParams({ ...params, genre: e.target.value })}
                placeholder="e.g., hip hop, indie pop"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* Country */}
            <div>
              <label htmlFor="country" className="block text-sm font-medium mb-2">
                Country
              </label>
              <select
                id="country"
                value={params.country || ''}
                onChange={(e) => setParams({ ...params, country: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Any</option>
                <option value="Japan">Japan</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
                <option value="Brazil">Brazil</option>
                <option value="Nigeria">Nigeria</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="United States">United States</option>
                <option value="Korea">South Korea</option>
                <option value="Spain">Spain</option>
                <option value="Italy">Italy</option>
              </select>
            </div>

            {/* Region */}
            <div>
              <label htmlFor="region" className="block text-sm font-medium mb-2">
                Region
              </label>
              <select
                id="region"
                value={params.region || ''}
                onChange={(e) => setParams({ ...params, region: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Any</option>
                <option value="West Africa">West Africa</option>
                <option value="East Africa">East Africa</option>
                <option value="Scandinavia">Scandinavia</option>
                <option value="Caribbean">Caribbean</option>
                <option value="Southeast Asia">Southeast Asia</option>
                <option value="South America">South America</option>
                <option value="Eastern Europe">Eastern Europe</option>
              </select>
            </div>

            {/* Era */}
            <div>
              <label htmlFor="era" className="block text-sm font-medium mb-2">
                Era
              </label>
              <select
                id="era"
                value={params.era || ''}
                onChange={(e) => setParams({ ...params, era: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Any</option>
                <option value="1960-1969">1960s</option>
                <option value="1970-1979">1970s</option>
                <option value="1980-1989">1980s</option>
                <option value="1990-1999">1990s</option>
                <option value="2000-2009">2000s</option>
                <option value="2010-2019">2010s</option>
                <option value="2020-2029">2020s</option>
              </select>
            </div>
          </div>

          {/* Surrounding Regions Checkbox */}
          {params.country && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="surrounding"
                checked={params.includeSurroundingRegions}
                onChange={(e) => setParams({ ...params, includeSurroundingRegions: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="surrounding" className="text-sm">
                Include surrounding regions
              </label>
            </div>
          )}
        </div>

        {/* Sound Profile Section (Collapsible) */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-lg font-semibold hover:text-gray-600"
          >
            Sound Profile
            <span className="text-sm">{isExpanded ? '▼' : '▶'}</span>
          </button>

          {isExpanded && (
            <div className="space-y-4 pl-4">
              {/* Energy Slider */}
              <div>
                <label htmlFor="energy" className="block text-sm font-medium mb-2">
                  Energy: {params.energy?.min || 0}% - {params.energy?.max || 100}%
                </label>
                <input
                  id="energy"
                  type="range"
                  min="0"
                  max="100"
                  value={params.energy?.min || 0}
                  onChange={(e) => setParams({
                    ...params,
                    energy: { min: parseInt(e.target.value), max: params.energy?.max || 100 }
                  })}
                  className="w-full"
                />
              </div>

              {/* Danceability Slider */}
              <div>
                <label htmlFor="danceability" className="block text-sm font-medium mb-2">
                  Danceability: {params.danceability?.min || 0}% - {params.danceability?.max || 100}%
                </label>
                <input
                  id="danceability"
                  type="range"
                  min="0"
                  max="100"
                  value={params.danceability?.min || 0}
                  onChange={(e) => setParams({
                    ...params,
                    danceability: { min: parseInt(e.target.value), max: params.danceability?.max || 100 }
                  })}
                  className="w-full"
                />
              </div>

              {/* Happiness (Valence) Slider */}
              <div>
                <label htmlFor="valence" className="block text-sm font-medium mb-2">
                  Happiness: {params.valence?.min || 0}% - {params.valence?.max || 100}%
                </label>
                <input
                  id="valence"
                  type="range"
                  min="0"
                  max="100"
                  value={params.valence?.min || 0}
                  onChange={(e) => setParams({
                    ...params,
                    valence: { min: parseInt(e.target.value), max: params.valence?.max || 100 }
                  })}
                  className="w-full"
                />
              </div>

              {/* Acoustic Slider */}
              <div>
                <label htmlFor="acousticness" className="block text-sm font-medium mb-2">
                  Acoustic: {params.acousticness?.min || 0}% - {params.acousticness?.max || 100}%
                </label>
                <input
                  id="acousticness"
                  type="range"
                  min="0"
                  max="100"
                  value={params.acousticness?.min || 0}
                  onChange={(e) => setParams({
                    ...params,
                    acousticness: { min: parseInt(e.target.value), max: params.acousticness?.max || 100 }
                  })}
                  className="w-full"
                />
              </div>

              {/* Instrumental Slider */}
              <div>
                <label htmlFor="instrumentalness" className="block text-sm font-medium mb-2">
                  Instrumental: {params.instrumentalness?.min || 0}% - {params.instrumentalness?.max || 100}%
                </label>
                <input
                  id="instrumentalness"
                  type="range"
                  min="0"
                  max="100"
                  value={params.instrumentalness?.min || 0}
                  onChange={(e) => setParams({
                    ...params,
                    instrumentalness: { min: parseInt(e.target.value), max: params.instrumentalness?.max || 100 }
                  })}
                  className="w-full"
                />
              </div>

              {/* Tempo Range */}
              <div>
                <label htmlFor="tempo-min" className="block text-sm font-medium mb-2">
                  Tempo (BPM): {params.tempo?.min || 60} - {params.tempo?.max || 200}
                </label>
                <div className="flex gap-4">
                  <input
                    id="tempo-min"
                    type="number"
                    min="60"
                    max="200"
                    value={params.tempo?.min || 60}
                    onChange={(e) => setParams({
                      ...params,
                      tempo: { min: parseInt(e.target.value), max: params.tempo?.max || 200 }
                    })}
                    className="w-24 px-3 py-2 border rounded-lg"
                  />
                  <span>to</span>
                  <input
                    id="tempo-max"
                    type="number"
                    min="60"
                    max="200"
                    value={params.tempo?.max || 200}
                    onChange={(e) => setParams({
                      ...params,
                      tempo: { min: params.tempo?.min || 60, max: parseInt(e.target.value) }
                    })}
                    className="w-24 px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Popularity Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Popularity</h3>
          
          <div>
            <label htmlFor="minPopularity" className="block text-sm font-medium mb-2">
              Min Popularity: {params.minPopularity}
            </label>
            <input
              id="minPopularity"
              type="range"
              min="0"
              max="100"
              value={params.minPopularity}
              onChange={(e) => setParams({ ...params, minPopularity: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="maxPopularity" className="block text-sm font-medium mb-2">
              Max Popularity: {params.maxPopularity}
            </label>
            <input
              id="maxPopularity"
              type="range"
              min="0"
              max="100"
              value={params.maxPopularity}
              onChange={(e) => setParams({ ...params, maxPopularity: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="library"
              checked={params.includeLibraryTracks}
              onChange={(e) => setParams({ ...params, includeLibraryTracks: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="library" className="text-sm">
              Include library tracks
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="deepcuts"
              checked={params.deepCutsOnly}
              onChange={(e) => setParams({ ...params, deepCutsOnly: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="deepcuts" className="text-sm">
              Deep cuts only (popularity {'<'} 40)
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSearching}
          className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>
    </div>
  )
}