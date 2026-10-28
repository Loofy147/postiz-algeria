import { fetchPublicHttpsText } from './safe.public.https.fetch.core.mjs';
import { getSsrfSafeDispatcher } from './ssrf.safe.dispatcher';
import { isSafePublicHttpsUrl } from './webhook.url.validator';

export type SafePublicTextFetchOptions = {
  /** Maximum decoded response size, in bytes. */
  maxBytes?: number;
  /** Timeout per request/redirect hop, in milliseconds. */
  timeoutMs?: number;
};

/**
 * Fetch public HTTPS text while validating DNS and every redirect destination.
 * The generic redirect/size logic is kept in a small dependency-injectable
 * core so the security behavior can be tested without reaching the network.
 */
export async function fetchSafePublicHttpsText(
  input: unknown,
  options: SafePublicTextFetchOptions = {}
): Promise<string> {
  return fetchPublicHttpsText(input, {
    ...options,
    validateUrl: isSafePublicHttpsUrl,
    dispatcher: getSsrfSafeDispatcher(),
  });
}
