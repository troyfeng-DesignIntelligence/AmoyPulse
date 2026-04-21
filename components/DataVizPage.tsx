"use client";

import { useMemo, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import rhythmData from "../xiamen_rhythm_multi.json";

type RhythmPoint = {
  hour: number;
  bike_pulse: number;
  food_activity: number;
  entertainment_activity: number;
};

type LayerKey = keyof Pick<RhythmPoint, "bike_pulse" | "food_activity" | "entertainment_activity">;

type LayerConfig = {
  key: LayerKey;
  label: string;
  accent: string;
  baseRadius: number;
  thickness: number;
};

const layers: LayerConfig[] = [
  { key: "bike_pulse", label: "Bike pulse", accent: "#6ee7ff", baseRadius: 122, thickness: 42 },
  { key: "food_activity", label: "Food activity", accent: "#f5d061", baseRadius: 188, thickness: 44 },
  { key: "entertainment_activity", label: "Nightlife", accent: "#d86bff", baseRadius: 255, thickness: 46 },
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const chartCenter = 500;
const chartSize = 1000;
const TAU = Math.PI * 2;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function normalize(value: number, min: number, max: number) {
  return max === min ? 0 : clamp01((value - min) / (max - min));
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1] ?? sorted[base];
  return sorted[base] + rest * (next - sorted[base]);
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: Number((cx + Math.cos(angle - Math.PI / 2) * radius).toFixed(2)),
    y: Number((cy + Math.sin(angle - Math.PI / 2) * radius).toFixed(2)),
  };
}

function buildRadialPath(points: Array<{ angle: number; radius: number }>, closed = true) {
  if (!points.length) return "";
  const segments = points.map((point, index) => {
    const pos = polar(chartCenter, chartCenter, point.radius, point.angle);
    return `${index === 0 ? "M" : "L"}${pos.x.toFixed(2)} ${pos.y.toFixed(2)}`;
  });
  return `${segments.join(" ")}${closed ? " Z" : ""}`;
}

function ringPoints(points: RhythmPoint[], key: LayerKey, config: LayerConfig) {
  const values = points.map((point) => point[key]);
  const p10 = quantile(values, 0.1);
  const p90 = quantile(values, 0.9);
  const baselineByHour = new Map<number, number>();
  points.forEach((point) => {
    const neighbors = [point.hour - 1, point.hour, point.hour + 1].map((hour) => points.find((item) => item.hour === (hour + 24) % 24)?.[key] ?? point[key]);
    baselineByHour.set(point.hour, neighbors.reduce((sum, item) => sum + item, 0) / neighbors.length);
  });

  return points.map((point, index) => {
    const level = normalize(point[key], p10, p90);
    const baseline = normalize(baselineByHour.get(point.hour) ?? point[key], p10, p90);
    const peakness = clamp01(Math.max(0, level - baseline) * 1.25);
    const neighborhood = [points[(index - 1 + points.length) % points.length][key], point[key], points[(index + 1) % points.length][key]];
    const noise = clamp01(Math.abs(point[key] - ((neighborhood[0] + neighborhood[2]) / 2)) / (p90 - p10 || 1));
    const angle = (point.hour / 24) * TAU;
    const radius = config.baseRadius + level * config.thickness;
    const baselineRadius = config.baseRadius + baseline * config.thickness;
    const edgeRadius = radius + peakness * 16;
    return { ...point, angle, level, baseline, peakness, noise, radius, baselineRadius, edgeRadius };
  });
}

