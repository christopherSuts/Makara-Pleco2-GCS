"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
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

function SetMapToUserLocation({ setCoords }) {
  const map = useMap();

  useEffect(() => {
    if (navigator.onLine && "geolocation" in navigator) {
      const watcher = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          map.setView([lat, lng], zoomSize);
          setCoords({ lat, lng });
        },
        () => {
          map.setView([DEFAULT_COORDS.lat, DEFAULT_COORDS.lng], zoomSize);
          setCoords(DEFAULT_COORDS);
        }
      );
      return () => navigator.geolocation.clearWatch(watcher);
    } else {
      map.setView([DEFAULT_COORDS.lat, DEFAULT_COORDS.lng], zoomSize);
      setCoords(DEFAULT_COORDS);
    }
  }, [map, setCoords]);

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
}) {
  useMapEvents({
    click(e) {
      if (isBoundarySession && isBoundaryAdding) {
        onBoundaryAddPoint?.(e.latlng);
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
  pathCoords = [],
  recordedTrack = [],
  // boundaries
  missionPath = [],
  isBoundarySession = false,
  isBoundaryAdding = false,
  boundaryPoints = [],
  movingDotId = null,
  onBoundaryAddPoint,
  onBoundaryPause, // called on right-click
  onBoundaryRemovePoint,
  onBoundaryBeginMovePoint,
  onBoundaryMovePointTo,
  onBoundaryEndMovePoint,
}) {
  const [userCoords, setUserCoords] = useState(DEFAULT_COORDS);

  return (
    <div className="h-full w-full">
      <MapContainer
        center={[DEFAULT_COORDS.lat, DEFAULT_COORDS.lng]} // safe initial center
        zoom={zoomSize}
        className="h-full w-full z-0"
      >

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
        />

        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <SetMapToUserLocation setCoords={setUserCoords} />
        <MouseCoordinates />

        {/* GCS marker */}
        <Marker position={[userCoords.lat, userCoords.lng]} icon={customIcon}>
          <Popup>GCS Location</Popup>
        </Marker>

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
            positions={boundaryPoints
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
