"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { wixApi, type Applicant, type ApplicantStatus, type JobListing } from "@/lib/wixApi";
import { PageHeader, Spinner } from "@/components/field";
import { useToast } from "@/components/toast";
import { IconRefresh, IconSearch, IconUsers, IconX } from "@/components/icons";

const STATUSES: { key: ApplicantStatus; label: string; style: string }[] = [
  { key: "NEW", label: "New", style: "bg-brand-red-light text-brand-red" },
  { key: "INTERVIEWING", label: "Interviewing", style: "bg-blue-50 text-blue-700" },
  { key: "ACCEPTED", label: "Accepted", style: "bg-emerald-50 text-emerald-700" },
  { key: "REJECTED", label: "Rejected", style: "bg-gray-100 text-gray-600" },
];
const STATUS = Object.fromEntries(STATUSES.map((s) => [s.key, s])) as Record<ApplicantStatus, (typeof STATUSES)[number]>;
const GENERAL = "__general";

function when(v: any) {
  if (!v) return "";
  const d = new Date(typeof v === "object" && "$date" in v ? v.$date : v);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function fullName(a: Applicant) {
  return `${a.firstName} ${a.lastName}`.trim() || a.email;
}

export default function ApplicantsPage() {
  const toast = useToast();
  const [applicants, setApplicants] = useState<Applicant[] | null>(null);
  const [listings, setListings] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState(""); // "" = all, GENERAL = no listing, else a listing id
  const [status, setStatus] = useState<"" | ApplicantStatus>("NEW");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Applicant | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Deep link from a listing card or the new-applicant email: /applicants?listing=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("listing");
    if (id) {
      setListing(id);
      setStatus("");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, l] = await Promise.all([wixApi.listApplicants(), wixApi.listJobs()]);
      setApplicants(a.applicants);
      setListings(l.listings);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const inListing = useMemo(
    () => (applicants ?? []).filter((a) => !listing || (listing === GENERAL ? !a.listingId : a.listingId === listing)),
    [applicants, listing]
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { "": inListing.length };
    for (const a of inListing) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [inListing]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return inListing.filter(
      (a) => (!status || a.status === status) && (!term || `${fullName(a)} ${a.email} ${a.city} ${a.school}`.toLowerCase().includes(term))
    );
  }, [inListing, status, q]);

  function open(a: Applicant) {
    setSelected(a);
    setNotes(a.notes);
  }

  async function update(a: Applicant, body: { status?: ApplicantStatus; notes?: string }, done: string) {
    setBusy(body.status ?? "notes");
    try {
      const res = await wixApi.updateApplicant({ id: a.id, ...body });
      setApplicants((prev) => (prev ?? []).map((x) => (x.id === a.id ? res.applicant : x)));
      setSelected(res.applicant);
      toast("success", done, fullName(a));
    } catch (e: any) {
      toast("error", "Couldn't update the applicant", e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  const listingTitle = (id: string) => listings.find((l) => l.id === id)?.title;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader
        eyebrow="Volunteers"
        title="Applicants"
        action={
          <button onClick={load} disabled={loading} className="btn-ghost self-start sm:self-auto">
            <IconRefresh className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      >
        Everyone who applied through the Join Our Team page. Move people along as you talk to them; notes stay internal.
      </PageHeader>

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 animate-fade-up">
        <select value={listing} onChange={(e) => setListing(e.target.value)} className="field-input sm:w-72">
          <option value="">All positions</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
              {l.status !== "OPEN" ? ` (${l.status.toLowerCase()})` : ""}
            </option>
          ))}
          <option value={GENERAL}>General interest</option>
        </select>
        <div className="relative flex-1">
          <IconSearch className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, city…" className="field-input pl-10" />
        </div>
      </div>
      <div className="mb-4 flex gap-1 p-1 rounded-xl bg-white border border-gray-200 w-fit max-w-full overflow-x-auto animate-fade-up">
        {[...STATUSES, { key: "" as const, label: "All" }].map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            className={[
              "px-4 h-9 rounded-lg text-sm font-semibold whitespace-nowrap transition-all",
              status === s.key ? "text-white bg-gradient-to-br from-brand-red to-brand-rose shadow-glow" : "text-gray-600 hover:text-brand-ink",
            ].join(" ")}
          >
            {s.label}
            <span className="ml-1.5 opacity-70">{counts[s.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {error && <div className="card p-5 mb-4 text-sm text-red-700 bg-red-50/80 border-red-100">Couldn&apos;t load applicants: {error}</div>}

      <div className="card overflow-hidden">
        {applicants === null && !error ? (
          <div className="divide-y divide-black/[0.06]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-5 py-4">
                <div className="skeleton h-4 w-1/3 mb-2" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center">
              <IconUsers className="w-7 h-7" />
            </div>
            <p className="text-base font-bold text-brand-ink">No applicants here</p>
            <p className="text-sm text-gray-500 mt-1">
              {(applicants ?? []).length === 0 ? "Applications from the website will show up here." : "Try another position or status."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {shown.map((a) => (
              <li key={a.id}>
                <button onClick={() => open(a)} className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-black/[0.02] transition-colors">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white font-bold flex items-center justify-center">
                    {fullName(a).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-ink truncate">{fullName(a)}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {(a.listingId ? listingTitle(a.listingId) ?? a.listingTitle : "General interest") + " · " + when(a.createdAt)}
                    </p>
                  </div>
                  <span className={`badge ${STATUS[a.status]?.style ?? ""}`}>{STATUS[a.status]?.label ?? a.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[2px]" onClick={() => setSelected(null)}>
          <aside className="h-full w-full sm:w-[460px] bg-white shadow-2xl overflow-y-auto animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/90 backdrop-blur border-b border-black/[0.06] px-6 py-4 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-base font-bold text-brand-ink truncate">{fullName(selected)}</p>
                <p className="text-xs text-gray-500 truncate">
                  {selected.listingId ? listingTitle(selected.listingId) ?? selected.listingTitle : "General interest"} · applied {when(selected.createdAt)}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center" aria-label="Close">
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              {/* Status */}
              <div>
                <p className="field-label mb-2">Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => s.key !== selected.status && update(selected, { status: s.key }, `Moved to ${s.label.toLowerCase()}`)}
                      disabled={!!busy}
                      className={[
                        "h-10 rounded-xl text-sm font-semibold border transition-all flex items-center justify-center gap-2",
                        selected.status === s.key ? "border-transparent text-white bg-gradient-to-br from-brand-red to-brand-rose shadow-glow" : "border-gray-200 text-gray-600 hover:border-brand-red/40",
                      ].join(" ")}
                    >
                      {busy === s.key && <Spinner />}
                      {s.label}
                    </button>
                  ))}
                </div>
                {selected.statusBy && (
                  <p className="text-xs text-gray-400 mt-2">
                    Last changed by {selected.statusBy} {when(selected.statusAt) && `on ${when(selected.statusAt)}`}
                  </p>
                )}
              </div>

              {/* Message */}
              {selected.message && (
                <div>
                  <p className="field-label mb-1.5">Why they want to join</p>
                  <p className="text-sm text-brand-ink whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl p-3.5">{selected.message}</p>
                </div>
              )}

              {/* Details */}
              <dl className="divide-y divide-black/[0.05]">
                {(
                  [
                    ["Email", selected.email && <a href={`mailto:${selected.email}`} className="text-brand-red hover:underline">{selected.email}</a>],
                    ["Phone", selected.phone],
                    ["City", selected.city],
                    ["School", selected.school],
                    ["Availability", selected.availability],
                    ["LinkedIn", selected.linkedin && <a href={selected.linkedin} target="_blank" rel="noreferrer" className="text-brand-red hover:underline break-all">{selected.linkedin}</a>],
                    ["Resume", selected.resumeUrl && <a href={selected.resumeUrl} target="_blank" rel="noreferrer" className="text-brand-red hover:underline">Open resume</a>],
                    ["Cover letter", selected.coverLetterUrl && <a href={selected.coverLetterUrl} target="_blank" rel="noreferrer" className="text-brand-red hover:underline">Open cover letter</a>],
                  ] as [string, React.ReactNode][]
                ).map(([k, v]) => (
                  <div key={k} className="py-2.5 grid grid-cols-[7rem_1fr] gap-3 text-sm">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="text-brand-ink break-words">{v || "—"}</dd>
                  </div>
                ))}
              </dl>

              {/* Notes */}
              <div>
                <p className="field-label mb-1.5">Internal notes</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Interview notes, next steps… only staff see this."
                  className="field-input h-auto py-2.5 leading-relaxed resize-y"
                />
                <button
                  onClick={() => update(selected, { notes }, "Notes saved")}
                  disabled={!!busy || notes === selected.notes}
                  className="btn-ghost mt-2 h-9 px-3 text-xs"
                >
                  {busy === "notes" && <Spinner />}
                  Save notes
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
