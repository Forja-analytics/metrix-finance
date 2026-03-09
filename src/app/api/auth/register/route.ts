import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, setSessionCookie, hashToken } from '@/lib/auth/utils';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashToken(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        passwordHash,
        emailVerified: new Date(),
      },
    });

    // Create default subscription
    await prisma.subscription.create({
      data: {
        userId: user.id,
        status: 'free',
      },
    });

    // Create session
    const session = await createSession(user.id, request);
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        subscription: { status: 'free', currentPeriodEnd: null },
      },
    });
    setSessionCookie(response, session.sessionToken);
    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
