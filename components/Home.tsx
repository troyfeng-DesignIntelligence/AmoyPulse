"use client";

import { useMemo, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { BoundaryStage } from "./BoundaryStage";
import { DataVizPage } from "./DataVizPage";
import poiData from "../export_light.json";

const bannerComments = [
  "我在廈門長大，海風一吹就會想起很多事。",
  "離開以後，最懷念的是鼓浪嶼的慢、廈門的亮。",
  "每次回到廈門，都像回到某種安靜的秩序。",
  "廈門不是很吵的城市，但它一直在低聲發光。",
  "很多年後才明白，原來我一直都在想念廈門。",
  "有些城市適合旅行，有些城市適合被長久地記住。",
  "如果要為一個地方寫下旋律，廈門會是很溫柔的那種。",
];

const overviewStats = [
  { label: "Coastline tone", value: "Calm / layered" },
  { label: "Rhythm density", value: "Low to medium" },
  { label: "Sound profile", value: "Breath, pulse, tide" },
  { label: "Visual language", value: "Dark / editorial" },
];

const mixTracks = [
  { title: "Terrain", subtitle: "Boundary / elevation / shoreline" },
  { title: "Rhythm", subtitle: "Tempo / density / pulse" },
  { title: "Memory", subtitle: "Comments / sentiment / nostalgia" },
];

type PoiItem = {
  name: string | null;
  coords: [number, number];
};

const dataRows = [
  { label: "Topography amplitude", value: "0.72", detail: "mapped to pitch spread" },
  { label: "Shoreline curvature", value: "0.48", detail: "mapped to waveform length" },
  { label: "Urban density", value: "0.66", detail: "mapped to beat intensity" },
  { label: "Memory warmth", value: "0.81", detail: "mapped to harmonic softness" },
];

export function Home() {
  const narrationRef = useRef<HTMLElement | null>(null);
  const mappingRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: narrationRef,
    offset: ["start start", "end end"],
  });
  const { scrollYProgress: mappingScroll } = useScroll({
    target: mappingRef,
    offset: ["start end", "center start"],
  });
  const mappingReveal = useTransform(mappingScroll, [0, 0.12, 0.4, 1], [0, 0.12, 0.72, 1]);
  const mappingLine1 = useTransform(mappingReveal, [0, 0.25, 0.55, 1], [0, 0.25, 0.78, 1]);
  const mappingLine2 = useTransform(mappingReveal, [0.12, 0.36, 0.68, 1], [0, 0.22, 0.8, 1]);

  const line1Y = useTransform(scrollYProgress, [0, 0.12, 0.28], [40, 0, -80]);
  const line2Y = useTransform(scrollYProgress, [0.16, 0.3, 0.46], [40, 0, -80]);
  const line3Y = useTransform(scrollYProgress, [0.34, 0.48, 0.64], [40, 0, -80]);
  const line4Y = useTransform(scrollYProgress, [0.56, 0.7, 0.86], [40, 0, -80]);
  const line5Y = useTransform(scrollYProgress, [0.76, 0.88, 0.98], [40, 0, -80]);

  const line1Opacity = useTransform(scrollYProgress, [0, 0.12, 0.22, 0.28], [0, 1, 1, 0]);
  const line2Opacity = useTransform(scrollYProgress, [0.16, 0.3, 0.4, 0.46], [0, 1, 1, 0]);
  const line3Opacity = useTransform(scrollYProgress, [0.34, 0.48, 0.58, 0.64], [0, 1, 1, 0]);
  const line4Opacity = useTransform(scrollYProgress, [0.56, 0.7, 0.8, 0.86], [0, 1, 1, 0]);
  const line5Opacity = useTransform(scrollYProgress, [0.76, 0.88, 0.94, 0.98], [0, 1, 1, 0]);

  const line1Scale = useTransform(scrollYProgress, [0, 0.12, 0.28], [0.98, 1, 0.94]);
  const line2Scale = useTransform(scrollYProgress, [0.16, 0.3, 0.46], [0.98, 1, 0.94]);
  const line3Scale = useTransform(scrollYProgress, [0.34, 0.48, 0.64], [0.98, 1, 0.94]);
  const line4Scale = useTransform(scrollYProgress, [0.56, 0.7, 0.86], [0.98, 1, 0.94]);
  const line5Scale = useTransform(scrollYProgress, [0.76, 0.88, 0.98], [0.98, 1, 0.95]);

  const line1Blur = useTransform(scrollYProgress, [0, 0.22, 0.28], ["blur(0px)", "blur(0px)", "blur(4px)"]);
  const line2Blur = useTransform(scrollYProgress, [0.16, 0.4, 0.46], ["blur(0px)", "blur(0px)", "blur(4px)"]);
  const line3Blur = useTransform(scrollYProgress, [0.34, 0.58, 0.64], ["blur(0px)", "blur(0px)", "blur(4px)"]);
  const line4Blur = useTransform(scrollYProgress, [0.56, 0.8, 0.86], ["blur(0px)", "blur(0px)", "blur(4px)"]);
  const line5Blur = useTransform(scrollYProgress, [0.76, 0.94, 0.98], ["blur(0px)", "blur(0px)", "blur(4px)"]);

  const waveformItems = useMemo(() => {
    const points = (((poiData as unknown) as { points?: PoiItem[] }).points ?? []).filter(
      (point): point is PoiItem => Array.isArray(point.coords) && point.coords.length >= 2,
    );
    const xs = points.map((point) => point.coords[0]);
    const ys = points.map((point) => point.coords[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const normalize = (value: number, min: number, max: number) => (max === min ? 0.5 : (value - min) / (max - min));
    const sampled = points.filter((_, index) => index % 2 === 0);

    return sampled.map((point, index) => {
      const xRatio = normalize(point.coords[0], minX, maxX);
      const yRatio = normalize(point.coords[1], minY, maxY);
      const pulse = Math.abs(xRatio - 0.5) * 0.55 + Math.abs(yRatio - 0.5) * 0.45;
      return {
        id: `${point.name ?? "poi"}-${index}`,
        name: point.name,
        xRatio,
        yRatio,
        pulse,
      };
    });
  }, []);

  const [selectedWaveIndex, setSelectedWaveIndex] = useState<number | null>(null);
  const selectedWave = selectedWaveIndex !== null ? waveformItems[selectedWaveIndex] ?? null : null;

  const line1Letter = useTransform(scrollYProgress, [0, 0.28], [0.04, 0.14]);
  const line2Letter = useTransform(scrollYProgress, [0.16, 0.46], [0.04, 0.14]);
  const line3Letter = useTransform(scrollYProgress, [0.34, 0.64], [0.04, 0.14]);
  const line4Letter = useTransform(scrollYProgress, [0.56, 0.86], [0.18, 0.3]);
  const line5Letter = useTransform(scrollYProgress, [0.76, 0.98], [0.12, 0.22]);

  return (
    <main className="bg-[#050505] text-white">
      <section className="relative min-h-screen overflow-hidden">
        <motion.video
          className="absolute inset-0 h-full w-full scale-[1.03] object-cover md:scale-[1.06]"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          <source src="/videos/Xiamen_Terrain_Animation_Loop.mp4" type="video/mp4" />
        </motion.video>

        <div className="absolute inset-0 bg-black/42" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.16)_48%,rgba(0,0,0,0.88)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_58%,rgba(0,0,0,0.42)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/22" />

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 md:px-10 lg:px-12">
          <div className="font-[family-name:var(--font-ui)] text-[0.7rem] uppercase tracking-[0.5em] text-white/82 md:text-xs">
            Amoy Pulse
          </div>
          <nav className="font-[family-name:var(--font-ui)] hidden items-center gap-8 text-xs uppercase tracking-[0.28em] text-white/52 md:flex">
            <a href="#narration" className="transition-colors hover:text-white">
              Story
            </a>
            <a href="#experience" className="transition-colors hover:text-white">
              Experience
            </a>
            <a href="/boundary" className="rounded-full border border-cyan-200/40 bg-cyan-300/10 px-4 py-2 text-cyan-100 transition hover:bg-cyan-200 hover:text-black">
              DJ console
            </a>
          </nav>
        </header>

        <div className="relative z-10 flex min-h-[calc(100vh-88px)] items-center px-6 pb-24 pt-8 md:px-10 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="grid w-full max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end"
          >
            <div className="max-w-4xl">
              <p className="font-[family-name:var(--font-ui)] mb-6 text-[0.7rem] uppercase tracking-[0.55em] text-white/46 md:text-xs">
                Amoy data · terrain · sound
              </p>
              <div className="space-y-3 md:space-y-4">
                <h1 className="font-[family-name:var(--font-cjk)] text-balance text-[3.8rem] font-black leading-[0.92] tracking-[-0.08em] text-white md:text-[6.5rem] lg:text-[8.5rem] xl:text-[10rem] xl:leading-[0.88] [text-shadow:0_0_34px_rgba(255,255,255,0.08)]">
                  廈門節奏
                </h1>
                <p className="font-[family-name:var(--font-title)] max-w-[15ch] text-[0.9rem] uppercase leading-[1.15] tracking-[0.42em] text-white/54 md:max-w-[18ch] md:text-[1rem] md:tracking-[0.48em]">
                  Rhythm of Amoy
                </p>
              </div>
              <div className="mt-6 max-w-2xl space-y-4 text-pretty text-base leading-8 text-white/66 md:text-lg md:leading-9">
                <p className="font-[family-name:var(--font-body)]">廈門的地形、光線與聲音，將被重新編排成一段沉浸式體驗。</p>
                <p className="font-[family-name:var(--font-cjk)] text-[1.05rem] leading-9 text-white/72 md:text-[1.2rem] md:leading-10">
                  Amoy will be translated into motion, rhythm, and atmosphere — as a cinematic interface rather than a conventional website.
                </p>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <a
                  href="#narration"
                  className="font-[family-name:var(--font-ui)] inline-flex items-center rounded-full border border-white/14 bg-white/10 px-7 py-3 text-xs uppercase tracking-[0.28em] text-white/90 backdrop-blur-sm transition duration-300 hover:bg-white hover:text-black"
                >
                  Enter the pulse
                </a>
                <a
                  href="/boundary"
                  className="font-[family-name:var(--font-ui)] inline-flex items-center rounded-full border border-cyan-200/30 bg-cyan-300/10 px-7 py-3 text-xs uppercase tracking-[0.28em] text-cyan-100 backdrop-blur-sm transition duration-300 hover:bg-cyan-200 hover:text-black"
                >
                  DJ console
                </a>
                <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.38em] text-white/34">
                  Scroll to continue
                </span>
              </div>
            </div>

            <div className="hidden justify-self-end lg:block">
              <div className="max-w-sm border-l border-white/12 pl-6">
                <p className="font-[family-name:var(--font-ui)] text-[0.7rem] uppercase tracking-[0.45em] text-white/38">
                  Chapter 01
                </p>
                <p className="font-[family-name:var(--font-cjk)] mt-5 text-2xl leading-[1.5] text-white/78">
                  一座城市的節奏，被轉譯成影像、文字與聲音。
                </p>
                <p className="font-[family-name:var(--font-body)] mt-4 text-base leading-8 text-white/58">
                  A quiet opening, framed like a film title card — elegant, restrained, and built to hand off into the main experience.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section ref={narrationRef} id="narration" className="relative min-h-[360vh] bg-[#050505]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_45%)]" />

        <div className="sticky top-0 flex h-screen items-center px-6 md:px-10 lg:px-12">
          <div className="mx-auto w-full max-w-6xl">
            <p className="font-[family-name:var(--font-ui)] mb-10 text-[0.65rem] uppercase tracking-[0.45em] text-white/35">
              Scroll narration
            </p>

            <div className="space-y-10 md:space-y-14">
              <motion.p style={{ opacity: line1Opacity, y: line1Y, scale: line1Scale, letterSpacing: line1Letter, filter: line1Blur }} className="font-[family-name:var(--font-cjk)] max-w-5xl text-3xl leading-[1.4] text-white md:text-5xl">
                我做這個網站，不是為了展示技術，而是想把一座城市的氣息留下來。
              </motion.p>

              <motion.p style={{ opacity: line2Opacity, y: line2Y, scale: line2Scale, letterSpacing: line2Letter, filter: line2Blur }} className="font-[family-name:var(--font-body)] max-w-4xl text-xl leading-[1.65] text-white/90 md:text-3xl">
                “Every corner in Amoy feels soft, walkable, and close to the sea.”
              </motion.p>

              <motion.p style={{ opacity: line3Opacity, y: line3Y, scale: line3Scale, letterSpacing: line3Letter, filter: line3Blur }} className="font-[family-name:var(--font-cjk)] max-w-5xl text-3xl leading-[1.4] text-white md:text-5xl">
                所以我們把地形、城市節奏與聲音重組成一段可以被觀看、也可以被聽見的敘事。
              </motion.p>

              <motion.p style={{ opacity: line4Opacity, y: line4Y, scale: line4Scale, letterSpacing: line4Letter, filter: line4Blur }} className="font-[family-name:var(--font-body)] max-w-4xl text-xl leading-[1.65] text-white/86 md:text-3xl">
                “The light here feels calm, as if the city is breathing quietly.”
              </motion.p>

              <motion.p style={{ opacity: line5Opacity, y: line5Y, scale: line5Scale, letterSpacing: line5Letter, filter: line5Blur }} className="font-[family-name:var(--font-title)] max-w-4xl text-[0.95rem] uppercase leading-[1.6] text-white/70 md:text-[1.15rem]">
                NEXT: A DATA-DRIVEN EXPERIENCE WHERE AMOY BECOMES MOTION, VISUALIZATION, AND MUSIC.
              </motion.p>
            </div>

            <div className="mt-24 overflow-hidden border-y border-white/10 py-6 md:mt-28 md:py-8">
              <motion.div
                className="flex min-w-max gap-10 text-[0.75rem] uppercase tracking-[0.34em] text-white/42 md:gap-14 md:text-xs"
                animate={{ x: [0, -1400] }}
                transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
              >
                {[...bannerComments, ...bannerComments].map((comment, index) => (
                  <span key={`${comment}-${index}`} className="font-[family-name:var(--font-ui)] whitespace-nowrap">
                    {comment}
                  </span>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <section ref={mappingRef} id="mapping" className="bg-[#050505] px-4 py-6 md:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-7xl rounded-[1.75rem] border border-white/10 bg-white/[0.03] px-5 py-5 backdrop-blur-sm md:px-6 md:py-6">
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.45em] text-white/35">DJ mapping rules</p>
              <motion.h2
                initial={{ opacity: 0, y: 12 }}
                style={{ opacity: mappingLine1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="text-2xl font-medium tracking-[-0.03em] text-white md:text-3xl"
              >
                数据DJ台使用说明
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                style={{ opacity: mappingLine2, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.08 }}
                className="max-w-xl text-sm leading-7 text-white/58 md:text-base"
              >
                时间决定速度，区域决定声音性格，旋钮决定强弱和层次。
              </motion.p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { title: "Time", text: "小时越往后，节拍越慢，氛围越深。" },
                { title: "Region", text: "海岸、山地、城市分别偏向氛围、旋律和鼓点。" },
                { title: "Beat", text: "这里控制低频力度，也影响推进感。" },
                { title: "Melody / FX", text: "旋律密度与高频混响一起决定画面亮度。" },
              ].map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ opacity: mappingReveal }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.08 }}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="text-[10px] uppercase tracking-[0.35em] text-white/38">{card.title}</div>
                  <div className="mt-2 text-sm leading-7 text-white/72">{card.text}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="experience" className="bg-[#050505] px-4 pb-8 pt-4 md:px-6 lg:px-8 lg:pb-12 lg:pt-6">
        <div className="mx-auto w-full max-w-none space-y-4">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-sm md:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl space-y-2">
                <p className="text-[10px] uppercase tracking-[0.45em] text-white/35">How the console works</p>
                <h2 className="text-xl font-medium tracking-[-0.03em] text-white md:text-2xl">
                  Time moves the city, region focuses it, and the mixer shapes its energy.
                </h2>
              </div>
              <div className="grid gap-2 text-[10px] uppercase tracking-[0.32em] text-white/48 md:grid-cols-3 md:gap-4">
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2">Time → motion</span>
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2">Region → focus</span>
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2">Mixer → atmosphere</span>
              </div>
            </div>
          </div>
          <BoundaryStage />
        </div>
      </section>

      <section id="dataviz" className="bg-[#050505]">
        <DataVizPage />
      </section>

      <section aria-label="Mirrored waveform" className="mt-40 bg-[#050505] px-4 pb-28 pt-0 md:mt-56 md:px-6 md:pb-36 lg:mt-72 lg:px-8 lg:pb-44">
        <div className="mx-auto w-full max-w-none pt-0">
          <div className="mx-auto w-full max-w-none px-0">
            <div className="mb-5 flex items-end justify-between gap-4 px-1 md:mb-8">
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.5em] text-white/22">Final trace</p>
                <p className="text-sm text-white/36 md:text-base">A lonely line of names, suspended at the end.</p>
              </div>
              {selectedWave?.name ? (
                <div className="rounded-full border border-white/10 bg-black/70 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-white/82 md:text-xs">
                  {selectedWave.name}
                </div>
              ) : null}
            </div>

            <div className="relative h-[44vh] min-h-[380px] w-full overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/12" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-32 -translate-y-1/2 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_72%)]" />
              <div className="absolute inset-0 flex items-center overflow-hidden">
                <div className="flex h-full w-full items-center gap-[1px] px-1">
                  {waveformItems.map((item, index) => {
                    const height = 12 + item.pulse * 118;
                    const topHeight = Math.max(12, height);
                    const bottomHeight = Math.max(12, height * (0.86 + item.yRatio * 0.22));
                    const distance = Math.abs(index - selectedWaveIndex);
                    const active = distance === 0;
                    const nearby = distance > 0 && distance <= 5;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedWaveIndex(index)}
                        onMouseEnter={() => setSelectedWaveIndex(index)}
                        onFocus={() => setSelectedWaveIndex(index)}
                        className="relative flex h-full flex-1 cursor-pointer items-center justify-center overflow-visible bg-transparent outline-none transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100"
                        style={{ opacity: active ? 1 : nearby ? 0.76 : 0.18 }}
                        aria-pressed={active}
                        aria-label={item.name ?? `Point ${index + 1}`}
                      >
                        <motion.div
                          className="absolute bottom-1/2 w-full origin-bottom rounded-full bg-white/95 shadow-[0_0_14px_rgba(255,255,255,0.2)]"
                          style={{ height: `${topHeight}%` }}
                          animate={active ? { opacity: [0.78, 1, 0.84], scaleY: [0.98, 1.06, 1] } : nearby ? { opacity: [0.28, 0.48, 0.3], scaleY: [0.98, 1.02, 0.99] } : { opacity: 0.12, scaleY: 1 }}
                          transition={active ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : nearby ? { duration: 3.8 + distance * 0.15, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                        />
                        <motion.div
                          className="absolute top-1/2 w-full origin-top rounded-full bg-white/95 shadow-[0_0_14px_rgba(255,255,255,0.16)]"
                          style={{ height: `${bottomHeight}%` }}
                          animate={active ? { opacity: [0.7, 0.96, 0.74], scaleY: [0.98, 1.06, 1] } : nearby ? { opacity: [0.22, 0.42, 0.24], scaleY: [0.98, 1.02, 0.99] } : { opacity: 0.1, scaleY: 1 }}
                          transition={active ? { duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.12 } : nearby ? { duration: 3.9 + distance * 0.15, repeat: Infinity, ease: "easeInOut", delay: 0.12 } : { duration: 0.2 }}
                        />
                        <div className={`absolute inset-x-0 top-1/2 h-px transition-colors duration-200 ${active ? "bg-white/80" : nearby ? "bg-white/45" : "bg-white/18"}`} />
                        {active && selectedWave?.name ? (
                          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-[180%] whitespace-nowrap rounded-full border border-white/15 bg-black/80 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/90 shadow-[0_0_20px_rgba(0,0,0,0.35)]">
                            {selectedWave.name}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
