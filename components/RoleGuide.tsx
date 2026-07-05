import { ROLE_DESCRIPTIONS } from "@/lib/roleDescriptions";
import { ROLE_ORDER } from "@/lib/roles";

type RoleGuideProps = {
  compact?: boolean;
  dark?: boolean;
};

export function RoleGuide({ compact = false, dark = false }: RoleGuideProps) {
  return (
    <div className={compact ? "space-y-2" : "grid gap-3 sm:grid-cols-2"}>
      {ROLE_ORDER.map((role) => {
        const description = ROLE_DESCRIPTIONS[role];

        return (
          <article
            key={role}
            className={
              dark
                ? "rounded-md border border-zinc-700 bg-[#0b0f14] p-3"
                : "rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
            }
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className={dark ? "font-black text-zinc-100" : "font-black text-zinc-950"}>
                {role}
              </h3>
              <span
                className={
                  dark
                    ? "shrink-0 rounded-full bg-zinc-800 px-2 py-1 text-xs font-bold text-zinc-300"
                    : "shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-xs font-bold text-zinc-600"
                }
              >
                {description.team}
              </span>
            </div>
            <p className={dark ? "mt-2 text-sm leading-6 text-zinc-400" : "mt-2 text-sm leading-6 text-zinc-600"}>
              {description.goal}
            </p>
          </article>
        );
      })}
    </div>
  );
}
