'use client';

import { cn } from '@/lib/utils';

interface TokenIconProps {
  symbol: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-9 h-9',
  xl: 'w-12 h-12',
};

// Map of token symbols to their icon files
const tokenIcons: Record<string, string> = {
  ETH: '/tokens/eth.png',
  WETH: '/tokens/weth.png',
  USDC: '/tokens/usdc.png',
  USDT: '/tokens/usdt.svg',
  WBTC: '/tokens/wbtc.png',
  BTC: '/tokens/btc.svg',
  DAI: '/tokens/dai.svg',
  LINK: '/tokens/link.svg',
  UNI: '/tokens/uni.svg',
  AAVE: '/tokens/aave.svg',
  CRV: '/tokens/crv.svg',
  SUSHI: '/tokens/sushi.svg',
  MATIC: '/tokens/matic.png',
  ARB: '/tokens/arb.svg',
  OP: '/tokens/op.svg',
  ONDO: '/tokens/ondo.svg',
  PEPE: '/tokens/pepe.svg',
  SHIB: '/tokens/shib.svg',
  APE: '/tokens/ape.svg',
  LDO: '/tokens/ldo.svg',
  RPL: '/tokens/rpl.png',
  MKR: '/tokens/mkr.svg',
  SNX: '/tokens/snx.svg',
  COMP: '/tokens/comp.svg',
  GRT: '/tokens/grt.svg',
};

// Fallback colors for tokens without icons
const tokenColors: Record<string, string> = {
  FXS: '#000000',
  FRAX: '#000000',
  LUSD: '#2eb6ea',
  USDD: '#216bff',
  TUSD: '#2b2e7f',
  GUSD: '#00dcfa',
  BUSD: '#f0b90b',
};

const textSizeClasses = {
  sm: 'text-[8px]',
  md: 'text-[10px]',
  lg: 'text-xs',
  xl: 'text-sm',
};

export function TokenIcon({ symbol, size = 'md', className }: TokenIconProps) {
  const normalizedSymbol = symbol.toUpperCase();
  const iconPath = tokenIcons[normalizedSymbol];

  if (iconPath) {
    return (
      <div
        className={cn(
          'rounded-full bg-white flex items-center justify-center overflow-hidden',
          sizeClasses[size],
          className
        )}
      >
        <img
          src={iconPath}
          alt={normalizedSymbol}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback: colored circle with text
  const color = tokenColors[normalizedSymbol] || '#00d4aa';
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold text-white',
        sizeClasses[size],
        textSizeClasses[size],
        className
      )}
      style={{ backgroundColor: color }}
    >
      {normalizedSymbol.slice(0, 3)}
    </div>
  );
}

interface TokenPairIconProps {
  token0Symbol: string;
  token1Symbol: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TokenPairIcon({ token0Symbol, token1Symbol, size = 'md', className }: TokenPairIconProps) {
  return (
    <div className={cn('flex -space-x-2', className)}>
      <TokenIcon symbol={token0Symbol} size={size} className="z-10 ring-2 ring-background" />
      <TokenIcon symbol={token1Symbol} size={size} className="z-0" />
    </div>
  );
}
