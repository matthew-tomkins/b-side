#!/usr/bin/env python3
"""
Split large enriched JSON file into smaller chunks using Python
This avoids Node.js memory constraints by processing line-by-line
"""

import json
import os
import sys

CHUNK_SIZE = 60000  # Artists per chunk
INPUT_FILE = 'client/data/musicbrainz-artists-enriched.json'
OUTPUT_DIR = 'client/data/musicbrainz-enriched-chunks'

def main():
    print('🔄 Starting split process with Python...\n')

    if not os.path.exists(INPUT_FILE):
        print(f'❌ Error: {INPUT_FILE} not found')
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f'✅ Output directory ready: {OUTPUT_DIR}')

    print(f'\n📖 Reading {INPUT_FILE}...')
    print('   (This may take 30-60 seconds)\n')

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    metadata = {k: v for k, v in data.items() if k != 'artists'}
    artists = data['artists']
    artist_items = list(artists.items())
    total_artists = len(artist_items)

    print(f'📊 Total artists: {total_artists:,}')
    print(f'🎯 Chunk size: {CHUNK_SIZE:,} artists')
    print(f'📦 Creating {(total_artists + CHUNK_SIZE - 1) // CHUNK_SIZE} chunks\n')

    chunk_index = 0
    for i in range(0, len(artist_items), CHUNK_SIZE):
        chunk_artists = dict(artist_items[i:i + CHUNK_SIZE])

        chunk_data = {
            **metadata,
            'chunk_index': chunk_index,
            'chunk_artist_count': len(chunk_artists),
            'total_artist_count': total_artists,
            'artists': chunk_artists
        }

        output_file = os.path.join(OUTPUT_DIR, f'chunk-{chunk_index:02d}.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(chunk_data, f, indent=2)

        progress = ((i + len(chunk_artists)) / total_artists * 100)
        print(f'✅ Chunk {chunk_index}: {len(chunk_artists):,} artists ({progress:.1f}% complete)')
        chunk_index += 1

    print(f'\n🎉 Split complete!')
    print(f'   Created {chunk_index} chunk files in {OUTPUT_DIR}')
    print(f'   Total artists: {total_artists:,}')
    print(f'\n💡 Next step: Start server to load chunks')

if __name__ == '__main__':
    main()
