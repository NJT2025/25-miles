"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import { useRef, useCallback, useEffect } from "react"
import Map, { Layer, Source, Marker, Popup, NavigationControl } from "react-map-gl/maplibre"
import type { MapRef, MapLayerMouseEvent } from "react-map-gl/maplibre"
import turfCircle from "@turf/circle"
import { CATEGORY_MAP, GROUPS, getGroupColour, type CategoryCode } from "@/lib/category-definitions"
import type { SearchResultRow } from "@/components/project/ProjectSearchPage"
import type { GeoJSONSource } from "maplibre-gl"

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
  ringIntervals.push(radius)

  const ringCircles = ringIntervals.map((r) => ({
    miles: r,
    isOuter: r === ringIntervals[ringIntervals.length - 1],
    geojson: turfCircle([lng, lat], r * 1.60934, { steps: 64, units: "kilometers" }),
  }))

  const mappable = results.filter(
    (r) => r.supplier.lat !== null && r.supplier.lng !== null
  )

  // Build GeoJSON FeatureCollection for clustering
  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: mappable.map((r, i) => {
      const primaryCategory = (r.supplier.categories[0] as CategoryCode) || null
      const group = primaryCategory ? (CATEGORY_MAP[primaryCategory]?.group ?? "suppliers") : "suppliers"
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.supplier.lng!, r.supplier.lat!] },
        properties: {
          index: i,
          supplierId: r.supplier.id,
          group,
          colour: getGroupColour(group),
          label: String(i + 1),
        },
      }
    }),
  }

  // MapLibre match expression for group → colour (typed as any to avoid complex DSL inference)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupColourExpression: any = [
    "match",
    ["get", "group"],
    ...GROUPS.flatMap((g) => [g.key, g.colour]),
    "#888",
  ]

  // Collect which groups are present for the legend
  const presentGroups = Array.from(
    new Set(
      mappable.flatMap((r) =>
        r.supplier.categories
          .map((c) => CATEGORY_MAP[c as CategoryCode]?.group)
          .filter(Boolean)
      )
    )
  )

  const selectedResult = results.find((r) => r.supplier.id === selectedId)

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

  // Unified click handler — differentiates clusters from individual points
  const handleMapClick = useCallback(async (e: MapLayerMouseEvent) => {
    const map = mapRef.current?.getMap()
    if (!map || !e.features?.length) {
      onSelectSupplier(null)
      return
    }

    const feature = e.features[0]
    const layerId = feature.layer?.id

    if (layerId === "clusters") {
      // Zoom to expand cluster
      const clusterId = feature.properties?.cluster_id as number
      const source = map.getSource("suppliers") as GeoJSONSource | undefined
      if (source && "getClusterExpansionZoom" in source) {
        try {
          const zoom = await (source as GeoJSONSource).getClusterExpansionZoom(clusterId)
          const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
          map.easeTo({ center: coords, zoom })
        } catch {
          /* ignore */
        }
      }
    } else if (layerId === "unclustered-point") {
      const supplierId = feature.properties?.supplierId as string | undefined
      if (supplierId) onSelectSupplier(supplierId)
    } else {
      onSelectSupplier(null)
    }
  }, [onSelectSupplier])

  // Change cursor when hovering interactive layers
  const handleMouseEnter = useCallback(() => {
    const canvas = mapRef.current?.getMap()?.getCanvas()
    if (canvas) canvas.style.cursor = "pointer"
  }, [])

  const handleMouseLeave = useCallback(() => {
    const canvas = mapRef.current?.getMap()?.getCanvas()
    if (canvas) canvas.style.cursor = ""
  }, [])

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: lng, latitude: lat, zoom: 9 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        onClick={handleMapClick}
        interactiveLayerIds={["clusters", "unclustered-point"]}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <NavigationControl position="top-right" />

        {/* Concentric rings — outer-to-inner so fills stack correctly */}
        {[...ringCircles].reverse().map(({ miles, isOuter, geojson: ringGeo }) => (
          <Source key={miles} id={`ring-${miles}`} type="geojson" data={ringGeo}>
            <Layer
              id={`ring-fill-${miles}`}
              type="fill"
              paint={{ "fill-color": "#4a7c59", "fill-opacity": 0.055 }}
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

        {/* Project site marker */}
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

        {/* Supplier GeoJSON with clustering */}
        {mappable.length > 0 && (
          <Source
            id="suppliers"
            type="geojson"
            data={geojson}
            cluster
            clusterRadius={40}
            clusterMaxZoom={13}
          >
            {/* Cluster circle */}
            <Layer
              id="clusters"
              type="circle"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": "#333331",
                "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 28],
                "circle-stroke-width": 2,
                "circle-stroke-color": "#fff",
              }}
            />
            {/* Cluster count */}
            <Layer
              id="cluster-count"
              type="symbol"
              filter={["has", "point_count"]}
              layout={{
                "text-field": "{point_count_abbreviated}",
                "text-size": 11,
                "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
              }}
              paint={{ "text-color": "#fff" }}
            />
            {/* Unclustered point */}
            <Layer
              id="unclustered-point"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": [
                  "case",
                  ["==", ["get", "supplierId"], selectedId ?? ""],
                  "#ffffff",
                  groupColourExpression,
                ],
                "circle-radius": [
                  "case",
                  ["==", ["get", "supplierId"], selectedId ?? ""],
                  14,
                  10,
                ],
                "circle-stroke-width": [
                  "case",
                  ["==", ["get", "supplierId"], selectedId ?? ""],
                  3,
                  1.5,
                ],
                "circle-stroke-color": [
                  "case",
                  ["==", ["get", "supplierId"], selectedId ?? ""],
                  groupColourExpression,
                  "rgba(255,255,255,0.8)",
                ],
              }}
            />
            {/* Number label on unclustered points */}
            <Layer
              id="unclustered-label"
              type="symbol"
              filter={["!", ["has", "point_count"]]}
              layout={{
                "text-field": ["get", "label"],
                "text-size": 10,
                "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                "text-allow-overlap": true,
              }}
              paint={{
                "text-color": [
                  "case",
                  ["==", ["get", "supplierId"], selectedId ?? ""],
                  groupColourExpression,
                  "#ffffff",
                ],
              }}
            />
          </Source>
        )}

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

      {/* Category colour legend */}
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
