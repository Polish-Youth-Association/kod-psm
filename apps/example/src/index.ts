import express from "express";
import type { RequestHandler } from "express";

const PORT = Number(process.env.PORT) || 8080;

const app = express();

const handler: RequestHandler = (_req, res) => {
  res.json({ ok: true, service: "PING!" });
};

app.get("/", handler);

app.listen(PORT, () => {
  console.log("Example app running on port " + PORT);
});