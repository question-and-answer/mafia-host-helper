"use client";

import { ROLE_ORDER, getRoleTotal } from "@/lib/roles";
import type { RoleCounts } from "@/types/game";

type RoleConfigEditorProps = {
  roleCounts: RoleCounts;
  playerCount: number;
  onChange: (roleCounts: RoleCounts) => void;
};

export function RoleConfigEditor({ roleCounts, playerCount, onChange }: RoleConfigEditorProps) {
  const total = getRoleTotal(roleCounts);

  const updateRole = (role: string, value: string) => {
    const nextCount = Math.max(0, Number.parseInt(value, 10) || 0);
    onChange({ ...roleCounts, [role]: nextCount });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ROLE_ORDER.map((role) => (
          <label
            key={role}
            className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
          >
            <span className="text-sm font-bold text-zinc-600">{role}</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={roleCounts[role] ?? 0}
              onChange={(event) => updateRole(role, event.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-zinc-300 px-3 text-lg font-black text-zinc-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </label>
        ))}
      </div>
      <div
        className={`rounded-lg border p-4 text-sm font-bold ${
          total === playerCount
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-red-200 bg-red-50 text-red-900"
        }`}
      >
        역할 총합 검사: {total}명 / 참가자 {playerCount}명
        {total !== playerCount ? (
          <p className="mt-1 font-medium">역할 수의 합이 참가자 수와 일치하지 않습니다.</p>
        ) : null}
      </div>
    </div>
  );
}
