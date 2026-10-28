import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchPublicHttpsText } from '../libraries/nestjs-libraries/src/dtos/webhooks/safe.public.https.fetch.core.mjs';

const publicValidator = async (url) => new URL(url).hostname === 'public.example';

test('rejects non-HTTPS URLs and private destinations before making a request', async () => {
  const urls = [
    'http://public.example/feed.xml',
    'https://127.0.0.1/feed.xml',
    'https://[::1]/feed.xml',
    'https://localhost/feed.xml',
    'not-a-url',
  ];
  let requestCount = 0;
  const fetchImpl = async () => {
    requestCount += 1;
    throw new Error('The test transport must not be called for an unsafe URL');
  };

  for (const url of urls) {
    await assert.rejects(
      fetchPublicHttpsText(url, { fetchImpl, validateUrl: publicValidator }),
      /public HTTPS URL|non-public HTTPS URL/
    );
  }
  assert.equal(requestCount, 0);
});

test('rejects embedded URL credentials before making a request', async () => {
  let requestCount = 0;
  const fetchImpl = async () => {
    requestCount += 1;
    throw new Error('The test transport must not be called for a URL with credentials');
  };

  await assert.rejects(
    fetchPublicHttpsText('https://user:password@public.example/feed.xml', {
      fetchImpl,
      validateUrl: publicValidator,
    }),
    /Embedded URL credentials/
  );
  assert.equal(requestCount, 0);
});

test('rejects invalid response-size configuration before making a request', async () => {
  let requestCount = 0;
  const fetchImpl = async () => {
    requestCount += 1;
    throw new Error('The test transport must not be called');
  };

  await assert.rejects(
    fetchPublicHttpsText('https://public.example/feed.xml', {
      fetchImpl,
      validateUrl: publicValidator,
      maxBytes: 0,
    }),
    /maxBytes must be a positive safe integer/
  );
  assert.equal(requestCount, 0);
});

test('revalidates redirect destinations before making a second request', async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    return new Response(null, {
      status: 302,
      headers: { location: 'https://127.0.0.1/private' },
    });
  };

  await assert.rejects(
    fetchPublicHttpsText('https://public.example/feed.xml', {
      fetchImpl,
      validateUrl: publicValidator,
    }),
    /non-public HTTPS URL/
  );
  assert.deepEqual(requested, ['https://public.example/feed.xml']);
});

test('enforces redirect limits', async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    return new Response(null, {
      status: 302,
      headers: { location: `/redirect-${requested.length}` },
    });
  };

  await assert.rejects(
    fetchPublicHttpsText('https://public.example/redirect-0', {
      fetchImpl,
      validateUrl: publicValidator,
    }),
    /redirect limit/
  );
  assert.equal(requested.length, 6);
});

test('enforces streamed response limits even without a Content-Length header', async () => {
  const fetchImpl = async () =>
    new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('1234'));
        controller.close();
      },
    }));

  await assert.rejects(
    fetchPublicHttpsText('https://public.example/feed.xml', {
      fetchImpl,
      validateUrl: publicValidator,
      maxBytes: 3,
    }),
    /response exceeded the configured size limit/
  );
});
