export type FetchPublicHttpsTextOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  validateUrl: (url: string) => boolean | Promise<boolean>;
  dispatcher?: unknown;
};

export function fetchPublicHttpsText(
  input: unknown,
  options: FetchPublicHttpsTextOptions
): Promise<string>;
