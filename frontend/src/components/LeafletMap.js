"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  Marker,
  Popup,
  Polyline,
  Polygon,
  useMapEvents,
} from "react-leaflet";

// Base icon definitions (size/anchor at the reference zoom). The actual
// rendered size is scaled by the current zoom level so the markers don't
// cover the whole map when zoomed out, nor become oversized when zoomed in.
const ICON_DEFS = {
  home: { url: "/mapMarker/home-icon.png", size: [36, 36], anchor: [18, 18] },
  asv: { url: "/mapMarker/asv-icon.png", size: [50, 60], anchor: [25, 30] },
  operator: { url: "/mapMarker/operator-icon.png", size: [45, 70], anchor: [22, 35] },
};

const REFERENCE_ZOOM = 16; // zoom level at which icons render at their base size
const MIN_ICON_SCALE = 0.45; // floor so markers stay visible when zoomed far out
const MAX_ICON_SCALE = 1.15; // ceiling so markers don't get oversized when zoomed in

/** Map a zoom level to an icon scale factor, gently growing/shrinking with zoom. */
function zoomToScale(zoom) {
  const scale = Math.pow(1.35, zoom - REFERENCE_ZOOM);
  return Math.max(MIN_ICON_SCALE, Math.min(MAX_ICON_SCALE, scale));
}

/** Build a Leaflet icon for the given definition at the given scale. */
function buildScaledIcon(def, scale) {
  return L.icon({
    iconUrl: def.url,
    iconSize: [def.size[0] * scale, def.size[1] * scale],
    iconAnchor: [def.anchor[0] * scale, def.anchor[1] * scale],
  });
}

const customIcon = L.icon({
  iconUrl: "/mapMarker/marker-icon.png",
  shadowUrl: "/mapMarker/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_COORDS = { lat: -6.144353601068162, lng: 106.88533858899994 };
const zoomSize = 16;

function AsvMarker({ parsedAsvPosition, icon }) {
  // Don't render if we don't have a valid, parsed position
  if (!parsedAsvPosition) {
    return null;
  }

  return (
    <Marker position={parsedAsvPosition} icon={icon}>
      <Popup>
        <b>ASV Location</b>
        <br />
        Lat: {parsedAsvPosition[0].toFixed(6)}
        <br />
        Lon: {parsedAsvPosition[1].toFixed(6)}
      </Popup>
    </Marker>
  );
}

function GcsMarker({ gcsPosition, icon }) {
  // gcsPosition is passed from page.js and is [lat, lng] or null
  if (!gcsPosition) {
    return null;
  }

  return (
    <Marker position={gcsPosition} icon={icon}>
      <Popup>
        <b>GCS Location</b>
        <br />
        Lat: {gcsPosition[0].toFixed(6)}
        <br />
        Lon: {gcsPosition[1].toFixed(6)}
      </Popup>
    </Marker>
  );
}

// Helper to center the map such that the target latlng is offset by [offsetX, offsetY] pixels
// Positive offsetX shifts the map center to the right, placing the target to the left.
function getOffsetCenter(map, latlng, offsetX, offsetY = 0) {
  const zoom = map.getZoom();
  const point = map.project(latlng, zoom);
  const targetPoint = point.add([offsetX, offsetY]); 
  return map.unproject(targetPoint, zoom);
}

function GcsLocationProvider({ onLocationUpdate, centerMode }) {
  const map = useMap();

  useEffect(() => {
    if (navigator.onLine && "geolocation" in navigator) {
      const watcher = navigator.geolocation.watchPosition(
        (position) => {
          const pos = [position.coords.latitude, position.coords.longitude];
          
          // 1. Report GCS position up to page.js
          onLocationUpdate(pos);

          // 2. Only center the map if the mode is 'gcs'
          if (centerMode === 'gcs') {
             // Offset 220px to the right so GCS appears 220px to the left (Visual Center)
            const center = getOffsetCenter(map, pos, 220);
            map.setView(center, map.getZoom() || zoomSize);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          onLocationUpdate(null); // Report error
        },
        { enableHighAccuracy: true }
      );

      return () => navigator.geolocation.clearWatch(watcher);
    }
  }, [map, onLocationUpdate, centerMode]); // Add centerMode to dependency array

  return null; // This component doesn't render anything
}

function AsvCenteringController({ centerMode, parsedAsvPosition }) {
  const map = useMap();

  useEffect(() => {
    if (centerMode === 'asv' && parsedAsvPosition) {
       // Offset 220px to the right so ASV appears 220px to the left (Visual Center)
      const center = getOffsetCenter(map, parsedAsvPosition, 220);
      map.setView(center, map.getZoom() || zoomSize);
    }
  }, [map, centerMode, parsedAsvPosition]);

  return null;
}

function MissionPathFocusController({ missionPath }) {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(missionPath) || missionPath.length < 2) return;

    const latLngs = missionPath
      .map((p) => {
        if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])];
        return [Number(p?.lat), Number(p?.lng)];
      })
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    if (latLngs.length < 2) return;

    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 19,
      animate: true,
      duration: 0.7,
    });
  }, [map, missionPath]);

  return null;
}

