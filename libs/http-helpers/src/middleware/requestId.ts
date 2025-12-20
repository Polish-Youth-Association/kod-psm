import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export function requestId() {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header("x-request-id")?.trim();
    const id = incoming && incoming.length > 0 ? incoming : randomUUID();

    (req as any).requestId = id;
    res.setHeader("x-request-id", id);

    next();
  };
}