'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { Users, Shield, ShieldOff, Trash2, RefreshCw, Search } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: string;
  emailVerified: string | null;
  createdAt: string;
  subscription: { status: string } | null;
}

export default function AdminPage() {
  const { user, isAdmin, isInitialized } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (isInitialized && !isAdmin) {
      router.push('/');
    }
  }, [isInitialized, isAdmin, router]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        setError('Failed to load users');
        return;
      }
      const data = await res.json();
      setUsers(data.users);
    } catch {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        setError(data.error || 'Failed to update role');
      }
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (userId: string, email: string | null) => {
    if (!confirm(`Delete user ${email || userId}? This cannot be undone.`)) return;
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        setError(data.error || 'Failed to delete user');
      }
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  if (!isInitialized || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-sm text-muted">
              {users.length} user{users.length !== 1 ? 's' : ''} registered
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchUsers} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-muted">Total Users</p>
          <p className="text-xl font-bold">{users.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Admins</p>
          <p className="text-xl font-bold text-primary">{users.filter(u => u.role === 'admin').length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Users</p>
          <p className="text-xl font-bold">{users.filter(u => u.role === 'user').length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Pro Subscribers</p>
          <p className="text-xl font-bold text-green-400">
            {users.filter(u => u.subscription?.status === 'pro' || u.subscription?.status === 'enterprise').length}
          </p>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          placeholder="Search by email, name, or role..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-primary/50"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card-hover/50">
                <th className="text-left px-4 py-3 font-medium text-muted">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Joined</th>
                <th className="text-right px-4 py-3 font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Loading...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    {searchQuery ? 'No users match your search' : 'No users found'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-card-hover/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{u.name || 'No name'}</p>
                        <p className="text-xs text-muted">{u.email || u.phone || 'No contact'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin'
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'bg-card-hover text-muted border border-border'
                      }`}>
                        {u.role === 'admin' ? <Shield className="w-3 h-3" /> : null}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${
                        u.subscription?.status === 'pro' ? 'text-green-400' :
                        u.subscription?.status === 'enterprise' ? 'text-yellow-400' :
                        'text-muted'
                      }`}>
                        {u.subscription?.status || 'free'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Cannot modify yourself */}
                        {u.id !== user?.id ? (
                          <>
                            <button
                              onClick={() => toggleRole(u.id, u.role)}
                              disabled={actionLoading === u.id}
                              className={`p-1.5 rounded-md transition-colors ${
                                u.role === 'admin'
                                  ? 'hover:bg-yellow-500/10 text-yellow-400'
                                  : 'hover:bg-primary/10 text-primary'
                              } disabled:opacity-50`}
                              title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                            >
                              {u.role === 'admin' ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => deleteUser(u.id, u.email)}
                              disabled={actionLoading === u.id}
                              className="p-1.5 rounded-md hover:bg-red-500/10 text-red-400 transition-colors disabled:opacity-50"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-muted italic">You</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
