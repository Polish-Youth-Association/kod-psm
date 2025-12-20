import type { NextFunction, Request, Response } from "express";

type RequestWithId = Request & { requestId?: string };

export function errorHandler() {
  return (
    err: any,
    req: RequestWithId,
    res: Response,
    _next: NextFunction
  ) => {
    const status = typeof err?.status === "number" ? err.status : 500;

    // Log once, consistently
    console.error("Unhandled error", {
      status,
      message: err?.message,
      stack: err?.stack,
      path: req.path,
      requestId: req.requestId
    });

    res.status(status).json({
      ok: false,
      error: status === 500 ? "Internal Server Error" : err?.message ?? "Error",
      requestId: req.requestId
    });
  };
}
