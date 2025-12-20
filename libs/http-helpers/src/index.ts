import type { Application } from "express";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { requestId } from "./middleware/requestId";
import {
  createHttpApp,
  json,
  Router,
  urlencoded
} from "./server";

export type RegisterRoutes = (app: Application) => void;

/**
 * Convenience helper that wires a standard Express app with JSON parsing,
 * request id propagation, and consistent error handling.
 */
export function createApp(registerRoutes: RegisterRoutes): Application {
  const app = createHttpApp();

  app.use(requestId());

  registerRoutes(app);

  app.use(notFound());
  app.use(errorHandler());

  return app;
}

export function listen(
  app: Application,
  port = Number(process.env.PORT) || 8080,
  onListening?: (port: number) => void
) {
  return app.listen(port, "0.0.0.0", () => {
    console.log(`HTTP server listening on ${port}`);
    onListening?.(port);
  });
}

export { createHttpApp, errorHandler, notFound, requestId, Router, json, urlencoded };
export type { Application } from "./server";
