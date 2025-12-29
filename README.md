# B-Side 🎵

> **Your personal guide to undiscovered music**

Break out of your musical bubble. Explore quality music from anywhere, anytime, any genre - tailored to your taste.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)

---

## 🎯 What is B-Side?

B-Side helps you discover quality music you're missing - not just "obscure tracks", but **music that's NEW TO YOU**.

### The Problem

- Spotify's algorithms keep you in your bubble
- YouTube rabbit holes are hit-or-miss
- You want to explore new genres but don't know where to start
- "Obscure music apps" just show you bad tracks with low play counts

### The Solution

**B-Side understands that "obscure" is relative to YOUR context.**

For someone in New Zealand:
- 1970s Nigerian funk = Obscure (hard to discover)
- Khruangbin = Familiar (already know them)

For someone in Lagos:
- 1970s Nigerian funk = Cultural heritage (not obscure)
- New Zealand indie = Obscure (hard to discover)

**B-Side finds the gaps in YOUR musical journey and fills them with quality recommendations.**

---

## ✨ Features

### 🔍 Seed-Based Discovery
- Select 2-3 tracks you love
- Find similar tracks using Last.fm's recommendation engine
- Filter by quality threshold (40-100 popularity)
- Exclude tracks already in your library
- Save discoveries to Spotify playlists

### 🌍 Explorer Mode *(Coming Soon)*
Explore music by region, genre, and era:
```
Region: West Africa
Genre: Funk
Era: 1970s
Quality: 40-100
```

Get curated results like:
- Fela Kuti (73 popularity) - Entry point
- Tony Allen (65 popularity) - Hidden gem
- Ebo Taylor (55 popularity) - Deep cut

### 🎚️ Quality Control
Set your minimum quality threshold:
- **40-60**: More obscure discoveries
- **60-80**: Sweet spot for exploration
- **80-100**: Well-known but new to you

Unlike other apps, B-Side **filters out genuinely bad low-quality tracks** while still finding music you've never heard.

### 📊 Your Library B-Sides
Discover hidden gems already in your Spotify library:
- Tracks you saved but forgot about
- Lower-popularity tracks from your favorite artists
- Sorted by obscurity score

---

## 🚀 Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite for blazing-fast builds
- TailwindCSS for styling
- React Router for navigation

**Backend:**
- Node.js + Express
- Spotify Web API (OAuth, user data, search)
- Last.fm API (global music recommendations)
- MusicBrainz local database (320k+ artists with metadata)
- Adaptive scoring algorithm for quality filtering

**Architecture:**
- Platform-agnostic adapter pattern
- Service layer separation
- Type-safe throughout

**Data Sources:**
- [Every Noise at Once](https://everynoise.com) - 2,680 curated genre names and taxonomy (MIT License)
  - Created by Glenn McDonald
  - Powers genre normalization and cross-source mapping
- [MusicBrainz](https://musicbrainz.org) - 1.2M+ artist metadata (CC0 License)
  - Artist geography, tags, and relationships
  - Community-maintained music encyclopedia
- [Discogs](https://www.discogs.com) - Genre/style enrichment (Fair Use)
  - Detailed genre classifications
  - Artist discographies and release data
- [Spotify Web API](https://developer.spotify.com) - Music playback and user data
- [Last.fm API](https://www.last.fm/api) - Music recommendations and discovery

---

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ and npm
- Spotify Developer account ([Sign up](https://developer.spotify.com/dashboard))
- Last.fm API account ([Get API key](https://www.last.fm/api/account/create))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/matthew-tomkins/b-side.git
   cd b-side
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Spotify
   VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
   VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/callback
   
   # Last.fm
   VITE_LASTFM_API_KEY=your_lastfm_api_key
   ```

4. **Configure Spotify App**
   - Go to your [Spotify Dashboard](https://developer.spotify.com/dashboard)
   - Add `http://localhost:5173/callback` to Redirect URIs
   - Set app to Development Mode

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open the app**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

---

## 📖 How It Works

### Discovery Flow

```
1. User selects seed tracks from their top tracks
   ↓
2. Last.fm finds similar tracks/artists
   ↓
3. Search Spotify for those recommendations
   ↓
4. Filter by:
   - Popularity threshold (quality control)
   - User's library (remove duplicates)
   ↓
5. Return curated results
   ↓
6. User can preview, save, or create playlists
```

### The Secret Sauce

**Personal Obscurity Algorithm:**
- Filters out tracks already in your library
- Prioritizes different genres/regions/eras than your usual
- Balances "new to you" with "actually good quality"
- Uses community data (future) to improve recommendations

---

## 🎨 Philosophy

### Core Values

1. **Personal, Not Universal**
   - Discovery tailored to YOUR gaps
   - Your journey is unique
   - No one-size-fits-all recommendations

2. **Quality Over Obscurity**
   - Good music that's new to you > Bad music nobody knows
   - Quality threshold prevents garbage recommendations
   - Curation matters

3. **Context & Education**
   - Learn about regions, eras, movements
   - Understand WHY music matters
   - Discovery as education, not just consumption

4. **Community-Driven** *(Future)*
   - Users share journeys
   - Learn from others' discoveries
   - Privacy-respecting, opt-in social features

### What B-Side Is NOT

- ❌ Not a "find the most obscure music" app
- ❌ Not trying to be cooler-than-thou
- ❌ Not about random algorithmic suggestions
- ❌ Not replacing Spotify - enhancing it

### What B-Side IS

- ✅ Your personal guide to undiscovered music
- ✅ Quality-controlled exploration tool
- ✅ Educational music discovery platform
- ✅ Community of curious music lovers

---

## 🗺️ Roadmap

### Phase 7: Dashboard & Discovery ✅
- [x] Spotify OAuth authentication
- [x] User dashboard with top artists/tracks
- [x] Seed-based discovery with Last.fm
- [x] Popularity filtering
- [x] Library exclusion
- [x] Save to Spotify playlists

### Phase 8: Explorer Mode 🚧 *(In Progress)*
- [x] Region/Genre/Era exploration
- [x] MusicBrainz local database (320k+ artists)
- [x] Adaptive scoring algorithm (MBID + era + tags)
- [x] SimplifiedDiscoveryEngine with rate limiting
- [ ] Character encoding normalization (The Go-Betweens issue)
- [ ] Optimize rate limiting (20-artist limit review)

### Phase 9-10: Intelligence Layer 🔮
- [ ] "My Blind Spots" analysis
- [ ] Personal obscurity scoring
- [ ] Discovery journeys (curated paths)
- [ ] Audio features integration

### Phase 11-15: Social & Community 🌐
- [ ] User profiles with privacy controls
- [ ] Follow system
- [ ] Share discoveries
- [ ] Community-curated journeys
- [ ] Discussion forums

---

## 🤝 Contributing

This project is currently in active development. Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Note:** Please use [Conventional Commits](https://www.conventionalcommits.org/) format.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Spotify Web API** - Music data and playback
- **Last.fm API** - Recommendation engine
- **Dev Academy Aotearoa** - Training and support
- **Every music explorer** who wants to break out of their bubble

---

## 📧 Contact

**Matt Tomkins**
- GitHub: [@matthew-tomkins](https://github.com/matthew-tomkins)
- Project: [B-Side](https://github.com/matthew-tomkins/b-side)

---

## 💡 Inspiration

*"The B-side was where artists took risks, experimented, and created something unique. That's what this app is about - finding your musical B-sides."*

**Built with ❤️ in Aotearoa, New Zealand** 🇳🇿

---

**[⬆ Back to top](#b-side-)**