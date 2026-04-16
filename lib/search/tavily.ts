// Tavily API client

export interface TavilyResult {
  title: string
  url: string
  content: string
  raw_content?: string
  score: number
}

export interface TavilyResponse {
  results: TavilyResult[]
  answer?: string
}

export async function tavilySearch(
  query: string,
  maxResults = 15,
  options: {
    includeRawContent?: boolean
    includeDomains?: string[]
  } = {}
): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return [] // graceful degradation in dev

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: options.includeRawContent ?? false,
      ...(options.includeDomains ? { include_domains: options.includeDomains } : {}),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Tavily API error ${res.status}: ${text}`)
  }

  const data: TavilyResponse = await res.json()
  return data.results ?? []
}
