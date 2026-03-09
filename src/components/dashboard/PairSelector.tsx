'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { POPULAR_TOKENS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Token {
  symbol: string;
  name: string;
  address: string;
}

interface PairSelectorProps {
  token0: Token | null;
  token1: Token | null;
  onToken0Change: (token: Token | null) => void;
  onToken1Change: (token: Token | null) => void;
}

export function PairSelector({ token0, token1, onToken0Change, onToken1Change }: PairSelectorProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs text-muted mb-1.5">Token 1</label>
          <TokenSelect
            value={token0}
            onChange={onToken0Change}
            excludeToken={token1}
            placeholder="Select token"
          />
        </div>
        <div className="pt-5">
          <div className="w-8 h-8 rounded-full bg-card-hover flex items-center justify-center">
            <span className="text-muted">/</span>
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-muted mb-1.5">Token 2</label>
          <TokenSelect
            value={token1}
            onChange={onToken1Change}
            excludeToken={token0}
            placeholder="Select token"
          />
        </div>
        {(token0 || token1) && (
          <button
            onClick={() => {
              onToken0Change(null);
              onToken1Change(null);
            }}
            className="pt-5 text-muted hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </Card>
  );
}

interface TokenSelectProps {
  value: Token | null;
  onChange: (token: Token | null) => void;
  excludeToken: Token | null;
  placeholder: string;
}

function TokenSelect({ value, onChange, excludeToken, placeholder }: TokenSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTokens = POPULAR_TOKENS.filter(
    (token) =>
      token.address !== excludeToken?.address &&
      (token.symbol.toLowerCase().includes(search.toLowerCase()) ||
        token.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-between w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg',
          'hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50'
        )}
      >
        {value ? (
          <div className="flex items-center gap-2">
            <TokenIcon symbol={value.symbol} size="sm" />
            <span className="font-medium">{value.symbol}</span>
          </div>
        ) : (
          <span className="text-muted">{placeholder}</span>
        )}
        <ChevronDown className={cn('w-4 h-4 text-muted transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tokens..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredTokens.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted">No tokens found</div>
            ) : (
              filteredTokens.map((token) => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => {
                    onChange(token);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-card-hover transition-colors',
                    value?.address === token.address && 'bg-primary/10'
                  )}
                >
                  <TokenIcon symbol={token.symbol} size="md" />
                  <div>
                    <span className="font-medium">{token.symbol}</span>
                    <span className="text-xs text-muted block">{token.name}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
