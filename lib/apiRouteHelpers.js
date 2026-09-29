import { NextResponse } from 'next/server';
import { OpenRouterError } from './openrouterServer';

/**
 * Centralized error handler for our /api/openrouter/* route handlers.
 * Converts any thrown error into a clean, safe JSON response — never
 * leaking stack traces to the client.
 */
export function errorResponse(err) {
  if (err instanceof OpenRouterError) {
    return NextResponse.json(err.toResponseBody(), { status: err.status });
  }

  console.error('[api/openrouter] Unexpected error:', err);
  return NextResponse.json(
    { error: { message: 'Unexpected server error. Please try again.', code: 'internal_error' } },
    { status: 500 }
  );
}

export function badRequest(message, details) {
  return NextResponse.json(
    { error: { message, code: 'bad_request', details } },
    { status: 400 }
  );
}
