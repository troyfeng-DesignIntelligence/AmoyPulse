"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import filteredBoundary from "../xiamen_boundary_sm_huli.json";

type Point = [number, number];
type Ring = Point[];
type Polygon = Ring[];
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

type RhythmPoint = {
  x: number;
  y: number;
  type: "beat" | "melody" | "sparkle";
  seed: number;
  size: number;
  opacity: number;
};

type InputData = {
  hour: number;
  bike_pulse: number;
  food_activity: number;
  entertainment_activity: number;
};

type MappingState = {
  hour: number;
  bikePulse: number;
  foodActivity: number;
  entertainmentActivity: number;
  beatDensity: number;
  melodyDensity: number;
  sparkleDensity: number;
  tempo: number;
  sceneState: "morning" | "day" | "night";
};

type MixerState = {
  beatIntensity: number;
  melodyDensity: number;
  sparkleAmount: number;
  tempo: number;
  glow: number;
  low: number;
  mid: number;
  high: number;
};

type KnobKey = keyof MixerState;

function transposeNote(note: string, semitones: number) {
  return Tone.Frequency(note).transpose(semitones).toNote();
}

type RegionMode = "coast" | "mountain" | "city";
type TriggerFlash = RegionMode | "mixer" | null;

type AudioNodePack = {
  drums: {
    volume: Tone.Volume;
    kick: Tone.MembraneSynth;
    hat: Tone.NoiseSynth;
  };
  strings: {
    volume: Tone.Volume;
    synth: Tone.PolySynth<Tone.Synth>;
    filter: Tone.Filter;
  };
  piano: {
    volume: Tone.Volume;
    synth: Tone.PolySynth<Tone.Synth>;
    filter: Tone.Filter;
  };
  ambience: {
    volume: Tone.Volume;
    noise: Tone.NoiseSynth;
    filter: Tone.Filter;
    reverb: Tone.Reverb;
  };
  eq: {
    low: Tone.Volume;
    mid: Tone.Volume;
    high: Tone.Volume;
  };
  master: Tone.Volume;
  panner: Tone.Panner;
};

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
function pointInRing(point: Point, ring: Ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.000001) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}
function pointInPolygon(point: Point, polygon: Polygon) {
  if (!polygon[0] || !pointInRing(point, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) if (pointInRing(point, polygon[i])) return false;
  return true;
}
function hashNoise(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function normalizeValue(value: number, min: number, max: number) {
  if (max === min) return 0;
  return clamp01((value - min) / (max - min));
}
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
function buildMapping(data: InputData): MappingState {
  const hourNorm = normalizeValue(data.hour, 0, 23);
  const bikePulse = clamp01(data.bike_pulse);
  const foodActivity = clamp01(data.food_activity);
  const entertainmentActivity = clamp01(data.entertainment_activity);
  const morning = smoothstep(0.15, 0.35, hourNorm);
  const day = smoothstep(0.3, 0.7, hourNorm);
  const night = smoothstep(0.65, 0.95, hourNorm);
  return {
    hour: hourNorm,
    bikePulse,
    foodActivity,
    entertainmentActivity,
    beatDensity: clamp01(0.18 + bikePulse * 0.66 + morning * 0.16 - night * 0.08),
    melodyDensity: clamp01(0.16 + foodActivity * 0.62 + day * 0.12),
    sparkleDensity: clamp01(0.2 + entertainmentActivity * 0.7 + night * 0.18),
    tempo: clamp01(0.15 + hourNorm * 0.55 + morning * 0.12 - night * 0.08),
    sceneState: morning > 0.5 ? "morning" : night > 0.5 ? "night" : "day",
  };
}
function createGeoPoints(polygons: Polygon[], bounds: Bounds, count = 240): RhythmPoint[] {
  const points: RhythmPoint[] = [];
  let attempts = 0;
  while (points.length < count && attempts < count * 160) {
    attempts += 1;
    const fx = (hashNoise(attempts * 0.91, attempts * 1.31) + Math.random() * 0.4) % 1;
    const fy = (hashNoise(attempts * 1.77, attempts * 0.47) + Math.random() * 0.4) % 1;
    const x = bounds.minX + fx * (bounds.maxX - bounds.minX);
    const y = bounds.minY + fy * (bounds.maxY - bounds.minY);
    const candidate: Point = [x, y];
    if (!polygons.some((polygon) => pointInPolygon(candidate, polygon))) continue;
    const colorRoll = hashNoise(x, y);
    const type: RhythmPoint["type"] = colorRoll < 0.34 ? "beat" : colorRoll < 0.68 ? "melody" : "sparkle";
    const size = type === "beat" ? 2.4 + hashNoise(y, x) * 2.4 : type === "melody" ? 1.6 + hashNoise(y, x) * 1.6 : 0.9 + hashNoise(y, x) * 1.1;
    const opacity = type === "beat" ? 0.45 + hashNoise(x + 2, y + 5) * 0.35 : type === "melody" ? 0.32 + hashNoise(x + 4, y + 1) * 0.28 : 0.55 + hashNoise(x + 7, y + 3) * 0.35;
    points.push({ x, y, type, seed: hashNoise(x + 9.1, y + 2.7) * Math.PI * 2, size, opacity });
  }
  return points;
}
function ringToPath(points: Point[], bounds: Bounds) {
  if (points.length === 0) return "";
  const width = Math.max(bounds.maxX - bounds.minX, 0.0001);
  const height = Math.max(bounds.maxY - bounds.minY, 0.0001);
  return points.map(([x, y], index) => {
    const px = 120 + ((x - bounds.minX) / width) * 760;
    const py = 110 + (1 - (y - bounds.minY) / height) * 680;
    return `${index === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`;
  }).join(" ") + " Z";
}
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
function HourTag({ hour }: { hour: number }) {
  return <div className="text-[10px] uppercase tracking-[0.4em] text-white/45">{String(hour).padStart(2, "0")}:00</div>;
}
function hourToTempo(hour: number) {
  if (hour < 8) return 78;
  if (hour < 16) return 64;
  return 56;
}
export function BoundaryStage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frameCounterRef = useRef(0);
  const canvasSizeRef = useRef({ width: 0, height: 0, dpr: 0 });
  const transportStartedRef = useRef(false);
  const audioRef = useRef<AudioNodePack | null>(null);
  const lastScheduledTimeRef = useRef(0);
  const triggerQueueRef = useRef<Array<{ type: RhythmPoint["type"]; x: number; y: number; size: number; velocity: number }>>([]);
  const pulseRef = useRef<Record<string, number>>({});
  const [audioReady, setAudioReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [polygons] = useState<Polygon[]>(() => {
    const source = filteredBoundary as unknown as { polygons?: Polygon[] };
    return source.polygons ?? [];
  });
  const bounds = useMemo(() => (polygons.length ? getBounds(polygons) : { minX: 0, minY: 0, maxX: 1, maxY: 1 }), [polygons]);
  const basePoints = useMemo(() => createGeoPoints(polygons, bounds), [bounds, polygons]);
  const outlinePaths = useMemo(() => polygons.map((polygon) => (polygon[0]?.length ? ringToPath(polygon[0], bounds) : "")).filter(Boolean), [bounds, polygons]);
  const [hour, setHour] = useState(19);
  const [playing, setPlaying] = useState(true);
  const [region, setRegion] = useState<RegionMode>("coast");
  const [mode, setMode] = useState<"beat" | "melody" | "sparkle">("beat");
  const [mixer, setMixer] = useState<MixerState>({ beatIntensity: 0.72, melodyDensity: 0.56, sparkleAmount: 0.46, tempo: 0.58, glow: 0.62, low: 0.5, mid: 0.5, high: 0.5 });
  const [activeKnob, setActiveKnob] = useState<KnobKey | null>(null);
  const [triggerFlash, setTriggerFlash] = useState<TriggerFlash>(null);
  const [cueTick, setCueTick] = useState(0);
  const cuePitchRef = useRef(0);
  const cueDirectionRef = useRef<1 | -1>(1);
  const cueReturnTimerRef = useRef<number | null>(null);
  const knobTimers = useRef<Record<KnobKey, number | null>>({ beatIntensity: null, melodyDensity: null, sparkleAmount: null, tempo: null, glow: null, low: null, mid: null, high: null });
  const activeMode = triggerFlash === "mixer" ? "fx" : mode;
  const inputData = useMemo<InputData>(() => ({
    hour,
    bike_pulse: clamp01(mixer.beatIntensity * (region === "coast" ? 1.05 : region === "mountain" ? 0.86 : 0.95)),
    food_activity: clamp01(mixer.melodyDensity * (region === "city" ? 1.08 : 0.92)),
    entertainment_activity: clamp01(mixer.sparkleAmount * (region === "city" ? 1.08 : 0.9)),
  }), [hour, mixer.beatIntensity, mixer.melodyDensity, mixer.sparkleAmount, region]);
  const mapping = useMemo(() => buildMapping(inputData), [inputData]);
  const bpm = hourToTempo(hour);
  const flashKnob = (key: KnobKey, step = 0.08) => {
    setActiveKnob(key);
    setMixer((current) => ({ ...current, [key]: clamp01(current[key] + step) }));
    const existing = knobTimers.current[key];
    if (existing) window.clearTimeout(existing);
    knobTimers.current[key] = window.setTimeout(() => {
      setActiveKnob((current) => (current === key ? null : current));
      knobTimers.current[key] = null;
    }, 180);
  };

  const applyInteractionAudio = (patch: Partial<MixerState>) => {
    setMixer((current) => ({ ...current, ...patch }));
    void initializeAudio();
  };

  const cueAccent = async () => {
    const audio = await initializeAudio();
    const now = Tone.now();
    const scale = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"];
    if (cueReturnTimerRef.current) window.clearTimeout(cueReturnTimerRef.current);
    setCueTick((value) => value + 1);
    const nextStep = Math.min(scale.length - 1, cuePitchRef.current + 1);
    cuePitchRef.current = nextStep;
    cueDirectionRef.current = 1;
    cueReturnTimerRef.current = window.setTimeout(() => {
      cueDirectionRef.current = -1;
      const fallLoop = () => {
        setCueTick((value) => value + 1);
        cuePitchRef.current = Math.max(0, cuePitchRef.current - 1);
        if (cuePitchRef.current > 0) {
          cueReturnTimerRef.current = window.setTimeout(fallLoop, 320);
        } else {
          cueDirectionRef.current = 1;
          cueReturnTimerRef.current = null;
        }
      };
      cueReturnTimerRef.current = window.setTimeout(fallLoop, 240);
    }, 820);
    const cueNote = scale[cuePitchRef.current];
    const topNote = transposeNote(cueNote, 12);
    const liftedString = transposeNote(cueNote, 3);
    audio.ambience.reverb.wet.rampTo(clamp01(0.12 + mixer.glow * 0.25), 0.06);
    audio.strings.synth.triggerAttackRelease([liftedString, topNote], "8n", now, 0.28 + mixer.mid * 0.12);
    audio.piano.synth.triggerAttackRelease([topNote], "16n", now + 0.02, 0.25 + mixer.mid * 0.1);
    if (mixer.tempo > 0.5) {
      audio.drums.kick.triggerAttackRelease("C1", "16n", now + 0.005, 0.45 + mixer.beatIntensity * 0.15);
    }
  };

  const beatAccent = async () => {
    const audio = await initializeAudio();
    const now = Tone.now();
    setMode("beat");
    setTriggerFlash("mixer");
    audio.drums.kick.triggerAttackRelease("C1", "16n", now, 0.9 + mixer.beatIntensity * 0.25);
    audio.drums.hat.triggerAttackRelease("32n", now + 0.006, 0.35 + mixer.beatIntensity * 0.2);
    audio.drums.kick.triggerAttackRelease("C1", "32n", now + 0.08, 0.45 + mixer.beatIntensity * 0.12);
    audio.drums.volume.volume.rampTo(-8 + mixer.beatIntensity * 12, 0.05);
    audio.strings.volume.volume.rampTo(-56 + mixer.low * 4, 0.05);
    audio.piano.volume.volume.rampTo(-56 + mixer.mid * 4, 0.05);
    audio.ambience.reverb.wet.rampTo(clamp01(0.03 + mixer.glow * 0.08), 0.05);
    applyInteractionAudio({ beatIntensity: clamp01(mixer.beatIntensity + 0.2), low: clamp01(mixer.low + 0.12), mid: clamp01(mixer.mid - 0.04), high: clamp01(mixer.high - 0.06) });
  };

  const toneAccent = async () => {
    const audio = await initializeAudio();
    const now = Tone.now();
    setMode("melody");
    setTriggerFlash("mixer");
    const noteSet = ["C4", "E4", "G4", "B4", "D5", "E5", "G5"];
    const seed = Math.floor((mixer.melodyDensity + mixer.mid + hour / 24) * 12) % noteSet.length;
    const seq = Array.from({ length: 6 + Math.round(mixer.melodyDensity * 3) }, (_, index) => noteSet[(seed + index) % noteSet.length]);
    const upperSeq = seq.map((note) => (note.endsWith("4") ? note.replace("4", "5") : note));
    audio.strings.synth.triggerAttackRelease(seq, "4n", now, 0.55 + mixer.melodyDensity * 0.25);
    audio.piano.synth.triggerAttackRelease(upperSeq.slice(0, 4), "8n", now + 0.02, 0.45 + mixer.mid * 0.16);
    audio.strings.volume.volume.rampTo(-6 + mixer.melodyDensity * 12, 0.05);
    audio.piano.volume.volume.rampTo(-10 + mixer.mid * 12, 0.05);
    audio.drums.volume.volume.rampTo(-56 + mixer.low * 4, 0.05);
    audio.ambience.reverb.wet.rampTo(clamp01(0.06 + mixer.glow * 0.12), 0.05);
    applyInteractionAudio({ melodyDensity: clamp01(mixer.melodyDensity + 0.2), mid: clamp01(mixer.mid + 0.12), low: clamp01(mixer.low - 0.04), high: clamp01(mixer.high - 0.03) });
  };

  const fxAccent = async () => {
    const audio = await initializeAudio();
    const now = Tone.now();
    setTriggerFlash("mixer");
    cueDirectionRef.current = 1;
    audio.ambience.reverb.wet.rampTo(clamp01(0.38 + mixer.glow * 0.6), 0.06);
    audio.ambience.filter.frequency.rampTo(2600 + mixer.high * 2600, 0.06);
    audio.ambience.noise.triggerAttackRelease(["16n", "16n"], now, 0.55 + mixer.sparkleAmount * 0.25);
    audio.drums.hat.triggerAttackRelease("32n", now + 0.008, 0.18 + mixer.high * 0.12);
    audio.drums.volume.volume.rampTo(-48 + mixer.low * 4, 0.05);
    audio.strings.volume.volume.rampTo(-20 + mixer.mid * 4, 0.05);
    audio.piano.volume.volume.rampTo(-20 + mixer.mid * 4, 0.05);
    applyInteractionAudio({ glow: clamp01(mixer.glow + 0.22), high: clamp01(mixer.high + 0.2), sparkleAmount: clamp01(mixer.sparkleAmount + 0.12), tempo: clamp01(mixer.tempo + 0.05) });
  };

  const setRegionWithAudio = (nextRegion: RegionMode) => {
    setRegion(nextRegion);
    setTriggerFlash(nextRegion);
    if (nextRegion === "coast") {
      applyInteractionAudio({
        beatIntensity: clamp01(mixer.beatIntensity + 0.05),
        low: clamp01(mixer.low + 0.08),
        mid: clamp01(mixer.mid - 0.03),
        high: clamp01(mixer.high - 0.04),
        sparkleAmount: clamp01(mixer.sparkleAmount - 0.02),
      });
    } else if (nextRegion === "mountain") {
      applyInteractionAudio({
        melodyDensity: clamp01(mixer.melodyDensity + 0.08),
        mid: clamp01(mixer.mid + 0.08),
        low: clamp01(mixer.low - 0.03),
        high: clamp01(mixer.high - 0.03),
        beatIntensity: clamp01(mixer.beatIntensity - 0.02),
      });
    } else {
      applyInteractionAudio({
        sparkleAmount: clamp01(mixer.sparkleAmount + 0.08),
        high: clamp01(mixer.high + 0.08),
        mid: clamp01(mixer.mid + 0.02),
        low: clamp01(mixer.low - 0.02),
        glow: clamp01(mixer.glow + 0.04),
      });
    }
  };

  const setModeWithAudio = (nextMode: "beat" | "melody" | "sparkle") => {
    setMode(nextMode);
    if (nextMode === "beat") {
      applyInteractionAudio({
        beatIntensity: clamp01(mixer.beatIntensity + 0.08),
        low: clamp01(mixer.low + 0.08),
        mid: clamp01(mixer.mid - 0.02),
        high: clamp01(mixer.high - 0.03),
      });
    } else if (nextMode === "melody") {
      applyInteractionAudio({
        melodyDensity: clamp01(mixer.melodyDensity + 0.09),
        mid: clamp01(mixer.mid + 0.08),
        low: clamp01(mixer.low - 0.02),
        high: clamp01(mixer.high - 0.02),
      });
    } else {
      applyInteractionAudio({
        sparkleAmount: clamp01(mixer.sparkleAmount + 0.09),
        high: clamp01(mixer.high + 0.08),
        low: clamp01(mixer.low - 0.02),
        mid: clamp01(mixer.mid - 0.01),
      });
    }
  };
  useEffect(() => {
    setMounted(true);
    void initializeAudio();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void initializeAudio();
  }, [mounted, region, mode, mixer.beatIntensity, mixer.melodyDensity, mixer.sparkleAmount, mixer.tempo, mixer.glow, mixer.low, mixer.mid, mixer.high, hour, playing]);

  const initializeAudio = async () => {
    if (audioRef.current) return audioRef.current;
    await Tone.start();
    await Tone.loaded();
    const master = new Tone.Volume(-8).toDestination();
    const panner = new Tone.Panner(0).connect(master);
    const lowEq = new Tone.Volume(0).connect(panner);
    const midEq = new Tone.Volume(0).connect(panner);
    const highEq = new Tone.Volume(0).connect(panner);
    const drumVolume = new Tone.Volume(-10).connect(lowEq);
    const stringFilter = new Tone.Filter(900, "lowpass").connect(midEq);
    const stringVolume = new Tone.Volume(-14).connect(stringFilter);
    const pianoFilter = new Tone.Filter(1800, "lowpass").connect(midEq);
    const pianoVolume = new Tone.Volume(-16).connect(pianoFilter);
    const ambienceFilter = new Tone.Filter(3200, "highpass").connect(highEq);
    const ambienceReverb = new Tone.Reverb({ decay: 2.8, wet: 0.3 }).connect(panner);
    const ambienceVolume = new Tone.Volume(-18).connect(ambienceFilter);
    ambienceFilter.connect(ambienceReverb);
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.018,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.16, sustain: 0.01, release: 0.06 },
      oscillator: { type: "sine" },
    }).connect(drumVolume);
    const hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0.01, release: 0.03 },
    }).connect(drumVolume);
    const strings = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.04, decay: 0.2, sustain: 0.35, release: 0.8 },
    }).connect(stringVolume);
    const piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0.08, release: 0.35 },
    }).connect(pianoVolume);
    const ambience = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0.01, release: 0.08 },
    }).connect(ambienceVolume);
    audioRef.current = { drums: { volume: drumVolume, kick, hat }, strings: { volume: stringVolume, synth: strings, filter: stringFilter }, piano: { volume: pianoVolume, synth: piano, filter: pianoFilter }, ambience: { volume: ambienceVolume, noise: ambience, filter: ambienceFilter, reverb: ambienceReverb }, eq: { low: lowEq, mid: midEq, high: highEq }, master, panner };
    setAudioReady(true);
    return audioRef.current;
  };
  const triggerAudioForPoint = (point: RhythmPoint, mappingState: MappingState, x: number, y: number, size: number, time?: number | string) => {
    const audio = audioRef.current;
    if (!audio) return;
    const pan = clamp01((x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 0.0001)) * 2 - 1;
    audio.panner.pan.rampTo(pan, 0.03);
    const velocity = clamp01(0.25 + size / 5 + hashNoise(x, y) * 0.2);
    const scheduledTime = typeof time === "number" ? Math.max(time, lastScheduledTimeRef.current) : Tone.now();
    lastScheduledTimeRef.current = Math.max(lastScheduledTimeRef.current, scheduledTime) + 0.001;
    const allowDrums = region === "city";
    const allowStrings = region === "coast" || region === "city";
    const allowPiano = region === "mountain" || region === "city";
    const allowAmbience = region === "city";
    if (point.type === "beat" && allowDrums) {
      const probability = clamp01(mappingState.bikePulse * (0.55 + mappingState.beatDensity * 0.85));
      if (Math.random() <= probability) audio.drums.kick.triggerAttackRelease("C1", "8n", scheduledTime, velocity * (0.6 + mappingState.bikePulse * 0.5));
      if (Math.random() < clamp01(mappingState.beatDensity * 0.55 + mappingState.hour * 0.1)) {
        audio.drums.hat.triggerAttackRelease("16n", scheduledTime + 0.01, velocity * 0.35);
      }
      audio.drums.volume.volume.rampTo(-18 + mappingState.bikePulse * 14, 0.06);
    } else if (point.type === "melody" && allowStrings) {
      const stringsNotes = ["G3", "A3", "C4", "D4", "E4", "G4", "A4"];
      const count = Math.max(1, Math.round(1 + mappingState.foodActivity * 5));
      const start = Math.floor(hashNoise(x + 2, y + 3) * stringsNotes.length);
      const seq = Array.from({ length: count }, (_, index) => stringsNotes[(start + index) % stringsNotes.length]);
      audio.strings.filter.frequency.rampTo(700 + mappingState.foodActivity * 1800, 0.08);
      audio.strings.volume.volume.rampTo(-24 + mappingState.foodActivity * 14, 0.08);
      audio.strings.synth.triggerAttackRelease(seq, mappingState.sceneState === "night" ? "2n" : "4n", scheduledTime, velocity * 0.72);
      if (allowPiano) {
        const pianoNotes = ["C4", "E4", "G4", "B4", "D5", "E5"];
        const pianoCount = Math.max(1, Math.round(1 + mappingState.foodActivity * 3));
        const pianoSeq = Array.from({ length: pianoCount }, (_, index) => pianoNotes[(start + index * 2) % pianoNotes.length]);
        audio.piano.filter.frequency.rampTo(1200 + mappingState.foodActivity * 1400, 0.08);
        audio.piano.volume.volume.rampTo(-26 + mappingState.foodActivity * 12, 0.08);
        audio.piano.synth.triggerAttackRelease(pianoSeq, mappingState.foodActivity > 0.65 ? "8n" : "4n", scheduledTime + 0.02, velocity * 0.8);
      }
    } else if (allowAmbience) {
      const freq = 1800 + mappingState.entertainmentActivity * 4200;
      audio.ambience.filter.frequency.rampTo(freq, 0.04);
      audio.ambience.volume.volume.rampTo(-24 + mappingState.entertainmentActivity * 16, 0.04);
      audio.ambience.reverb.wet.rampTo(0.1 + mappingState.entertainmentActivity * 0.45, 0.05);
      audio.ambience.noise.triggerAttackRelease("16n", scheduledTime, velocity * (0.5 + mappingState.entertainmentActivity * 0.6));
    }
  };
  useEffect(() => {
    void initializeAudio();
    return () => {
      audioRef.current?.drums.kick.dispose();
      audioRef.current?.drums.hat.dispose();
      audioRef.current?.strings.synth.dispose();
      audioRef.current?.piano.synth.dispose();
      audioRef.current?.ambience.noise.dispose();
      audioRef.current?.ambience.reverb.dispose();
      audioRef.current?.drums.volume.dispose();
      audioRef.current?.strings.volume.dispose();
      audioRef.current?.strings.filter.dispose();
      audioRef.current?.piano.volume.dispose();
      audioRef.current?.piano.filter.dispose();
      audioRef.current?.ambience.volume.dispose();
      audioRef.current?.ambience.filter.dispose();
      audioRef.current?.eq.low.dispose();
      audioRef.current?.eq.mid.dispose();
      audioRef.current?.eq.high.dispose();
      audioRef.current?.master.dispose();
      audioRef.current?.panner.dispose();
      audioRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!playing) {
      Tone.Transport.pause();
      return;
    }
    Tone.Transport.bpm.value = bpm;
    const currentMapping = buildMapping({
      hour,
      bike_pulse: clamp01(mixer.beatIntensity * (region === "coast" ? 1.05 : region === "mountain" ? 0.86 : 0.95)),
      food_activity: clamp01(mixer.melodyDensity * (region === "city" ? 1.08 : 0.92)),
      entertainment_activity: clamp01(mixer.sparkleAmount * (region === "city" ? 1.08 : 0.9)),
    });
    lastScheduledTimeRef.current = Math.max(lastScheduledTimeRef.current, Tone.now());
    const loop = Tone.Transport.scheduleRepeat((time) => {
      const audio = audioRef.current;
      if (!audio) return;
      const baseTime = typeof time === "number" ? time : Tone.now();
      const eventTime = Math.max(baseTime, lastScheduledTimeRef.current);
      lastScheduledTimeRef.current = eventTime + 0.001;
      const beatRate = currentMapping.sceneState === "morning" ? "8n" : currentMapping.sceneState === "night" ? "2n" : "4n";
      if (region === "city") {
        audio.drums.kick.triggerAttackRelease("C1", beatRate, eventTime, 0.6 + currentMapping.beatDensity * 0.2 + mixer.beatIntensity * 0.2);
        if (Math.random() < clamp01(currentMapping.beatDensity * (0.35 + mixer.beatIntensity * 0.55))) {
          audio.drums.hat.triggerAttackRelease("16n", eventTime + 0.005, 0.18 + currentMapping.beatDensity * 0.2);
        }
      }
      if (region === "coast" || region === "city") {
        const stringCount = Math.max(1, Math.round(1 + currentMapping.melodyDensity * 6 + mixer.melodyDensity * 3));
        const stringNotes = ["G3", "A3", "C4", "D4", "E4", "G4", "A4"];
        const stringSeed = Math.floor(hashNoise(currentMapping.hour + 2, currentMapping.foodActivity + 3) * stringNotes.length);
        const stringSeq = Array.from({ length: stringCount }, (_, index) => transposeNote(stringNotes[(stringSeed + index) % stringNotes.length], cuePitchRef.current));
        audio.strings.synth.triggerAttackRelease(stringSeq, currentMapping.sceneState === "night" ? "2n" : "4n", eventTime, 0.28 + currentMapping.melodyDensity * 0.28 + mixer.mid * 0.14);
      }
      if (region === "mountain" || region === "city") {
        const pianoCount = Math.max(1, Math.round(1 + currentMapping.melodyDensity * 3));
        const pianoNotes = ["C4", "E4", "G4", "B4", "D5", "E5"];
        const pianoSeed = Math.floor(hashNoise(currentMapping.hour + 11, currentMapping.foodActivity + 7) * pianoNotes.length);
        const pianoSeq = Array.from({ length: pianoCount }, (_, index) => transposeNote(pianoNotes[(pianoSeed + index * 2) % pianoNotes.length], cuePitchRef.current));
        audio.piano.synth.triggerAttackRelease(pianoSeq, currentMapping.foodActivity > 0.55 ? "8n" : "4n", eventTime + 0.02, 0.22 + currentMapping.melodyDensity * 0.2 + mixer.mid * 0.12);
      }
      if (region === "city" && Math.random() < clamp01(currentMapping.sparkleDensity * (0.45 + mixer.sparkleAmount * 0.75))) {
        audio.ambience.noise.triggerAttackRelease("16n", eventTime, 0.18 + currentMapping.sparkleDensity * 0.16 + mixer.high * 0.1);
      }
      const selected = basePoints.filter((point) => {
        const weight = point.type === "beat" ? currentMapping.bikePulse : point.type === "melody" ? currentMapping.foodActivity : currentMapping.entertainmentActivity;
        return Math.random() < clamp01(weight * 0.35 + mapping.tempo * 0.15 + (point.type === "melody" ? mixer.melodyDensity * 0.2 : 0) + (point.type === "sparkle" ? mixer.sparkleAmount * 0.15 : 0));
      }).slice(0, Math.max(10, Math.round(6 + mixer.melodyDensity * 12)));
      selected.forEach((point, index) => {
        const normX = (point.x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 0.0001);
        const normY = (point.y - bounds.minY) / Math.max(bounds.maxY - bounds.minY, 0.0001);
        const scheduledTime = eventTime + index * 0.01;
        triggerQueueRef.current.push({ type: point.type, x: normX, y: normY, size: point.size, velocity: 0.4 + point.opacity * 0.6 });
        pulseRef.current[`${point.type}-${point.x}-${point.y}`] = 1;
        triggerAudioForPoint(point, currentMapping, point.x, point.y, point.size, scheduledTime);
      });
    }, currentMapping.sceneState === "morning" ? "8n" : "4n");
    if (Tone.Transport.state !== "started" && transportStartedRef.current) Tone.Transport.start();
    transportStartedRef.current = true;
    return () => {
      Tone.Transport.clear(loop);
    };
  }, [basePoints, bpm, bounds.maxX, bounds.maxY, bounds.minX, bounds.minY, hour, mapping.tempo, mixer.beatIntensity, mixer.melodyDensity, mixer.sparkleAmount, playing, region]);
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.drums.volume.volume.rampTo(-18 + mapping.bikePulse * 12, 0.12);
    audioRef.current.strings.volume.volume.rampTo(-20 + mapping.foodActivity * 10, 0.12);
    audioRef.current.piano.volume.volume.rampTo(-21 + mapping.foodActivity * 8, 0.12);
    audioRef.current.ambience.volume.volume.rampTo(-24 + mapping.entertainmentActivity * 16, 0.12);
    audioRef.current.strings.filter.frequency.rampTo(600 + mapping.foodActivity * 2200, 0.12);
    audioRef.current.piano.filter.frequency.rampTo(1200 + mapping.foodActivity * 1400, 0.12);
    audioRef.current.ambience.filter.frequency.rampTo(1800 + mapping.entertainmentActivity * 4500, 0.12);
    audioRef.current.ambience.reverb.wet.rampTo(0.08 + mapping.entertainmentActivity * 0.5, 0.12);
    Tone.Transport.bpm.rampTo(hourToTempo(hour), 0.18);
  }, [hour, mapping]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setHour((value) => (value + 1) % 24), 3800);
    return () => window.clearInterval(id);
  }, [playing]);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const beatGain = clamp01(0.25 + mixer.beatIntensity * 0.75 + mixer.low * 0.2);
    const stringGain = clamp01(0.25 + mixer.melodyDensity * 0.75 + mixer.mid * 0.2);
    const pianoGain = clamp01(0.2 + mixer.melodyDensity * 0.55 + mixer.mid * 0.25);
    const ambienceGain = clamp01(0.25 + mixer.sparkleAmount * 0.75 + mixer.high * 0.2);
    audio.drums.volume.volume.rampTo(-28 + beatGain * 18 + mapping.bikePulse * 6, 0.04);
    audio.strings.volume.volume.rampTo(-28 + stringGain * 18 + mapping.foodActivity * 6, 0.04);
    audio.piano.volume.volume.rampTo(-30 + pianoGain * 18 + mapping.foodActivity * 5, 0.04);
    audio.ambience.volume.volume.rampTo(-28 + ambienceGain * 18 + mapping.entertainmentActivity * 6, 0.04);
    audio.strings.filter.frequency.rampTo(500 + mixer.mid * 1800 + mapping.foodActivity * 1600, 0.04);
    audio.piano.filter.frequency.rampTo(1200 + mixer.mid * 1200 + mapping.foodActivity * 1200, 0.04);
    audio.ambience.filter.frequency.rampTo(1600 + mixer.high * 1600 + mapping.entertainmentActivity * 2600, 0.04);
    audio.ambience.reverb.wet.rampTo(clamp01(0.05 + mixer.glow * 0.8), 0.04);
    Tone.Transport.bpm.value = hourToTempo(hour) + mixer.tempo * 24;
  }, [hour, mapping.bikePulse, mapping.entertainmentActivity, mapping.foodActivity, mixer.beatIntensity, mixer.glow, mixer.high, mixer.mid, mixer.melodyDensity, mixer.sparkleAmount, mixer.tempo, mixer.low]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resizeCanvas = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.floor(width * dpr);
      const pixelHeight = Math.floor(height * dpr);
      if (canvasSizeRef.current.width === pixelWidth && canvasSizeRef.current.height === pixelHeight && canvasSizeRef.current.dpr === dpr) return;
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvasSizeRef.current = { width: pixelWidth, height: pixelHeight, dpr };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    const draw = () => {
      resizeCanvas();
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = canvasSizeRef.current.dpr || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#040507";
      ctx.fillRect(0, 0, width, height);
      const timeDensity = clamp01(0.35 + mapping.hour * 0.65);
      const timeGlow = clamp01(0.35 + mapping.hour * 0.55);
      const timeSpeed = clamp01(0.55 + mapping.hour * 0.45);
      const beat = clamp01(mapping.bikePulse * mixer.beatIntensity * (0.65 + timeDensity * 0.45) * (0.55 + mixer.low * 0.9));
      const strings = clamp01(mapping.foodActivity * mixer.melodyDensity * (0.62 + timeDensity * 0.42) * (0.55 + mixer.mid * 0.9));
      const piano = clamp01(mapping.foodActivity * mixer.melodyDensity * (0.58 + timeDensity * 0.36) * (0.5 + mixer.mid * 0.85));
      const ambience = clamp01(mapping.entertainmentActivity * mixer.sparkleAmount * (0.65 + timeDensity * 0.42) * (0.55 + mixer.high * 0.9));
      const tempo = clamp01((mixer.tempo * 0.45 + timeSpeed * 0.55));
      const glow = clamp01((mixer.glow * 0.55 + timeGlow * 0.45));
      audioRef.current?.drums.volume.volume.rampTo(-22 + beat * 16, 0.04);
      audioRef.current?.strings.volume.volume.rampTo(-24 + strings * 16, 0.04);
      audioRef.current?.piano.volume.volume.rampTo(-25 + piano * 14, 0.04);
      audioRef.current?.ambience.volume.volume.rampTo(-28 + ambience * 18, 0.04);
      audioRef.current?.ambience.reverb.wet.rampTo(clamp01(0.04 + glow * 0.8), 0.04);
      audioRef.current?.drums.volume.volume.rampTo(audioRef.current.drums.volume.volume.value + (mixer.low - 0.5) * 1.8, 0.04);
      audioRef.current?.strings.volume.volume.rampTo(audioRef.current.strings.volume.volume.value + (mixer.mid - 0.5) * 1.8, 0.04);
      audioRef.current?.piano.volume.volume.rampTo(audioRef.current.piano.volume.volume.value + (mixer.mid - 0.5) * 1.2, 0.04);
      audioRef.current?.ambience.volume.volume.rampTo(audioRef.current.ambience.volume.volume.value + (mixer.high - 0.5) * 1.8, 0.04);
      const beatPulse = 0.5 + 0.5 * Math.sin(frameCounterRef.current * 0.018 * tempo);
      const stringWave = 0.5 + 0.5 * Math.sin(frameCounterRef.current * 0.012 * tempo + 1.7);
      const pianoWave = 0.5 + 0.5 * Math.sin(frameCounterRef.current * 0.021 * tempo + 0.9);
      const ambienceWave = 0.5 + 0.5 * Math.sin(frameCounterRef.current * 0.04 * (1.1 + tempo) + 2.6);
      if (outlinePaths.length) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1.4;
        ctx.shadowColor = "rgba(255,255,255,0.05)";
        ctx.shadowBlur = 4;
        for (const path of outlinePaths) ctx.stroke(new Path2D(path));
        ctx.restore();
      }
      const regionMultiplier = region === "coast" ? 1 : region === "mountain" ? 0.74 : 0.66;
      const activeCount = Math.max(60, Math.floor(basePoints.length * clamp01(0.25 + mapping.bikePulse * 0.16 + mapping.foodActivity * 0.22 + mapping.entertainmentActivity * 0.2 + mixer.melodyDensity * 0.18 + mixer.sparkleAmount * 0.1) * regionMultiplier));
      const flashBoost = triggerFlash ? 1.12 : 1;
      const activePoints = basePoints.slice(0, activeCount);
      const blueBudget = Math.max(10, Math.floor(activePoints.length * clamp01(0.08 + mapping.foodActivity * 0.3 + mixer.melodyDensity * 0.48 + strings * 0.2)));
      let renderedMelodies = 0;
      for (const point of activePoints) {
        const px = 120 + ((point.x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 0.0001)) * 760;
        const py = 110 + (1 - (point.y - bounds.minY) / Math.max(bounds.maxY - bounds.minY, 0.0001)) * 680;
        const t = frameCounterRef.current * 0.015 * tempo + point.seed;
        const pulseKey = `${point.type}-${point.x}-${point.y}`;
        const pulse = pulseRef.current[pulseKey] ?? 0;
        pulseRef.current[pulseKey] = Math.max(0, pulse - 0.03);
        if (point.type === "beat") {
          const size = point.size * (0.9 + beatPulse * (0.45 + beat * 0.55)) * (1 + pulse * 0.55) * flashBoost;
          ctx.save();
          ctx.shadowColor = "rgba(250,204,21,0.34)";
          ctx.shadowBlur = 5 + glow * 10 * (0.35 + beat);
          ctx.fillStyle = `rgba(250,204,21,${point.opacity * (0.48 + beat * 0.95)})`;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (point.type === "melody") {
          if (renderedMelodies >= blueBudget) continue;
          renderedMelodies += 1;
          const driftX = Math.sin(t * 0.55) * (0.8 + stringWave * 2.8 * tempo) * (0.85 + mapping.melodyDensity * 0.4);
          const driftY = Math.cos(t * 0.68) * (0.8 + stringWave * 2.8 * tempo) * (0.85 + mapping.melodyDensity * 0.4);
          const size = point.size * (0.98 + strings * 0.34) * (1 + pulse * 0.35);
          ctx.save();
          ctx.shadowColor = "rgba(96,165,250,0.26)";
          ctx.shadowBlur = 4 + strings * 8 + glow * 5;
          ctx.fillStyle = `rgba(96,165,250,${point.opacity * (0.42 + strings * 0.9)})`;
          ctx.beginPath();
          ctx.arc(px + driftX, py + driftY, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          const flicker = 0.45 + 0.55 * Math.sin(t * (3.8 + ambience * 4.8) + Math.sin(t * 1.3));
          const size = Math.max(0.6, point.size * 0.72 * (0.72 + flicker * 0.82) * (1 + pulse * 0.6));
          ctx.save();
          ctx.shadowColor = "rgba(255,255,255,0.42)";
          ctx.shadowBlur = 2 + ambienceWave * 6 + glow * 7;
          ctx.fillStyle = `rgba(255,255,255,${Math.min(1, point.opacity * (0.48 + flicker * 0.95) * (0.72 + ambience * 0.78))})`;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      frameCounterRef.current += 1 + tempo * 0.8;
      animationFrameRef.current = window.requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("resize", onResize);
      if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, [basePoints, bounds.maxX, bounds.maxY, bounds.minX, bounds.minY, hour, mapping, mixer.beatIntensity, mixer.glow, mixer.melodyDensity, mixer.sparkleAmount, mixer.tempo, outlinePaths, region, triggerFlash]);
  return (
    <section className="h-screen min-h-screen overflow-hidden bg-[#040507] text-white">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-white/8 px-5 text-[10px] uppercase tracking-[0.45em] text-white/40 md:px-8">
          <span>Urban Rhythm Console</span>
          <div className="flex items-center gap-3"><span className="rounded-full border border-white/10 bg-black/35 px-2 py-1">Tone {audioReady ? "ready" : "loading"}</span><HourTag hour={hour} /></div>
        </header>
        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4 md:p-6">
          <aside className="flex w-[18rem] shrink-0 flex-col rounded-none border-r border-white/10 bg-[#0f1114] overflow-hidden">
            <div className="border-b border-white/10 px-4 py-3 text-[10px] uppercase tracking-[0.45em] text-white/45">transport</div>
            <div className="grid grid-cols-6 gap-1 border-b border-white/10 p-4">
              {Array.from({ length: 24 }, (_, index) => index).map((slot) => (<button key={slot} type="button" onClick={() => setHour(slot)} className={`h-7 border text-[9px] transition ${hour === slot ? "border-cyan-300/70 bg-cyan-300/20 text-white" : "border-white/10 bg-white/[0.03] text-white/35 hover:bg-white/[0.06]"}`} aria-label={`Set hour ${slot}`}><span className="sr-only">{slot}</span></button>))}
            </div>
            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.4em] text-white/35"><span>hour</span><button type="button" onClick={async () => { await initializeAudio(); const isStarted = Tone.Transport.state === "started"; if (isStarted) { Tone.Transport.pause(); } else { Tone.Transport.start(); } setPlaying((value) => !value); applyInteractionAudio({ tempo: clamp01(mixer.tempo + 0.02), glow: clamp01(mixer.glow + 0.02) }); }} className="text-white/70">{playing ? "pause" : "play"}</button></div>
              <div className="mt-2 flex items-end justify-between"><div className="text-5xl font-semibold tracking-[-0.08em] text-white">{hour}</div><div className="text-[10px] uppercase tracking-[0.35em] text-emerald-300">live</div></div>
              <div className="mt-3 text-[10px] uppercase tracking-[0.3em] text-white/35">tempo {bpm} bpm</div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-4">
              <TriggerPad active={region === "coast"} label="coast" accent="from-white/10 to-white/5" onClick={() => setRegionWithAudio("coast")} compact />
              <TriggerPad active={region === "mountain"} label="mountain" accent="from-white/10 to-white/5" onClick={() => setRegionWithAudio("mountain")} compact />
              <TriggerPad active={region === "city"} label="city" accent="from-white/10 to-white/5" onClick={() => setRegionWithAudio("city")} compact />
              <TriggerPad active={false} label="latch" accent="from-white/10 to-white/5" onClick={() => { setTriggerFlash(region); if (region === "coast") { applyInteractionAudio({ melodyDensity: clamp01(mixer.melodyDensity + 0.02), beatIntensity: clamp01(mixer.beatIntensity - 0.02), sparkleAmount: clamp01(mixer.sparkleAmount - 0.05), high: clamp01(mixer.high - 0.04) }); } else if (region === "mountain") { applyInteractionAudio({ beatIntensity: clamp01(mixer.beatIntensity - 0.05), sparkleAmount: clamp01(mixer.sparkleAmount - 0.05), low: clamp01(mixer.low - 0.03), high: clamp01(mixer.high - 0.03) }); } else { applyInteractionAudio({ sparkleAmount: clamp01(mixer.sparkleAmount + 0.08), high: clamp01(mixer.high + 0.05), glow: clamp01(mixer.glow + 0.06) }); } }} compact />
            </div>
            <div className="grid grid-cols-3 gap-2 p-4 text-[9px] uppercase tracking-[0.34em] text-white/45">
              <TriggerPad active={mode === "beat"} label="beat" accent="from-white/10 to-white/5" onClick={() => setModeWithAudio("beat")} compact />
              <TriggerPad active={mode === "melody"} label="tone" accent="from-white/10 to-white/5" onClick={() => setModeWithAudio("melody")} compact />
              <TriggerPad active={mode === "sparkle"} label="spark" accent="from-white/10 to-white/5" onClick={() => setModeWithAudio("sparkle")} compact />
            </div>
          </aside>
          <main className="relative flex min-h-0 min-w-0 flex-1 items-stretch overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/20">
            <canvas ref={canvasRef} className="h-full w-full" />
            <div className="pointer-events-none absolute left-5 top-5 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-white/50">Xiamen outline / live particles</div>
            <div className="pointer-events-none absolute right-5 top-5 grid gap-2 text-right text-[10px] uppercase tracking-[0.34em] text-white/58"><div className="rounded-full border border-white/10 bg-black/35 px-3 py-1">time · {String(hour).padStart(2, "0")}:00</div><div className="rounded-full border border-white/10 bg-black/35 px-3 py-1">region · {region}</div><div className="rounded-full border border-white/10 bg-black/35 px-3 py-1">mode · {activeMode}</div></div>
            <div className="pointer-events-none absolute bottom-5 left-5 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm leading-6 text-white/72 backdrop-blur-sm">Time shapes speed, region shapes focus, and the mixer shapes the point field in real time.</div>
          </main>
          <aside className="flex w-[20rem] shrink-0 flex-col rounded-none border-l border-white/10 bg-[#121419] overflow-hidden">
            <div className="border-b border-white/10 px-4 py-3 text-[10px] uppercase tracking-[0.45em] text-white/45">deck A</div>
            <div className="grid gap-3 p-4">
              <button type="button" onClick={() => { setActiveKnob("tempo"); setTriggerFlash("mixer"); flashKnob("tempo", 0.06); void cueAccent(); applyInteractionAudio({ tempo: clamp01(mixer.tempo + 0.14), glow: clamp01(mixer.glow + 0.06), mid: clamp01(mixer.mid + 0.04), low: clamp01(mixer.low + 0.03) }); }} className="relative aspect-square w-full rounded-full border border-white/10 bg-black/90" aria-label="scratch jog wheel"><div className="absolute inset-[10%] rounded-full border border-white/12" /><div className="absolute inset-[24%] rounded-full border border-white/8 bg-black" /><div className="absolute left-1/2 top-1/2 h-[34%] w-[2px] -translate-x-1/2 -translate-y-full bg-white" style={{ transform: `translate(-50%, -100%) rotate(${20 + mixer.tempo * 300 + Math.max(0, cuePitchRef.current) * 12 - cueTick * 0.5}deg)`, transformOrigin: "50% 100%" }} /><div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.45em] text-white/40">scratch</div></button>
              <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <TriggerPad active={activeKnob === "tempo"} label="cue" accent="from-white/10 to-white/5" onClick={() => { flashKnob("tempo", 0.12); void cueAccent(); applyInteractionAudio({ tempo: clamp01(mixer.tempo + 0.1), glow: clamp01(mixer.glow + 0.05), beatIntensity: clamp01(mixer.beatIntensity + 0.01) }); }} compact />
                <TriggerPad active={triggerFlash === "mixer"} label="fx" accent="from-white/10 to-white/5" onClick={() => { void fxAccent(); }} compact />
                <TriggerPad active={mode === "beat"} label="beat" accent="from-white/10 to-white/5" onClick={() => { void beatAccent(); }} compact />
                <TriggerPad active={mode === "melody"} label="tone" accent="from-white/10 to-white/5" onClick={() => { void toneAccent(); }} compact />
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
                <TriggerPad active={region === "coast"} label="coast" accent="from-white/10 to-white/5" onClick={() => { setRegion("coast"); setTriggerFlash("coast"); }} compact />
                <TriggerPad active={region === "mountain"} label="mountain" accent="from-white/10 to-white/5" onClick={() => { setRegion("mountain"); setTriggerFlash("mountain"); }} compact />
                <TriggerPad active={region === "city"} label="city" accent="from-white/10 to-white/5" onClick={() => { setRegion("city"); setTriggerFlash("city"); }} compact />
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[10px] uppercase tracking-[0.34em] text-white/55"><div className="border border-white/10 bg-black/40 px-3 py-2">beat {Math.round(mixer.beatIntensity * 100)}</div><div className="border border-white/10 bg-black/40 px-3 py-2">melody {Math.round(mixer.melodyDensity * 100)}</div><div className="border border-white/10 bg-black/40 px-3 py-2">spark {Math.round(mixer.sparkleAmount * 100)}</div><div className="border border-white/10 bg-black/40 px-3 py-2">glow {Math.round(mixer.glow * 100)}</div></div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
function TriggerPad({ label, active, accent, compact = false, wide = false, onClick }: { label: string; active: boolean; accent: string; compact?: boolean; wide?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`group relative overflow-hidden rounded-2xl border px-3 py-3 text-center text-[10px] uppercase tracking-[0.34em] transition ${compact ? "py-2" : "py-3"} ${wide ? "w-full" : ""} ${active ? "border-white/30 bg-white/12 text-white" : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"}`}><span className={`absolute inset-0 bg-gradient-to-br ${accent} transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`} /><span className="relative z-10">{label}</span></button>;
}
function SpinDisc({ title, value, accent, marker, onTap }: { title: string; value: number; accent: string; marker: string; onTap: () => void }) {
  const angle = 35 + value * 290;
  return <button type="button" onClick={onTap} className="relative aspect-square w-full rounded-full border border-white/12 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(255,255,255,0.01)_42%,rgba(0,0,0,0.72)_72%)] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"><div className={`absolute inset-0 rounded-full bg-gradient-to-br ${accent} opacity-70 blur-[10px]`} /><div className="relative z-10 flex h-full flex-col justify-between"><div className="flex items-center justify-between text-[9px] uppercase tracking-[0.42em] text-white/40"><span>{title}</span><span>{Math.round(value * 100)}</span></div><div className="relative mx-auto flex aspect-square w-[72%] items-center justify-center rounded-full border border-white/10 bg-black/45"><div className="absolute inset-[18%] rounded-full border border-white/10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_58%)]" /><div className="absolute inset-[11%] rounded-full border border-white/5" /><div className="absolute left-1/2 top-1/2 h-[38%] w-[1.5px] -translate-x-1/2 -translate-y-full rounded-full bg-white/80 shadow-[0_0_16px_rgba(255,255,255,0.45)]" style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)`, transformOrigin: "50% 100%" }} /><div className="absolute inset-0 rounded-full ring-1 ring-white/5" /><div className="absolute inset-4 rounded-full border border-white/8" /><div className="absolute bottom-2 text-[9px] uppercase tracking-[0.45em] text-white/25">{marker}</div></div></div></button>;
}
function MiniDial({ label, value, accent, onTap }: { label: string; value: number; accent: "amber" | "cyan" | "white" | "fuchsia"; onTap: () => void }) {
  const accentMap = { amber: "from-amber-300/30 to-amber-300/6", cyan: "from-cyan-300/30 to-cyan-300/6", white: "from-white/25 to-white/6", fuchsia: "from-fuchsia-300/30 to-fuchsia-300/6" } as const;
  const angle = 40 + value * 280;
  return <button type="button" onClick={onTap} className="relative overflow-hidden rounded-[1rem] border border-white/10 bg-black/35 p-2 text-left transition hover:border-white/20"><div className={`absolute inset-0 bg-gradient-to-br ${accentMap[accent]} opacity-70`} /><div className="relative z-10 flex items-center justify-between gap-2"><div><div className="text-[9px] uppercase tracking-[0.42em] text-white/45">{label}</div><div className="mt-1 text-xs font-medium text-white">{Math.round(value * 100)}</div></div><div className="relative h-10 w-10 rounded-full border border-white/12 bg-black/45"><div className="absolute inset-2 rounded-full border border-white/8" /><div className="absolute left-1/2 top-1/2 h-[38%] w-[1.5px] -translate-x-1/2 -translate-y-full rounded-full bg-white/85 shadow-[0_0_12px_rgba(255,255,255,0.35)]" style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)`, transformOrigin: "50% 100%" }} /></div></div></button>;
}

