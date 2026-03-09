'use client';

import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        suppressHydrationWarning
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-gradient-to-r from-primary to-accent hover:from-primary-hover hover:to-primary text-background shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30': variant === 'primary',
            'bg-card hover:bg-card-hover text-foreground border border-border hover:border-primary/30': variant === 'secondary',
            'hover:bg-card/50 text-foreground': variant === 'ghost',
            'border border-border hover:bg-card hover:border-primary/30 text-foreground': variant === 'outline',
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
