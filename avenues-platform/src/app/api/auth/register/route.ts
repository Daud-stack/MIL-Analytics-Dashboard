import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { DEFAULT_FACILITY_NAME } from "@/lib/app-config";
import {
  enforceDbRateLimit,
  getClientIp,
  isAdminSession,
} from "@/lib/security";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  email: z.string().trim().email("Invalid email address").max(320, "Email is too long"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(256, "Password is too long"),
  organization: z.string().trim().min(1).max(120).optional().default(DEFAULT_FACILITY_NAME),
  role: z.enum(["ADMIN", "ANALYST", "VIEWER"]).optional().default("ANALYST"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const clientIp = getClientIp(request);
    const rateLimitResult = await enforceDbRateLimit(`register:${clientIp}`, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: "Too many registration attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfterSeconds),
          },
        }
      );
    }

    const body = await request.json();
    const data = registerSchema.parse(body);
    const normalizedEmail = data.email.toLowerCase();
    const adminRequest = isAdminSession(session);
    const selfRegistrationEnabled = process.env.ALLOW_SELF_REGISTRATION === "true";

    if (!selfRegistrationEnabled && !adminRequest) {
      return NextResponse.json(
        {
          success: false,
          message: "Self-registration is disabled. Please contact an administrator.",
        },
        { status: 403 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Self-registered users get read-only access; only an admin can grant
    // ANALYST/ADMIN roles.
    const assignedRole = adminRequest ? data.role : "VIEWER";
    const organizationName = adminRequest
      ? data.organization
      : process.env.DEFAULT_ORGANIZATION_NAME || DEFAULT_FACILITY_NAME;

    const orgSlug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (!org) {
      try {
        org = await prisma.organization.create({
          data: {
            name: organizationName,
            slug: orgSlug,
          },
        });
      } catch {
        // Two concurrent registrations can race the find-then-create and hit
        // the unique constraint (P2002) - re-read instead of returning a 500.
        org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
        if (!org) throw new Error('Failed to create or find organization');
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: normalizedEmail,
        password: hashedPassword,
        role: assignedRole,
        org: { connect: { id: org.id } },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully. You can now sign in.",
        user: {
          name: user.name,
          email: user.email,
          organization: org.name,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error("[Register] Error:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred during registration" },
      { status: 500 }
    );
  }
}
