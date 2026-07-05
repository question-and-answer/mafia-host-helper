"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type NoiseMode = "white" | "pink" | "brown" | "rain" | "cafe";

const NOISE_OPTIONS: { id: NoiseMode; label: string; description: string }[] = [
  { id: "white", label: "백색소음", description: "고른 샤아 소리" },
  { id: "pink", label: "핑크소음", description: "조금 부드러운 소리" },
  { id: "brown", label: "브라운소음", description: "낮고 묵직한 소리" },
  { id: "rain", label: "빗소리", description: "잔잔한 빗소리 느낌" },
  { id: "cafe", label: "카페소음", description: "작게 웅성거리는 느낌" },
];

type WhiteNoisePlayerProps = {
  title?: string;
  helperText?: string;
  armStorageKey?: string;
  autoStartKey?: string;
};

export function WhiteNoisePlayer({
  title = "소음 재생",
  helperText = "자동 재생은 처음부터 허용되지 않습니다. 먼저 준비하거나 직접 재생하세요.",
  armStorageKey,
  autoStartKey,
}: WhiteNoisePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isArmed, setIsArmed] = useState(false);
  const [mode, setMode] = useState<NoiseMode>("white");
  const [volume, setVolume] = useState(0.18);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const lastAutoStartKeyRef = useRef<string | undefined>(undefined);

  const stopNoise = useCallback((closeContext = true) => {
    try {
      sourceRef.current?.stop();
    } catch {
      // The source may already be stopped.
    }
    sourceRef.current = null;
    gainRef.current = null;
    if (closeContext) {
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    } else {
      void audioContextRef.current?.suspend();
    }
    setIsPlaying(false);
  }, []);

  const startNoise = useCallback(async () => {
    try {
      sourceRef.current?.stop();
    } catch {
      // The source may already be stopped.
    }
    sourceRef.current = null;
    gainRef.current = null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const existingContext = audioContextRef.current;
    const audioContext =
      existingContext && existingContext.state !== "closed" ? existingContext : new AudioContextClass();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    const bufferSize = audioContext.sampleRate * 3;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);

    fillNoiseBuffer(output, mode, audioContext.sampleRate);

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    gain.connect(audioContext.destination);
    source.start();

    audioContextRef.current = audioContext;
    sourceRef.current = source;
    gainRef.current = gain;
    setIsPlaying(true);
  }, [mode, volume]);

  useEffect(() => {
    if (!armStorageKey || typeof window === "undefined") return;
    setIsArmed(window.localStorage.getItem(armStorageKey) === "true");
  }, [armStorageKey]);

  useEffect(() => {
    if (!autoStartKey || !isArmed || isPlaying) return;
    if (lastAutoStartKeyRef.current === autoStartKey) return;

    lastAutoStartKeyRef.current = autoStartKey;
    void startNoise();
  }, [autoStartKey, isArmed, isPlaying, startNoise]);

  const armNoise = async () => {
    setIsArmed(true);
    if (armStorageKey) {
      window.localStorage.setItem(armStorageKey, "true");
    }
    await startNoise();
    window.setTimeout(() => stopNoise(false), 250);
  };

  const updateVolume = (nextVolume: number) => {
    setVolume(nextVolume);
    if (gainRef.current) {
      gainRef.current.gain.value = nextVolume;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-zinc-950">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{helperText}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {NOISE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setMode(option.id);
              if (isPlaying) {
                window.setTimeout(() => void startNoise(), 0);
              }
            }}
            className={`min-h-14 rounded-lg border px-3 py-2 text-left ${
              mode === option.id
                ? "border-zinc-950 bg-zinc-950 text-white"
                : "border-zinc-300 bg-white text-zinc-950"
            }`}
          >
            <span className="block font-black">{option.label}</span>
            <span className={mode === option.id ? "text-xs text-zinc-300" : "text-xs text-zinc-500"}>
              {option.description}
            </span>
          </button>
        ))}
      </div>

      <label className="block rounded-lg border border-zinc-200 bg-white p-3">
        <span className="text-sm font-bold text-zinc-700">볼륨</span>
        <input
          type="range"
          min="0.04"
          max="0.5"
          step="0.01"
          value={volume}
          onChange={(event) => updateVolume(Number(event.target.value))}
          className="mt-2 w-full"
        />
      </label>

      {armStorageKey ? (
        <button
          type="button"
          onClick={armNoise}
          className={`min-h-14 w-full rounded-lg px-5 py-4 text-lg font-black shadow-sm active:scale-[0.99] ${
            isArmed ? "bg-emerald-700 text-white" : "bg-indigo-800 text-white"
          }`}
        >
          {isArmed ? "소음 준비 완료" : "소음 준비"}
        </button>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={startNoise}
          className="min-h-14 rounded-lg bg-zinc-950 px-5 py-4 text-lg font-black text-white shadow-sm active:scale-[0.99]"
        >
          재생
        </button>
        <button
          type="button"
          onClick={() => stopNoise()}
          className="min-h-14 rounded-lg border border-zinc-300 bg-white px-5 py-4 text-lg font-black text-zinc-950 active:scale-[0.99]"
        >
          정지
        </button>
      </div>

      <p className="text-center text-sm text-zinc-500">
        {isPlaying
          ? `${NOISE_OPTIONS.find((option) => option.id === mode)?.label} 재생 중입니다.`
          : isArmed
            ? "사회자가 밤을 시작하면 자동 재생을 시도합니다."
            : "정지 상태입니다."}
      </p>
    </div>
  );
}

function fillNoiseBuffer(output: Float32Array, mode: NoiseMode, sampleRate: number) {
  const random = createRandomStream(output.length);
  let pinkB0 = 0;
  let pinkB1 = 0;
  let pinkB2 = 0;
  let brown = 0;

  for (let i = 0; i < output.length; i += 1) {
    const white = random[i];

    if (mode === "white") {
      output[i] = white;
    } else if (mode === "pink") {
      pinkB0 = 0.99765 * pinkB0 + white * 0.099046;
      pinkB1 = 0.963 * pinkB1 + white * 0.2965164;
      pinkB2 = 0.57 * pinkB2 + white * 1.0526913;
      output[i] = (pinkB0 + pinkB1 + pinkB2 + white * 0.1848) * 0.22;
    } else if (mode === "brown") {
      brown = (brown + 0.02 * white) / 1.02;
      output[i] = brown * 3.5;
    } else if (mode === "rain") {
      const drip = Math.sin((2 * Math.PI * i) / (sampleRate * 0.037)) * 0.025;
      output[i] = white * 0.28 + drip * (random[i] > 0.992 ? 1 : 0);
    } else {
      const lowWave = Math.sin((2 * Math.PI * i) / (sampleRate * 0.7)) * 0.08;
      const chatter = Math.sin((2 * Math.PI * i) / (sampleRate * 0.031)) * random[i] * 0.12;
      output[i] = white * 0.16 + lowWave + chatter;
    }
  }
}

function createRandomStream(length: number) {
  const output = new Float32Array(length);
  const chunkSize = 16_384;
  const randomValues = new Uint32Array(chunkSize);

  for (let offset = 0; offset < length; offset += chunkSize) {
    const count = Math.min(chunkSize, length - offset);
    crypto.getRandomValues(randomValues.subarray(0, count));

    for (let i = 0; i < count; i += 1) {
      output[offset + i] = randomValues[i] / 2147483648 - 1;
    }
  }

  return output;
}
