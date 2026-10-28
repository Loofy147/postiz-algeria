const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Fetch bounded text while revalidating every URL and redirect hop.
 *
 * This internal core receives the application's URL validator and transport
 * dispatcher from its TypeScript wrapper. Keep those dependencies mandatory:
 * callers must not turn off URL validation accidentally.
 */
export async function fetchPublicHttpsText(input, options) {
  const {
    maxBytes = DEFAULT_MAX_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
    validateUrl,
    dispatcher,
  } = options ?? {};

  if (typeof validateUrl !== 'function') {
    throw new TypeError('validateUrl must be provided');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError('maxBytes must be a positive safe integer');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError('timeoutMs must be a positive safe integer');
  }

  let currentUrl;
  try {
    if (typeof input !== 'string' || !input.trim()) {
      throw new Error('Missing URL');
    }
    currentUrl = input.trim();
  } catch {
    throw new Error('URL must be a public HTTPS URL without embedded credentials');
  }

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    let parsed;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new Error('URL must be a public HTTPS URL without embedded credentials');
    }

    if (parsed.protocol !== 'https:') {
      throw new Error('URL must be a public HTTPS URL');
    }
    if (!parsed.hostname || parsed.username || parsed.password) {
      throw new Error('Embedded URL credentials are not allowed');
    }

    currentUrl = parsed.toString();
    if (!(await validateUrl(currentUrl))) {
      throw new Error('Refusing outbound fetch to a non-public HTTPS URL');
    }

    // Node's fetch supports Undici's dispatcher option, but some TypeScript
    // DOM RequestInit definitions omit it; the wrapper supplies the safe agent.
    const response = await fetchImpl(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      dispatcher,
    });

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => undefined);

      if (!location || redirectCount === MAX_REDIRECTS) {
        throw new Error('Remote URL exceeded the redirect limit or omitted Location');
      }

      try {
        currentUrl = new URL(location, currentUrl).toString();
      } catch {
        throw new Error('Remote URL returned an invalid redirect target');
      }
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`Remote fetch failed with HTTP ${response.status}`);
    }

    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error('Remote response exceeded the configured size limit');
    }

    if (!response.body) {
      return '';
    }

    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel().catch(() => undefined);
          throw new Error('Remote response exceeded the configured size limit');
        }
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(bytes);
  }

  throw new Error('Remote URL exceeded the redirect limit');
}
