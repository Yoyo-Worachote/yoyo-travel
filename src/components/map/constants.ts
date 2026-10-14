import type { MapStatus } from "@/lib/passport";
import type { RegionId } from "@/lib/types";

export const STATUS_COLORS: Record<MapStatus, { fill: string; opacity: number }> = {
  visited: { fill: "#2c6446", opacity: 0.85 },
  partial: { fill: "#8dbb9d", opacity: 0.75 },
  want: { fill: "#d9a441", opacity: 0.7 },
  none: { fill: "#e4ead9", opacity: 0.7 },
};

export interface MapProvince {
  slug: string;
  region: RegionId;
  label: string;
  sublabel: string;
}

export interface MapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  focus: (slug: string) => void;
}
