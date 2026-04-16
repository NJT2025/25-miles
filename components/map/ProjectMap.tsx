"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import { useRef, useCallback, useEffect } from "react"
import Map, { Layer, Source, Marker, Popup, NavigationControl } from "react-map-gl/maplibre"
import type { MapRef } from "react-map-gl/maplibre"
import turfCircle from "@turf/circle"
import { CATEGORY_MAP, GROUPS, getGroupColour, type CategoryCode } from "@/lib/category-definitions"
import type { SearchResultRow } from "@/components/project/ProjectSearchPage"

// Free CartoDB Positron style — no API key required
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"

interface ProjectMapProps {
  lat: number
  lng: number
  radius: number
  results: SearchResultRow[]
  selectedId: string | null
  onSelectSupplier: (id: string | null) => void
}

export function ProjectMap({
  lat,
  lng,
  radius,
  results,
  selectedId,
  onSelectSupplier,
}: ProjectMapProps) {
  const mapRef = useRef<MapRef>(null)

  // Concentric rings every 5 miles up to the search radius
  const ringIntervals: number[] = []
  for (let r = 5; r < radius; r += 5) ringIntervals.push(r)
  ringIntervals.push(radius) // always include the outer edge

  const ringCircles = ringIntervals.map((r) => ({
    miles: r,
    isOuter: r === ringIntervals[ringIntervals.length - 1],
    geojson: turfCircle([lng, lat], r * 1.60934, { steps: 64, units: "kilometers" }),
  }))

  const mappable = results.filter(
    (r) => r.supplier.lat !== null && r.supplier.lng !== null
  )

  // Collect which groups are present in results for the legend
  const presentGroups = Array.from(
    new Set(
      mappable.flatMap((r) =>
        r.supplier.categories.map(
          (c) => CATEGORY_MAP[c as CategoryCode]?.group
        ).filter(Boolean)
      )
    )
  )

  const selectedResult = results.find((r) => r.supplier.id === selectedId)

  // Fit map view to the radius circle whenever radius or centre changes
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const bbox = turfCircle([lng, lat], radius * 1.60934, { steps: 4, units: "kilometers" })
    const coords = (bbox.geometry.coordinates[0] as [number, number][])
    const lngs = coords.map((c) => c[0])
    const lats = coords.map((c) => c[1])
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 48, duration: 600 }
    )
  }, [radius, lat, lng])

  const handleMapClick = useCallback(() => {
    onSelectSupplier(null)
  }, [onSelectSupplier])

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: lng,
          latitude: lat,
          zoom: 9,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        onClick={handleMapClick}
      >
        <NavigationControl position="top-right" />

        {/* Concentric rings every 5 miles — rendered outer-to-inner so fills stack */}
        {[...ringCircles].reverse().map(({ miles, isOuter, geojson }) => (
          <Source key={miles} id={`ring-${miles}`} type="geojson" data={geojson}>
            <Layer
              id={`ring-fill-${miles}`}
              type="fill"
              paint={{
                "fill-color": "#4a7c59",
                "fill-opacity": 0.055,
              }}
            />
            <Layer
              id={`ring-line-${miles}`}
              type="line"
              paint={{
                "line-color": "#4a7c59",
                "line-width": isOuter ? 2 : 1,
                "line-opacity": isOuter ? 0.9 : 0.35,
                "line-dasharray": isOuter ? [1] : [4, 3],
              }}
            />
          </Source>
        ))}

        {/* Project site marker — prominent pin with label */}
        <Marker longitude={lng} latitude={lat} anchor="bottom">
          <div className="flex flex-col items-center">
            <div
              className="px-2 py-0.5 rounded text-white text-[10px] font-semibold shadow-md whitespace-nowrap"
              style={{ backgroundColor: "#1c1c1a" }}
            >
              Project site
            </div>
            <div
              className="w-0 h-0"
              style={{
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "7px solid #1c1c1a",
              }}
            />
          </div>
        </Marker>

        {/* Supplier markers */}
        {mappable.map((result, index) => {
          const { supplier } = result
          const primaryCategory = (supplier.categories[0] as CategoryCode) || null
          const colour = primaryCategory
            ? getGroupColour(CATEGORY_MAP[primaryCategory]?.group ?? "suppliers")
            : "#888"
          const isSelected = supplier.id === selectedId

          return (
            <Marker
              key={supplier.id}
              longitude={supplier.lng!}
              latitude={supplier.lat!}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                onSelectSupplier(supplier.id)
              }}
            >
              <div
                className={`flex items-center justify-center rounded-full text-white text-[10px] font-bold shadow-md cursor-pointer transition-transform ${
                  isSelected ? "scale-125" : "hover:scale-110"
                }`}
                style={{
                  width: isSelected ? 30 : 24,
                  height: isSelected ? 30 : 24,
                  backgroundColor: colour,
                  border: isSelected ? "2px solid white" : "1.5px solid rgba(255,255,255,0.8)",
                  boxShadow: isSelected ? `0 0 0 2px ${colour}` : undefined,
                }}
              >
                {index + 1}
              </div>
            </Marker>
          )
        })}

        {/* Popup for selected supplier */}
        {selectedResult && selectedResult.supplier.lat && selectedResult.supplier.lng && (
          <Popup
            longitude={selectedResult.supplier.lng}
            latitude={selectedResult.supplier.lat}
            anchor="bottom"
            onClose={() => onSelectSupplier(null)}
            closeOnClick={false}
            className="font-sans"
          >
            <div className="p-1 max-w-[220px]">
              <p className="font-semibold text-stone-800 text-sm leading-snug">
                {selectedResult.supplier.name}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                {selectedResult.distanceMiles >= 99999
                  ? "Location unknown"
                  : `${selectedResult.distanceMiles.toFixed(1)} miles`}
              </p>
              {selectedResult.supplier.website && (
                <a
                  href={selectedResult.supplier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline block mt-1"
                >
                  Visit website →
                </a>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Category colour legend — only shown when results have mapped locations */}
      {presentGroups.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-2 space-y-1 text-xs pointer-events-none">
          {GROUPS.filter((g) => presentGroups.includes(g.key)).map((g) => (
            <div key={g.key} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: g.colour }}
              />
              <span className="text-stone-600">{g.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
