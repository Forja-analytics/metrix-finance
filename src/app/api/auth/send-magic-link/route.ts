import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { hashToken } from '@/lib/auth/utils';

// Force dynamic rendering - don't try to statically optimize this route at build time
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    // Initialize Resend only after validation
    const resend = new Resend(process.env.RESEND_API_KEY);

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
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background: #0a0a0a;">
            <div style="max-width: 480px; margin: 0 auto; background: #1a1a1a; border-radius: 16px; padding: 40px; border: 1px solid #333;">
              <h1 style="color: #fff; margin: 0 0 8px 0; font-size: 24px;">Sign in to Metrix Finance</h1>
              <p style="color: #888; margin: 0 0 32px 0; font-size: 16px;">Click the button below to sign in. This link expires in 15 minutes.</p>
              <a href="${magicLink}"
                 style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white;
                        padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600;
                        font-size: 16px;">
                Sign In to Metrix
              </a>
              <p style="color: #666; font-size: 14px; margin-top: 32px;">
                If you didn't request this email, you can safely ignore it.
              </p>
              <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
              <p style="color: #555; font-size: 12px; margin: 0;">
                Or copy this link: <span style="color: #6366f1;">${magicLink}</span>
              </p>
            </div>
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
