import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  organization: z.string().optional().default("Avenues Clinic"),
  role: z.enum(["ADMIN", "ANALYST", "VIEWER"]).optional().default("ANALYST"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Find or create the organization
    const orgSlug = data.organization
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    let org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: data.organization,
          slug: orgSlug,
        },
      });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase().trim(),
        password: hashedPassword,
        role: data.role,
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
