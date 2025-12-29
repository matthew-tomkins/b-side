import { ParsedQuery } from './QueryParser'

interface CacheEntry {
  query: string
  parsed: ParsedQuery
  timestamp: number
}

export class QueryCache {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly TTL = 30 * 24 * 60 * 60 * 1000 // 30 days
  private readonly STORAGE_KEY = 'b-side-query-cache'

  constructor() {
    this.load()
  }

  get(query: string): ParsedQuery | null {
    const key = query.toLowerCase().trim()
    const entry = this.cache.get(key)
    
    if (!entry) return null
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key)
      this.save()
      return null
    }
    
    console.log('Cache HIT:', key)
    return entry.parsed
  }

  set(query: string, parsed: ParsedQuery): void {
    const key = query.toLowerCase().trim()
    this.cache.set(key, {
      query,
      parsed,
      timestamp: Date.now()
    })
    console.log('Cache SET:', key)
    this.save()
  }

  // Persist to localStorage
  private save(): void {
    try {
      const data = Array.from(this.cache.entries())
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (err) {
      console.error('Failed to save cache:', err)
    }
  }

  // Load from localStorage
  private load(): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY)
      if (data) {
        const entries = JSON.parse(data)
        this.cache = new Map(entries)
        console.log('Loaded cache with', this.cache.size, 'entries')
      }
    } catch (err) {
      console.error('Failed to load cache:', err)
    }
  }

  // Clear entire cache
  clear(): void {
    this.cache.clear()
    this.save()
    console.log('Cache cleared')
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    }
  }
}