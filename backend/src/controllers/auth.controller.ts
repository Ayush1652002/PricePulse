import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import prisma from "../config/prisma.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function registerUser(req: Request, res: Response) {
  try {
    const { email, password } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    return res.status(201).json({
      message: "User registered successfully.",
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
   if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid input.",
      errors: error.issues,
    });
  }

  console.error(error);

  return res.status(500).json({
    message: "Internal server error.",
  });
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = registerSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

  res.cookie("token", token, {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  maxAge: 60 * 60 * 1000,
});

return res.status(200).json({
  message: "Login successful.",
});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Invalid input.",
        errors: error.issues,
      });
    }

    console.error(error);

    return res.status(500).json({
      message: "Internal server error.",
    });
  }
}

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

export async function googleLogin(
  req: Request,
  res: Response
) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        message: "Google credential missing.",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email || !payload.sub) {
      return res.status(401).json({
        message: "Invalid Google account.",
      });
    }

    let user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
            password: "",
          googleId: payload.sub,
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: payload.sub,
        },
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "1h",
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
      maxAge: 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Google login successful.",
    });
  } catch (error) {
    console.error(error);

    return res.status(401).json({
      message: "Google login failed.",
    });
  }
}

export function logoutUser(req: Request, res: Response) {
  res.clearCookie("token");

  return res.status(200).json({
    message: "Logout successful.",
  });
}

export function getProfile(req: Request, res: Response) {
  return res.status(200).json({
    message: "You are authenticated.",
    user: (req as any).user,
  });
}