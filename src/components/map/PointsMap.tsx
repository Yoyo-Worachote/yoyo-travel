"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "./PointsMapCanvas";

const Canvas = dynamic(() => import("./PointsMapCanvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full skeleton" />,
});

export type { MapPoint };

export function PointsMap({
  points,
  route,
  bbox,
  height = 360,
  label,
}: {
  points: MapPoint[];
  route?: boolean;
  bbox?: [number, number, number, number];
  height?: number | string;
  label: string;
}) {
  return (
    <div className="card overflow-hidden" style={{ height }} role="region" aria-label={label}>
      <Canvas points={points} route={route} bbox={bbox} />
    </div>
  );
}
