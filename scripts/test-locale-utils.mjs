import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getLanguageDirection, resolveSupportedLanguage } from '../libraries/react-shared-libraries/src/translation/locale.utils.ts';

const supportedLanguages = [
  'en', 'he', 'ru', 'zh', 'fr', 'es', 'pt', 'de', 'it', 'ja', 'ko', 'ar', 'tr', 'vi',
];

test('resolves a regional Arabic tag to the supported Arabic resource', () => {
  assert.equal(resolveSupportedLanguage('ar-DZ', supportedLanguages, 'en'), 'ar');
  assert.equal(resolveSupportedLanguage(' FR ', supportedLanguages, 'en'), 'fr');
  assert.equal(resolveSupportedLanguage('zh_CN', supportedLanguages, 'en'), 'zh');
});

test('falls back when locale is blank or unsupported', () => {
  assert.equal(resolveSupportedLanguage(null, supportedLanguages, 'en'), 'en');
  assert.equal(resolveSupportedLanguage('xx-YY', supportedLanguages, 'en'), 'en');
  assert.equal(resolveSupportedLanguage('   ', supportedLanguages, 'en'), 'en');
});

test('computes right-to-left direction from language tags, not country names', () => {
  assert.equal(getLanguageDirection('ar'), 'rtl');
  assert.equal(getLanguageDirection('ar-DZ'), 'rtl');
  assert.equal(getLanguageDirection('he-IL'), 'rtl');
  assert.equal(getLanguageDirection('fa'), 'rtl');
  assert.equal(getLanguageDirection('ur-PK'), 'rtl');
  assert.equal(getLanguageDirection('fr'), 'ltr');
  assert.equal(getLanguageDirection('en-US'), 'ltr');
  assert.equal(getLanguageDirection(undefined), 'ltr');
});

test('English, Arabic and French locale resources have identical key sets', async () => {
  const load = async (language) => JSON.parse(
    await readFile(new URL(`../libraries/react-shared-libraries/src/translation/locales/${language}/translation.json`, import.meta.url), 'utf8')
  );
  const [en, ar, fr] = await Promise.all([load('en'), load('ar'), load('fr')]);
  const expected = Object.keys(en).sort();
  assert.deepEqual(Object.keys(ar).sort(), expected);
  assert.deepEqual(Object.keys(fr).sort(), expected);
});
