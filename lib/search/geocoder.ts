// Mapbox Geocoding API helpers

export interface GeocodeResult {
  lat: number
  lng: number
  placeName: string
}

export async function geocodePostcode(postcode: string): Promise<GeocodeResult | null> {
  const token = process.env.MAPBOX_TOKEN

  // Primary: Mapbox
  if (token) {
    const encoded = encodeURIComponent(postcode.trim())
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?country=GB&types=postcode&access_token=${token}`
    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const feature = data.features?.[0]
        if (feature) {
          const [lng, lat] = feature.center
          return { lat, lng, placeName: feature.place_name }
        }
      }
    } catch {
      // fall through to postcodes.io
    }
  }

  // Fallback: postcodes.io (free, no key, UK postcodes only)
  try {
    const clean = postcode.replace(/\s+/g, "").toUpperCase()
    const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`)
    if (res.ok) {
      const data = await res.json()
      if (data.status === 200 && data.result) {
        return {
          lat: data.result.latitude,
          lng: data.result.longitude,
          placeName: data.result.postcode,
        }
      }
    }
  } catch {
    // postcodes.io also failed
  }

  return null
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const token = process.env.MAPBOX_TOKEN
  if (!token) return null // graceful degradation in dev

  const encoded = encodeURIComponent(address.trim())
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?country=GB&access_token=${token}`

  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json()
  const feature = data.features?.[0]
  if (!feature) return null

  const [lng, lat] = feature.center
  return { lat, lng, placeName: feature.place_name }
}

/**
 * Haversine distance between two lat/lng points, in miles.
 */
export function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}
