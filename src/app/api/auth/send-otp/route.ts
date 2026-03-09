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
      body: `Your Metrix Finance code is: ${otp}. Valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
