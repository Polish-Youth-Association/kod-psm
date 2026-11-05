"use client";

import { useState } from "react";
import type { RecentMemberIds } from "@/lib/wixApi";
import { IconCheck, IconCopy } from "./icons";

function shortDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString([], { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/** Sidebar for the queue: the most recent member ID issued overall and per delegation prefix. */
export function LastIdsPanel({ data, loading }: { data: RecentMemberIds | null; loading: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      // Clipboard can be blocked; the ID is visible anyway.
    }
  }

  const prefixes = data?.prefixes ?? [];
  // Phones show 3 delegations by default (so the queue isn't pushed off screen), desktop 6.
  const shown = showAll ? prefixes : prefixes.slice(0, 6);

  return (
    <aside className="card p-5 lg:sticky lg:top-24 animate-fade-up">
      <p className="eyebrow mb-3">Last member IDs used</p>

      {loading && !data ? (
        <div className="space-y-3">
          <div className="skeleton h-14 w-full" />
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-4 w-3/4" />
        </div>
      ) : !data?.latest ? (
        <p className="text-sm text-gray-500">Couldn&apos;t load issued IDs.</p>
      ) : (
        <>
          <button
            onClick={() => copy(data.latest!.memberId)}
            title="Copy"
            className="group w-full text-left p-4 rounded-2xl bg-gradient-to-br from-brand-red to-brand-rose text-white shadow-glow"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">Most recent</p>
            <p className="mt-0.5 flex items-center justify-between gap-2 font-mono text-lg font-bold">
              {data.latest.memberId}
              {copied === data.latest.memberId ? (
                <IconCheck className="w-4 h-4 shrink-0" />
              ) : (
                <IconCopy className="w-4 h-4 shrink-0 opacity-60 group-hover:opacity-100" />
              )}
            </p>
            <p className="text-xs text-white/75">{shortDate(data.latest.issuedAt)}</p>
          </button>

          <p className="field-label mt-5 mb-2">By delegation</p>
          <ul className="divide-y divide-black/[0.06]">
            {shown.map((p, i) => (
              <li key={p.prefix} className={!showAll && i >= 3 ? "hidden lg:block" : ""}>
                <button
                  onClick={() => copy(p.last.memberId)}
                  title="Copy"
                  className="w-full flex items-center gap-3 py-2 text-left hover:bg-black/[0.02] rounded-lg"
                >
                  <span className="badge bg-gray-100 text-gray-700 w-14 justify-center">{p.prefix}</span>
                  <span className="flex-1 min-w-0 font-mono text-sm font-semibold text-brand-ink truncate">
                    {p.last.memberId}
                  </span>
                  {copied === p.last.memberId ? (
                    <IconCheck className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <span className="text-xs text-gray-500 shrink-0">{shortDate(p.last.issuedAt)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {prefixes.length > 3 && (
            <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs font-semibold text-brand-red hover:underline">
              {showAll ? "Show fewer" : `Show all ${prefixes.length}`}
            </button>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-gray-500">
            From the Membership Certificates Drive and approved members. Tap an ID to copy it.
            {data.driveError && <span className="block text-amber-700 mt-1">Drive didn&apos;t load, showing CMS only.</span>}
          </p>
        </>
      )}
    </aside>
  );
}
