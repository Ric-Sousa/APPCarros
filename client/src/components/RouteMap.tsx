import { useEffect, useRef, useState } from "react";
import { loadLeaflet } from "@/lib/leaflet";

interface Stop { lat?: number; lon?: number; name?: string; distance?: number }
interface Props {
  origin: [number, number];
  dest: [number, number];
  geometry?: { coordinates?: [number, number][] } | null;
  stops?: { type: string; suggested: Stop[] }[];
}

/** Mapa (Leaflet, carregado só aqui) com a rota, origem/destino e paragens sugeridas. */
const NO_STOPS: NonNullable<Props["stops"]> = [];

export default function RouteMap({ origin, dest, geometry, stops = NO_STOPS }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if ([...origin, ...dest].some((n) => !Number.isFinite(n))) return;
    let map: any;
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !container.current) return;
        // Um mapa por resultado; removido na limpeza (evita "Map container is already initialized")
        map = L.map(container.current);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; contribuidores do OpenStreetMap" }).addTo(map);
        const bounds = L.latLngBounds([origin, dest]);
        L.marker(origin).addTo(map).bindTooltip("Origem");
        L.marker(dest).addTo(map).bindTooltip("Destino");
        if (geometry?.coordinates?.length) {
          const line = L.polyline(geometry.coordinates.map(([lng, lat]) => [lat, lng]), { color: "#2563eb", weight: 4 }).addTo(map);
          bounds.extend(line.getBounds());
        }
        for (const group of stops) {
          for (const s of group.suggested ?? []) {
            if (typeof s.lat !== "number" || typeof s.lon !== "number") continue;
            L.circleMarker([s.lat, s.lon], { radius: 5, color: group.type === "charging" ? "green" : "orange" })
              .bindTooltip(`${s.name ?? ""}${s.distance ? ` • ${s.distance} km` : ""}`)
              .addTo(map);
            bounds.extend([s.lat, s.lon]);
          }
        }
        map.fitBounds(bounds.pad(0.15));
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [origin, dest, geometry, stops]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  return <div ref={container} className="w-full h-72 rounded border border-border" role="img" aria-label="Mapa da rota" />;
}
