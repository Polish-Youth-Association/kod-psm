"use client";

import { useEffect, useMemo, useState } from "react";
import { wixApi, type OrgPerson } from "@/lib/wixApi";
import { PageHeader } from "@/components/field";
import { IconChevron, IconMail, IconRefresh, IconSearch, IconUsers } from "@/components/icons";

type View = "tree" | "teams";

const TINTS = [
  "from-brand-red to-brand-rose",
  "from-orange-500 to-amber-400",
  "from-violet-600 to-fuchsia-500",
  "from-sky-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-pink-500 to-rose-400",
  "from-indigo-500 to-blue-400",
];

// Same department → same colour, so teams are easy to pick out in the tree.
function tintFor(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

// Top-level team for grouping: "Programs / Events" -> "Programs".
function teamOf(p: OrgPerson) {
  return (p.department || "").split(" / ")[0].trim() || "Unassigned";
}

function matches(p: OrgPerson, q: string) {
  if (!q) return true;
  return [p.name, p.title, p.email, p.department].some((v) => v.toLowerCase().includes(q));
}

function PersonCard({
  p,
  manager,
  reports,
  compact,
}: {
  p: OrgPerson;
  manager?: OrgPerson;
  reports: number;
  compact?: boolean;
}) {
  return (
    <div className={`card ${compact ? "p-3" : "p-4"} flex items-start gap-3 min-w-0 hover:shadow-lift transition-shadow`}>
      <div
        className={`${compact ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm"} shrink-0 rounded-xl bg-gradient-to-br ${tintFor(
          teamOf(p)
        )} text-white font-bold flex items-center justify-center shadow`}
      >
        {initials(p.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-brand-ink truncate">{p.name}</p>
        <p className={`text-xs truncate ${p.title ? "text-gray-600" : "text-amber-700 italic"}`}>
          {p.title || "No title in Workspace"}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 text-gray-500 hover:text-brand-red truncate">
            <IconMail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{p.email}</span>
          </a>
          {!compact && manager && <span className="text-gray-400">Reports to {manager.name}</span>}
          {reports > 0 && <span className="badge bg-gray-100 text-gray-600">{reports} direct</span>}
        </div>
      </div>
    </div>
  );
}

function TreeNode({
  p,
  byManager,
  byEmail,
  visible,
  depth,
}: {
  p: OrgPerson;
  byManager: Map<string, OrgPerson[]>;
  byEmail: Map<string, OrgPerson>;
  visible: Set<string> | null;
  depth: number;
}) {
  // Team heads (people with their own reports) first, then alphabetical.
  const kids = (byManager.get(p.email) ?? [])
    .filter((k) => !visible || visible.has(k.email))
    .sort((a, b) => (byManager.get(b.email)?.length ?? 0) - (byManager.get(a.email)?.length ?? 0) || a.name.localeCompare(b.name));
  const [open, setOpen] = useState(depth < 1);
  const expanded = open || !!visible; // searching opens the matching branches
  return (
    <li className="relative">
      <div className="flex items-start gap-2">
        {kids.length > 0 ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-4 w-6 h-6 shrink-0 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-brand-red"
            aria-label={expanded ? `Collapse ${p.name}` : `Expand ${p.name}`}
            aria-expanded={expanded}
          >
            <IconChevron className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <div className="flex-1 min-w-0 max-w-xl">
          <PersonCard p={p} reports={(byManager.get(p.email) ?? []).length} compact={depth > 0} />
        </div>
      </div>
      {expanded && kids.length > 0 && (
        <ul className="ml-3 sm:ml-5 pl-4 sm:pl-6 mt-2 space-y-2 border-l-2 border-dashed border-gray-200">
          {kids.map((k) => (
            <TreeNode key={k.email} p={k} byManager={byManager} byEmail={byEmail} visible={visible} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OrgPage() {
  const [people, setPeople] = useState<OrgPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("tree");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await wixApi.listOrg();
      if (!data.ok) throw new Error((data as any).error ?? "Failed to load the org chart");
      setPeople(data.people ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const { byEmail, byManager, roots, managerCount } = useMemo(() => {
    const byEmail = new Map(people.map((p) => [p.email, p]));
    const byManager = new Map<string, OrgPerson[]>();
    const roots: OrgPerson[] = [];
    for (const p of people) {
      if (p.managerEmail && byEmail.has(p.managerEmail) && p.managerEmail !== p.email) {
        byManager.set(p.managerEmail, [...(byManager.get(p.managerEmail) ?? []), p]);
      } else {
        roots.push(p);
      }
    }
    // Real roots (people with reports) first, then everyone not placed yet.
    roots.sort((a, b) => (byManager.get(b.email)?.length ?? 0) - (byManager.get(a.email)?.length ?? 0) || a.name.localeCompare(b.name));
    return { byEmail, byManager, roots, managerCount: people.filter((p) => p.managerEmail).length };
  }, [people]);

  const q = query.trim().toLowerCase();

  // While searching, keep matches plus their whole management chain so they stay in context.
  const visible = useMemo(() => {
    if (!q) return null;
    const keep = new Set<string>();
    for (const p of people) {
      if (!matches(p, q)) continue;
      let cur: OrgPerson | undefined = p;
      while (cur && !keep.has(cur.email)) {
        keep.add(cur.email);
        cur = cur.managerEmail ? byEmail.get(cur.managerEmail) : undefined;
      }
    }
    return keep;
  }, [q, people, byEmail]);

  const teams = useMemo(() => {
    const m = new Map<string, OrgPerson[]>();
    for (const p of people) if (matches(p, q)) m.set(teamOf(p), [...(m.get(teamOf(p)) ?? []), p]);
    return [...m.entries()].sort(([a], [b]) => (a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)));
  }, [people, q]);

  const placed = roots.filter((r) => byManager.has(r.email));
  const unplaced = roots.filter((r) => !byManager.has(r.email) && (!visible || visible.has(r.email)));

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader
        eyebrow="People"
        title="Org Chart"
        action={
          <button onClick={load} disabled={loading} className="btn-ghost self-start sm:self-auto">
            <IconRefresh className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        }
      >
        Positions and reporting lines, pulled live from Google Workspace (job title, department and manager on each
        account). Fix someone there and it updates here.
        {!loading && people.length > 0 && (
          <span className="ml-2 badge bg-brand-red-light text-brand-red align-middle">{people.length} people</span>
        )}
      </PageHeader>

      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <label className="relative flex-1">
          <IconSearch className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, position, team or email"
            className="field-input pl-10"
          />
        </label>
        <div className="inline-flex p-1 rounded-xl bg-white border border-gray-200 self-start">
          {(["tree", "teams"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={[
                "px-4 h-9 rounded-lg text-sm font-semibold transition-all",
                view === v ? "text-white bg-gradient-to-br from-brand-red to-brand-rose shadow-glow" : "text-gray-600 hover:text-brand-ink",
              ].join(" ")}
            >
              {v === "tree" ? "Reporting lines" : "By team"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50/80 text-red-700 text-sm animate-fade-up">{error}</div>
      )}

      {loading && people.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 flex gap-3">
              <div className="skeleton w-11 h-11 rounded-xl" />
              <div className="flex-1">
                <div className="skeleton h-4 w-32 mb-2" />
                <div className="skeleton h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && people.length > 0 && view === "tree" && (
        <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
          {managerCount === 0 && (
            <div className="mb-6 p-4 rounded-2xl border border-amber-200 bg-amber-50/80 text-amber-800 text-sm">
              No reporting lines are set in Workspace yet, so everyone is listed flat below. Set each person&apos;s
              manager in the Admin console (User → Employee information) to build the tree.
            </div>
          )}
          {placed.length > 0 && (
            <ul className="space-y-3">
              {placed
                .filter((r) => !visible || visible.has(r.email))
                .map((r) => (
                  <TreeNode key={r.email} p={r} byManager={byManager} byEmail={byEmail} visible={visible} depth={0} />
                ))}
            </ul>
          )}
          {unplaced.length > 0 && (
            <section className="mt-8">
              <p className="field-label mb-3">
                {placed.length > 0 ? `Not placed yet (${unplaced.length}) — no manager set` : `Everyone (${unplaced.length})`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {unplaced.map((p) => (
                  <PersonCard key={p.email} p={p} reports={0} />
                ))}
              </div>
            </section>
          )}
          {visible && visible.size === 0 && <p className="text-sm text-gray-500">No one matches “{query}”.</p>}
        </div>
      )}

      {!loading && people.length > 0 && view === "teams" && (
        <div className="space-y-8 animate-fade-up" style={{ animationDelay: "120ms" }}>
          {teams.map(([team, members]) => (
            <section key={team}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${tintFor(team)}`} />
                <h2 className="text-base font-bold text-brand-ink">{team}</h2>
                <span className="badge bg-gray-100 text-gray-600">{members.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {members.map((p) => (
                  <PersonCard
                    key={p.email}
                    p={p}
                    manager={p.managerEmail ? byEmail.get(p.managerEmail) : undefined}
                    reports={(byManager.get(p.email) ?? []).length}
                  />
                ))}
              </div>
            </section>
          ))}
          {teams.length === 0 && <p className="text-sm text-gray-500">No one matches “{query}”.</p>}
        </div>
      )}

      {!loading && !error && people.length === 0 && (
        <div className="card py-20 px-6 text-center">
          <IconUsers className="w-8 h-8 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No people returned from Workspace.</p>
        </div>
      )}
    </main>
  );
}
