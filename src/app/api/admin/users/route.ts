import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionWithRole } from '@/lib/auth/utils';

// Helper: verify the request comes from an admin
async function requireAdmin(request: NextRequest) {
  const session = await getSessionWithRole(request);
  if (!session || session.role !== 'admin') {
    return null;
  }
  return session;
}

// GET /api/admin/users — list all users
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      subscription: {
        select: { status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ users });
}

// PATCH /api/admin/users — update a user's role
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId, role } = await request.json();

  if (!userId || !role || !['user', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid userId or role' }, { status: 400 });
  }

  // Prevent admin from demoting themselves
  if (userId === admin.userId && role !== 'admin') {
    return NextResponse.json({ error: 'Cannot remove your own admin role' }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json({ user: updated });
}

// DELETE /api/admin/users — delete a user
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  // Prevent admin from deleting themselves
  if (userId === admin.userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ success: true });
}
