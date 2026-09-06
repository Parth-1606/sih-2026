"use client";
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Circle,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import { pfzData, userLocation } from "@/lib/mock";
import { CURATED_MPAS } from "@/lib/marine-zones";

export type LayerId = "pfz" | "sst" | "chlorophyll" | "weather" | "waves" | "geofences" | "alerts" | "ports" | "restricted";
export type StyleMode = "ocean" | "streets" | "voyager" | "dark" | "satellite" | "google";

const TILES: Record<StyleMode, { url: string; attribution: string }> = {
  ocean: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, GEBCO, NOAA, NGDC & contributors",
  },
  streets: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  voyager: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, Maxar, Earthstar Geographics",
  },
  google: {
    url: "",
    attribution: "",
  },
};

// Free Esri label/reference overlays — these draw city & water names on top
const LABEL_OVERLAYS: Partial<Record<StyleMode, { url: string; attribution: string }>> = {
  ocean: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri",
  },
};

const ALERT_PINS = [
  { id: "ALT-001", lat: 18.75, lng: 72.45, title: "Strong wind advisory", sub: "Western offshore • until 18:00" },
  { id: "ALT-004", lat: 18.95, lng: 72.55, title: "Lightning cells", sub: "Northwest offshore • until 11:00" },
];

const GEOFENCES: L.LatLngExpression[][] = [
  [
    [18.95, 72.55],
    [19.0, 72.68],
    [18.93, 72.75],
    [18.88, 72.62],
  ],
  [
    [18.6, 72.6],
    [18.7, 72.72],
    [18.63, 72.82],
    [18.53, 72.7],
  ],
];

function pfzPolygon(lat: number, lng: number): L.LatLngExpression[] {
  const dLat = 0.045;
  const dLng = 0.075;
  return [
    [lat - dLat, lng - dLng],
    [lat + dLat * 0.6, lng - dLng * 0.8],
    [lat + dLat, lng + dLng],
    [lat - dLat * 0.6, lng + dLng * 0.8],
  ];
}

export type MapCenter = { lat: number; lng: number };

export interface DrawnRoute {
  coords: [number, number][];
  color: string;
  dash?: boolean;
}

export interface FitBox {
  s: number;
  w: number;
  n: number;
  e: number;
  nonce: number;
}

function MapEvents({ onMove }: { onMove: (zoom: number, center: MapCenter) => void }) {
  const map = useMap();
  useEffect(() => {
    const update = () => {
      const c = map.getCenter();
      onMove(map.getZoom(), { lat: c.lat, lng: c.lng });
    };
    map.on("zoomend moveend", update);
    update();
    return () => {
      map.off("zoomend moveend", update);
    };
  }, [map, onMove]);
  return null;
}

function MapReady({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}
function FitBounds({ box }: { box: FitBox | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (!box) return;
    map.fitBounds([[box.s, box.w], [box.n, box.e]], { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box?.nonce]);
  return null;
}

/** Animated vessel dot along a route. Skipped when reduced-motion is set. */
function RouteAnimator({ job }: { job: { coords: [number, number][]; nonce: number } | null | undefined }) {
  const [pos, setPos] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (!job || job.coords.length < 2) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    const step = Math.max(1, Math.floor(job.coords.length / 120));
    const id = window.setInterval(() => {
      setPos(job.coords[Math.min(i, job.coords.length - 1)]);
      i += step;
      if (i >= job.coords.length) window.clearInterval(id);
    }, 60);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.nonce]);
  if (!pos) return null;
  return <Circle center={pos} radius={900} pathOptions={{ color: "#fff", weight: 2, fillColor: "#4BA3FF", fillOpacity: 1 }} />;
}

