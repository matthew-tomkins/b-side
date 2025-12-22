import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true // For client-side use
})

export interface ParsedQuery {
  region?: string
  country?: string
  multiCountryRegion?: string[]
  genre: string
  era?: string
  decade?: string
  mood?: string
  popularity?: 'mainstream' | 'underground' | 'obscure'
}

export class QueryParser {
  async parse(userQuery: string): Promise<ParsedQuery> {
    try {
      console.log('Parsing query with AI:', userQuery)
      
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Parse this music search query into structured data. Return ONLY valid JSON, no other text.

Query: "${userQuery}"

Extract:
- region: city name only (e.g., "Seattle", "Tokyo", "Lagos")
- country: ISO country name (e.g., "USA", "Japan", "Nigeria", "Ghana")
- multiCountryRegion: for regions spanning multiple countries, list primary countries (e.g., "West Africa" → ["Nigeria", "Ghana", "Senegal"])
- genre: music genre (e.g., "funk", "grunge", "city pop")
- era: time period as "YYYY-YYYY" (e.g., "1970-1979", "1990-1999")
- decade: decade if mentioned (e.g., "1980s", "1990s")
- mood: mood/vibe (e.g., "upbeat", "melancholic", "underground")
- popularity: "mainstream", "underground", or "obscure" if implied

Example:
Query: "grunge from seattle in the 90s"
Output: {"region":"Seattle","country":"USA","genre":"grunge","era":"1990-1999","decade":"1990s"}

Example:
Query: "west africa funk"
Output: {"multiCountryRegion":["Nigeria","Ghana","Senegal"],"genre":"funk"}

Now parse: "${userQuery}"`
        }]
      })

      // Extract JSON from response
      const content = message.content[0]
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          console.log('Parsed result:', parsed)
          return parsed
        }
      }

      throw new Error('Failed to parse response')
    } catch (err) {
      console.error('Query parsing error:', err)
      // Fallback: treat entire query as genre
      return { genre: userQuery }
    }
  }
}