"use client";

import { useCallback, useEffect, useState } from "react";
import { wixApi, type VaultRequest, type VaultState } from "@/lib/wixApi";
import { PageHeader, Spinner } from "@/components/field";
import { useToast } from "@/components/toast";
import { IconCheck, IconDatabase, IconKey, IconMail, IconRefresh, IconX } from "@/components/icons";

const DURATION_LABEL: Record<number, string> = { 4: "4 hours", 24: "1 day", 72: "3 days", 168: "1 week" };

const STATUS_STYLE: Record<VaultRequest["status"], string> = {
  PENDING: "bg-amber-50 text-amber-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  EXPIRED: "bg-gray-100 text-gray-600",
  REVOKED: "bg-gray-100 text-gray-600",
  DENIED: "bg-red-50 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

function toDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(typeof v === "object" && "$date" in v ? v.$date : v);
  return isNaN(d.getTime()) ? null : d;
}

function timeLeft(v: any) {
  const d = toDate(v);
  if (!d) return "";
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return "ending soon";
  const h = Math.floor(ms / 3600000);
  if (h >= 48) return `${Math.round(h / 24)} days left`;
  if (h >= 1) return `${h}h ${Math.floor((ms % 3600000) / 60000)}m left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
}

function when(v: any) {
  const d = toDate(v);
  return d ? d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}

function ResourceIcon({ kind, className }: { kind: string | null; className?: string }) {
  return kind === "group" ? <IconDatabase className={className} /> : <IconMail className={className} />;
}

function RequestRow({
  r,
  showRequester,
  actions,
}: {
  r: VaultRequest;
  showRequester?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <li className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-brand-red to-brand-rose text-white flex items-center justify-center">
          <ResourceIcon kind={r.kind} className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-brand-ink truncate">
            {r.resourceLabel}
            {showRequester && <span className="font-medium text-gray-500"> · {r.requester}</span>}
          </p>
          <p className="text-xs text-gray-600 line-clamp-2">“{r.reason}”</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {DURATION_LABEL[r.hours] ?? `${r.hours}h`} · requested {when(r.createdAt)}
            {r.status === "ACTIVE" && <> · <span className="text-emerald-700 font-semibold">{timeLeft(r.expiresAt)}</span></>}
            {r.approver && r.status !== "PENDING" && <> · by {r.approver}</>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <span className={`badge ${STATUS_STYLE[r.status]}`}>{r.status.toLowerCase()}</span>
        {actions}
      </div>
    </li>
  );
}

export default function AccessPage() {
  const toast = useToast();
  const [state, setState] = useState<VaultState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resource, setResource] = useState("");
  const [hours, setHours] = useState(24);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // id of the request being acted on, or "new"

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await wixApi.vault();
      setState(s);
      setResource((cur) => cur || s.resources[0]?.id || "");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, body: Record<string, unknown>, ok: string) {
    setBusy(id);
    try {
      await wixApi.vaultAction(body);
      toast("success", ok, "");
      await load();
    } catch (e: any) {
      toast("error", "That didn't work", e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 5) {
      toast("error", "Add a reason", "A short note on why you need access helps the approver.");
      return;
    }
    await act("new", { action: "request", resource, hours, reason: reason.trim() }, "Request sent");
    setReason("");
  }

  const selected = state?.resources.find((r) => r.id === resource);
  const openMine = (state?.mine ?? []).filter((r) => r.status === "PENDING" || r.status === "ACTIVE");
  const pastMine = (state?.mine ?? []).filter((r) => !(r.status === "PENDING" || r.status === "ACTIVE")).slice(0, 10);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader
        eyebrow="Access"
        title="Access vault"
        action={
          <button onClick={load} disabled={loading} className="btn-ghost self-start sm:self-auto">
            <IconRefresh className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      >
        Need a shared inbox or member data for a while? Request it here. Once approved it shows up in your own account
        automatically, no passwords, and it&apos;s removed when the time is up.
      </PageHeader>

      {error && <div className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50/80 text-red-700 text-sm">{error}</div>}

      {/* Approver panel */}
      {state?.isApprover && (
        <section className="mb-8 animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-bold text-brand-ink">Waiting for approval</h2>
            <span className="badge bg-brand-red-light text-brand-red">{state.pending?.length ?? 0}</span>
          </div>
          <div className="card overflow-hidden">
            {state.pending && state.pending.length > 0 ? (
              <ul className="divide-y divide-black/[0.06]">
                {state.pending.map((r) => (
                  <RequestRow
                    key={r.id}
                    r={r}
                    showRequester
                    actions={
                      <>
                        <button
                          onClick={() => act(r.id, { action: "approve", id: r.id }, `Approved for ${r.requester}`)}
                          disabled={!!busy}
                          className="btn-primary h-9 px-4"
                        >
                          {busy === r.id ? <Spinner /> : <IconCheck className="w-4 h-4" />}
                          Approve
                        </button>
                        <button
                          onClick={() => act(r.id, { action: "deny", id: r.id }, "Denied")}
                          disabled={!!busy}
                          className="btn-ghost h-9 px-3 hover:!border-red-300 hover:!text-red-600"
                          aria-label="Deny"
                        >
                          <IconX className="w-4 h-4" />
                        </button>
                      </>
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-sm text-gray-500 text-center">Nothing waiting. Nice.</p>
            )}
          </div>

          {state.active && state.active.length > 0 && (
            <>
              <h2 className="text-base font-bold text-brand-ink mt-6 mb-3">Active access</h2>
              <div className="card overflow-hidden">
                <ul className="divide-y divide-black/[0.06]">
                  {state.active.map((r) => (
                    <RequestRow
                      key={r.id}
                      r={r}
                      showRequester
                      actions={
                        <button
                          onClick={() => act(r.id, { action: "revoke", id: r.id }, `Revoked for ${r.requester}`)}
                          disabled={!!busy}
                          className="btn-ghost h-9 px-3 text-xs hover:!border-red-300 hover:!text-red-600"
                        >
                          {busy === r.id ? "Revoking…" : "Revoke"}
                        </button>
                      }
                    />
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 items-start">
        {/* Request form */}
        <section className="card p-6 animate-fade-up" style={{ animationDelay: "60ms" }}>
          <h2 className="text-base font-bold text-brand-ink mb-4 flex items-center gap-2">
            <IconKey className="w-4 h-4 text-brand-red" /> Request access
          </h2>
          {!state ? (
            <div className="space-y-3">
              <div className="skeleton h-11 w-full" />
              <div className="skeleton h-11 w-full" />
              <div className="skeleton h-24 w-full" />
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <span className="field-label">What do you need?</span>
                <div className="grid grid-cols-1 gap-2">
                  {state.resources.map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setResource(r.id)}
                      className={[
                        "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                        resource === r.id ? "border-brand-red/40 bg-brand-red-light/60" : "border-gray-200 bg-white hover:border-gray-300",
                      ].join(" ")}
                    >
                      <ResourceIcon kind={r.kind} className={`w-4 h-4 ${resource === r.id ? "text-brand-red" : "text-gray-400"}`} />
                      <span className="text-sm font-semibold text-brand-ink">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="field-label">For how long?</span>
                <div className="flex flex-wrap gap-2">
                  {state.durations.map((h) => (
                    <button
                      type="button"
                      key={h}
                      onClick={() => setHours(h)}
                      className={[
                        "px-3.5 h-9 rounded-lg text-sm font-semibold border transition-all",
                        hours === h ? "text-white border-transparent bg-gradient-to-br from-brand-red to-brand-rose shadow-glow" : "text-gray-600 border-gray-200 bg-white hover:border-gray-300",
                      ].join(" ")}
                    >
                      {DURATION_LABEL[h] ?? `${h}h`}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="field-label">Why?</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Answering member questions while John is away"
                  className="field-input h-auto py-2.5 resize-none"
                />
              </label>

              <button type="submit" disabled={busy === "new"} className="btn-primary">
                {busy === "new" ? <Spinner /> : <IconKey className="w-4 h-4" />}
                {busy === "new" ? "Sending…" : "Send request"}
              </button>
              {selected && (
                <p className="text-xs text-gray-500 -mt-2">
                  {selected.kind === "inbox"
                    ? `Once approved, ${selected.target} appears in your Gmail under your profile picture.`
                    : "Once approved, the page unlocks for you within about 5 minutes."}
                </p>
              )}
            </form>
          )}
        </section>

        {/* My requests */}
        <section className="animate-fade-up" style={{ animationDelay: "120ms" }}>
          <h2 className="text-base font-bold text-brand-ink mb-3">Your requests</h2>
          <div className="card overflow-hidden">
            {state && openMine.length + pastMine.length === 0 ? (
              <p className="px-5 py-10 text-sm text-gray-500 text-center">You haven&apos;t requested anything yet.</p>
            ) : (
              <ul className="divide-y divide-black/[0.06]">
                {openMine.map((r) => (
                  <RequestRow
                    key={r.id}
                    r={r}
                    actions={
                      <button
                        onClick={() => act(r.id, { action: "cancel", id: r.id }, r.status === "ACTIVE" ? "Access ended" : "Request cancelled")}
                        disabled={!!busy}
                        className="btn-ghost h-9 px-3 text-xs"
                      >
                        {r.status === "ACTIVE" ? "End now" : "Cancel"}
                      </button>
                    }
                  />
                ))}
                {pastMine.map((r) => (
                  <RequestRow key={r.id} r={r} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