/** Tracks the map zoom level and reports it up so marker icons can be scaled. */
function ZoomWatcher({ onZoom }) {
  const map = useMap();

  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);

  useMapEvents({
    zoomend() {
      onZoom(map.getZoom());
    },
  });

  return null;
}

function MouseCoordinates() {
  const [position, setPosition] = useState({ lat: null, lng: null });

  useMapEvents({
    mousemove(e) {
      setPosition({
        lat: e.latlng.lat.toFixed(6),
        lng: e.latlng.lng.toFixed(6),
      });
    },
  });

  return (
    <div className="absolute bottom-2 left-2 bg-white text-xs text-gray-700 p-1 rounded shadow z-[1000]">
      {position.lat && position.lng ? (
        <span>
          Lat: {position.lat}, Lng: {position.lng}
        </span>
      ) : (
        <span>Arahkan mouse ke peta</span>
      )}
    </div>
  );
}

/** Map interaction hooks MUST be rendered inside <MapContainer> */
function MapInteractions({
  isBoundarySession,
  isBoundaryAdding,
  onBoundaryAddPoint,
  onBoundaryPause,
  homePickMode = false,
  onHomePick,
}) {
  useMapEvents({
    click(e) {
      if (isBoundarySession && isBoundaryAdding) {
        onBoundaryAddPoint?.(e.latlng);
      } else if (homePickMode) {
        onHomePick?.(e.latlng);
      }
    },
    contextmenu() {
      if (isBoundarySession && isBoundaryAdding) {
        onBoundaryPause?.();
      }
    },
  });
  return null;
}

function hueAt(i, n) {
  const h = Math.floor((i / Math.max(1, n)) * 300); // 0..300° for a plum-ish rainbow
  return `hsl(${h}, 80%, 50%)`;
}

