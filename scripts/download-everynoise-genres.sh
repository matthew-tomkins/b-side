#!/bin/bash

# Download Every Noise Genre List
#
# TOS Status: ✅ Fully Compliant
# - Public data project by Glenn McDonald (Spotify)
# - Explicitly available for download
# - No scraping - direct file download
# - Source: https://everynoise.com/everynoise1d.cgi?scope=all

DATA_DIR="../client/data"
OUTPUT_FILE="$DATA_DIR/everynoise-genres.txt"
TEMP_FILE="/tmp/everynoise-genres.txt"

echo "📥 Downloading Every Noise genre list..."

# Download the genre list
curl -s "https://everynoise.com/everynoise1d.cgi?scope=all" > "$TEMP_FILE"

if [ $? -ne 0 ]; then
  echo "❌ Download failed"
  exit 1
fi

# Check if file is not empty
if [ ! -s "$TEMP_FILE" ]; then
  echo "❌ Downloaded file is empty"
  exit 1
fi

# Move to data directory
mkdir -p "$DATA_DIR"
mv "$TEMP_FILE" "$OUTPUT_FILE"

# Count genres
GENRE_COUNT=$(wc -l < "$OUTPUT_FILE" | tr -d ' ')

echo "✅ Downloaded $GENRE_COUNT genres to $OUTPUT_FILE"
echo ""
echo "Sample genres:"
head -10 "$OUTPUT_FILE"
echo "..."

exit 0
