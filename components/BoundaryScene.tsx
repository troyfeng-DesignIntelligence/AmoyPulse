"use client";

import { useMemo } from "react";

type Point = [number, number];
type Ring = Point[];
type Polygon = Ring[];

type GeoJSONFeatureCollection = {
  features: { geometry: { type: string; coordinates: Polygon[] } }[];
};

type BoundaryLike = GeoJSONFeatureCollection | Ring | Polygon | number[][] | number[][][];

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function isPoint(value: unknown): value is Point {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number";
}

function normalizeBoundary(source: BoundaryLike): Polygon[] {
  if (Array.isArray(source) && source.length > 0 && isPoint(source[0])) {
    return [[source as Ring]];
  }

  if (Array.isArray(source) && source.length > 0 && Array.isArray(source[0]) && isPoint(source[0][0])) {
    return [source as Polygon];
  }

  if (Array.isArray(source) && source.length > 0 && Array.isArray(source[0]) && Array.isArray(source[0][0])) {
    return source as unknown as Polygon[];
  }

  const collection = source as GeoJSONFeatureCollection;
  return collection.features.flatMap((feature) => feature.geometry.coordinates);
}

function getBounds(polygons: Polygon[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return { minX, minY, maxX, maxY };
}

function ringToPath(ring: Ring) {
  return ring.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${-y}`).join(" ") + " Z";
}

export function BoundaryScene({ boundary }: { boundary: BoundaryLike }) {
  const polygons = useMemo(() => normalizeBoundary(boundary), [boundary]);
  const bounds = useMemo(() => getBounds(polygons), [polygons]);

  const padding = 0.08;
  const width = Math.max(bounds.maxX - bounds.minX, 0.0001);
  const height = Math.max(bounds.maxY - bounds.minY, 0.0001);
  const viewBox = `${bounds.minX - width * padding} ${-(bounds.maxY + height * padding)} ${width * (1 + padding * 2)} ${height * (1 + padding * 2)}`;

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(60,95,130,0.18),rgba(5,5,5,0)_60%),radial-gradient(circle_at_top,rgba(16,28,40,0.4),transparent_40%)]" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="boundaryGlow" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="rgba(190,225,255,0.35)" />
            <stop offset="55%" stopColor="rgba(102,160,220,0.12)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x={bounds.minX - width * padding} y={-(bounds.maxY + height * padding)} width={width * (1 + padding * 2)} height={height * (1 + padding * 2)} fill="url(#boundaryGlow)" />

        {polygons.map((polygon, polygonIndex) =>
          polygon.map((ring, ringIndex) => (
            <g key={`${polygonIndex}-${ringIndex}`} filter="url(#softGlow)">
              <path
                d={ringToPath(ring)}
                fill="rgba(110, 168, 220, 0.08)"
                stroke="rgba(225, 245, 255, 0.95)"
                strokeWidth="0.0025"
                vectorEffect="non-scaling-stroke"
                opacity={ringIndex === 0 ? 1 : 0.85}
              />
            </g>
          )),
        )}
      </svg>

      <div className="pointer-events-none absolute left-6 top-6 z-10 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-[10px] uppercase tracking-[0.45em] text-white/70 backdrop-blur-sm md:left-10 md:top-8">
        Xiamen boundary / GeoJSON
      </div>

      <div className="pointer-events-none absolute bottom-6 left-6 z-10 max-w-xs border-l border-white/10 pl-4 text-white/68 md:bottom-8 md:left-10">
        <p className="text-[11px] uppercase tracking-[0.45em] text-white/38">Visible boundary</p>
        <p className="mt-3 text-sm leading-7">
          这里直接把厦门边界以矢量轮廓显示出来，避免 canvas/加载问题导致整页看不见。
        </p>
      </div>
    </div>
  );
}