export default function LeafletBase({
  styleMode,
  layers,
  interactive,
  onMove,
  onReady,
  onInspect,
  ports,
  route,
  routeAlt,
  fit,
  animateRoute,
  overlayOpacity = 1,
}: {
  styleMode: StyleMode;
  layers: Record<LayerId, boolean>;
  interactive: boolean;
  onMove: (zoom: number, center: MapCenter) => void;
  onReady: (map: L.Map) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onInspect: (data: any) => void;
  ports: { name: string; lat: number; lng: number }[];
  route?: DrawnRoute | null;
  routeAlt?: DrawnRoute | null;
  fit?: FitBox | null;
  animateRoute?: { coords: [number, number][]; nonce: number } | null;
  overlayOpacity?: number;
}) {
  const icons = useMemo(() => {
    const user = L.divIcon({
      className: "",
      html: `<div style="position:relative;width:28px;height:28px">
        <div style="position:absolute;inset:0;background:rgba(75,163,255,0.25);border-radius:9999px;filter:blur(6px)"></div>
        <div style="position:absolute;left:7px;top:7px;width:14px;height:14px;background:#4BA3FF;border:2px solid #fff;border-radius:9999px;box-shadow:0 0 10px rgba(75,163,255,0.9)"></div>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const alert = L.divIcon({
      className: "",
      html: `<div style="width:14px;height:14px;background:#F4B942;border:2px solid rgba(255,255,255,0.5);border-radius:9999px;box-shadow:0 0 12px rgba(244,185,66,0.9)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    const pfzDot = L.divIcon({
      className: "",
      html: `<div style="width:8px;height:8px;background:#F2C94C;border-radius:9999px;box-shadow:0 0 8px rgba(242,201,76,0.9)"></div>`,
      iconSize: [8, 8],
      iconAnchor: [4, 4],
    });
    const port = L.divIcon({
      className: "",
      html: `<div style="width:20px;height:20px;background:rgba(7,16,20,0.85);border:1px solid rgba(255,255,255,0.4);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px">⚓</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    return { user, alert, pfzDot, port };
  }, []);

  return (
    <MapContainer
      center={[18.85, 72.7]}
      zoom={9}
      scrollWheelZoom={interactive}
      dragging={interactive}
      zoomControl={false}
      className="absolute inset-0 z-0"
      style={{ height: "100%", width: "100%", background: "#0A2733" }}
    >
      <TileLayer url={TILES[styleMode].url} attribution={TILES[styleMode].attribution} />
      {LABEL_OVERLAYS[styleMode] && (
        <TileLayer url={LABEL_OVERLAYS[styleMode]!.url} attribution={LABEL_OVERLAYS[styleMode]!.attribution} />
      )}
      <MapEvents onMove={onMove} />
      <MapReady onReady={onReady} />
      <FitBounds box={fit} />
      <RouteAnimator job={animateRoute} />

      {routeAlt && routeAlt.coords.length > 1 && (
        <Polyline
          positions={routeAlt.coords}
          pathOptions={{ color: routeAlt.color, weight: 3, opacity: 0.85, dashArray: "8 7" }}
        />
      )}
      {route && route.coords.length > 1 && (
        <>
          <Polyline
            positions={route.coords}
            pathOptions={{ color: route.color, weight: 4.5, opacity: 0.95 }}
          />
          <Circle center={route.coords[0]} radius={600} pathOptions={{ color: route.color, weight: 0, fillColor: "#35C98A", fillOpacity: 1 }} />
          <Circle center={route.coords[route.coords.length - 1]} radius={600} pathOptions={{ color: route.color, weight: 0, fillColor: "#F4B942", fillOpacity: 1 }} />
        </>
      )}

      {layers.sst && (
        <>
          <Circle center={[18.78, 72.58]} radius={14000} pathOptions={{ color: "#2E9CFF", weight: 0, fillColor: "#2E9CFF", fillOpacity: 0.28 * overlayOpacity }} />
          <Circle center={[18.95, 72.5]} radius={10000} pathOptions={{ color: "#2E9CFF", weight: 0, fillColor: "#2E9CFF", fillOpacity: 0.18 * overlayOpacity }} />
        </>
      )}
      {layers.chlorophyll && (
        <Circle center={[18.8, 72.6]} radius={9000} pathOptions={{ color: "#35C98A", weight: 0, fillColor: "#35C98A", fillOpacity: 0.25 * overlayOpacity }} />
      )}
      {layers.waves && (
        <>
          <Polyline positions={[[19.0, 72.3], [18.9, 72.5], [18.8, 72.7], [18.7, 72.9]]} pathOptions={{ color: "#4BA3FF", weight: 1.5, opacity: 0.7 }} />
          <Polyline positions={[[18.95, 72.3], [18.85, 72.5], [18.75, 72.7], [18.65, 72.9]]} pathOptions={{ color: "#4BA3FF", weight: 1.2, opacity: 0.45 }} />
        </>
      )}
      {layers.geofences &&
        GEOFENCES.map((positions, i) => (
          <Polygon key={i} positions={positions} pathOptions={{ color: "#ffffff", weight: 1.5, opacity: 0.55, dashArray: "6 4", fill: false }} />
        ))}

      {layers.pfz &&
        pfzData
          .filter(p => p.lat != null && p.lng != null)
          .map(p => (
            <Polygon
              key={p.id}
              positions={pfzPolygon(p.lat!, p.lng!)}
              pathOptions={{ color: "#F2C94C", weight: 1.8, fillColor: "#F2C94C", fillOpacity: 0.22 * overlayOpacity }}
              eventHandlers={{
                click: () =>
                  onInspect({ kind: "pfz", id: p.id, title: p.id, sub: `${p.distance_km} km ${p.direction} • ${p.productivity} productivity`, lat: `${p.lat!.toFixed(2)}°N`, lng: `${p.lng!.toFixed(2)}°E`, sst: `${p.sst}°C`, chl: `${p.chlorophyll}`, conf: p.confidence, srcName: "Demo PFZ (INCOIS advisory shape)", srcUrl: "https://incois.gov.in/MarineFisheries/PfzAdvisory", mode: "demo" }),
              }}
            />
          ))}

      {layers.pfz &&
        pfzData
          .filter(p => p.lat != null && p.lng != null)
          .map(p => (
            <Marker
              key={`dot-${p.id}`}
              position={[p.lat!, p.lng!]}
              icon={icons.pfzDot}
              eventHandlers={{
                click: () =>
                  onInspect({ kind: "pfz", id: p.id, title: p.id, sub: `${p.distance_km} km ${p.direction} • ${p.productivity} productivity`, lat: `${p.lat!.toFixed(2)}°N`, lng: `${p.lng!.toFixed(2)}°E`, sst: `${p.sst}°C`, chl: `${p.chlorophyll}`, conf: p.confidence, srcName: "Demo PFZ (INCOIS advisory shape)", srcUrl: "https://incois.gov.in/MarineFisheries/PfzAdvisory", mode: "demo" }),
              }}
            >
              <Tooltip permanent direction="bottom" offset={[0, 10]}>
                <span style={{ background: p.id === "PFZ-001" ? "#F2C94C" : "#fff", color: "#071014", padding: "2px 8px", borderRadius: 9999, fontWeight: 700, fontSize: 11 }}>
                  {p.id} • {p.confidence}%
                </span>
              </Tooltip>
            </Marker>
          ))}

      {layers.alerts &&
        ALERT_PINS.map(a => (
          <Marker
            key={a.id}
            position={[a.lat, a.lng]}
            icon={icons.alert}
            eventHandlers={{ click: () => onInspect({ kind: "alert", title: a.title, sub: a.sub, alert: true, srcName: "Demo IMD advisory (SACHET shape pending)", srcUrl: "https://sachet.ndma.gov.in", mode: "demo" }) }}
          />
        ))}

      <Marker position={[userLocation.latitude, userLocation.longitude]} icon={icons.user}>
        <Tooltip permanent direction="bottom" offset={[0, 12]}>
          <span style={{ background: "rgba(7,16,20,0.85)", color: "#fff", padding: "2px 8px", borderRadius: 9999, fontSize: 11 }}>
            You • {userLocation.latitude.toFixed(2)}°N {userLocation.longitude.toFixed(2)}°E
          </span>
        </Tooltip>
      </Marker>

      {layers.ports &&
        ports.map(p => (
          <Marker
            key={`${p.name}-${p.lat}`}
            position={[p.lat, p.lng]}
            icon={icons.port}
            eventHandlers={{ click: () => onInspect({ kind: "port", title: p.name, sub: `${p.lat.toFixed(2)}°N ${p.lng.toFixed(2)}°E`, srcName: "OpenStreetMap seamarks (live) / curated fallback", srcUrl: "https://www.openstreetmap.org", mode: "live" }) }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <span style={{ fontSize: 11 }}>⚓ {p.name}</span>
            </Tooltip>
          </Marker>
        ))}

      {layers.restricted &&
        CURATED_MPAS.map(z => (
          <Polygon
            key={z.name}
            positions={z.polygon}
            pathOptions={{ color: "#FF6B6B", weight: 1.6, dashArray: "5 3", fillColor: "#FF6B6B", fillOpacity: 0.12 * overlayOpacity }}
            eventHandlers={{ click: () => onInspect({ kind: "restricted", title: z.name, sub: z.note, srcName: "Curated MPA boxes (WDPA shape pending)", srcUrl: "https://www.protectedplanet.net", mode: "demo" }) }}
          >
            <Tooltip direction="top" sticky>
              <span style={{ fontSize: 11 }}>⛔ {z.name}</span>
            </Tooltip>
          </Polygon>
        ))}
    </MapContainer>
  );
}
