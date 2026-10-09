import { Request, Response, NextFunction } from "express";

/**
 * Simple CSRF protection for cookie login.
 *
 * Browsers only let your own website add a custom header like X-Requested-With.
 * Another website would need permission (CORS) first, and your CORS list blocks it.
 * So: every request that changes data must carry this header.
 */
export const CSRF_HEADER_NAME = "x-requested-with";
export const CSRF_HEADER_VALUE = "pricepulse";

export function requireCustomHeader(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  if (req.get(CSRF_HEADER_NAME) === CSRF_HEADER_VALUE) {
    return next();
  }

  return res.status(403).json({ message: "Missing required request header." });
}
