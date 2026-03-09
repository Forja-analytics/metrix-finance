'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu, X, LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageSelector } from '@/components/layout/LanguageSelector';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { isPro, setAuthModalOpen } = useStore();
  const { user, isAuthenticated, logout, isInitialized } = useAuth();
  const t = useTranslation();

  const navLinks = [
    { href: '/', label: t('discover') },
    { href: '/simulate', label: t('simulate') },
    { href: '/track', label: t('track') },
    { href: '/pricing', label: t('pricing') },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Three bars with dots representing metrics/analytics */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0f1a14] to-[#152a1e] border border-primary/30 flex items-end justify-center gap-[3px] p-1.5 shadow-lg shadow-primary/10">
              {/* Three vertical bars with dots - matching the logo design */}
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <div className="w-1.5 h-2 bg-primary rounded-sm" />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <div className="w-1.5 h-4 bg-primary rounded-sm" />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <div className="w-1.5 h-3 bg-primary rounded-sm" />
              </div>
            </div>
            <span className="font-semibold text-lg hidden sm:block tracking-tight">
              <span className="text-primary">Principia</span>
              <span className="text-muted ml-1 font-normal">Metrics</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  pathname === link.href
                    ? 'text-primary bg-primary/10'
                    : 'text-muted hover:text-foreground hover:bg-card'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:block w-64">
              <Input
                placeholder={t('searchPools')}
                icon={<Search className="w-4 h-4" />}
              />
            </div>

            {isPro && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full border border-primary/30 glow-accent">
                <span className="text-xs font-medium text-primary">{t('pro')}</span>
              </div>
            )}

            {/* Language Selector */}
            <LanguageSelector />

            {/* Auth State */}
            {isInitialized && (
              <>
                {isAuthenticated ? (
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-card hover:bg-card-hover border border-border rounded-lg transition-colors"
                    >
                      <User className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium hidden sm:block max-w-[120px] truncate">
                        {user?.email || user?.phone || 'Account'}
                      </span>
                    </button>
                    {userMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setUserMenuOpen(false)}
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                          <div className="px-3 py-2 border-b border-border">
                            <p className="text-xs text-muted">Signed in as</p>
                            <p className="text-sm font-medium truncate">
                              {user?.email || user?.phone}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              logout();
                              setUserMenuOpen(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-muted hover:text-foreground hover:bg-background flex items-center gap-2"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign out
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAuthModalOpen(true)}
                    className="hidden sm:flex"
                  >
                    Sign In
                  </Button>
                )}
              </>
            )}

            {/* Wallet Connect Button - chain status hidden per user request */}
            <ConnectButton
              showBalance={false}
              chainStatus="none"
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
            />

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden p-2 text-muted hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'block px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  pathname === link.href
                    ? 'text-primary bg-primary/10'
                    : 'text-muted hover:text-foreground hover:bg-card'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="px-4 pb-4 space-y-3">
            <Input
              placeholder={t('searchPools')}
              icon={<Search className="w-4 h-4" />}
            />
            {isInitialized && !isAuthenticated && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setAuthModalOpen(true);
                  setMobileMenuOpen(false);
                }}
              >
                Sign In
              </Button>
            )}
            {isInitialized && isAuthenticated && (
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-sm text-muted hover:text-foreground flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign out ({user?.email || user?.phone})
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
