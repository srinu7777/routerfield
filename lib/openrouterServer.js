/**
 * Server-only OpenRouter client.
 *
 * This module is imported exclusively from Next.js Route Handlers
 * (app/api/openrouter/**). It is the ONLY place in the server-hosted
 * (Next.js) app that reads OPENROUTER_API_KEY, and that key is never sent
 * to the browser. All React studio components call our own `/api/openrouter/*`
 * routes, which use this module to talk to OpenRouter.
 */

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export function getBaseUrl() {
  return process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL;
}

export function getServerApiKey() {
  return process.env.OPENROUTER_API_KEY || null;
}

/**
 * A normalized error shape we can safely JSON-serialize back to the browser
 * without leaking stack traces or upstream internals.
 */
export class OpenRouterError extends Error {
  constructor(message, { status = 500, code = 'provider_error', details = null } = {}) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toResponseBody() {
    return {
      error: {
        message: this.message,
        code: this.code,
        details: this.details ?? undefined,
      },
    };
  }
}

function mapStatusToCode(status) {
  switch (status) {
    case 400: return 'bad_request';
    case 401: return 'unauthorized';
    case 403: return 'forbidden';
    case 404: return 'not_found';
    case 408: return 'timeout';
    case 429: return 'rate_limited';
    case 502:
    case 503:
    case 504: return 'provider_error';
    default: return status >= 500 ? 'provider_error' : 'request_error';
  }
}

/**
 * Low-level fetch wrapper that talks to OpenRouter with the server-side key.
 * Never call this from client code.
 */
export async function openrouterFetch(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const apiKey = getServerApiKey();
  if (!apiKey) {
    throw new OpenRouterError(
      'The server is not configured with an OPENROUTER_API_KEY. Set it in your environment (.env.local) and restart the server.',
      { status: 500, code: 'missing_api_key' }
    );
  }

  const url = `${getBaseUrl()}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (networkErr) {
    throw new OpenRouterError(
      'Could not reach OpenRouter. Check your network connection and try again.',
      { status: 503, code: 'network_error', details: networkErr.message }
    );
  }

  if (!response.ok) {
    let detail = null;
    let message = `OpenRouter request failed (${response.status})`;
    try {
      const errJson = await response.json();
      detail = errJson;
      message = errJson?.error?.message || errJson?.message || message;
    } catch {
      try {
        const text = await response.text();
        if (text) message = text.slice(0, 300);
      } catch {
        // ignore
      }
    }

    if (response.status === 429) message = message || 'Rate limited by OpenRouter. Please wait and try again.';
    if (response.status === 402) message = 'Insufficient credits on this OpenRouter account.';

    throw new OpenRouterError(message, {
      status: response.status,
      code: response.status === 402 ? 'insufficient_credits' : mapStatusToCode(response.status),
      details: detail,
    });
  }

  return response;
}

export async function openrouterJson(path, opts) {
  const res = await openrouterFetch(path, opts);
  return res.json();
}

/** Streams the raw bytes of a response straight through (used for video content downloads). */
export async function openrouterBinary(path, opts) {
  const res = await openrouterFetch(path, opts);
  return res;
}
