'use client';

import { useState } from 'react';
import { X, Loader2, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

type AuthMode = 'login' | 'register';

export function AuthModal() {
  const { isAuthModalOpen, setAuthModalOpen } = useStore();
  const { login, register, isLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async () => {
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (mode === 'register' && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    let result;
    if (mode === 'login') {
      result = await login(email, password);
    } else {
      result = await register(email, password, name || undefined);
    }

    if (result.success) {
      handleClose();
    } else {
      setError(result.error || 'Something went wrong');
    }
  };

  const handleClose = () => {
    setAuthModalOpen(false);
    setTimeout(() => {
      setMode('login');
      setEmail('');
      setPassword('');
      setName('');
      setError('');
      setShowPassword(false);
    }, 200);
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-0 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {mode === 'login' ? 'Sign in to Metrix' : 'Create an account'}
            </h2>
            <p className="text-sm text-muted mt-1">
              {mode === 'login'
                ? 'Enter your credentials to access your account'
                : 'Sign up to start tracking your positions'}
            </p>
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

          {/* Name (register only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Min. 6 characters' : 'Your password'}
                className="w-full px-4 py-3 pr-12 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isLoading || !email || !password}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : mode === 'login' ? (
              <LogIn className="w-4 h-4 mr-2" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>

          {/* Toggle mode */}
          <div className="text-center pt-2">
            <button
              onClick={toggleMode}
              className="text-sm text-muted hover:text-primary transition-colors"
            >
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-xs text-muted">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
