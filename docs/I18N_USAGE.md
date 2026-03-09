# i18n (Internationalization) Usage Guide

## Overview

The Principia Metrics platform now supports 5 languages:
- English (EN) 🇬🇧
- Spanish (ES) 🇪🇸
- Portuguese (PT) 🇧🇷
- French (FR) 🇫🇷
- German (DE) 🇩🇪

## How It Works

The i18n system uses:
1. **Zustand Store** - Persists language selection to localStorage
2. **Custom Hook** - `useTranslation()` provides access to translations
3. **Type-Safe Keys** - TypeScript ensures all translation keys exist

## Using Translations in Components

### Basic Usage

```typescript
'use client';

import { useTranslation } from '@/hooks/useTranslation';

export function MyComponent() {
  const t = useTranslation();

  return (
    <div>
      <h1>{t('discover')}</h1>
      <button>{t('refresh')}</button>
      <input placeholder={t('search')} />
    </div>
  );
}
```

### Available Translation Keys

See `src/lib/i18n.ts` for all available keys. Common keys include:

**Navigation:**
- `discover`, `simulate`, `track`, `pricing`

**Common UI:**
- `search`, `refresh`, `loading`, `error`, `save`, `cancel`, `delete`, `edit`, `add`, `remove`

**Track Page Metrics:**
- `currentLiquidity`, `earnings`, `profitLoss`, `apr`, `deposits`, `withdrawals`
- `unclaimed`, `claimed`, `retention`, `vsHodl`, `assetGain`, `roi`
- `projection24h`, `projection7d`, `projection30d`

**Pool Terms:**
- `totalValue`, `feesEarned`, `tvl`, `volume24h`, `fees24h`, `feeTier`, `priceRange`

**Position States:**
- `loadingPositions`, `noPositionsFound`, `openedPositions`, `closedPositions`

## Language Selector Component

The language selector is already integrated in the Navbar between the PRO badge and ConnectButton.

Users can:
1. Click the globe icon to open the language dropdown
2. Select from 5 languages with flag icons
3. Language preference is saved to localStorage

## Adding New Translations

### 1. Add Translation Key to All Languages

Edit `src/lib/i18n.ts`:

```typescript
export const translations = {
  en: {
    // ... existing translations
    myNewKey: 'My New Translation',
  },
  es: {
    // ... existing translations
    myNewKey: 'Mi Nueva Traducción',
  },
  // ... add to all 5 languages (pt, fr, de)
};
```

### 2. Use the New Key

```typescript
const t = useTranslation();
<p>{t('myNewKey')}</p>
```

TypeScript will autocomplete and type-check all translation keys!

## Accessing Current Language

```typescript
import { useStore } from '@/lib/store';

export function MyComponent() {
  const { language } = useStore();

  // language will be: 'en' | 'es' | 'pt' | 'fr' | 'de'
  console.log('Current language:', language);
}
```

## Programmatically Changing Language

```typescript
import { useStore } from '@/lib/store';

export function MyComponent() {
  const { setLanguage } = useStore();

  const handleChangeToSpanish = () => {
    setLanguage('es');
  };
}
```

## Best Practices

1. **Always use the hook** - Don't hardcode strings that should be translated
2. **Keep keys semantic** - Use descriptive names like `connectWallet` not `string1`
3. **Maintain parity** - When adding a key, add it to ALL 5 languages
4. **Use proper capitalization** - Match the capitalization of the original design
5. **Context matters** - Some words translate differently based on context (e.g., "track" as noun vs verb)

## Language Metadata

Access language information:

```typescript
import { LANGUAGES, Language } from '@/lib/i18n';

const languageInfo = LANGUAGES['es'];
// {
//   code: 'es',
//   name: 'Spanish',
//   nativeName: 'Español',
//   flag: '🇪🇸'
// }
```

## File Structure

```
src/
├── lib/
│   ├── i18n.ts                    # Translation dictionaries
│   └── store.ts                   # Language state management
├── hooks/
│   └── useTranslation.ts          # Translation hook
└── components/
    └── layout/
        ├── Navbar.tsx             # Uses translations
        └── LanguageSelector.tsx   # Language dropdown
```

## Testing Translations

1. Open the app in your browser
2. Click the globe icon in the Navbar
3. Select a language
4. Verify navigation items and UI elements change
5. Refresh the page - language should persist

## Future Enhancements

Consider adding:
- Date/number formatting per locale
- Right-to-left (RTL) language support
- Dynamic translation loading (code splitting)
- Translation management service integration
- Pluralization rules
- String interpolation with variables
