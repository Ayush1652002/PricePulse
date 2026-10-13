import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import prisma from "../config/prisma.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import {
  createOtpVerification,
  verifyOtp as verifyOtpService,
  resendOtp as resendOtpService,
} from "../services/otp.service.js";

const registerSchema = z.object({
  email: z.string().email(),
  // bcrypt only reads the first 72 bytes, so very long passwords only waste server time.
  password: z.string().min(6).max(72),
});

// Login only needs "something was typed"; the real check is bcrypt.compare below.
// (Using the register rules here would lock out accounts created under older rules.)
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().trim().regex(/^\d{6}$/),
});

const resendOtpSchema = z.object({
  email: z.string().email(),
});

// Configurable session duration in days (Default: 30 days)
const AUTH_EXPIRY_DAYS = Math.max(
  1,
  Number(process.env.AUTH_SESSION_EXPIRY_DAYS) || 30
);
const COOKIE_MAX_AGE_MS = AUTH_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const JWT_EXPIRES_IN = `${AUTH_EXPIRY_DAYS}d`;

function setAuthCookie(res: Response, token: string) {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

function signToken(user: { id: string; email: string }) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: JWT_EXPIRES_IN as any, algorithm: "HS256" }
  );
}

// Step 1: Validate email/password, send OTP
export async function registerUser(req: Request, res: Response) {
  try {
    const { email, password } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const created = await createOtpVerification(email, hashedPassword);

    if (!created.success) {
      return res.status(429).json({ message: created.message });
    }

    // Send OTP email via Brevo HTTP API
    await sendOtpEmail(email, created.otp);

    return res.status(200).json({
      message: "OTP sent to your email. Please verify to complete registration.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input.", errors: error.issues });
    }
    console.error("Register error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
}

// Step 2: Verify OTP → create user account → set JWT cookie
export async function verifyOtp(req: Request, res: Response) {
  try {
    const { email, otp } = verifyOtpSchema.parse(req.body);

    const result = await verifyOtpService(email, otp);

    if (!result.success || !result.hashedPassword) {
      return res.status(400).json({ message: result.message });
    }

    // Create the user account now that OTP is verified
    const user = await prisma.user.create({
      data: {
        email,
        password: result.hashedPassword,
        displayName: email.split("@")[0],
      },
    });

    setAuthCookie(res, signToken(user));

    return res.status(201).json({
      message: "Account verified and created successfully.",
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Email and a 6-digit OTP are required." });
    }
    // Two verify requests at the same moment can both reach user.create; the second one fails here.
    if ((error as { code?: string })?.code === "P2002") {
      return res.status(409).json({ message: "User already exists." });
    }
    console.error("Verify OTP error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
}

// Resend OTP
export async function resendOtp(req: Request, res: Response) {
  try {
    const { email } = resendOtpSchema.parse(req.body);

    const result = await resendOtpService(email);

    if (!result.success) {
      return res.status(429).json({ message: result.message });
    }

    // Send the new OTP via Brevo
    await sendOtpEmail(email, result.otp!);

    return res.status(200).json({ message: "OTP resent to your email." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Email is required." });
    }
    console.error("Resend OTP error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
}

// Brevo HTTP API — OTP email sender
async function sendOtpEmail(email: string, otp: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_FROM_NAME || "PricePulse",
        email: process.env.BREVO_FROM_EMAIL || "noreply@pricepulse.app",
      },
      to: [{ email }],
      subject: "Your PricePulse OTP Code",
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px;">
          <h2 style="color: #7c3aed; margin-bottom: 8px;">PricePulse</h2>
          <p style="color: #94a3b8;">Your verification code is:</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #7c3aed; margin: 16px 0;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 14px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Brevo OTP email error:", err);
    throw new Error("Failed to send OTP email.");
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    setAuthCookie(res, signToken(user));

    return res.status(200).json({ message: "Login successful." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input.", errors: error.issues });
    }
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
}


export async function googleLogin(req: Request, res: Response) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential missing." });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error("GOOGLE_CLIENT_ID is not set in process.env");
      return res.status(500).json({ message: "Google Auth is not configured on the server." });
    }

    const client = new OAuth2Client(clientId);

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();

    if (!payload?.email || !payload.sub) {
      return res.status(401).json({ message: "Invalid Google account." });
    }

    if (payload.email_verified !== true) {
      return res.status(401).json({ message: "Your Google email is not verified." });
    }

    let user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          password: "",
          googleId: payload.sub,
          displayName: payload.name ?? payload.email.split("@")[0],
          avatarUrl: payload.picture ?? null,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId ?? payload.sub,
          displayName: payload.name ?? user.displayName,
          avatarUrl: payload.picture ?? user.avatarUrl,
        },
      });
    }

    setAuthCookie(res, signToken(user));

    return res.status(200).json({
      message: "Google login successful.",
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Google verify error:", error);
    return res.status(401).json({ message: "Google login failed." });
  }
}

export function logoutUser(_req: Request, res: Response) {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });

  return res.status(200).json({ message: "Logout successful." });
}

export async function getProfile(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true, avatarUrl: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
}