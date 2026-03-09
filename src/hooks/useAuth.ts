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

  const syncSubscription = useCallback((userData: User | null) => {
    if (userData?.subscription) {
      const isPro = userData.subscription.status === 'pro' ||
                    userData.subscription.status === 'enterprise';
      setIsPro(isPro);
    } else {
      setIsPro(false);
    }
  }, [setIsPro]);

  // Fetch session on mount
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        setUser(data.user);
        syncSubscription(data.user);
      } catch (error) {
        console.error('Failed to fetch session:', error);
        setIsPro(false);
      } finally {
        setIsInitialized(true);
      }
    };

    fetchSession();
  }, [setIsPro, syncSubscription]);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        syncSubscription(data.user);
      }
      return { success: res.ok, error: data.error };
    } catch {
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  }, [syncSubscription]);

  const register = useCallback(async (email: string, password: string, name?: string): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        syncSubscription(data.user);
      }
      return { success: res.ok, error: data.error };
    } catch {
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  }, [syncSubscription]);

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
      syncSubscription(data.user);
    } catch (error) {
      console.error('Refresh session error:', error);
    }
  }, [syncSubscription]);

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
        syncSubscription(data.user);
      }
      return { success: res.ok, error: data.error };
    } catch {
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  }, [syncSubscription]);

  const createCheckout = useCallback(async (priceId: string): Promise<{ url?: string; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        return { url: data.url };
      }
      return { error: data.error || 'Failed to create checkout' };
    } catch {
      return { error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openBillingPortal = useCallback(async (): Promise<{ url?: string; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/stripe/create-portal', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.url) {
        return { url: data.url };
      }
      return { error: data.error || 'Failed to open portal' };
    } catch {
      return { error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    isLoading,
    isInitialized,
    isAuthenticated: !!user,
    isPro: user?.subscription?.status === 'pro' || user?.subscription?.status === 'enterprise',
    subscriptionStatus: user?.subscription?.status || 'free',
    login,
    register,
    sendMagicLink,
    sendOTP,
    verifyOTP,
    logout,
    refreshSession,
    createCheckout,
    openBillingPortal,
  };
}
