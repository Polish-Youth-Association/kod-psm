import type { Request, Response } from "express";

export function notFound() {
  return (req: Request, res: Response) => {
    res.status(404).json({
      ok: false,
      error: "Not Found",
      path: req.path
    });
  };
}