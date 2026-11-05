"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { wixApi, type CmsPage } from "@/lib/wixApi";
import { PageHeader } from "@/components/field";
import { IconChevron, IconLock, IconRefresh, IconSearch, IconX } from "@/components/icons";

// The backend decides which columns each view shows; every allowlisted field is in the detail panel.
const PAGE_SIZE = 50;
const SKELETON_COLS = 7;

function fmt(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object" && v && "$date" in (v as any)) v = (v as any).$date;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if ((key.endsWith("Date") || key.endsWith("At") || key.endsWith("Time")) && typeof v === "string" && !isNaN(Date.parse(v))) {
    return new Date(v).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
  }
  if (key === "onboardingStatus") return v === "ONBOARDED" ? "Onboarded" : v === "NOT_ONBOARDED" ? "Pending" : String(v);
  return String(v);
}

function StatusBadge({ v }: { v: unknown }) {
  const on = v === "ONBOARDED";
  return <span className={`badge ${on ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{fmt("onboardingStatus", v)}</span>;
}

export default function DataPage() {
  const [data, setData] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [view, setView] = useState("formEntries");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" } | null>(null); // null = view default
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setPage(0), [debouncedQ, status, sort, view]);

  function switchView(key: string) {
    if (key === view) return;
    setView(key);
    setStatus("");
    setSort(null);
    setSelected(null);
  }

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await wixApi.readCms({ view, q: debouncedQ, status, sort: sort?.field ?? "", dir: sort?.dir ?? "", page, pageSize: PAGE_SIZE });
      if (id !== reqId.current) return; // a newer request superseded this one
      setData(res);
      setDenied(false);
    } catch (e: any) {
      if (id !== reqId.current) return;
      const msg = e?.message ?? String(e);
      if (/not in .*cms-viewers/i.test(msg)) setDenied(true);
      else setError(msg);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [view, debouncedQ, status, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  const fields = data?.fields ?? [];
  const cols = (data?.columns ?? []).map((k) => fields.find((f) => f.key === k)).filter(Boolean) as { key: string; label: string }[];
  const isQueue = view === "members";
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function toggleSort(key: string) {
    setSort((s) => (s?.field === key ? { field: key, dir: s.dir === "asc" ? "desc" : "asc" } : { field: key, dir: "asc" }));
  }

  if (denied) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <PageHeader eyebrow="Data" title="Member data" />
        <div className="card py-16 px-6 text-center animate-fade-up">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center">
            <IconLock className="w-7 h-7" />
          </div>
          <p className="text-lg font-bold text-brand-ink">You don&apos;t have access to member data</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Member records are limited to Tech, the President and the Memberships team. Ask an admin to add you to
            cms-viewers@polishyouth.org.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader
        eyebrow="Data"
        title="Member data"
        action={
          <button onClick={load} disabled={loading} className="btn-ghost self-start sm:self-auto">
            <IconRefresh className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      >
        Read-only view of member records in the Wix CMS. Every view is logged.
        {data && <span className="ml-2 badge bg-brand-red-light text-brand-red align-middle">{data.total} records</span>}
      </PageHeader>

      {/* View tabs */}
      <div className="mb-4 flex gap-1 p-1 rounded-xl bg-white border border-gray-200 w-fit max-w-full overflow-x-auto animate-fade-up">
        {(data?.views ?? [{ key: "formEntries", label: "Membership form entries" }, { key: "members", label: "Onboarding queue" }]).map((v) => (
          <button
            key={v.key}
            onClick={() => switchView(v.key)}
            className={[
              "px-4 h-9 rounded-lg text-sm font-semibold whitespace-nowrap transition-all",
              view === v.key ? "text-white bg-gradient-to-br from-brand-red to-brand-rose shadow-glow" : "text-gray-600 hover:text-brand-ink",
            ].join(" ")}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <label className="relative flex-1">
          <IconSearch className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isQueue ? "Search name, email or member ID" : "Search first name, last name or email"}
            className="field-input pl-10"
          />
        </label>
        {data?.filters?.onboardingStatus && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="field-input sm:w-48">
            <option value="">All statuses</option>
            <option value="ONBOARDED">Onboarded</option>
            <option value="NOT_ONBOARDED">Pending</option>
          </select>
        )}
      </div>

      {error && <div className="mb-4 p-4 rounded-2xl border border-red-200 bg-red-50/80 text-red-700 text-sm">{error}</div>}

      <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] bg-gray-50/80">
                {cols.map((c) => (
                  <th key={c.key} className="text-left font-semibold text-gray-600 px-4 py-3 whitespace-nowrap">
                    <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-brand-ink">
                      {c.label}
                      {sort?.field === c.key && (
                        <IconChevron className={`w-3.5 h-3.5 ${sort.dir === "asc" ? "-rotate-90" : "rotate-90"}`} />
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={loading ? "opacity-50 transition-opacity" : ""}>
              {!data &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-black/[0.04]">
                    {Array.from({ length: SKELETON_COLS }).map((_, k) => (
                      <td key={k} className="px-4 py-3">
                        <div className="skeleton h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))}
              {data?.items.map((row) => (
                <tr
                  key={row._id}
                  onClick={() => setSelected(row)}
                  className="border-b border-black/[0.04] hover:bg-brand-red-light/40 cursor-pointer"
                >
                  {cols.map((c) => (
                    <td key={c.key} className={`px-4 py-3 whitespace-nowrap ${c.key === "memberId" ? "font-mono font-semibold" : ""}`}>
                      {c.key === "onboardingStatus" ? <StatusBadge v={row[c.key]} /> : fmt(c.key, row[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
              {data && data.items.length === 0 && (
                <tr>
                  <td colSpan={cols.length} className="px-4 py-12 text-center text-gray-500">
                    No records match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-black/[0.06] text-sm">
            <span className="text-gray-500">
              Page {page + 1} of {pages}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => p - 1)} disabled={page === 0 || loading} className="btn-ghost h-9">
                Previous
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= pages || loading} className="btn-ghost h-9">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[2px]" onClick={() => setSelected(null)}>
          <aside
            className="h-full w-full sm:w-[420px] bg-white shadow-2xl overflow-y-auto animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white/90 backdrop-blur border-b border-black/[0.06] px-6 py-4 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-base font-bold text-brand-ink truncate">
                  {selected.fullName || [selected.firstName, selected.lastName].filter(Boolean).join(" ") || "Member"}
                </p>
                <p className="text-xs font-mono text-gray-500">{isQueue ? selected.memberId || "No member ID yet" : data?.label}</p>
              </div>
              <button onClick={() => setSelected(null)} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center" aria-label="Close">
                <IconX className="w-4 h-4" />
              </button>
            </div>
            <dl className="px-6 py-4 divide-y divide-black/[0.05]">
              {fields.map((f) => (
                <div key={f.key} className="py-2.5 grid grid-cols-[9rem_1fr] gap-3 text-sm">
                  <dt className="text-gray-500">{f.label}</dt>
                  <dd className="text-brand-ink break-words">
                    {f.key === "certUrl" && selected[f.key] ? (
                      <a href={selected[f.key]} target="_blank" rel="noreferrer" className="text-brand-red hover:underline">
                        Open certificate
                      </a>
                    ) : (f.key === "email" || f.key === "email2") && selected[f.key] ? (
                      <a href={`mailto:${selected[f.key]}`} className="text-brand-red hover:underline">
                        {selected[f.key]}
                      </a>
                    ) : (
                      fmt(f.key, selected[f.key])
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      )}
    </main>
  );
}
