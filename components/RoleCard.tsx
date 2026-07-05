"use client";

import { useState } from "react";
import { ROLE_DESCRIPTIONS } from "@/lib/roleDescriptions";

export function RoleCard({ role }: { role: string }) {
  const [isHidden, setIsHidden] = useState(false);
  const description = ROLE_DESCRIPTIONS[role] ?? {
    team: "알 수 없음",
    goal: "사회자의 안내에 따라 진행하세요.",
  };

  if (isHidden) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xl font-black text-zinc-950">역할이 숨겨졌습니다.</p>
        <button
          type="button"
          onClick={() => setIsHidden(false)}
          className="mt-5 min-h-14 w-full rounded-lg bg-zinc-950 px-5 py-4 text-lg font-black text-white"
        >
          다시 보기
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
      <p className="text-sm font-bold text-red-700">{description.team}</p>
      <h2 className="mt-2 text-5xl font-black text-zinc-950">{role}</h2>
      <p className="mt-5 text-base leading-7 text-zinc-700">목표: {description.goal}</p>
      <button
        type="button"
        onClick={() => setIsHidden(true)}
        className="mt-6 min-h-14 w-full rounded-lg border border-zinc-300 bg-white px-5 py-4 text-lg font-black text-zinc-950"
      >
        역할 숨기기
      </button>
    </div>
  );
}
