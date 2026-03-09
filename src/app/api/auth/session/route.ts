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
