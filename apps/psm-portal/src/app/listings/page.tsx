"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { wixApi, type JobListing, type ListingStatus, type OrgPerson } from "@/lib/wixApi";
import { PageHeader, Spinner } from "@/components/field";
import { useToast } from "@/components/toast";
import { useUser } from "@/components/userContext";
import { IconBriefcase, IconPlus, IconRefresh, IconTrash, IconUsers, IconX } from "@/components/icons";

const STATUS_STYLE: Record<ListingStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  OPEN: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-amber-50 text-amber-700",
};
const STATUS_LABEL: Record<ListingStatus, string> = { DRAFT: "Draft", OPEN: "Open", CLOSED: "Closed" };
const FILTERS: { key: "" | ListingStatus; label: string }[] = [
  { key: "", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "DRAFT", label: "Drafts" },
  { key: "CLOSED", label: "Closed" },
];

type Draft = Pick<JobListing, "title" | "team" | "location" | "commitment" | "summary" | "description" | "requirements" | "ownerEmail">;
const EMPTY: Draft = { title: "", team: "", location: "", commitment: "", summary: "", description: "", requirements: "", ownerEmail: "" };

function Input({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  list,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  list?: string;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="field-label">
        {label}
        {required && <span className="text-brand-red"> *</span>}
      </span>
      {rows ? (
        <textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="field-input h-auto py-2.5 leading-relaxed resize-y"
        />
      ) : (
        <input value={value} list={list} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="field-input" />
      )}
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export default function ListingsPage() {
  const toast = useToast();
  const { userEmail } = useUser();
  const [listings, setListings] = useState<JobListing[] | null>(null);
  const [people, setPeople] = useState<OrgPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"" | ListingStatus>("");
  // Editor: null = closed, "new" = creating, otherwise the listing being edited.
  const [editing, setEditing] = useState<"new" | JobListing | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await wixApi.listJobs();
      setListings(res.listings);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Teams + owners for the editor's suggestions; the page works without them.
    wixApi.listOrg().then((r) => setPeople(r.people)).catch(() => {});
  }, [load]);

  const teams = useMemo(() => Array.from(new Set(people.map((p) => p.department).filter(Boolean))).sort(), [people]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { "": listings?.length ?? 0 };
    for (const l of listings ?? []) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [listings]);
  const shown = (listings ?? []).filter((l) => !filter || l.status === filter);

  function openEditor(l: "new" | JobListing) {
    setEditing(l);
    setDraft(
      l === "new"
        ? { ...EMPTY, ownerEmail: userEmail ?? "" }
        : {
            title: l.title,
            team: l.team,
            location: l.location,
            commitment: l.commitment,
            summary: l.summary,
            description: l.description,
            requirements: l.requirements,
            ownerEmail: l.ownerEmail,
          }
    );
  }

  async function save(status?: ListingStatus) {
    if (!editing) return;
    if (!draft.title.trim()) {
      toast("error", "Missing title", "Give the listing a title.");
      return;
    }
    setBusy("save");
    try {
      const body =
        editing === "new" ? { action: "create", ...draft, status: status ?? "DRAFT" } : { action: "update", id: editing.id, ...draft, ...(status ? { status } : {}) };
      const res = await wixApi.saveJob(body);
      toast("success", res.listing?.status === "OPEN" ? "Listing is live" : "Listing saved", draft.title.trim());
      setEditing(null);
      await load();
    } catch (e: any) {
      toast("error", "Couldn't save the listing", e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(l: JobListing, status: ListingStatus) {
    setBusy(l.id);
    try {
      await wixApi.saveJob({ action: "update", id: l.id, status });
      toast("success", status === "OPEN" ? "Listing is live" : "Listing closed", l.title);
      await load();
    } catch (e: any) {
      toast("error", "Couldn't update the listing", e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(l: JobListing) {
    if (!confirm(`Delete "${l.title}"? This can't be undone.`)) return;
    setBusy("delete");
    try {
      await wixApi.saveJob({ action: "delete", id: l.id });
      toast("success", "Listing deleted", l.title);
      setEditing(null);
      await load();
    } catch (e: any) {
      toast("error", "Couldn't delete", e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  const editingListing = editing && editing !== "new" ? editing : null;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader
        eyebrow="Volunteers"
        title="Job Listings"
        action={
          <div className="flex gap-2 self-start sm:self-auto">
            <button onClick={load} disabled={loading} className="btn-ghost" aria-label="Refresh">
              <IconRefresh className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => openEditor("new")} className="btn-primary">
              <IconPlus className="w-4 h-4" />
              New listing
            </button>
          </div>
        }
      >
        Volunteer positions we&apos;re hiring for. Open listings show on the Join Our Team page at polishyouth.org; drafts
        and closed ones stay internal.
      </PageHeader>

      {/* Status filter */}
      <div className="mb-4 flex gap-1 p-1 rounded-xl bg-white border border-gray-200 w-fit max-w-full overflow-x-auto animate-fade-up">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={[
              "px-4 h-9 rounded-lg text-sm font-semibold whitespace-nowrap transition-all",
              filter === f.key ? "text-white bg-gradient-to-br from-brand-red to-brand-rose shadow-glow" : "text-gray-600 hover:text-brand-ink",
            ].join(" ")}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="card p-5 mb-4 text-sm text-red-700 bg-red-50/80 border-red-100">Couldn&apos;t load listings: {error}</div>
      )}

      {listings === null && !error ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-5 w-1/3 mb-2" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="card py-16 px-6 text-center animate-fade-up">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center">
            <IconBriefcase className="w-7 h-7" />
          </div>
          <p className="text-base font-bold text-brand-ink">{filter ? "Nothing here" : "No listings yet"}</p>
          <p className="text-sm text-gray-500 mt-1">{filter ? "No listings with this status." : "Create one to start taking applications."}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((l, i) => (
            <li key={l.id} className="card p-5 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <button onClick={() => openEditor(l)} className="flex items-start gap-3 flex-1 min-w-0 text-left">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white flex items-center justify-center">
                    <IconBriefcase className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-brand-ink truncate">{l.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {[l.team, l.location, l.commitment].filter(Boolean).join(" · ") || "No details yet"}
                    </p>
                    {l.summary && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{l.summary}</p>}
                  </div>
                </button>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span className={`badge ${STATUS_STYLE[l.status]}`}>{STATUS_LABEL[l.status]}</span>
                  <Link href={`/applicants?listing=${encodeURIComponent(l.id)}`} className="btn-ghost h-9 px-3 text-xs">
                    <IconUsers className="w-4 h-4" />
                    {l.applicants?.total ?? 0}
                    {(l.applicants?.NEW ?? 0) > 0 && <span className="badge bg-brand-red-light text-brand-red">{l.applicants?.NEW} new</span>}
                  </Link>
                  {l.status === "OPEN" ? (
                    <button onClick={() => setStatus(l, "CLOSED")} disabled={!!busy} className="btn-ghost h-9 px-3 text-xs">
                      {busy === l.id ? <Spinner /> : "Close"}
                    </button>
                  ) : (
                    <button onClick={() => setStatus(l, "OPEN")} disabled={!!busy} className="btn-ghost h-9 px-3 text-xs">
                      {busy === l.id ? <Spinner /> : l.status === "DRAFT" ? "Publish" : "Reopen"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[2px]" onClick={() => !busy && setEditing(null)}>
          <aside className="h-full w-full sm:w-[520px] bg-white shadow-2xl flex flex-col animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-black/[0.06] px-6 py-4 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-base font-bold text-brand-ink truncate">{editingListing ? "Edit listing" : "New listing"}</p>
                {editingListing && (
                  <p className="text-xs text-gray-500">
                    {STATUS_LABEL[editingListing.status]} · created by {editingListing.createdBy || "unknown"}
                  </p>
                )}
              </div>
              <button onClick={() => setEditing(null)} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center" aria-label="Close">
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
              <Input label="Title" required value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder="Social Media Coordinator" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Team" value={draft.team} list="listing-teams" onChange={(v) => setDraft((d) => ({ ...d, team: v }))} placeholder="Marketing" />
                <Input label="Location" value={draft.location} onChange={(v) => setDraft((d) => ({ ...d, location: v }))} placeholder="Remote / Chicago" />
                <Input label="Time commitment" value={draft.commitment} onChange={(v) => setDraft((d) => ({ ...d, commitment: v }))} placeholder="3–5 hrs/week" />
                <Input
                  label="Owner"
                  value={draft.ownerEmail}
                  list="listing-owners"
                  onChange={(v) => setDraft((d) => ({ ...d, ownerEmail: v }))}
                  placeholder="name@polishyouth.org"
                  hint="Gets an email for each new applicant"
                />
              </div>
              <Input
                label="Summary"
                value={draft.summary}
                onChange={(v) => setDraft((d) => ({ ...d, summary: v }))}
                placeholder="One line shown on the listing card"
              />
              <Input
                label="Description"
                rows={7}
                value={draft.description}
                onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
                placeholder="What they'll do, who they'll work with, why it matters."
              />
              <Input
                label="Requirements"
                rows={4}
                value={draft.requirements}
                onChange={(v) => setDraft((d) => ({ ...d, requirements: v }))}
                placeholder="One per line"
              />
              <datalist id="listing-teams">
                {teams.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <datalist id="listing-owners">
                {people.map((p) => (
                  <option key={p.email} value={p.email}>
                    {p.name}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="border-t border-black/[0.06] px-6 py-4 flex flex-wrap items-center gap-2">
              {editingListing ? (
                <>
                  <button onClick={() => save()} disabled={!!busy} className="btn-primary">
                    {busy === "save" && <Spinner />}
                    Save
                  </button>
                  {editingListing.status !== "OPEN" && (
                    <button onClick={() => save("OPEN")} disabled={!!busy} className="btn-ghost">
                      Save &amp; publish
                    </button>
                  )}
                  {!editingListing.applicants?.total && (
                    <button onClick={() => remove(editingListing)} disabled={!!busy} className="btn-ghost ml-auto" aria-label="Delete listing">
                      <IconTrash className="w-4 h-4" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button onClick={() => save("OPEN")} disabled={!!busy} className="btn-primary">
                    {busy === "save" && <Spinner />}
                    Publish
                  </button>
                  <button onClick={() => save("DRAFT")} disabled={!!busy} className="btn-ghost">
                    Save as draft
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
