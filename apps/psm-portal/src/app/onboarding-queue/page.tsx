"use client";

import { useEffect, useState, useCallback } from "react";
import { wixApi, type RecentMemberIds } from "@/lib/wixApi";
import { LastIdsPanel } from "@/components/lastIds";
import { PageHeader, Spinner } from "@/components/field";
import { useToast } from "@/components/toast";
import { IconCheck, IconRefresh, IconTrash } from "@/components/icons";

type Member = {
  docId: string;
  memberId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  prefix: string;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  birthday?: string;
  phone?: string;
  certStatus: "generated" | "failed" | "pending";
  createdAt: unknown;
  wixContactId?: string | null;
  wixAttachStatus?: "attached" | "skipped" | "failed" | null;
  wixFieldsUpdated?: boolean;
  flags?: string[];
};

type FlagSeverity = "high" | "medium" | "low";

const FLAG_LABELS: Record<string, { label: string; tooltip: string; severity: FlagSeverity }> = {
  // High severity — system errors that need fixing
  wix_attach_failed: {
    label: "Wix attachment failed",
    tooltip: "Certificate PDF wasn't attached to the Wix contact's Attachments tab. Re-send to retry.",
    severity: "high",
  },
  wix_fields_not_updated: {
    label: "Wix fields not updated",
    tooltip: "Custom fields (Member ID / Certificate URL) didn't update on the Wix contact.",
    severity: "high",
  },
  // Medium severity — likely user-data issues, double-check
  duplicate_email: {
    label: "Possible duplicate email",
    tooltip: "Another member record uses the same email — double-check Wix and merge / delete as needed.",
    severity: "medium",
  },
  no_wix_contact: {
    label: "No matching Wix contact",
    tooltip: "Server couldn't find a Wix contact for this email — verify the email matches what's in Wix.",
    severity: "medium",
  },
  // Low severity — informational
  duplicate_name: {
    label: "Possible duplicate name",
    tooltip: "Another member record uses the same full name. Could be a coincidence or a re-submission.",
    severity: "low",
  },
};

const SEVERITY_STYLES: Record<FlagSeverity, string> = {
  high:   "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low:    "bg-blue-100 text-blue-800 border-blue-200",
};

const SEVERITY_ICON: Record<FlagSeverity, string> = {
  high:   "✖",
  medium: "⚠",
  low:    "ⓘ",
};

