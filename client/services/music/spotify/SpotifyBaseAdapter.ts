import { getAuthHeaders } from '../../spotify/auth'

export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

/**
 * Base class for Spotify adapters
 * Provides shared authentication and retry logic
 */
export abstract class SpotifyBaseAdapter {
  /**
   * Get standard Spotify API headers with authentication
   */
  protected getHeaders() {
    return getAuthHeaders()
  }

  /**
   * Retry a Spotify API call with exponential backoff on rate limit (429) errors
   * Handles Spotify's rate limiting gracefully
   */
  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error: unknown) {
        lastError = error

        // Check if it's a rate limit error (429)
        const is429 = (error as { status?: number })?.status === 429 ||
                      (error as { response?: { status?: number } })?.response?.status === 429 ||
                      ((error as Error)?.message && (error as Error).message.includes('429'))

        if (!is429 || attempt === maxRetries) {
          // Not a rate limit error, or we've exhausted retries
          throw error
        }

        // Calculate exponential backoff delay
        const delay = initialDelay * Math.pow(2, attempt)
        console.warn(`⏳ Spotify rate limit hit (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`)

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }
}
