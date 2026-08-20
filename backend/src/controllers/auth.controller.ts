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
  password: z.string().min(6),
});

function setAuthCookie(res: Response, token: string) {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 60 * 60 * 1000,
  });
}

function signToken(user: { id: string; email: string }) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
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
    const otp = await createOtpVerification(email, hashedPassword);

    // Send OTP email via Brevo HTTP API
    await sendOtpEmail(email, otp);

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
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const result = await verifyOtpService(email, otp.trim());

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
    console.error("Verify OTP error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
}

// Resend OTP
export async function resendOtp(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const result = await resendOtpService(email);

    if (!result.success) {
      return res.status(429).json({ message: result.message });
    }

    // Send the new OTP via Brevo
    await sendOtpEmail(email, result.otp!);

    return res.status(200).json({ message: "OTP resent to your email." });
  } catch (error) {
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
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_FROM_NAME || "PricePulse",
        email: process.env.SMTP_USER || "alerts@pricepulse.app",
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

// ─── EXISTING CONTROLLERS — 100% UNTOUCHED ────────────────────────────────────

export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = registerSchema.parse(req.body);

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

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function googleLogin(req: Request, res: Response) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential missing." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email || !payload.sub) {
      return res.status(401).json({ message: "Invalid Google account." });
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
    console.error(error);
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