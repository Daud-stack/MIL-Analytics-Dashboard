import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  organization: z.string().optional().default("Avenues Clinic"),
  role: z.enum(["ADMIN", "ANALYST", "VIEWER"]).optional().default("ANALYST"),
});

type RegisterRequest = z.infer<typeof registerSchema>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = registerSchema.parse(body);

    // In development mode, we don't persist to a database
    // In production, you would:
    // 1. Check if user already exists
    // 2. Hash the password
    // 3. Create user in database
    // 4. Return success response

    if (process.env.NODE_ENV === "development") {
      // Dev mode: just validate and return success
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      // TODO: Implement database write when database is configured
      // const user = await prisma.user.create({
      //   data: {
      //     name: validatedData.name,
      //     email: validatedData.email,
      //     password: hashedPassword,
      //     organization: validatedData.organization,
      //     role: validatedData.role,
      //   },
      // });

      return NextResponse.json(
        {
          success: true,
          message: "Account created successfully. You can now sign in.",
          user: {
            name: validatedData.name,
            email: validatedData.email,
            organization: validatedData.organization,
            role: validatedData.role,
          },
        },
        { status: 201 }
      );
    }

    // Production mode: persist to database
    // This will be implemented when database is set up
    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully. You can now sign in.",
        user: {
          name: validatedData.name,
          email: validatedData.email,
          organization: validatedData.organization,
          role: validatedData.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return NextResponse.json(
        {
          success: false,
          message: firstError.message,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "An error occurred during registration",
      },
      { status: 500 }
    );
  }
}
