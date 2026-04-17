// Claude API — extract structured supplier records from raw search results
import Anthropic from "@anthropic-ai/sdk"
import type { TavilyResult } from "./tavily"
import type { CategoryCode } from "@/lib/category-definitions"
import { HERITAGE_CRAFT_LIST_FOR_PROMPT } from "@/lib/heritage-crafts-data"

export interface ExtractedSupplier {
  name: string
  description: string
  address: string
  postcode?: string
  phone?: string
  email?: string
  website?: string
  categories: CategoryCode[]
  accreditations: string[]
  sourceUrl?: string
  heritageRiskLevel?: string
  heritageCraftType?: string
}

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a data extraction assistant helping an architecture practice find local building material suppliers and craftspeople in the UK.

Given raw web search results, extract structured information about suppliers, manufacturers, and craftspeople.

Return a JSON array of objects. Each object must have:
- name: string (company or person name)
- description: string (brief description of what they do, 1-2 sentences)
- address: string (full address if found, otherwise empty string)
- postcode: string (UK postcode if found, otherwise empty string)
- phone: string (phone number if found, otherwise empty string)
- email: string (email if found, otherwise empty string)
- website: string (website URL if found, otherwise empty string)
- categories: string[] (from the provided category codes)
- accreditations: string[] (e.g. "IHBC", "CITB", "Guild of Master Craftsmen")
- sourceUrl: string (the URL where this result was found)
- heritageRiskLevel: string | null (see HCA Heritage Crafts list below)
- heritageCraftType: string | null (see HCA Heritage Crafts list below)

HCA Heritage Crafts — Red List (building and decorative crafts):
${HERITAGE_CRAFT_LIST_FOR_PROMPT}

If a supplier clearly practises one of the crafts in the HCA Heritage Crafts list above, set heritageRiskLevel to the risk level shown in brackets and heritageCraftType to the exact craft name. Only set these fields if you are confident the supplier specifically practises that heritage craft. Otherwise set both to null.

Only include genuine UK-based businesses. Skip news articles and non-business entries. Extract every business you can find — including those listed in directories or mentioned briefly. Return up to 25 results. Return only valid JSON, no markdown fences.`

/**
 * Claude-only fallback: generate plausible UK supplier records from Claude's
 * training knowledge when Tavily is not configured.
 */
export async function claudeGenerateSuppliers(
  categories: CategoryCode[],
  locationContext: string,
  radiusMiles?: number
): Promise<ExtractedSupplier[]> {
  const radiusContext = radiusMiles
    ? `Search radius: ${radiusMiles} miles. Include suppliers spread across the full search area — not just those closest to the location. For a larger radius, include suppliers up to ${radiusMiles} miles away.`
    : "Include a geographic spread — some local, some within the wider region."

  const userPrompt = `You are helping an architecture practice find real UK suppliers and craftspeople.

Location: ${locationContext}
Category codes needed: ${categories.join(", ")}
${radiusContext}

Generate a list of 10–15 real or highly plausible UK businesses or sole traders that match these categories and could realistically be found within the search area. Prefer businesses that are genuinely known to exist.

Return a JSON array only (no markdown). Each object must have:
- name: string
- description: string (2–3 sentences about what they do)
- address: string (realistic UK address)
- postcode: string (valid UK postcode near the location)
- phone: string or ""
- email: string or ""
- website: string or ""
- categories: string[] (subset of: ${categories.join(", ")})
- accreditations: string[] (realistic ones such as "IHBC", "CITB", "Guild of Master Craftsmen", "Worshipful Company", or [])
- sourceUrl: ""
- heritageRiskLevel: string or null (CRITICALLY_ENDANGERED | ENDANGERED | CULTURALLY_DISTINCTIVE | RESURGENT | null)
- heritageCraftType: string or null

Return only valid JSON, no markdown fences.`

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 5000,
    temperature: 0,
    messages: [{ role: "user", content: userPrompt }],
  })

  const text = message.content[0].type === "text" ? message.content[0].text : ""
  const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()

  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    console.error("Failed to parse Claude-generated suppliers:", cleaned)
    return []
  }
}

export async function extractSuppliers(
  searchResults: TavilyResult[],
  categories: CategoryCode[],
  locationContext: string
): Promise<ExtractedSupplier[]> {
  if (searchResults.length === 0) return []

  // Use raw_content (full page text) when available, truncated to 3000 chars
  const resultsText = searchResults
    .map((r, i) => {
      const body = r.raw_content
        ? r.raw_content.slice(0, 5000)
        : r.content
      return `[${i + 1}] ${r.title}\nURL: ${r.url}\n${body}`
    })
    .join("\n\n---\n\n")

  const userPrompt = `Location context: ${locationContext}
Category codes to assign: ${categories.join(", ")}

Search results:
${resultsText}

Extract supplier records from the above. Return JSON array only.`

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    temperature: 0,
    messages: [{ role: "user", content: userPrompt }],
    system: SYSTEM_PROMPT,
  })

  const text = message.content[0].type === "text" ? message.content[0].text : ""

  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim()

  try {
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    console.error("Failed to parse AI extraction response:", cleaned)
    return []
  }
}
