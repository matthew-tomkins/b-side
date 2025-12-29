# Music Data Builder Scripts

**Purpose:** Automated scripts to build and maintain JSON data files for SimplifiedDiscoveryEngine

**TOS Compliance:** 100% - Uses only official APIs (MusicBrainz, Spotify)

---

## 📁 Scripts Overview

### 1. build-geography-data.ts
Fetches artist geography data from MusicBrainz API

**Output:** `client/data/artist-geography.json`

**Data Includes:**
- Artist country codes (US, GB, JP, NG, etc.)
- City/area information
- MusicBrainz IDs for reference

**Source:** MusicBrainz API (CC0 License - public domain)

**Rate Limit:** 1 request/second

### 2. build-similarity-data.ts
Fetches artist similarity/relationship data from Spotify

**Output:** `client/data/artist-similarity.json`

**Data Includes:**
- Related artists (up to 20 per artist)
- Primary genre
- Popularity/influence score
- Spotify IDs

**Source:** Spotify Related Artists API

**Rate Limit:** ~2 requests/second (conservative)

---

## 🚀 Usage

### Quick Start

```bash
# Build geography data (from MusicBrainz)
npm run build:geography

# Build similarity data (from Spotify)
npm run build:similarity

# Build both (sequential)
npm run build:music-data
```

### First Time Setup

**1. Geography Data (No auth required)**
```bash
npm run build:geography
```

The script includes a seed list of ~70 artists across key genres:
- US Punk: Ramones, Dead Kennedys, Black Flag
- UK Punk: Sex Pistols, The Clash, Buzzcocks
- Nigerian Funk: Fela Kuti, Tony Allen
- Japanese Indie: Lamp, Fishmans, Cornelius
- And more...

**Estimated time:** ~2 minutes (70 artists × 1 req/sec)

**2. Similarity Data (Requires Spotify login)**
```bash
# Option A: Use env var
SPOTIFY_TOKEN=your_token npm run build:similarity

# Option B: Log in via app first (token saved to localStorage)
npm run dev
# → Navigate to app, log in with Spotify
# → Then run build:similarity
```

**Estimated time:** ~30 seconds (70 artists × 0.5s)

---

## 📈 Expanding the Dataset

### Add More Artists

Edit `build-geography-data.ts` and add artists to the `SEED_ARTISTS` array:

```typescript
const SEED_ARTISTS = [
  // Existing artists...

  // Your additions
  'New Artist Name',
  'Another Band',
  // ...
]
```

Then run:
```bash
npm run build:geography
npm run build:similarity
```

### Incremental Updates

Both scripts skip artists that already have data. To update an artist:

1. Remove them from the JSON file manually
2. Re-run the script

Or modify the script to force updates.

---

## 🔧 Advanced Usage

### Update Existing Data

By default, scripts skip artists that already have data. To force update:

**Option 1:** Delete the JSON file and rebuild:
```bash
rm client/data/artist-geography.json
npm run build:geography
```

**Option 2:** Modify the skip logic in the script:
```typescript
// In build-geography-data.ts, comment out this check:
// if (data.artists[artistName]) {
//   console.log(`   ✓ Already have data, skipping`)
//   skipped++
//   continue
// }
```

### Custom Artist Lists

Create your own script using the builders:

```typescript
import { buildGeographyData } from './build-geography-data'

const MY_ARTISTS = [
  'Artist 1',
  'Artist 2',
  // ...
]

buildGeographyData(MY_ARTISTS)
```

### Automation (Weekly Updates)

Add a GitHub Action to update data weekly:

```yaml
# .github/workflows/update-music-data.yml
name: Update Music Data

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sundays
  workflow_dispatch:      # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build:geography
      - run: npm run build:similarity
        env:
          SPOTIFY_TOKEN: ${{ secrets.SPOTIFY_TOKEN }}
      - uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: 'chore: update music data'
```

---

## 📊 Data Format

### artist-geography.json

