import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token + (process.env.TOKEN_SALT || 'default-salt'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(userId: string, request: NextRequest) {
  const sessionToken = nanoid(32);
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  const session = await prisma.session.create({
    data: {
      sessionToken: await hashToken(sessionToken),
      userId,
      expiresAt,
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || undefined,
    }
  });

  return { ...session, sessionToken }; // Return unhashed token for cookie
}

export async function getSession(request: NextRequest) {
  const sessionToken = request.cookies.get('session')?.value;
  if (!sessionToken) return null;

  const hashedToken = await hashToken(sessionToken);
  const session = await prisma.session.findUnique({
    where: { sessionToken: hashedToken }
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session;
}

export async function deleteSession(request: NextRequest) {
  const sessionToken = request.cookies.get('session')?.value;
  if (!sessionToken) return;

  const hashedToken = await hashToken(sessionToken);
  await prisma.session.deleteMany({ where: { sessionToken: hashedToken } });
}

export function setSessionCookie(response: NextResponse, sessionToken: string) {
  response.cookies.set('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });
}
