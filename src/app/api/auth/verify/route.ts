import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken, createSession, setSessionCookie } from '@/lib/auth/utils';

// POST: Verify OTP (from form submission)
export async function POST(request: NextRequest) {
  try {
    const { token, identifier, type } = await request.json();

    if (!token || !identifier || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedIdentifier = type === 'email'
      ? identifier.toLowerCase().trim()
      : identifier;

    const hashedToken = await hashToken(token);

    // Find and validate token
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedIdentifier,
        token: hashedToken,
        type,
        expiresAt: { gt: new Date() }
      }
    });

    if (!verificationToken) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // Delete used token
    await prisma.verificationToken.delete({ where: { id: verificationToken.id } });

    // Find or create user
    let user = await prisma.user.findFirst({
      where: type === 'email'
        ? { email: normalizedIdentifier }
        : { phone: normalizedIdentifier }
    });

    if (!user) {
      user = await prisma.user.create({
        data: type === 'email'
          ? { email: normalizedIdentifier, emailVerified: new Date() }
          : { phone: normalizedIdentifier, phoneVerified: new Date() }
      });

      // Create default subscription
      await prisma.subscription.create({
        data: { userId: user.id, status: 'free' }
      });
    } else {
      // Update verification timestamp
      await prisma.user.update({
        where: { id: user.id },
        data: type === 'email'
          ? { emailVerified: new Date() }
          : { phoneVerified: new Date() }
      });
    }

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id }
    });

    // Create session
    const session = await createSession(user.id, request);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        subscription: {
          status: subscription?.status || 'free',
          currentPeriodEnd: subscription?.currentPeriodEnd,
        }
      }
    });

    setSessionCookie(response, session.sessionToken);
    return response;
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

// GET: Verify magic link (from email click)
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      return NextResponse.redirect(`${baseUrl}/?error=missing_params`);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const hashedToken = await hashToken(token);

    // Find and validate token
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        token: hashedToken,
        type: 'email',
        expiresAt: { gt: new Date() }
      }
    });

    if (!verificationToken) {
      return NextResponse.redirect(`${baseUrl}/?error=invalid_token`);
    }

    // Delete used token
    await prisma.verificationToken.delete({ where: { id: verificationToken.id } });

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email: normalizedEmail, emailVerified: new Date() }
      });
      await prisma.subscription.create({
        data: { userId: user.id, status: 'free' }
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() }
      });
    }

    // Create session
    const session = await createSession(user.id, request);
    const response = NextResponse.redirect(`${baseUrl}/?success=logged_in`);
    setSessionCookie(response, session.sessionToken);

    return response;
  } catch (error) {
    console.error('Magic link verify error:', error);
    return NextResponse.redirect(`${baseUrl}/?error=verification_failed`);
  }
}
