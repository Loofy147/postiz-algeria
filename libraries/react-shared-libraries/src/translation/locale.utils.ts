const RTL_LANGUAGE_CODES = new Set([
  'ar', // Arabic
  'dv', // Dhivehi
  'fa', // Persian
  'he', // Hebrew
  'ps', // Pashto
  'sd', // Sindhi
  'ug', // Uyghur
  'ur', // Urdu
  'yi', // Yiddish
]);

const normalizeLocale = (locale?: string | null) =>
  (locale || '').trim().replace(/_/g, '-').toLowerCase();

/** Resolve a cookie/header locale to a locale that the application actually ships. */
export const resolveSupportedLanguage = (
  candidate: string | null | undefined,
  supportedLanguages: readonly string[],
  fallbackLanguage: string
): string => {
  const normalized = normalizeLocale(candidate);
  if (!normalized) return fallbackLanguage;

  const exactMatch = supportedLanguages.find(
    (language) => language.toLowerCase() === normalized
  );
  if (exactMatch) return exactMatch;

  // Accept regional variants such as ar-DZ when only the base language is shipped.
  const baseLanguage = normalized.split('-')[0];
  return (
    supportedLanguages.find(
      (language) => language.toLowerCase() === baseLanguage
    ) || fallbackLanguage
  );
};

/** Return the writing direction for a BCP 47 language tag or language code. */
export const getLanguageDirection = (
  languageCode?: string | null
): 'rtl' | 'ltr' => {
  const primaryLanguage = normalizeLocale(languageCode).split('-')[0];
  return RTL_LANGUAGE_CODES.has(primaryLanguage) ? 'rtl' : 'ltr';
};
