import express from "express";
import path from "node:path";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

const clientBuildPath = path.join(__dirname, "client");

app.use(express.static(clientBuildPath));

app.post("/api/log", (req, res) => {
  console.log("Received payload:", req.body);
  res.json({ ok: true });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "member-onboarding-app" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 member-onboarding-app running on port ${PORT}`);
});