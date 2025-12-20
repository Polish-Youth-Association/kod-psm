import express from "express";
import type {
  Application,
  NextFunction,
  Request,
  RequestHandler,
  Response
} from "express";

export type CreateHttpAppOptions = {
  /**
   * Set to false to skip installing express.json middleware.
   * Provide an options object to customize the parser.
   */
  jsonParser?: boolean | Parameters<typeof express.json>[0];
};

/**
 * Factory that returns an Express application with sensible defaults installed.
 * By default we always attach the JSON body parser so apps can handle JSON APIs
 * without repeating the same boilerplate in every service.
 */
export function createHttpApp(options: CreateHttpAppOptions = {}): Application {
  const { jsonParser = true } = options;
  const app = express();

  if (jsonParser) {
    const jsonConfig = jsonParser === true ? undefined : jsonParser;
    app.use(express.json(jsonConfig));
  }

  return app;
}

export const json: typeof express.json = express.json;
export const urlencoded: typeof express.urlencoded = express.urlencoded;
export const Router = express.Router;

export type {
  Application,
  NextFunction,
  Request,
  RequestHandler,
  Response
};
