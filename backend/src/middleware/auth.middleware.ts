import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
   const token = req.cookies.token;

if (!token) {
  return res.status(401).json({
    message: "Access token missing.",
  });
}

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);

    (req as any).user = decoded;

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}