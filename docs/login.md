# Metrix Finance - Authentication System Implementation Guide

> Complete guide for implementing passwordless authentication with email magic links, SMS OTP, Stripe subscriptions, and Railway PostgreSQL.

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [External Service Setup](#external-service-setup)
4. [Database Schema](#database-schema)
5. [Implementation Steps](#implementation-steps)
6. [API Routes Reference](#api-routes-reference)
7. [Frontend Components](#frontend-components)
8. [Environment Variables](#environment-variables)
9. [Security Considerations](#security-considerations)
10. [Testing Checklist](#testing-checklist)

---

## Overview

### What We're Building
- **Passwordless authentication** - No passwords to remember or manage
- **Email magic links** - One-click sign-in via email (Resend)
- **SMS OTP** - 6-digit verification codes via SMS (Twilio)
- **Stripe subscriptions** - Pro ($19/mo) and Enterprise ($99/mo) plans
- **Railway PostgreSQL** - Persistent user and subscription storage

### User Preferences
- Auth Methods: Both Email + SMS
- Email Domain: Using Resend's test domain (`onboarding@resend.dev`)
- Existing Services: Railway (deployment only)
- Accounts to Create: Stripe, Resend, Twilio, Railway PostgreSQL

### Tech Stack Additions
| Library | Purpose | Installation |
|---------|---------|--------------|
| `prisma` | Database ORM | `npm install prisma @prisma/client` |
| `resend` | Email magic links | `npm install resend` |
| `twilio` | SMS OTP | `npm install twilio` |
| `jose` | JWT/session tokens | `npm install jose` |
| `stripe` | Payment processing | `npm install stripe` |
| `nanoid` | Secure token generation | `npm install nanoid` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  AuthModal   │  │   Navbar     │  │   Pricing    │          │
│  │  (passwordless│  │   (auth      │  │   (Stripe    │          │
│  │   flows)     │  │    state)    │  │    checkout) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                  │                   │
│         └─────────────────┼──────────────────┘                  │
│                           │                                      │
│                    ┌──────┴──────┐                              │
│                    │  useAuth()  │  ← Zustand store sync        │
│                    │    Hook     │                               │
│                    └──────┬──────┘                              │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                     API ROUTES                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ /api/auth/                                                │   │
│  │   ├── send-magic-link  → Resend email                    │   │
│  │   ├── send-otp         → Twilio SMS                      │   │
│  │   ├── verify           → Validate token, create session  │   │
│  │   └── session          → Get/delete session              │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ /api/stripe/                                              │   │
│  │   ├── create-checkout  → Stripe Checkout Session         │   │
│  │   ├── create-portal    → Customer billing portal         │   │
│  │   └── webhook          → Handle subscription events      │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                     EXTERNAL SERVICES                            │
│                           │                                      │
│   ┌───────────┐   ┌───────┴───────┐   ┌───────────┐            │
│   │  Resend   │   │   Railway     │   │  Twilio   │            │
│   │  (Email)  │   │  PostgreSQL   │   │  (SMS)    │            │
│   │  Free:    │   │               │   │  Trial:   │            │
│   │  3000/mo  │   │  ┌─────────┐  │   │  $15      │            │
│   └───────────┘   │  │  Users  │  │   └───────────┘            │
│                   │  │Sessions │  │                             │
│   ┌───────────┐   │  │Tokens   │  │                             │
│   │  Stripe   │   │  │Subs     │  │                             │
│   │ (Payments)│   │  └─────────┘  │                             │
│   │ 2.9%+30¢  │   └───────────────┘                             │
│   └───────────┘                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## External Service Setup

### 1. Railway PostgreSQL

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New** → **Database** → **PostgreSQL**
3. Wait for provisioning (~30 seconds)
4. Click on the database → **Connect** tab
5. Copy the `DATABASE_URL` (starts with `postgresql://...`)

### 2. Resend (Email Magic Links)

1. Sign up at [resend.com](https://resend.com)
2. Go to **API Keys** → **Create API Key**
3. Copy the API key (starts with `re_...`)
4. Note: Emails will be sent from `onboarding@resend.dev` (test domain)
5. Free tier: 3,000 emails/month, 100 emails/day

### 3. Twilio (SMS OTP)

1. Sign up at [twilio.com](https://www.twilio.com/try-twilio)
2. Complete verification (they'll send you a code)
3. From Console Dashboard, copy:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click to reveal)
4. Go to **Phone Numbers** → **Manage** → **Buy a number**
   - Get a US number with SMS capability (~$1/month, covered by trial)
5. Trial gives ~$15 credit (~1,900 SMS messages in US)

### 4. Stripe (Payments)

1. Sign up at [stripe.com](https://stripe.com)
2. Go to **Developers** → **API Keys**
   - Copy **Secret key** (starts with `sk_test_...`)
3. Create Products:
   - Go to **Products** → **Add product**
   - **Pro Plan**: $19/month, recurring
   - **Enterprise Plan**: $99/month, recurring
   - Copy each **Price ID** (starts with `price_...`)
4. Set up Webhook:
   - Go to **Developers** → **Webhooks** → **Add endpoint**
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy **Signing secret** (starts with `whsec_...`)

---

## Database Schema

### Prisma Schema File

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String        @id @default(cuid())
  email         String?       @unique
  phone         String?       @unique
  name          String?
  emailVerified DateTime?
  phoneVerified DateTime?
  image         String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  sessions     Session[]
  subscription Subscription?
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expiresAt    DateTime
  userAgent    String?
  ipAddress    String?
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

model VerificationToken {
  id         String   @id @default(cuid())
  identifier String   // email or phone number
  token      String   @unique // hashed token
  type       String   // 'email' | 'sms'
  expiresAt  DateTime
  createdAt  DateTime @default(now())

  @@index([identifier])
  @@index([expiresAt])
}

model Subscription {
  id                   String    @id @default(cuid())
  userId               String    @unique
  stripeCustomerId     String?   @unique
  stripeSubscriptionId String?   @unique
  stripePriceId        String?
  status               String    @default("free") // free, pro, enterprise, canceled
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean   @default(false)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([stripeCustomerId])
}
```

### Migration Commands

```bash
# Initialize Prisma (if not done)
npx prisma init

# Create and apply migration
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate

# View database in browser
npx prisma studio
```

---

## Implementation Steps

### Phase 1: Database Setup

#### Step 1.1: Install Dependencies
```bash
cd metrix-finance
npm install prisma @prisma/client
npm install resend twilio jose nanoid stripe
```

#### Step 1.2: Initialize Prisma
```bash
npx prisma init
```

#### Step 1.3: Add DATABASE_URL to `.env.local`
```env
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
```

#### Step 1.4: Create Prisma Client Singleton

Create `src/lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

#### Step 1.5: Run Migrations
```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

### Phase 2: Auth Infrastructure

#### Step 2.1: Create Auth Utilities

Create `src/lib/auth/utils.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token + process.env.TOKEN_SALT);
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
```

#### Step 2.2: Create Send Magic Link Route

Create `src/app/api/auth/send-magic-link/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { hashToken } from '@/lib/auth/utils';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Generate token
    const token = nanoid(32);
    const hashedToken = await hashToken(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Delete existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: normalizedEmail }
    });

    // Create new token
    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: hashedToken,
        type: 'email',
        expiresAt,
      }
    });

    // Build magic link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const magicLink = `${baseUrl}/api/auth/verify?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send email via Resend
    await resend.emails.send({
      from: 'Metrix Finance <onboarding@resend.dev>',
      to: normalizedEmail,
      subject: 'Sign in to Metrix Finance',
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: sans-serif; padding: 20px;">
            <h1 style="color: #6366f1;">Sign in to Metrix Finance</h1>
            <p>Click the button below to sign in. This link expires in 15 minutes.</p>
            <a href="${magicLink}"
               style="display: inline-block; background: #6366f1; color: white;
                      padding: 12px 24px; border-radius: 8px; text-decoration: none;
                      margin: 20px 0;">
              Sign In to Metrix Finance
            </a>
            <p style="color: #666; font-size: 14px;">
              If you didn't request this email, you can safely ignore it.
            </p>
            <p style="color: #666; font-size: 12px;">
              Or copy this link: ${magicLink}
            </p>
          </body>
        </html>
      `
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send magic link error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
```

#### Step 2.3: Create Send OTP Route

Create `src/app/api/auth/send-otp/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/auth/utils';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    // Validate E.164 format (+1234567890)
    if (!phone || !/^\+[1-9]\d{1,14}$/.test(phone)) {
      return NextResponse.json({
        error: 'Invalid phone number. Use format: +1234567890'
      }, { status: 400 });
    }

    // Rate limiting: max 3 OTPs per phone per hour
    const recentTokens = await prisma.verificationToken.count({
      where: {
        identifier: phone,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
      }
    });

    if (recentTokens >= 3) {
      return NextResponse.json({
        error: 'Too many requests. Please try again later.'
      }, { status: 429 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedToken = await hashToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create token (don't delete old ones for rate limiting to work)
    await prisma.verificationToken.create({
      data: {
        identifier: phone,
        token: hashedToken,
        type: 'sms',
        expiresAt,
      }
    });

    // Send SMS via Twilio
    await twilioClient.messages.create({
      body: `Your Metrix Finance verification code is: ${otp}. Valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
```

#### Step 2.4: Create Verify Route

Create `src/app/api/auth/verify/route.ts`:
```typescript
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
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/?error=verification_failed`);
  }
}
```

#### Step 2.5: Create Session Route

Create `src/app/api/auth/session/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, deleteSession } from '@/lib/auth/utils';
import { prisma } from '@/lib/prisma';

// GET: Get current session
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json({ user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { subscription: true }
    });

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        subscription: {
          status: user.subscription?.status || 'free',
          currentPeriodEnd: user.subscription?.currentPeriodEnd,
        }
      }
    });
  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json({ user: null });
  }
}

// DELETE: Logout
export async function DELETE(request: NextRequest) {
  try {
    await deleteSession(request);
    const response = NextResponse.json({ success: true });
    response.cookies.delete('session');
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
```

---

### Phase 3: Frontend Integration

#### Step 3.1: Create useAuth Hook

Create `src/hooks/useAuth.ts`:
```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';

interface User {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  subscription: {
    status: 'free' | 'pro' | 'enterprise' | 'canceled';
    currentPeriodEnd: string | null;
  };
}

interface AuthResult {
  success: boolean;
  error?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { setIsPro } = useStore();

  // Fetch session on mount
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        setUser(data.user);

        // Sync subscription status to Zustand
        if (data.user?.subscription) {
          const isPro = data.user.subscription.status === 'pro' ||
                        data.user.subscription.status === 'enterprise';
          setIsPro(isPro);
        } else {
          setIsPro(false);
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
        setIsPro(false);
      } finally {
        setIsInitialized(true);
      }
    };

    fetchSession();
  }, [setIsPro]);

  const sendMagicLink = useCallback(async (email: string): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      return { success: res.ok, error: data.error };
    } catch {
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendOTP = useCallback(async (phone: string): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      return { success: res.ok, error: data.error };
    } catch {
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOTP = useCallback(async (phone: string, otp: string): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: phone, token: otp, type: 'sms' }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        const isPro = data.user.subscription?.status === 'pro' ||
                      data.user.subscription?.status === 'enterprise';
        setIsPro(isPro);
      }
      return { success: res.ok, error: data.error };
    } catch {
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  }, [setIsPro]);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      setUser(null);
      setIsPro(false);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setIsPro]);

  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      setUser(data.user);
      if (data.user?.subscription) {
        const isPro = data.user.subscription.status === 'pro' ||
                      data.user.subscription.status === 'enterprise';
        setIsPro(isPro);
      }
    } catch (error) {
      console.error('Refresh session error:', error);
    }
  }, [setIsPro]);

  return {
    user,
    isLoading,
    isInitialized,
    isAuthenticated: !!user,
    isPro: user?.subscription?.status === 'pro' || user?.subscription?.status === 'enterprise',
    sendMagicLink,
    sendOTP,
    verifyOTP,
    logout,
    refreshSession,
  };
}
```

#### Step 3.2: Update AuthModal Component

Replace `src/components/layout/AuthModal.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { X, Mail, Phone, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

type AuthStep = 'method' | 'email' | 'phone' | 'verify-email' | 'verify-phone';

export function AuthModal() {
  const { isAuthModalOpen, setAuthModalOpen } = useStore();
  const { sendMagicLink, sendOTP, verifyOTP, isLoading } = useAuth();
  const [step, setStep] = useState<AuthStep>('method');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  if (!isAuthModalOpen) return null;

  const handleSendMagicLink = async () => {
    setError('');
    const result = await sendMagicLink(email);
    if (result.success) {
      setStep('verify-email');
    } else {
      setError(result.error || 'Failed to send email');
    }
  };

  const handleSendOTP = async () => {
    setError('');
    // Ensure phone has + prefix
    const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    const result = await sendOTP(formattedPhone);
    if (result.success) {
      setPhone(formattedPhone);
      setStep('verify-phone');
    } else {
      setError(result.error || 'Failed to send code');
    }
  };

  const handleVerifyOTP = async () => {
    setError('');
    const result = await verifyOTP(phone, otp);
    if (result.success) {
      handleClose();
    } else {
      setError(result.error || 'Invalid code');
    }
  };

  const handleClose = () => {
    setAuthModalOpen(false);
    // Reset form after animation
    setTimeout(() => {
      setStep('method');
      setEmail('');
      setPhone('');
      setOtp('');
      setError('');
    }, 200);
  };

  const handleBack = () => {
    setError('');
    setStep('method');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="p-6 pb-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'method' && (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 text-muted hover:text-foreground rounded-lg hover:bg-background transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-semibold">
                {step === 'method' && 'Sign in to Metrix'}
                {step === 'email' && 'Enter your email'}
                {step === 'phone' && 'Enter your phone'}
                {step === 'verify-email' && 'Check your email'}
                {step === 'verify-phone' && 'Enter verification code'}
              </h2>
              <p className="text-sm text-muted mt-1">
                {step === 'method' && 'Choose how you want to sign in'}
                {step === 'email' && "We'll send you a magic link"}
                {step === 'phone' && "We'll send you a verification code"}
                {step === 'verify-email' && 'Click the link we sent you'}
                {step === 'verify-phone' && 'Enter the 6-digit code'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Method Selection */}
          {step === 'method' && (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-14 text-left"
                onClick={() => setStep('email')}
              >
                <Mail className="w-5 h-5 mr-3 text-primary" />
                <div>
                  <div className="font-medium">Continue with Email</div>
                  <div className="text-xs text-muted">We&apos;ll send you a magic link</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-14 text-left"
                onClick={() => setStep('phone')}
              >
                <Phone className="w-5 h-5 mr-3 text-primary" />
                <div>
                  <div className="font-medium">Continue with Phone</div>
                  <div className="text-xs text-muted">We&apos;ll send you a code via SMS</div>
                </div>
              </Button>
            </div>
          )}

          {/* Email Input */}
          {step === 'email' && (
            <div className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && email && handleSendMagicLink()}
              />
              <Button
                className="w-full"
                onClick={handleSendMagicLink}
                disabled={isLoading || !email || !email.includes('@')}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Send Magic Link
              </Button>
            </div>
          )}

          {/* Phone Input */}
          {step === 'phone' && (
            <div className="space-y-4">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                placeholder="+1 555 000 0000"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && phone && handleSendOTP()}
              />
              <p className="text-xs text-muted">
                Enter your phone number with country code (e.g., +1 for US)
              </p>
              <Button
                className="w-full"
                onClick={handleSendOTP}
                disabled={isLoading || phone.length < 10}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Phone className="w-4 h-4 mr-2" />
                )}
                Send Code
              </Button>
            </div>
          )}

          {/* Email Verification Pending */}
          {step === 'verify-email' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <p className="text-muted">We sent a magic link to</p>
              <p className="font-medium text-lg">{email}</p>
              <p className="text-sm text-muted mt-4">
                Click the link in the email to sign in.<br />
                The link expires in 15 minutes.
              </p>
              <Button
                variant="ghost"
                className="mt-6"
                onClick={() => setStep('email')}
              >
                Use a different email
              </Button>
            </div>
          )}

          {/* OTP Input */}
          {step === 'verify-phone' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-muted text-sm">Enter the code sent to</p>
                <p className="font-medium">{phone}</p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-4 bg-background border border-border rounded-lg text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
                maxLength={6}
                onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && handleVerifyOTP()}
              />
              <Button
                className="w-full"
                onClick={handleVerifyOTP}
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Verify Code
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setOtp('');
                  handleSendOTP();
                }}
                disabled={isLoading}
              >
                Resend code
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### Step 3.3: Update Store

Add to `src/lib/store.ts` (add these fields to the interface and implementation):

```typescript
// Add to AppState interface
interface AppState {
  // ... existing fields ...

  // User state (synced from server session)
  user: {
    id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
    subscription: {
      status: 'free' | 'pro' | 'enterprise' | 'canceled';
      currentPeriodEnd: string | null;
    };
  } | null;
  setUser: (user: AppState['user']) => void;
}

// Add to store implementation
user: null,
setUser: (user) => {
  set({ user });
  // Auto-sync isPro when user changes
  if (user?.subscription) {
    const isPro = user.subscription.status === 'pro' ||
                  user.subscription.status === 'enterprise';
    set({ isPro });
  } else {
    set({ isPro: false });
  }
},
```

---

### Phase 4: Stripe Integration

#### Step 4.1: Create Checkout Route

Create `src/app/api/stripe/create-checkout/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/auth/utils';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { priceId } = await request.json();

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { subscription: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create or get Stripe customer
    let customerId = user.subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        phone: user.phone || undefined,
        metadata: { userId: user.id }
      });
      customerId = customer.id;
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/pricing?success=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      metadata: { userId: user.id },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Create checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}
```

#### Step 4.2: Create Portal Route

Create `src/app/api/stripe/create-portal/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSession } from '@/lib/auth/utils';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.userId }
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${baseUrl}/pricing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Create portal error:', error);
    return NextResponse.json({ error: 'Failed to create portal' }, { status: 500 });
  }
}
```

#### Step 4.3: Create Webhook Route

Create `src/app/api/stripe/webhook/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          const priceId = subscription.items.data[0].price.id;
          const status = priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID
            ? 'enterprise'
            : 'pro';

          await prisma.subscription.upsert({
            where: { userId },
            update: {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
              status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            },
            create: {
              userId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
              status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            }
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0].price.id;

        let status: string;
        if (subscription.status !== 'active') {
          status = 'canceled';
        } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
          status = 'enterprise';
        } else {
          status = 'pro';
        }

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status,
            stripePriceId: priceId,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          }
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { status: 'free', cancelAtPeriodEnd: false }
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}

