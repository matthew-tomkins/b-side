// Array utilities for deduplication and manipulation

/**
 * Deduplicate an array of items based on a key function
 * @param array - Array to deduplicate
 * @param keyFn - Function that generates a unique key for each item
 * @returns Deduplicated array (preserves order, keeps first occurrence)
 */
export function deduplicateBy<T>(array: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>()
  const unique: T[] = []

  for (const item of array) {
    const key = keyFn(item)
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(item)
    }
  }

  return unique
}