export default function OnboardingQueuePage() {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastIds, setLastIds] = useState<RecentMemberIds | null>(null);
  const [lastIdsLoading, setLastIdsLoading] = useState(true);

  // Per-row approval state
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [polishNames, setPolishNames] = useState<Record<string, string>>({});
  const [memberIdInputs, setMemberIdInputs] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [rowSuccess, setRowSuccess] = useState<Record<string, string>>({});

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await wixApi.listQueue();
      if (!data.ok) throw new Error((data as any).error ?? "Failed to load queue");
      setMembers(data.members ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLastIds = useCallback(async () => {
    setLastIdsLoading(true);
    try {
      setLastIds(await wixApi.recentMemberIds());
    } catch {
      // Panel shows its own "couldn't load" state; the queue still works.
    } finally {
      setLastIdsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchQueue();
    fetchLastIds();
  }, [fetchQueue, fetchLastIds]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  async function handleApprove(member: Member) {
    const firstName = polishNames[member.docId]?.trim();
    if (!firstName) {
      setRowErrors((prev) => ({ ...prev, [member.docId]: "Polish first name is required." }));
      return;
    }
    // Member ID is assigned manually by the membership team. Use the typed value,
    // falling back to any ID already on the record.
    const memberId = (memberIdInputs[member.docId] ?? member.memberId ?? "").trim();
    if (!memberId) {
      setRowErrors((prev) => ({ ...prev, [member.docId]: "Member ID is required." }));
      return;
    }
    setApproving((prev) => ({ ...prev, [member.docId]: true }));
    setRowErrors((prev) => ({ ...prev, [member.docId]: "" }));
    setRowSuccess((prev) => ({ ...prev, [member.docId]: "" }));

    try {
      const data = await wixApi.approve(member.docId, firstName, memberId);
      if (!data.ok) throw new Error((data as any).error ?? "Approval failed");

      setRowSuccess((prev) => ({
        ...prev,
        [member.docId]: `Approved · ${data.memberId}`,
      }));
      if (data.certStatus === "failed") {
        toast("error", `${member.fullName} approved, but no certificate`, data.certError ?? "Certificate generation failed.");
      } else {
        toast("success", `${member.fullName} approved`, `Welcome email sent to ${member.email}`);
      }
      fetchLastIds();
      // Remove from list after a short delay
      setTimeout(() => {
        setMembers((prev) => prev.filter((m) => m.docId !== member.docId));
      }, 2000);
    } catch (e: any) {
      setRowErrors((prev) => ({ ...prev, [member.docId]: e?.message ?? String(e) }));
      toast("error", "Approval failed", e?.message ?? String(e));
    } finally {
      setApproving((prev) => ({ ...prev, [member.docId]: false }));
    }
  }

  async function handleDelete(member: Member) {
    const confirmed = window.confirm(
      `Delete ${member.fullName} (${member.memberId}) from the queue?\n\nThis removes the CMS record. Certificates in Drive and the Wix contact are kept.`
    );
    if (!confirmed) return;

    setDeleting((prev) => ({ ...prev, [member.docId]: true }));
    setRowErrors((prev) => ({ ...prev, [member.docId]: "" }));

    try {
      const data = await wixApi.deleteFromQueue(member.docId);
      if (!data.ok) throw new Error((data as any).error ?? "Delete failed");

      setMembers((prev) => prev.filter((m) => m.docId !== member.docId));
    } catch (e: any) {
      setRowErrors((prev) => ({ ...prev, [member.docId]: e?.message ?? String(e) }));
    } finally {
      setDeleting((prev) => ({ ...prev, [member.docId]: false }));
    }
  }

  const certBadge = (status: Member["certStatus"]) => {
    if (status === "generated") return <span className="badge bg-emerald-50 text-emerald-700">Certificate ready</span>;
    if (status === "failed") return <span className="badge bg-red-50 text-red-700">Cert failed</span>;
    return <span className="badge bg-amber-50 text-amber-700">Cert on approval</span>;
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader
        eyebrow="Members"
        title="Onboarding Queue"
        action={
          <button onClick={refreshAll} disabled={loading} className="btn-ghost self-start sm:self-auto">
            <IconRefresh className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      >
        New sign-ups from the website. Add their Polish first name and Member ID, then approve to send the
        welcome email with their certificate.
        {!loading && members.length > 0 && (
          <span className="ml-2 badge bg-brand-red-light text-brand-red align-middle">{members.length} waiting</span>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-6 items-start">
        <div className="lg:order-2">
          <LastIdsPanel data={lastIds} loading={lastIdsLoading} />
        </div>
        <div className="min-w-0 lg:order-1">
          {error && (
            <div className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50/80 text-red-700 text-sm animate-fade-up">{error}</div>
          )}

          {loading && members.length === 0 && (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card p-6">
                  <div className="skeleton h-5 w-48 mb-3" />
                  <div className="skeleton h-4 w-72 mb-6" />
                  <div className="skeleton h-11 w-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && members.length === 0 && !error && (
            <div className="card py-20 px-6 text-center animate-fade-up">
              <div className="mx-auto mb-4 w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg">
                <IconCheck className="w-8 h-8" />
              </div>
              <p className="text-lg font-bold text-brand-ink">All caught up</p>
              <p className="text-sm text-gray-500 mt-1">No members waiting for onboarding.</p>
            </div>
          )}

          {members.length > 0 && (
            <div className="space-y-4">
              {members.map((member, i) => (
                <div
                  key={member.docId}
                  style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                  className={[
                    "card p-5 sm:p-6 animate-fade-up transition-all duration-300",
                    rowSuccess[member.docId] ? "border-emerald-300 bg-emerald-50/60" : "hover:shadow-lift",
                  ].join(" ")}
                >
                  {member.flags && member.flags.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {member.flags.map((flag) => {
                        const meta = FLAG_LABELS[flag] ?? { label: flag, tooltip: "", severity: "medium" as FlagSeverity };
                        return (
                          <span
                            key={flag}
                            title={meta.tooltip}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border cursor-help ${SEVERITY_STYLES[meta.severity]}`}
                          >
                            {SEVERITY_ICON[meta.severity]} {meta.label}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-5 mb-5">
                    {/* Identity */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-brand-red to-brand-rose text-white text-lg font-bold flex items-center justify-center shadow-glow">
                        {(member.firstName || member.fullName || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold text-brand-ink truncate">{member.fullName}</p>
                        <p className="text-sm text-gray-600 truncate">{member.email}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[member.phone, member.birthday && `Born ${member.birthday}`].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="md:w-56 text-sm text-gray-700">
                      <p className="field-label mb-1">Address</p>
                      {member.address?.line1 && <p>{member.address.line1}</p>}
                      <p>
                        {[member.address?.city, member.address?.state].filter(Boolean).join(", ")} {member.address?.postalCode}
                      </p>
                      <p className="text-gray-500">{member.address?.country}</p>
                    </div>

                    {/* Membership */}
                    <div className="md:w-44">
                      <p className="field-label mb-1">Membership</p>
                      <p className="font-mono font-bold text-brand-ink">{member.memberId || "Not assigned"}</p>
                      {member.prefix && <p className="text-xs text-gray-500">Prefix {member.prefix}</p>}
                      <div className="mt-1.5">{certBadge(member.certStatus)}</div>
                    </div>
                  </div>

                  {/* Approval row */}
                  <div className="border-t border-black/[0.06] pt-5">
                    {rowSuccess[member.docId] ? (
                      <p className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
                        <IconCheck className="w-5 h-5" /> {rowSuccess[member.docId]}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr_auto_auto] gap-3 items-end">
                        <label className="flex flex-col gap-1.5">
                          <span className="field-label">
                            Member ID <span className="text-brand-red">*</span>
                          </span>
                          <input
                            type="text"
                            placeholder="DNY62120899"
                            value={memberIdInputs[member.docId] ?? member.memberId ?? ""}
                            onChange={(e) =>
                              setMemberIdInputs((prev) => ({ ...prev, [member.docId]: e.target.value }))
                            }
                            className="field-input font-mono"
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="field-label">
                            First name in Polish <span className="text-brand-red">*</span>
                          </span>
                          <input
                            type="text"
                            placeholder="e.g. Katarzyna"
                            value={polishNames[member.docId] ?? ""}
                            onChange={(e) =>
                              setPolishNames((prev) => ({ ...prev, [member.docId]: e.target.value }))
                            }
                            className="field-input"
                          />
                        </label>
                        <button
                          onClick={() => handleApprove(member)}
                          disabled={approving[member.docId] || deleting[member.docId]}
                          className="btn-primary"
                        >
                          {approving[member.docId] ? <Spinner /> : <IconCheck className="w-4 h-4" />}
                          {approving[member.docId] ? "Sending…" : "Approve & send"}
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
                          disabled={approving[member.docId] || deleting[member.docId]}
                          className="btn-ghost h-11 hover:!border-red-300 hover:!text-red-600"
                          aria-label={`Delete ${member.fullName}`}
                        >
                          <IconTrash className="w-4 h-4" />
                          <span className="sm:hidden">{deleting[member.docId] ? "Deleting…" : "Delete"}</span>
                        </button>
                        {rowErrors[member.docId] && (
                          <p className="sm:col-span-4 text-xs text-red-600">{rowErrors[member.docId]}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