// Stripe requires raw body, disable body parsing
export const config = {
  api: { bodyParser: false }
};
```

---

## Environment Variables

Complete `.env.local` file:

```env
# ===========================================
# DATABASE (Railway PostgreSQL)
# ===========================================
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_HOST.railway.app:5432/railway"

# ===========================================
# AUTH SECRETS (generate with: openssl rand -base64 32)
# ===========================================
JWT_SECRET="your-256-bit-secret-here"
TOKEN_SALT="your-token-salt-secret-here"

# ===========================================
# RESEND (Email Magic Links)
# Free: 3,000 emails/month
# https://resend.com/api-keys
# ===========================================
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"

# ===========================================
# TWILIO (SMS OTP)
# Trial: $15 credit (~1,900 SMS)
# https://console.twilio.com
# ===========================================
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_PHONE_NUMBER="+15551234567"

# ===========================================
# STRIPE (Payments)
# https://dashboard.stripe.com/apikeys
# ===========================================
STRIPE_SECRET_KEY="sk_test_xxxxxxxxxxxxxxxxxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxxxxxx"
STRIPE_PRO_PRICE_ID="price_xxxxxxxxxxxxxxxxxxxx"
STRIPE_ENTERPRISE_PRICE_ID="price_xxxxxxxxxxxxxxxxxxxx"

