'use client';
import { FC, ReactNode, useEffect, useState } from 'react';
import { useTranslationSettings } from '@gitroom/react/translation/get.transation.service.client';
import {
  fallbackLng,
  languages,
} from '@gitroom/react/translation/i18n.config';
import {
  getLanguageDirection,
  resolveSupportedLanguage,
} from '@gitroom/react/translation/locale.utils';

export const HtmlComponent: FC = () => {
  const settings = useTranslationSettings();
  const [dir, setDir] = useState(settings.dir());

  useEffect(() => {
    const updateDocumentLocale = () => {
      const language = resolveSupportedLanguage(
        settings.resolvedLanguage || settings.language || fallbackLng,
        languages,
        fallbackLng
      );
      const direction = getLanguageDirection(language);
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttribute('dir', direction);
      setDir(direction);
    };

    updateDocumentLocale();
    settings.on('languageChanged', updateDocumentLocale);
    return () => {
      settings.off('languageChanged', updateDocumentLocale);
    };
  }, [settings]);

  useEffect(() => {
    const htmlElement = document.querySelector('html');
    if (htmlElement) {
      htmlElement.setAttribute('dir', dir);
    }
  }, [dir]);

  return null;
};
