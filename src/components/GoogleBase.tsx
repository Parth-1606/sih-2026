"use client";
import { useCallback, useEffect, useState } from "react";
import { GoogleMap, Marker, Polygon, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { pfzData, userLocation } from "@/lib/mock";
import { CURATED_MPAS } from "@/lib/marine-zones";
import type { DrawnRoute, FitBox, LayerId, MapCenter } from "./LeafletBase";

const containerStyle = { width: "100%", height: "100%" };
const CENTER: MapCenter = { lat: 18.55, lng: 74.0 };

const ALERT_PINS = [
  { id: "ALT-001", lat: 18.62, lng: 74.28, title: "Strong wind advisory", sub: "Eastern offshore • until 18:00" },
  { id: "ALT-004", lat: 18.38, lng: 73.66, title: "Lightning cells", sub: "Western offshore • until 11:00" },
];

const GEOFENCES: { lat: number; lng: number }[][] = [
  [
    { lat: 18.66, lng: 73.78 },
    { lat: 18.74, lng: 73.92 },
    { lat: 18.68, lng: 74.0 },
    { lat: 18.6, lng: 73.86 },
  ],
  [
    { lat: 18.3, lng: 74.1 },
    { lat: 18.42, lng: 74.3 },
    { lat: 18.32, lng: 74.42 },
    { lat: 18.22, lng: 74.22 },
  ],
];

function makeDot(fill: string, stroke = "#fff", scale = 7) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: stroke,
    strokeWeight: 2,
    scale,
  };
}

function pfzPolygon(lat: number, lng: number): { lat: number; lng: number }[] {
  const dLat = 0.045;
  const dLng = 0.075;
  return [
    { lat: lat - dLat, lng: lng - dLng },
    { lat: lat + dLat * 0.6, lng: lng - dLng * 0.8 },
    { lat: lat + dLat, lng: lng + dLng },
    { lat: lat - dLat * 0.6, lng: lng + dLng * 0.8 },
  ];
}