# ===========================================
# APP
# ===========================================
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ===========================================
# EXISTING VARS (keep these)
# ===========================================
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your_existing_value"
NEXT_PUBLIC_ALCHEMY_API_KEY="your_existing_value"
NEXT_PUBLIC_GRAPH_API_KEY="your_existing_value"
```

---

## Security Considerations

### Token Security
- All tokens hashed with SHA-256 + salt before database storage
- Magic links expire in 15 minutes
- OTP codes expire in 10 minutes
- Tokens are single-use (deleted immediately after verification)

### Session Security
- Session tokens stored as httpOnly cookies (not accessible via JavaScript)
- Secure flag enabled in production (HTTPS only)
- SameSite=Lax prevents CSRF attacks
- 30-day expiration with automatic cleanup possible

### Rate Limiting
- SMS OTP: Maximum 3 codes per phone number per hour
- Consider adding IP-based rate limiting for production

### Input Validation
- Email format validation before sending
- Phone number E.164 format validation (+1234567890)
- OTP numeric validation (exactly 6 digits)

### Stripe Webhooks
- Signature verification on all webhook events
- Metadata used to link sessions to users
- Idempotent handling (upsert operations)

---

## Testing Checklist

### Phase 1: Database
- [ ] Railway PostgreSQL created
- [ ] DATABASE_URL in .env.local
- [ ] `npx prisma migrate dev` successful
- [ ] `npx prisma studio` shows empty tables

### Phase 2: Auth Infrastructure
- [ ] All auth dependencies installed
- [ ] Auth utility functions created
- [ ] API routes return proper responses

### Phase 3: Frontend
- [ ] AuthModal opens with method selection
- [ ] Email flow: enter email → send → check inbox
- [ ] Magic link in email redirects and logs in
- [ ] SMS flow: enter phone → send → enter OTP → logged in
- [ ] Logout clears session
- [ ] Refresh page maintains session
- [ ] Navbar shows logged-in state

### Phase 4: Stripe
- [ ] Stripe products/prices created
- [ ] Checkout redirects to Stripe
- [ ] Successful payment updates subscription
- [ ] `isPro` reflects subscription status
- [ ] Customer portal accessible
- [ ] Webhook handles events correctly

### Integration
- [ ] Web3 wallet connection still works
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Error states handled gracefully

---

## Quick Reference Commands

```bash
# Install all dependencies
npm install prisma @prisma/client resend twilio jose nanoid stripe

# Initialize Prisma
npx prisma init

# Run migration
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# View database
npx prisma studio

# Test Stripe webhook locally
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Generate secrets
openssl rand -base64 32
```

---

## File Checklist

### Files to Create
- [ ] `prisma/schema.prisma`
- [ ] `src/lib/prisma.ts`
- [ ] `src/lib/auth/utils.ts`
- [ ] `src/hooks/useAuth.ts`
- [ ] `src/app/api/auth/send-magic-link/route.ts`
- [ ] `src/app/api/auth/send-otp/route.ts`
- [ ] `src/app/api/auth/verify/route.ts`
- [ ] `src/app/api/auth/session/route.ts`
- [ ] `src/app/api/stripe/create-checkout/route.ts`
- [ ] `src/app/api/stripe/create-portal/route.ts`
- [ ] `src/app/api/stripe/webhook/route.ts`

### Files to Modify
- [ ] `src/components/layout/AuthModal.tsx` (rewrite)
- [ ] `src/lib/store.ts` (add user state)
- [ ] `src/components/layout/Navbar.tsx` (show auth state)
- [ ] `src/app/pricing/page.tsx` (integrate checkout)
- [ ] `package.json` (add dependencies)
- [ ] `.env.local` (add new variables)
