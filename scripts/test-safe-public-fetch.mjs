import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchSafePublicHttpsText } from '../libraries/nestjs-libraries/src/dtos/webhooks/safe.public.https.fetch.ts';

test('rejects non-HTTPS and private literal-IP URLs before making a request', async () => {
  const urls = [
    'http://127.0.0.1/feed.xml',
    'https://127.0.0.1/feed.xml',
    'https://[::1]/feed.xml',
    'https://localhost/feed.xml',
    'not-a-url',
  ];
  let requestCount = 0;
  const fetchImpl: typeof fetch = async () => {
    requestCount += 1;
    throw new Error('The test transport must not be called for an unsafe URL');
  };

  for (const url of urls) {
    await assert.rejects(
      fetchSafePublicHttpsText(url, { fetchImpl }),
      /public HTTPS URL|non-public HTTPS URL/
    );
  }

  assert.equal(requestCount, 0);
});

test('rejects embedded URL credentials before making a request', async () => {
  let requestCount = 0;
  const fetchImpl: typeof fetch = async () => {
    requestCount += 1;
    throw new Error('The test transport must not be called for a URL with credentials');
  };

  await assert.rejects(
    fetchSafePublicHttpsText('https://user:password@example.com/feed.xml', {
      fetchImpl,
    }),
    /public HTTPS URL without embedded credentials/
  );
  assert.equal(requestCount, 0);
});

test('rejects invalid response-size configuration before making a request', async () => {
  let requestCount = 0;
  const fetchImpl: typeof fetch = async () => {
    requestCount += 1;
    throw new Error('The test transport must not be called');
  };

  await assert.rejects(
    fetchSafePublicHttpsText('https://example.com/feed.xml', {
      fetchImpl,
      maxBytes: 0,
    }),
    /maxBytes must be a positive safe integer/
  );
  assert.equal(requestCount, 0);
});
