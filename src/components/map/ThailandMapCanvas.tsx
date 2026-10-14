"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { MapStatus } from "@/lib/passport";
import type { RegionId } from "@/lib/types";
import { STATUS_COLORS, type MapHandle, type MapProvince } from "./constants";

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

interface Props {
  geojson: GeoJSON.FeatureCollection;
  provinces: Map<string, MapProvince>;
  statuses: Record<string, MapStatus>;
  regionFilter: RegionId | null;
  highlight: string | null;
  onSelect: (slug: string) => void;
  handleRef: React.MutableRefObject<MapHandle | null>;
  boundaryAttribution: string;
}

const THAILAND_BOUNDS = L.latLngBounds([5.6, 97.3], [20.5, 105.7]);

export default function ThailandMapCanvas({
  geojson,
  provinces,
  statuses,
  regionFilter,
  highlight,
  onSelect,
  handleRef,
  boundaryAttribution,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const propsRef = useRef({ provinces, statuses, regionFilter, highlight, onSelect });
  propsRef.current = { provinces, statuses, regionFilter, highlight, onSelect };

  const styleFor = (slug: string): L.PathOptions => {
    const { statuses, regionFilter, highlight, provinces } = propsRef.current;
    const status = statuses[slug] ?? "none";
    const c = STATUS_COLORS[status];
    const dimmed = regionFilter && provinces.get(slug)?.region !== regionFilter;
    const hl = highlight === slug;
    return {
      color: hl ? "#c4693f" : "#234f39",
      weight: hl ? 3 : 0.8,
      fillColor: c.fill,
      fillOpacity: dimmed ? 0.12 : c.opacity,
      opacity: dimmed ? 0.35 : 0.9,
    };
  };

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 5,
      maxZoom: 12,
      maxBounds: THAILAND_BOUNDS.pad(0.4),
      scrollWheelZoom: false,
      zoomSnap: 0.25,
    });
    map.fitBounds(THAILAND_BOUNDS);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(map);
    map.on("focus", () => map.scrollWheelZoom.enable());
    map.on("blur", () => map.scrollWheelZoom.disable());

    const layer = L.geoJSON(geojson, {
      style: (f) => styleFor(f?.properties?.slug),
      onEachFeature: (feature, lyr) => {
        const slug = feature.properties?.slug as string;
        const info = propsRef.current.provinces.get(slug);
        if (info) {
          lyr.bindTooltip(
            `<strong>${escapeHtml(info.label)}</strong><br/><span style="opacity:.75">${escapeHtml(info.sublabel)}</span>`,
            { sticky: true, className: "province-tip", direction: "top" },
          );
        }
        lyr.on({
          mouseover: (e) => {
            const path = e.target as L.Path;
            path.setStyle({ weight: 2.5, color: "#c4693f" });
            path.bringToFront();
          },
          mouseout: (e) => (e.target as L.Path).setStyle(styleFor(slug)),
          click: () => propsRef.current.onSelect(slug),
          keypress: (e) => (e.originalEvent as KeyboardEvent).key === "Enter" && propsRef.current.onSelect(slug),
        });
      },
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = layer;
    // Keep re-fitting Thailand while the layout settles, until the user moves the map.
    let userMoved = false;
    const container = el.current;
    const markMoved = () => (userMoved = true);
    container.addEventListener("pointerdown", markMoved);
    container.addEventListener("wheel", markMoved, { passive: true });
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      map.invalidateSize();
      if (!userMoved) map.fitBounds(THAILAND_BOUNDS, { animate: false });
    };
    handleRef.current = {
      zoomIn: () => (markMoved(), map.zoomIn()),
      zoomOut: () => (markMoved(), map.zoomOut()),
      reset: () => {
        userMoved = false;
        fit();
      },
      focus: (slug) => {
        markMoved();
        layer.eachLayer((l) => {
          const f = (l as L.GeoJSON & { feature?: GeoJSON.Feature }).feature;
          if (f?.properties?.slug === slug) map.fitBounds((l as L.Polygon).getBounds(), { maxZoom: 8, padding: [30, 30] });
        });
      },
    };
    const raf = requestAnimationFrame(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener("pointerdown", markMoved);
      container.removeEventListener("wheel", markMoved);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson]);

  // Boundary attribution follows the UI language.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.attributionControl.addAttribution(boundaryAttribution);
    return () => {
      map.attributionControl?.removeAttribution(boundaryAttribution);
    };
  }, [boundaryAttribution, geojson]);

  // Restyle when statuses / filters change.
  useEffect(() => {
    layerRef.current?.eachLayer((l) => {
      const f = (l as L.Path & { feature?: GeoJSON.Feature }).feature;
      if (f?.properties?.slug) (l as L.Path).setStyle(styleFor(f.properties.slug));
    });
  }, [statuses, regionFilter, highlight]);

  return <div ref={el} className="yoyo-map h-full w-full" aria-label="Map of Thailand provinces" />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
