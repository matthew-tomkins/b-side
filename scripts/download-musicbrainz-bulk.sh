#!/bin/bash

# Download MusicBrainz Bulk Data - Full Database Dump
#
# TOS Status: ✅ CC0 Public Domain
# Source: https://musicbrainz.org/doc/MusicBrainz_Database/Download
# License: Creative Commons CC0 (Public Domain)
#
# Downloads MusicBrainz core + derived data dumps
# Total size: ~6.5GB compressed, ~20-30GB uncompressed

DATA_DIR="../client/data"
TEMP_DIR="/tmp/musicbrainz-bulk"
BASE_URL="http://ftp.musicbrainz.org/pub/musicbrainz/data/fullexport"

echo "🌍 MusicBrainz Bulk Data Downloader"
echo "======================================"
echo ""
echo "📋 Downloading full MusicBrainz database dump"
echo "📦 Source: MusicBrainz Public Data Dumps"
echo "📜 License: CC0 (Public Domain)"
echo "⏱️  Expected time: 30-60 minutes"
echo "💾 Download size: ~6.5GB compressed"
echo "💾 Disk usage: ~20-30GB during extraction"
echo ""

# Create temp directory
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Get latest dump version
echo "🔍 Finding latest dump version..."
LATEST_VERSION=$(curl -s "$BASE_URL/LATEST")
if [ -z "$LATEST_VERSION" ]; then
  echo "❌ Could not determine latest version"
  exit 1
fi

DUMP_URL="$BASE_URL/$LATEST_VERSION"
echo "✅ Using dump version: $LATEST_VERSION"
echo ""

# Download core dump (contains artist, area, and relationship tables)
echo "1/2 Downloading core database dump (6GB, ~30-45 min)..."
echo "    This includes: artist, area, release, recording, work, label, etc."
curl -L --progress-bar "$DUMP_URL/mbdump.tar.bz2" -o "$TEMP_DIR/mbdump.tar.bz2"

if [ $? -ne 0 ]; then
  echo "❌ Core dump download failed"
  exit 1
fi

# Download derived data dump (contains tags, ratings, annotations)
echo ""
echo "2/2 Downloading derived data dump (445MB, ~5-10 min)..."
echo "    This includes: artist tags, ratings, annotations"
curl -L --progress-bar "$DUMP_URL/mbdump-derived.tar.bz2" -o "$TEMP_DIR/mbdump-derived.tar.bz2"

if [ $? -ne 0 ]; then
  echo "❌ Derived data download failed"
  exit 1
fi

# Extract core dump
echo ""
echo "📦 Extracting core database dump..."
tar -xjf mbdump.tar.bz2

if [ $? -ne 0 ]; then
  echo "❌ Extraction failed"
  exit 1
fi

# Extract derived dump
echo "📦 Extracting derived data dump..."
tar -xjf mbdump-derived.tar.bz2

if [ $? -ne 0 ]; then
  echo "❌ Extraction failed"
  exit 1
fi

echo ""
echo "✅ Downloaded and extracted to $TEMP_DIR/mbdump"
echo ""
echo "📊 Core Files:"
ls -lh mbdump/artist mbdump/area 2>/dev/null || echo "Error: Files not found"
echo ""
echo "📊 Tag Files:"
ls -lh mbdump/artist_tag mbdump/tag 2>/dev/null || echo "Error: Files not found"
echo ""
echo "📊 Relationship Files:"
ls -lh mbdump/l_artist_artist mbdump/link mbdump/link_type 2>/dev/null || echo "Error: Files not found"
echo ""

# Clean up compressed files to save space
echo "🧹 Cleaning up compressed files..."
rm -f mbdump.tar.bz2 mbdump-derived.tar.bz2
echo ""

echo "✅ Download complete!"
echo "Next step: Run parse-musicbrainz-bulk.ts to convert to JSON"

exit 0
