'use client';

import useCookie from 'react-use-cookie';
import {
  cookieName,
  fallbackLng,
  languages,
} from '@gitroom/react/translation/i18n.config';
import {
  getLanguageDirection,
  resolveSupportedLanguage,
} from '@gitroom/react/translation/locale.utils';
import i18next from 'i18next';
import { FC, useEffect } from 'react';

export const ChangeDir: FC = () => {
  const currentLanguage = i18next.resolvedLanguage || fallbackLng;
  const [language] = useCookie(cookieName, currentLanguage || fallbackLng);

  useEffect(() => {
    const supportedLanguage = resolveSupportedLanguage(
      language || currentLanguage,
      languages,
      fallbackLng
    );
    document.documentElement.setAttribute('lang', supportedLanguage);
    document.documentElement.setAttribute(
      'dir',
      getLanguageDirection(supportedLanguage)
    );
  }, [currentLanguage, language]);

  return null;
};
