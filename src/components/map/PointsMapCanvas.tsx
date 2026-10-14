"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  href?: string;
  color?: string;
  order?: number;
}

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export default function PointsMapCanvas({
  points,
  route = false,
  bbox,
}: {
  points: MapPoint[];
  route?: boolean;
  bbox?: [number, number, number, number];
}) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(map);
    const group = L.featureGroup().addTo(map);
    for (const p of points) {
      const marker = p.order != null
        ? L.marker([p.lat, p.lng], {
            icon: L.divIcon({
              className: "",
              html: `<span style="display:grid;place-items:center;width:28px;height:28px;border-radius:9999px;background:${p.color ?? "#234f39"};color:white;font-weight:700;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">${p.order}</span>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
            keyboard: true,
            title: p.label,
          })
        : L.circleMarker([p.lat, p.lng], {
            radius: 7,
            color: "white",
            weight: 2,
            fillColor: p.color ?? "#234f39",
            fillOpacity: 0.95,
          });
      const html = p.href ? `<a href="${esc(p.href)}" style="font-weight:600;color:#234f39">${esc(p.label)}</a>` : esc(p.label);
      marker.bindPopup(html).bindTooltip(esc(p.label), { direction: "top" });
      marker.addTo(group);
    }
    if (route && points.length > 1) {
      L.polyline(points.map((p) => [p.lat, p.lng] as [number, number]), {
        color: "#c4693f",
        weight: 3,
        dashArray: "6 6",
      }).addTo(map);
    }
    if (points.length) map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 14 });
    else if (bbox) map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]]);
    else map.setView([13.75, 100.5], 6);
    map.on("focus", () => map.scrollWheelZoom.enable());
    map.on("blur", () => map.scrollWheelZoom.disable());
    return () => {
      map.remove();
    };
  }, [points, route, bbox]);
  return <div ref={el} className="h-full w-full" />;
}
