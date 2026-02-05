export type OnboardingType = "member" | "volunteer";

export type OnboardingRequest = {
  id: string;
  type: OnboardingType;

  firstName: string;
  lastName: string;
  personalEmail: string;

  // optional but useful
  team?: string;
  startDate?: string;

  status: "RECEIVED" | "NEEDS_APPROVAL" | "APPROVED" | "COMPLETED" | "REJECTED";
  createdAt: string; // ISO
};

const store: OnboardingRequest[] = [];

// NOTE: this is dev-only. Cloud Run instances restart and this will wipe.
export const onboardingStore = {
  list(type?: OnboardingType) {
    return store
      .filter((r) => (type ? r.type === type : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  create(req: Omit<OnboardingRequest, "id" | "createdAt" | "status">) {
    const id = `req_${Math.random().toString(36).slice(2, 10)}`;
    const createdAt = new Date().toISOString();

    const record: OnboardingRequest = {
      ...req,
      id,
      createdAt,
      status: "NEEDS_APPROVAL"
    };

    store.push(record);
    return record;
  }
};