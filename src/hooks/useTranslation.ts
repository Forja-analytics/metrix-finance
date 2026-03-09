'use client';

import { useStore } from '@/lib/store';
import { getTranslation, TranslationKey } from '@/lib/i18n';

export function useTranslation() {
  const language = useStore((state) => state.language);

  return (key: TranslationKey): string => {
    return getTranslation(language, key);
  };
}
