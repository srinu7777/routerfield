import { NextResponse } from 'next/server';
import { generateImageWithFallback } from '@/lib/imageProvider';
import { errorResponse, badRequest } from '@/lib/apiRouteHelpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/openrouter/images
 * Body: { model, prompt, aspect_ratio?, resolution?, quality?, n?, seed?,
 *         output_format?, input_references? }
 *
 * Muse Image is the primary provider (MODEL_API_KEY); OpenRouter is the
 * secondary/fallback (OPENROUTER_API_KEY) — see lib/imageProvider.js.
 * `model` is only used when the request actually lands on OpenRouter; Muse
 * always uses its own fixed model. The response includes a `provider`
 * field so the caller can tell which one actually served the request.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Request body must be JSON.');
  }

  const { model, prompt } = body || {};
  if (!model) return badRequest('Missing required field "model".');
  if (!prompt) return badRequest('Missing required field "prompt".');

  // Only forward fields either provider actually understands, so a stray
  // client-side field never turns into a confusing 400 from upstream.
  const payload = { model, prompt };
  const passthroughFields = [
    'n', 'resolution', 'aspect_ratio', 'size', 'quality',
    'output_format', 'background', 'output_compression',
    'seed', 'referenceImages',
  ];
  for (const field of passthroughFields) {
    if (body[field] !== undefined) payload[field] = body[field];
  }
  // Back-compat: earlier client code sent OpenRouter's own `input_references`
  // shape directly; normalize it to plain URLs for the provider-agnostic layer.
  if (!payload.referenceImages && Array.isArray(body.input_references)) {
    payload.referenceImages = body.input_references.map((r) => r.image_url?.url).filter(Boolean);
  }

  try {
    const result = await generateImageWithFallback(payload);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

