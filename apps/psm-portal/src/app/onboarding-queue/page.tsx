"use client";

import { useEffect, useState, useCallback } from "react";

type Member = {
  docId: string;
  memberId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  prefix: string;
  address: {
    line1?: string;
    city?: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  birthday?: string;
  phone?: string;
  certStatus: "generated" | "failed" | "pending";
  createdAt: unknown;
};

export default function OnboardingQueuePage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-row approval state
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [polishNames, setPolishNames] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [rowSuccess, setRowSuccess] = useState<Record<string, string>>({});

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/queue");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to load queue");
      setMembers(data.members ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  async function handleApprove(member: Member) {
    const firstName = polishNames[member.docId]?.trim();
    if (!firstName) {
      setRowErrors((prev) => ({ ...prev, [member.docId]: "Polish first name is required." }));
      return;
    }
    setApproving((prev) => ({ ...prev, [member.docId]: true }));
    setRowErrors((prev) => ({ ...prev, [member.docId]: "" }));
    setRowSuccess((prev) => ({ ...prev, [member.docId]: "" }));

    try {
      const res = await fetch(`/api/onboarding/approve/${member.docId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstNamePolish: firstName }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Approval failed");

      setRowSuccess((prev) => ({
        ...prev,
        [member.docId]: `Approved! Member ID: ${data.memberId}`,
      }));
      // Remove from list after a short delay
      setTimeout(() => {
        setMembers((prev) => prev.filter((m) => m.docId !== member.docId));
      }, 2000);
    } catch (e: any) {
      setRowErrors((prev) => ({ ...prev, [member.docId]: e?.message ?? String(e) }));
    } finally {
      setApproving((prev) => ({ ...prev, [member.docId]: false }));
    }
  }

  async function handleDelete(member: Member) {
    const confirmed = window.confirm(
      `Delete ${member.fullName} (${member.memberId}) from the queue?\n\nThis removes the Firestore record. The certificate PDF in storage and the Wix contact are preserved.`
    );
    if (!confirmed) return;

    setDeleting((prev) => ({ ...prev, [member.docId]: true }));
    setRowErrors((prev) => ({ ...prev, [member.docId]: "" }));

    try {
      const res = await fetch(`/api/onboarding/queue/${member.docId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Delete failed");

      setMembers((prev) => prev.filter((m) => m.docId !== member.docId));
    } catch (e: any) {
      setRowErrors((prev) => ({ ...prev, [member.docId]: e?.message ?? String(e) }));
    } finally {
      setDeleting((prev) => ({ ...prev, [member.docId]: false }));
    }
  }

  const certBadge = (status: Member["certStatus"]) => {
    const base = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium";
    if (status === "generated") return <span className={`${base} bg-green-100 text-green-800`}>Certificate ready</span>;
    if (status === "failed") return <span className={`${base} bg-red-100 text-red-700`}>Cert failed</span>;
    return <span className={`${base} bg-yellow-100 text-yellow-800`}>Cert pending</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">Member Onboarding Queue</h1>
          <p className="text-sm text-brand-gray mt-1">
            Review new members submitted via Wix. Enter their name in Polish and approve to send the welcome email.
          </p>
        </div>
        <button
          onClick={fetchQueue}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-border text-brand-gray hover:border-brand-red hover:text-brand-red transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && members.length === 0 && !error && (
        <div className="text-center py-20 text-brand-gray text-sm">
          No members pending onboarding.
        </div>
      )}

      {members.length > 0 && (
        <div className="space-y-4">
          {members.map((member) => (
            <div
              key={member.docId}
              className="bg-white border border-brand-border rounded-xl p-5 shadow-sm"
            >
              <div className="flex flex-wrap gap-6 mb-4">
                {/* Identity */}
                <div className="flex-1 min-w-[200px]">
                  <p className="text-xs text-brand-gray uppercase tracking-wide mb-1">Member</p>
                  <p className="font-semibold text-brand-dark">{member.fullName}</p>
                  <p className="text-sm text-brand-gray">{member.email}</p>
                  {member.phone && <p className="text-sm text-brand-gray">{member.phone}</p>}
                  {member.birthday && (
                    <p className="text-sm text-brand-gray">DOB: {member.birthday}</p>
                  )}
                </div>

                {/* Address */}
                <div className="flex-1 min-w-[180px]">
                  <p className="text-xs text-brand-gray uppercase tracking-wide mb-1">Address</p>
                  {member.address.line1 && (
                    <p className="text-sm text-brand-dark">{member.address.line1}</p>
                  )}
                  <p className="text-sm text-brand-dark">
                    {[member.address.city, member.address.state].filter(Boolean).join(", ")}{" "}
                    {member.address.postalCode}
                  </p>
                  <p className="text-sm text-brand-dark">{member.address.country}</p>
                </div>

                {/* Membership */}
                <div className="flex-1 min-w-[160px]">
                  <p className="text-xs text-brand-gray uppercase tracking-wide mb-1">Membership</p>
                  <p className="font-mono text-brand-dark font-semibold">{member.memberId}</p>
                  <p className="text-sm text-brand-gray">Prefix: {member.prefix}</p>
                  <div className="mt-1">{certBadge(member.certStatus)}</div>
                </div>
              </div>

              {/* Approval row */}
              <div className="border-t border-brand-border pt-4">
                {rowSuccess[member.docId] ? (
                  <p className="text-sm text-green-700 font-medium">{rowSuccess[member.docId]}</p>
                ) : (
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-[220px]">
                      <label className="block text-xs text-brand-gray mb-1">
                        First name in Polish <span className="text-brand-red">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Katarzyna"
                        value={polishNames[member.docId] ?? ""}
                        onChange={(e) =>
                          setPolishNames((prev) => ({ ...prev, [member.docId]: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red"
                      />
                      {rowErrors[member.docId] && (
                        <p className="text-xs text-red-600 mt-1">{rowErrors[member.docId]}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleApprove(member)}
                      disabled={approving[member.docId] || deleting[member.docId]}
                      className="mt-5 px-5 py-2 rounded-lg text-sm font-semibold bg-brand-red text-white hover:bg-brand-red-dark transition-colors disabled:opacity-50"
                    >
                      {approving[member.docId] ? "Sending…" : "Approve & Send Email"}
                    </button>
                    <button
                      onClick={() => handleDelete(member)}
                      disabled={approving[member.docId] || deleting[member.docId]}
                      className="mt-5 px-4 py-2 rounded-lg text-sm font-medium border border-brand-border text-brand-gray hover:border-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      {deleting[member.docId] ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