export default function LeafletMap({
  asvPosition,
  gcsPosition,      
  setGcsPosition,
  centerMode,
  pathCoords = [],
  recordedTrack = [],
  // boundaries
  missionPath = [],
  isBoundarySession = false,
  isBoundaryAdding = false,
  boundaryPoints = [],
  shownBoundaryPoints = [],  
  movingDotId = null,
  onBoundaryAddPoint,
  onBoundaryPause, // called on right-click
  onBoundaryRemovePoint,
  onBoundaryBeginMovePoint,
  onBoundaryMovePointTo,
  onBoundaryEndMovePoint,
  homePoint = null,
  homePickMode = false,
  onHomePick = undefined,
}) {
  const [userCoords, setUserCoords] = useState(DEFAULT_COORDS);
  const [parsedAsvPosition, setParsedAsvPosition] = useState(null);
  const [zoom, setZoom] = useState(zoomSize);

  // Rebuild marker icons whenever the zoom level changes so they scale
  // with the map instead of staying a fixed pixel size.
  const scale = zoomToScale(zoom);
  const asvIcon = useMemo(() => buildScaledIcon(ICON_DEFS.asv, scale), [scale]);
  const operatorIcon = useMemo(() => buildScaledIcon(ICON_DEFS.operator, scale), [scale]);
  const homeIcon = useMemo(() => buildScaledIcon(ICON_DEFS.home, scale), [scale]);

  useEffect(() => {
    if (asvPosition && asvPosition.payload) {
      const lat = asvPosition.payload.lat;
      const lon = asvPosition.payload.lon;

      // Ignore (0,0) as it's an invalid "no-fix" location
      if (lat === 0 && lon === 0) {
        setParsedAsvPosition(null);
      } else {
        setParsedAsvPosition([lat, lon]);
        // console.log("Parsed ASV position:", parsedAsvPosition);
      }
    }
  }, [asvPosition]);

  return (
    <div className="h-full w-full">
      <MapContainer
        center={DEFAULT_COORDS}
        zoom={zoomSize}
        maxZoom={22}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={22}
          maxNativeZoom={19.2}
        />

        <GcsLocationProvider
          onLocationUpdate={setGcsPosition}
          centerMode={centerMode}
        />
        <ZoomWatcher onZoom={setZoom} />
        <MouseCoordinates />

        <AsvCenteringController
          centerMode={centerMode}
          parsedAsvPosition={parsedAsvPosition}
        />
        <MissionPathFocusController missionPath={missionPath} />

        <AsvMarker parsedAsvPosition={parsedAsvPosition} icon={asvIcon} />
        <GcsMarker gcsPosition={gcsPosition} icon={operatorIcon} />

        {/* Default position marker */}
        <Marker position={[userCoords.lat, userCoords.lng]} icon={customIcon}>
          <Popup>GCS Location</Popup>
        </Marker>

        {/* Rainbow perimeter track */}
        {Array.isArray(recordedTrack) && recordedTrack.length > 1 && (
          <>
            {recordedTrack.slice(0, -1).map((pt, i) => {
              const next = recordedTrack[i + 1];
              return (
                <Polyline
                  key={`trk-${i}`}
                  positions={[[pt.lat, pt.lng], [next.lat, next.lng]]}
                  pathOptions={{
                    color: hueAt(i, recordedTrack.length - 1),
                    weight: 5,
                    opacity: 0.95,
                  }}
                />
              );
            })}
          </>
        )}

        {/* Map event hooks live INSIDE the MapContainer */}
        <MapInteractions
          isBoundarySession={isBoundarySession}
          isBoundaryAdding={isBoundaryAdding}
          onBoundaryAddPoint={onBoundaryAddPoint}
          onBoundaryPause={onBoundaryPause}
          homePickMode={homePickMode}
          onHomePick={onHomePick}
        />
        {/* HOME marker */}
        {homePoint && (
          <Marker position={[homePoint.lat, homePoint.lng]} icon={homeIcon}>
            <Popup>
              <b>HOME</b>
              <br />
              Lat: {homePoint.lat.toFixed(6)}
              <br />
              Lon: {homePoint.lng.toFixed(6)}
            </Popup>
          </Marker>
        )}

        {/* Perimeter path */}
        {Array.isArray(pathCoords) && pathCoords.length > 1 && (
          <Polyline
            positions={pathCoords}
            pathOptions={{ color: "#6B0F2B", weight: 4, opacity: 0.9 }}
          />
        )}

        {/* Mission/Generated path (new) */}
        {Array.isArray(missionPath) && missionPath.length > 1 && (
          <Polyline
            positions={missionPath}
            pathOptions={{
              color: "#B0486E",
              weight: 3,
              opacity: 0.95,
              dashArray: "6 6",
            }}
          />
        )}

        {/* Boundary polygon */}
        {boundaryPoints.length >= 3 && (
          <Polygon
            positions={[...boundaryPoints] 
              .sort((a, b) => a.seq - b.seq)
              .map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: "#6B0F2B",
              weight: 2,
              fillColor: "#6B0F2B",
              fillOpacity: 0.25,
            }}
          />
        )}

        {/* Boundary polygon (SAVED/SHOWN) */}
        {Array.isArray(shownBoundaryPoints) && shownBoundaryPoints.length >= 3 && (
          <Polygon
            positions={shownBoundaryPoints.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: "#2563eb",        // visually distinct from live edit
              weight: 2,
              fillColor: "#2563eb",
              fillOpacity: 0.15,
            }}
          />
        )}

        {/* Boundary dots */}
        {boundaryPoints
          .sort((a, b) => a.seq - b.seq)
          .map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              draggable={movingDotId === p.id}
              eventHandlers={{
                dragend: (e) => {
                  const ll = e.target.getLatLng();
                  onBoundaryMovePointTo?.(p.id, ll);
                  onBoundaryEndMovePoint?.();
                },
              }}
              icon={L.divIcon({
                className: "",
                html: `<div style="
                  width:10px;height:10px;border-radius:9999px;
                  background:${movingDotId === p.id ? "#6B0F2B" : "white"};
                  border:2px solid #6B0F2B; box-shadow:0 0 8px rgba(107,15,43,0.35);
                "></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6],
              })}
            >
              <Popup>
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">Dot #{p.seq}</div>
                  <div className="flex flex-col gap-1">
                    <button
                      className="px-2 py-1 rounded bg-[#6B0F2B] text-white hover:bg-[#5a0d24]"
                      onClick={() => onBoundaryBeginMovePoint?.(p.id)}
                    >
                      Move
                    </button>
                    <button
                      className="px-2 py-1 rounded bg-[#b91c1c] text-white hover:bg-[#991b1b]"
                      onClick={() => onBoundaryRemovePoint?.(p.id)}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Tip: when “Move” is active, drag the dot then release.
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
