"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import { useState, useRef, useCallback } from "react"
import Map, { Layer, Source, Marker } from "react-map-gl/maplibre"
import type { MapRef } from "react-map-gl/maplibre"
import turfCircle from "@turf/circle"
import { CATEGORY_MAP, getGroupColour } from "@/lib/category-definitions"
import type { CategoryCode } from "@/lib/category-definitions"
import type { SearchResultRow } from "@/components/project/ProjectSearchPage"

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"

interface PrintProject {
  id: string
  name: string
  postcode: string
  lat: number
  lng: number
  radius: number
}

interface PrintSession {
  id: string
  createdAt: string
  categories: string[]
  radius: number
  results: SearchResultRow[]
}

interface PrintReportPageProps {
  project: PrintProject
  session: PrintSession
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

function distanceLabel(miles: number) {
  if (miles >= 99999) return "—"
  return `${miles.toFixed(1)} mi`
}

function categoryLabels(codes: string[]) {
  return codes
    .map((c) => CATEGORY_MAP[c as CategoryCode]?.label ?? c)
    .join(", ")
}

export function PrintReportPage({ project, session }: PrintReportPageProps) {
  const mapRef = useRef<MapRef>(null)
  const [mapImage, setMapImage] = useState<string | null>(null)

  const radiusCircle = turfCircle(
    [project.lng, project.lat],
    session.radius * 1.60934,
    { steps: 64, units: "kilometers" }
  )

  const national = session.results.filter((r) => r.supplier.isNationalKnown)
  const nonNational = session.results.filter((r) => !r.supplier.isNationalKnown)
  const within = nonNational.filter((r) => r.isWithinRadius)
  const beyond = nonNational.filter((r) => !r.isWithinRadius)

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const bbox = turfCircle(
      [project.lng, project.lat],
      session.radius * 1.60934,
      { steps: 4, units: "kilometers" }
    )
    const coords = (bbox.geometry.coordinates[0] as [number, number][])
    const lngs = coords.map((c) => c[0])
    const lats = coords.map((c) => c[1])

    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 40, duration: 0 }
    )

    map.once("idle", () => {
      const dataUrl = map.getCanvas().toDataURL("image/png")
      setMapImage(dataUrl)
      setTimeout(() => window.print(), 200)
    })
  }, [project.lat, project.lng, session.radius])

  return (
    <>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 15mm; }
        }
        body { font-family: sans-serif; background: white; margin: 0; padding: 0; }
      `}</style>

      {/* Hidden map used only to capture snapshot */}
      {!mapImage && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 700,
            height: 350,
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <Map
            ref={mapRef}
            initialViewState={{
              longitude: project.lng,
              latitude: project.lat,
              zoom: 9,
            }}
            style={{ width: "100%", height: "100%" }}
            mapStyle={MAP_STYLE}
            preserveDrawingBuffer
            onLoad={handleMapLoad}
          >
            <Source id="radius-fill" type="geojson" data={radiusCircle}>
              <Layer
                id="radius-fill-layer"
                type="fill"
                paint={{ "fill-color": "#4a7c59", "fill-opacity": 0.14 }}
              />
              <Layer
                id="radius-outline-layer"
                type="line"
                paint={{ "line-color": "#4a7c59", "line-width": 2 }}
              />
            </Source>

            <Marker longitude={project.lng} latitude={project.lat} anchor="bottom">
              <div
                style={{
                  backgroundColor: "#1c1c1a",
                  color: "white",
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: 3,
                  whiteSpace: "nowrap",
                }}
              >
                Project site
              </div>
            </Marker>

            {session.results
              .filter((r) => r.supplier.lat !== null && r.supplier.lng !== null)
              .map((result, index) => {
                const primaryCategory = (result.supplier.categories[0] as CategoryCode) || null
                const colour = primaryCategory
                  ? getGroupColour(CATEGORY_MAP[primaryCategory]?.group ?? "suppliers")
                  : "#888"
                return (
                  <Marker
                    key={result.supplier.id}
                    longitude={result.supplier.lng!}
                    latitude={result.supplier.lat!}
                    anchor="center"
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        backgroundColor: colour,
                        border: "1.5px solid rgba(255,255,255,0.8)",
                        color: "white",
                        fontSize: 9,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {index + 1}
                    </div>
                  </Marker>
                )
              })}
          </Map>
        </div>
      )}

      {/* Loading indicator */}
      {!mapImage && (
        <div
          className="no-print"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            color: "#888",
            fontSize: 14,
          }}
        >
          Preparing report…
        </div>
      )}

      {/* Print layout — shown once map is captured */}
      {mapImage && (
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "24px 32px", color: "#1c1c1a" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              borderBottom: "2px solid #1c1c1a",
              paddingBottom: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  backgroundColor: "#333331",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                25
              </div>
              <span style={{ fontWeight: 600, fontSize: 15, color: "#333331" }}>Miles</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{project.name}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                {project.postcode} &middot; {session.radius} mi radius &middot; {formatDate(session.createdAt)}
              </div>
            </div>
          </div>

          {/* Map image */}
          <div style={{ marginBottom: 20, borderRadius: 6, overflow: "hidden", border: "1px solid #e5e5e5" }}>
            <img
              src={mapImage}
              alt="Project map"
              style={{ width: "100%", display: "block", maxHeight: 260, objectFit: "cover" }}
            />
          </div>

          {/* Results table */}
          <ResultsSection title={`Within ${session.radius} mi (${within.length})`} results={within} startIndex={1} />
          {beyond.length > 0 && (
            <ResultsSection title="Beyond radius" results={beyond} startIndex={within.length + 1} />
          )}
          {national.length > 0 && (
            <ResultsSection title="National suppliers" results={national} startIndex={within.length + beyond.length + 1} />
          )}
        </div>
      )}
    </>
  )
}

function ResultsSection({
  title,
  results,
  startIndex,
}: {
  title: string
  results: SearchResultRow[]
  startIndex: number
}) {
  if (results.length === 0) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#555",
          marginBottom: 6,
          paddingBottom: 4,
          borderBottom: "1px solid #ddd",
        }}
      >
        {title}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ color: "#888" }}>
            <th style={thStyle}>#</th>
            <th style={{ ...thStyle, textAlign: "left" }}>Name</th>
            <th style={thStyle}>Distance</th>
            <th style={{ ...thStyle, textAlign: "left" }}>Categories</th>
            <th style={{ ...thStyle, textAlign: "left" }}>Phone</th>
            <th style={{ ...thStyle, textAlign: "left" }}>Website</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr
              key={r.id}
              style={{ backgroundColor: i % 2 === 0 ? "#fafaf9" : "white" }}
            >
              <td style={{ ...tdStyle, color: "#999", textAlign: "center" }}>{startIndex + i}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{r.supplier.name}</td>
              <td style={{ ...tdStyle, textAlign: "center", color: "#666" }}>
                {distanceLabel(r.distanceMiles)}
              </td>
              <td style={{ ...tdStyle, color: "#666" }}>{categoryLabels(r.supplier.categories)}</td>
              <td style={{ ...tdStyle, color: "#666" }}>{r.supplier.phone ?? "—"}</td>
              <td style={{ ...tdStyle, color: "#4a7c59", wordBreak: "break-all" }}>
                {r.supplier.website ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  padding: "4px 6px",
  borderBottom: "1px solid #ddd",
}

const tdStyle: React.CSSProperties = {
  padding: "5px 6px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
}
