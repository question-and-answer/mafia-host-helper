"use client";

import { useEffect, useState } from "react";
import { formatSeconds, getRemainingSeconds } from "@/lib/timer";

type DiscussionTimerProps = {
  seconds: number;
  startedAt: string | null;
  label?: string;
};

export function DiscussionTimer({ seconds, startedAt, label = "토론 타이머" }: DiscussionTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    getRemainingSeconds(seconds, startedAt),
  );

  useEffect(() => {
    const update = () => setRemainingSeconds(getRemainingSeconds(seconds, startedAt));
    update();
    const intervalId = window.setInterval(update, 1000);

    return () => window.clearInterval(intervalId);
  }, [seconds, startedAt]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 text-center shadow-sm">
      <p className="text-sm font-bold text-zinc-500">{label}</p>
      <p className="mt-2 text-5xl font-black tabular-nums text-zinc-950">
        {formatSeconds(remainingSeconds)}
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        {startedAt ? "진행 중" : "일시정지됨"}
      </p>
    </div>
  );
}
