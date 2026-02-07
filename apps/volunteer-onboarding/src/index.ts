import { createApp, listen } from "@kod-psm/http-helpers";

const PORT = Number(process.env.PORT) || 8080;

type VolunteerOnboardingPayload = {
  firstName: string;
  lastName: string;
  personalEmail: string;
  team: string;
  startDate?: string;
  notes?: string;
  suggestedPrimaryEmail?: string;
};

function newId() {
  return `req_${Math.random().toString(36).slice(2, 10)}`;
}

const app = createApp((router) => {
  router.get("/", (_req, res) => {
    res.json({
      ok: true,
      service: "volunteer-onboarding"
    });
  });

  // ✅ NEW: the endpoint the portal will call
  router.post("/v1/onboarding/volunteers", (req, res) => {
    const body = (req.body ?? {}) as Partial<VolunteerOnboardingPayload>;

    if (!body.firstName || !body.lastName || !body.personalEmail || !body.team) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: firstName, lastName, personalEmail, team"
      });
    }

    // For now: stubbed response (later we call Admin SDK here)
    const requestId = newId();

    return res.status(200).json({
      ok: true,
      requestId,
      status: "Submitted",
      received: {
        firstName: body.firstName,
        lastName: body.lastName,
        personalEmail: body.personalEmail,
        team: body.team,
        startDate: body.startDate ?? "",
        notes: body.notes ?? "",
        suggestedPrimaryEmail: body.suggestedPrimaryEmail ?? ""
      }
    });
  });
});

listen(app, PORT, () => {
  console.log("🚀 volunteer-onboarding (volunteer-onboarding) running on port " + PORT);
});