export function DataVizPage() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "center start"],
  });
  const reveal = useTransform(scrollYProgress, [0, 0.15, 0.55, 1], [0, 0.12, 0.72, 1]);
  const ringReveal = useTransform(reveal, [0, 0.25, 0.68, 1], [0.02, 0.18, 0.84, 1]);
  const pointReveal = useTransform(reveal, [0, 0.22, 0.6, 1], [0, 0.1, 0.8, 1]);
  const spin = useTransform(scrollYProgress, [0, 1], [0, 360]);
  const drift = useTransform(scrollYProgress, [0, 1], [0, 10]);
  const pulse = useTransform(scrollYProgress, [0, 0.5, 1], [0.98, 1.02, 0.99]);

  const points = rhythmData as RhythmPoint[];

  const stats = useMemo(() => {
    const layersData = layers.map((layer) => {
      const series = ringPoints(points, layer.key, layer);
      const avg = series.reduce((sum, item) => sum + item.level, 0) / series.length;
      const peak = series.reduce((best, item) => (item.level > best.level ? item : best), series[0]);
      return { ...layer, series, avg, peak };
    });

    const rhythmIndex = points.map((point) => point.bike_pulse * 0.35 + point.food_activity * 0.3 + point.entertainment_activity * 0.35);
    const peakHour = points[rhythmIndex.indexOf(Math.max(...rhythmIndex))];
    const rhythmScore = Math.round(Math.max(...rhythmIndex));

    return { layersData, peakHour, rhythmScore };
  }, [points]);

  const radialLine = (series: ReturnType<typeof ringPoints>, radiusOffset: number) => {
    const pathPoints = series.map((item) => ({ angle: item.angle, radius: item.baselineRadius + radiusOffset + item.level * 10 }));
    return buildRadialPath(pathPoints);
  };

  return (
    <main ref={sectionRef} className="min-h-screen bg-black text-white">
      <section className="relative overflow-hidden px-5 py-6 md:px-8 md:py-8 lg:px-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:80px_80px] opacity-20" />

        <div className="relative mx-auto max-w-[1440px] space-y-6">
          <header className="grid gap-4 border-b border-white/10 pb-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.5em] text-white/40">Data visualization / Xiamen rhythm</p>
              <h1 className="font-[family-name:var(--font-cjk)] text-3xl leading-none md:text-5xl">城市节奏数据图谱</h1>
              <p className="max-w-3xl text-sm leading-7 text-white/58 md:text-base">
                三层同心夜间仪表：骑行、餐饮、夜间娱乐分别占据三条环带，半径表达强度，内环表达常态，外缘表达峰值，边缘粗糙度表达噪声。
              </p>
            </div>
            <div className="grid gap-2 text-[10px] uppercase tracking-[0.35em] text-white/45 md:grid-cols-3 xl:justify-self-end">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-center">points {points.length}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-center">peak {pad2(stats.peakHour.hour)}:00</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-center">score {stats.rhythmScore}</span>
            </div>
          </header>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 md:p-5">
                <div className="text-[10px] uppercase tracking-[0.45em] text-white/35">Night instrument notes</div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {stats.layersData.map((layer, index) => (
                    <motion.div
                      key={layer.key}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.08 }}
                      className="rounded-[1.25rem] border border-white/10 bg-black/30 p-4"
                    >
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.42em] text-white/38">
                        <span>{layer.label}</span>
                        <span>{Math.round(layer.peak.level * 100)}</span>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-white/8">
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: Math.max(0.1, layer.avg) }}
                          transition={{ duration: 1.1, ease: "easeOut" }}
                          className={`h-full origin-left rounded-full ${
                            layer.key === "bike_pulse"
                              ? "bg-[#6ee7ff]"
                              : layer.key === "food_activity"
                                ? "bg-[#f5d061]"
                                : "bg-[#d86bff]"
                          }`}
                        />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-white/66">
                        {layer.key === "bike_pulse" ? "通勤脉冲" : layer.key === "food_activity" ? "晚餐活动" : "夜晚生活"}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm md:p-6">
                <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/60 p-3 md:p-4">
                  <svg viewBox={`0 0 ${chartSize} ${chartSize}`} className="h-auto w-full">
                    <defs>
                      {stats.layersData.map((layer) => (
                        <radialGradient key={layer.key} id={`glow-${layer.key}`}>
                          <stop offset="0%" stopColor={layer.accent} stopOpacity="0.35" />
                          <stop offset="60%" stopColor={layer.accent} stopOpacity="0.12" />
                          <stop offset="100%" stopColor={layer.accent} stopOpacity="0" />
                        </radialGradient>
                      ))}
                      <filter id="softGlow">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {[
                      { start: 18, end: 21, color: "rgba(245,208,97,0.08)", label: "EVE" },
                      { start: 21, end: 24, color: "rgba(110,231,255,0.08)", label: "NIGHT" },
                      { start: 0, end: 3, color: "rgba(216,107,255,0.08)", label: "DEEP" },
                      { start: 3, end: 6, color: "rgba(255,255,255,0.06)", label: "DAWN" },
                    ].map((band) => {
                      const startAngle = (band.start / 24) * TAU - Math.PI / 2;
                      const endAngle = (band.end / 24) * TAU - Math.PI / 2;
                      const startOuter = polar(chartCenter, chartCenter, 296, startAngle + Math.PI / 2);
                      const endOuter = polar(chartCenter, chartCenter, 296, endAngle + Math.PI / 2);
                      const startInner = polar(chartCenter, chartCenter, 86, endAngle + Math.PI / 2);
                      const endInner = polar(chartCenter, chartCenter, 86, startAngle + Math.PI / 2);
                      const largeArc = band.end - band.start > 12 ? 1 : 0;
                      const d = [
                        `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
                        `A 296 296 0 ${largeArc} 1 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
                        `L ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
                        `A 86 86 0 ${largeArc} 0 ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
                        "Z",
                      ].join(" ");
                      return <path key={band.label} d={d} fill={band.color} />;
                    })}

                    {[0, 6, 12, 18].map((hour) => {
                      const angle = (hour / 24) * TAU;
                      const start = polar(chartCenter, chartCenter, 98, angle);
                      const end = polar(chartCenter, chartCenter, 288, angle);
                      return <line key={hour} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="rgba(255,255,255,0.08)" />;
                    })}

                    {layers.map((layer) => (
                      <circle key={layer.key} cx={chartCenter} cy={chartCenter} r={layer.baseRadius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 8" />
                    ))}

                    {stats.layersData.map((layer, index) => {
                      const fillPath = buildRadialPath(layer.series.map((item) => ({ angle: item.angle, radius: item.radius }))); 
                      const basePath = buildRadialPath(layer.series.map((item) => ({ angle: item.angle, radius: item.baselineRadius })));
                      const edgePath = buildRadialPath(layer.series.map((item) => ({ angle: item.angle, radius: item.edgeRadius })));
                      const orbitOffset = index * 1.8;
                      return (
                        <motion.g key={layer.key} filter="url(#softGlow)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ opacity: ringReveal, rotate: spin, originX: 0.5, originY: 0.5, y: drift }} transition={{ duration: 0.9, ease: "easeOut", delay: index * 0.12 }}>
                          <path d={fillPath} fill={`url(#glow-${layer.key})`} opacity="0.9" />
                          <motion.path
                            d={basePath}
                            fill="none"
                            stroke="rgba(255,255,255,0.28)"
                            strokeWidth="1.2"
                            strokeDasharray="2 6"
                            animate={{ strokeDashoffset: [0, -28 - index * 8] }}
                            transition={{ duration: 8 + index * 2, repeat: Infinity, ease: "linear" }}
                          />
                          <motion.path
                            d={edgePath}
                            fill="none"
                            stroke={layer.accent}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            animate={{ strokeDashoffset: [0, -18 - index * 6], opacity: [0.7, 1, 0.78] }}
                            transition={{ duration: 6.5 + index * 1.2, repeat: Infinity, ease: "linear" }}
                          />
                          <motion.path
                            d={radialLine(layer.series, orbitOffset)}
                            fill="none"
                            stroke="rgba(255,255,255,0.18)"
                            strokeWidth="0.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            animate={{ pathLength: [0.96, 1, 0.98] }}
                            transition={{ duration: 4.8 + index, repeat: Infinity, ease: "easeInOut" }}
                          />
                        </motion.g>
                      );
                    })}

                    {stats.layersData.flatMap((layer) =>
                      layer.series.map((item, index) => {
                        const outer = polar(chartCenter, chartCenter, item.edgeRadius, item.angle);
                        const inner = polar(chartCenter, chartCenter, layer.baseRadius - 12, item.angle);
                        const peakGlow = item.peakness > 0.18 ? 1 : 0.2;
                        return (
                          <motion.g
                            key={`${layer.key}-${item.hour}-${index}`}
                            style={{ opacity: pointReveal }}
                            initial={{ opacity: 0, scale: 0.3 }}
                            animate={{ opacity: 1, scale: 1, rotate: item.noise * 8 }}
                            transition={{ duration: 0.45, ease: "easeOut", delay: 0.16 + item.hour * 0.01 + index * 0.01 }}
                          >
                            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={layer.accent} strokeOpacity={0.28 + item.noise * 0.28} strokeWidth={1.1 + item.noise * 1.8} />
                            <circle cx={outer.x} cy={outer.y} r={2.2 + item.peakness * 3.4} fill={layer.accent} fillOpacity={0.55 + peakGlow * 0.35} />
                          </motion.g>
                        );
                      })
                    )}

                    {Array.from({ length: 24 }, (_, hour) => {
                      const angle = (hour / 24) * TAU;
                      const anchor = polar(chartCenter, chartCenter, 320, angle);
                      const tickStart = polar(chartCenter, chartCenter, 300, angle);
                      return (
                        <motion.g
                          key={hour}
                          initial={{ opacity: 0.5 }}
                          animate={{ opacity: [0.35, 0.9, 0.35] }}
                          transition={{ duration: 6 + hour * 0.08, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <line x1={tickStart.x} y1={tickStart.y} x2={anchor.x} y2={anchor.y} stroke="rgba(255,255,255,0.22)" />
                          <text x={anchor.x} y={anchor.y} fill="rgba(255,255,255,0.46)" fontSize="10" textAnchor="middle" dominantBaseline="middle">
                            {pad2(hour)}
                          </text>
                        </motion.g>
                      );
                    })}

                    <motion.circle
                      cx={chartCenter}
                      cy={chartCenter}
                      r="82"
                      fill="#050505"
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="1.2"
                      style={{ scale: pulse, originX: 0.5, originY: 0.5 }}
                      animate={{ filter: ["drop-shadow(0 0 0px rgba(255,255,255,0.12))", "drop-shadow(0 0 10px rgba(255,255,255,0.22))", "drop-shadow(0 0 0px rgba(255,255,255,0.12))"] }}
                      transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.circle
                      cx={chartCenter}
                      cy={chartCenter}
                      r="56"
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="3 9"
                      animate={{ rotate: 360, strokeDashoffset: [0, -40] }}
                      transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                      style={{ originX: 0.5, originY: 0.5 }}
                    />
                    <motion.circle
                      cx={chartCenter}
                      cy={chartCenter}
                      r="34"
                      fill="none"
                      stroke="rgba(255,255,255,0.24)"
                      strokeWidth="1.2"
                      strokeDasharray="10 8"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 42, repeat: Infinity, ease: "linear" }}
                      style={{ originX: 0.5, originY: 0.5 }}
                    />
                    <text x={chartCenter} y={chartCenter - 14} fill="rgba(255,255,255,0.52)" fontSize="11" textAnchor="middle" letterSpacing="4">
                      RHYTHM
                    </text>
                    <text x={chartCenter} y={chartCenter + 10} fill="rgba(255,255,255,0.9)" fontSize="20" textAnchor="middle" letterSpacing="2">
                      {pad2(stats.peakHour.hour)}:00
                    </text>
                    <text x={chartCenter} y={chartCenter + 32} fill="rgba(255,255,255,0.48)" fontSize="11" textAnchor="middle" letterSpacing="3">
                      INDEX {stats.rhythmScore}
                    </text>
                  </svg>
                </div>
              </div>
            </div>

            <aside className="grid gap-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 md:p-5">
                <div className="text-[10px] uppercase tracking-[0.45em] text-white/35">Readout</div>
                <div className="mt-4 grid gap-3">
                  {stats.layersData.map((layer) => (
                    <div key={layer.key} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-white/55">
                        <span>{layer.label}</span>
                        <span>{Math.round(layer.peak.level * 100)}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: layer.avg }} transition={{ duration: 1.2, ease: "easeOut" }} className="h-full origin-left rounded-full" style={{ backgroundColor: layer.accent }} />
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.25em] text-white/34">
                        <span>avg {Math.round(layer.avg * 100)}</span>
                        <span>peak {Math.round(layer.peak.level * 100)}</span>
                        <span>noise {Math.round(layer.peak.noise * 100)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 md:p-5">
                <div className="text-[10px] uppercase tracking-[0.45em] text-white/35">Night narrative</div>
                <p className="mt-4 text-sm leading-7 text-white/70">
                  城市在夜里的声音行成环形节奏，可见峰值和碎片化波动。
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.3em] text-white/45">
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-center">Baseline</span>
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-center">Peak</span>
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-2 text-center">Noise</span>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 md:p-5">
                <div className="text-[10px] uppercase tracking-[0.45em] text-white/35">Time band</div>
                <div className="mt-4 grid gap-2 text-sm text-white/68">
                  {[
                    ["18:00–21:00", "EVE / 餐饮与通勤同时抬升"],
                    ["21:00–00:00", "NIGHT / 三层进入分化"],
                    ["00:00–03:00", "DEEP / 夜生活保持亮点"],
                    ["03:00–06:00", "DAWN / 城市回到低频"],
                  ].map(([time, desc]) => (
                    <div key={time} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                      <span className="font-[family-name:var(--font-ui)] text-white/48">{time}</span>
                      <span className="text-right text-white/68">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
