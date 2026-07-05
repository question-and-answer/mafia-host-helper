"use client";

import { useRef, useState } from "react";

export function WhiteNoisePlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const startNoise = async () => {
    stopNoise();

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const bufferSize = audioContext.sampleRate * 2;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);

    const chunkSize = 16_384;
    const randomValues = new Uint32Array(chunkSize);

    for (let offset = 0; offset < bufferSize; offset += chunkSize) {
      const length = Math.min(chunkSize, bufferSize - offset);
      crypto.getRandomValues(randomValues.subarray(0, length));

      for (let i = 0; i < length; i += 1) {
        output[offset + i] = randomValues[i] / 2147483648 - 1;
      }
    }

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    gain.gain.value = 0.18;
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    gain.connect(audioContext.destination);
    source.start();

    audioContextRef.current = audioContext;
    sourceRef.current = source;
    setIsPlaying(true);
  };

  const stopNoise = () => {
    try {
      sourceRef.current?.stop();
    } catch {
      // The source may already be stopped.
    }
    sourceRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setIsPlaying(false);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={startNoise}
        className="min-h-14 w-full rounded-lg bg-zinc-950 px-5 py-4 text-lg font-black text-white shadow-sm active:scale-[0.99]"
      >
        백색소음 재생
      </button>
      <button
        type="button"
        onClick={stopNoise}
        className="min-h-14 w-full rounded-lg border border-zinc-300 bg-white px-5 py-4 text-lg font-black text-zinc-950 active:scale-[0.99]"
      >
        정지
      </button>
      <p className="text-center text-sm text-zinc-500">
        {isPlaying ? "백색소음이 재생 중입니다." : "자동 재생은 하지 않습니다. 직접 눌러 주세요."}
      </p>
    </div>
  );
}
