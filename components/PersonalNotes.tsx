"use client";

import { useEffect, useState } from "react";

export function PersonalNotes({ storageKey }: { storageKey: string }) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setNotes(window.localStorage.getItem(storageKey) ?? "");
  }, [storageKey]);

  const updateNotes = (value: string) => {
    setNotes(value);
    window.localStorage.setItem(storageKey, value);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-zinc-950">내 메모</h2>
          <p className="mt-1 text-sm text-zinc-500">이 메모는 내 휴대폰에만 저장됩니다.</p>
        </div>
        <button
          type="button"
          onClick={() => updateNotes("")}
          className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-black text-zinc-800"
        >
          지우기
        </button>
      </div>
      <textarea
        value={notes}
        onChange={(event) => updateNotes(event.target.value)}
        placeholder="의심되는 사람, 발언, 투표 후보 등을 적어두세요."
        className="mt-4 min-h-32 w-full resize-y rounded-lg border border-zinc-300 p-3 text-base leading-7 text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
      />
    </div>
  );
}