export default function GoogleBase({
  apiKey,
  layers,
  interactive,
  onMove,
  onReady,
  onInspect,
  ports,
  route,
  routeAlt,
  fit,
}: {
  apiKey: string;
  layers: Record<LayerId, boolean>;
  interactive: boolean;
  onMove: (zoom: number, center: MapCenter) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onReady: (map: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onInspect: (data: any) => void;
  ports: { name: string; lat: number; lng: number }[];
  route?: DrawnRoute | null;
  routeAlt?: DrawnRoute | null;
  fit?: FitBox | null;
}) {
  const { isLoaded, loadError } = useJsApiLoader({ id: "marine-google-map", googleMapsApiKey: apiKey });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [map, setMap] = useState<any>(null);

  const onLoad = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => {
      setMap(m);
      onReady(m);
    },
    [onReady]
  );

  // Built per-render once the Google script is loaded (cheap object, no hook needed).
  const icons =
    isLoaded && typeof google !== "undefined"
      ? {
          user: makeDot("#4BA3FF"),
          alert: makeDot("#F4B942", "rgba(255,255,255,0.6)", 6),
          pfz: makeDot("#F2C94C", "#F2C94C", 4),
        }
      : null;

  // External fit-to-bounds (route planner).
  useEffect(() => {
    if (!map || !fit || typeof google === "undefined") return;
    map.fitBounds(
      new google.maps.LatLngBounds({ lat: fit.s, lng: fit.w }, { lat: fit.n, lng: fit.e }),
      24
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit?.nonce]);

  if (loadError) {
    return (
      <div className="absolute inset-0 z-0 flex items-center justify-center text-sm text-white/70 bg-[#0A2733] p-6 text-center">
        Google Maps failed to load — check your API key &amp; that Maps JavaScript API is enabled.
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className="absolute inset-0 z-0 flex items-center justify-center text-sm text-white/60 bg-[#0A2733]">
        Loading Google Maps…
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerClassName="absolute inset-0 z-0"
      mapContainerStyle={containerStyle}
      center={CENTER}
      zoom={9}
      onLoad={onLoad}
      options={{
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: false,
        draggable: interactive,
        scrollwheel: interactive,
        styles: [
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0A2733" }] },
          { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7fb8d9" }] },
        ],
      }}
      onZoomChanged={() => {
        if (!map) return;
        const c = map.getCenter()?.toJSON();
        if (c) onMove(map.getZoom(), { lat: c.lat, lng: c.lng });
      }}
      onDragEnd={() => {
        if (!map) return;
        const c = map.getCenter()?.toJSON();
        if (c) onMove(map.getZoom(), { lat: c.lat, lng: c.lng });
      }}
    >
      {layers.geofences &&
        GEOFENCES.map((paths, i) => (
          <Polygon
            key={i}
            paths={paths}
            options={{ strokeColor: "#ffffff", strokeOpacity: 0.7, strokeWeight: 1.5, fillOpacity: 0, clickable: false }}
          />
        ))}

      {layers.pfz &&
        pfzData
          .filter(p => p.lat != null && p.lng != null)
          .map(p => (
            <Polygon
              key={p.id}
              paths={pfzPolygon(p.lat!, p.lng!)}
              options={{ strokeColor: "#F2C94C", strokeWeight: 2, fillColor: "#F2C94C", fillOpacity: 0.25 }}
              onClick={() =>
                onInspect({ kind: "pfz", id: p.id, title: p.id, sub: `${p.distance_km} km ${p.direction} • ${p.productivity} productivity`, lat: `${p.lat!.toFixed(2)}°N`, lng: `${p.lng!.toFixed(2)}°E`, sst: `${p.sst}°C`, chl: `${p.chlorophyll}`, conf: p.confidence })
              }
            />
          ))}

      {layers.pfz &&
        icons &&
        pfzData
          .filter(p => p.lat != null && p.lng != null)
          .map(p => (
            <Marker
              key={`dot-${p.id}`}
              position={{ lat: p.lat!, lng: p.lng! }}
              icon={icons.pfz}
              label={{ text: `${p.id} • ${p.confidence}%`, color: "#071014", fontWeight: "700", fontSize: "11px" }}
              onClick={() =>
                onInspect({ kind: "pfz", id: p.id, title: p.id, sub: `${p.distance_km} km ${p.direction} • ${p.productivity} productivity`, lat: `${p.lat!.toFixed(2)}°N`, lng: `${p.lng!.toFixed(2)}°E`, sst: `${p.sst}°C`, chl: `${p.chlorophyll}`, conf: p.confidence })
              }
            />
          ))}

      {layers.alerts &&
        icons &&
        ALERT_PINS.map(a => (
          <Marker
            key={a.id}
            position={{ lat: a.lat, lng: a.lng }}
            icon={icons.alert}
            title={a.title}
            onClick={() => onInspect({ kind: "alert", title: a.title, sub: a.sub, alert: true })}
          />
        ))}

      {icons && (
        <Marker
          position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
          icon={icons.user}
          label={{ text: `You • ${userLocation.latitude.toFixed(2)}°N ${userLocation.longitude.toFixed(2)}°E`, color: "#fff", fontSize: "11px" }}
        />
      )}

      {layers.restricted &&
        CURATED_MPAS.map(z => (
          <Polygon
            key={z.name}
            paths={z.polygon.map(([lat, lng]) => ({ lat, lng }))}
            options={{ strokeColor: "#FF6B6B", strokeWeight: 2, fillColor: "#FF6B6B", fillOpacity: 0.15 }}
            onClick={() => onInspect({ kind: "restricted", title: z.name, sub: z.note })}
          />
        ))}

      {layers.ports &&
        ports.map(p => (
          <Marker key={`${p.name}-${p.lat}`} position={{ lat: p.lat, lng: p.lng }} title={`⚓ ${p.name}`} />
        ))}

      {routeAlt && routeAlt.coords.length > 1 && (
        <Polyline
          path={routeAlt.coords.map(([lat, lng]) => ({ lat, lng }))}
          options={{ strokeColor: routeAlt.color, strokeWeight: 3, strokeOpacity: 0.85 }}
        />
      )}
      {route && route.coords.length > 1 && (
        <Polyline
          path={route.coords.map(([lat, lng]) => ({ lat, lng }))}
          options={{ strokeColor: route.color, strokeWeight: 5, strokeOpacity: 0.95 }}
        />
      )}
    </GoogleMap>
  );
}