```json
{
  "version": "1.0",
  "last_updated": "2025-12-27",
  "source": "MusicBrainz API (CC0 License)",
  "description": "Artist geography data for filtering by country",
  "artists": {
    "Ramones": {
      "country": "US",
      "city": "New York",
      "mbid": "40ab0f93-469a-4743-abed-f43a447aefe5"
    }
  }
}
```

### artist-similarity.json

```json
{
  "version": "1.0",
  "last_updated": "2025-12-27",
  "source": "Spotify Related Artists API",
  "description": "Artist similarity relationships",
  "artists": {
    "Ramones": {
      "similar": ["Dead Kennedys", "The Damned", "Buzzcocks"],
      "genre": "punk",
      "influence_score": 85,
      "spotify_id": "1co4F2pPNH8JjTutZkmgSm"
    }
  }
}
```

---

## 🚨 Rate Limiting

### MusicBrainz
- **Limit:** 1 request/second (50/sec with account)
- **Implementation:** 1000ms delay between requests
- **TOS:** Strictly enforced - DO NOT exceed

### Spotify
- **Limit:** ~100 requests/30 seconds (varies by endpoint)
- **Implementation:** 500ms delay (conservative)
- **TOS:** Flexible but respect limits

### Best Practices

1. **Run during off-peak hours** (less likely to hit limits)
2. **Don't run both scripts simultaneously** (separate rate limits)
3. **Use incremental updates** (skip existing artists)
4. **Monitor console output** for errors/warnings

---

## ⚠️ Troubleshooting

### "No Spotify token found"

**Solution:** Log in via the app first:
```bash
npm run dev
# → Navigate to http://localhost:5174
# → Click "Login with Spotify"
# → Token saved to localStorage
# → Run build:similarity again
```

Or set `SPOTIFY_TOKEN` environment variable.

### "MusicBrainz rate limit exceeded"

**Solution:** Wait 1 minute, then resume. The script will skip completed artists.

### "Artist not found"

**Reasons:**
- Artist name spelling differs in MusicBrainz
- Artist doesn't exist in database
- Artist is too obscure

**Solution:** Check MusicBrainz directly: https://musicbrainz.org/

### Build errors with TypeScript

**Solution:**
```bash
# Ensure tsx is installed
npm install tsx --save-dev

# Or run with node + ts-node
npx ts-node scripts/build-geography-data.ts
```

---

## 📈 Performance Metrics

### Initial Build (70 artists)

| Script | Time | API Calls | Rate Limit |
|--------|------|-----------|------------|
| Geography | ~2 min | 70 | 1 req/sec |
| Similarity | ~30 sec | 70 | 2 req/sec |
| **Total** | **~2.5 min** | **140** | - |

### Incremental Update (10 new artists)

| Script | Time | API Calls |
|--------|------|-----------|
| Geography | ~10 sec | 10 |
| Similarity | ~5 sec | 10 |
| **Total** | **~15 sec** | **20** |

### Scale Estimates

| Artists | Geography Time | Similarity Time | Total Time |
|---------|----------------|-----------------|------------|
| 100 | 1.7 min | 50 sec | 2.5 min |
| 500 | 8.3 min | 4.2 min | 12.5 min |
| 1000 | 16.7 min | 8.3 min | 25 min |
| 2000 | 33.3 min | 16.7 min | 50 min |

**Recommendation:** Build incrementally rather than all at once.

---

## 🎯 Next Steps

1. **Run initial build** (~2.5 min for 70 artists)
2. **Test SimplifiedEngine** with expanded data
3. **Add more artists** to seed list (target: 500-1000)
4. **Set up weekly automation** (GitHub Action)
5. **Monitor data quality** and update as needed

---

## 🔗 References

- [MusicBrainz API Docs](https://musicbrainz.org/doc/MusicBrainz_API)
- [Spotify Web API Docs](https://developer.spotify.com/documentation/web-api)
- [TOS Compliance Plan](../SESSION_2025-12-27_JSON_DATA_PLAN.md)

---

**Last Updated:** December 27, 2025
**Maintainer:** B-Side Team
**TOS Status:** ✅ Fully Compliant
