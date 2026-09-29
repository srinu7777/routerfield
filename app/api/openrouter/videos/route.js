import { NextResponse } from 'next/server';
import { openrouterJson } from '@/lib/openrouterServer';
import { errorResponse, badRequest } from '@/lib/apiRouteHelpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/openrouter/videos
 * Body: { model, prompt, duration?, resolution?, aspect_ratio?, size?,
 *         frame_images?, input_references?, generate_audio?, seed?, provider? }
 *
 * Submits a video generation job (POST /api/v1/videos) and immediately
 * returns the job envelope { id, polling_url, status }. Video generation is
 * asynchronous — the client polls GET /api/openrouter/videos/[id] for status.
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

  const payload = { model, prompt };
  const passthroughFields = [
    'duration', 'resolution', 'aspect_ratio', 'size',
    'frame_images', 'input_references', 'generate_audio',
    'seed', 'provider',
  ];
  for (const field of passthroughFields) {
    if (body[field] !== undefined) payload[field] = body[field];
  }

  try {
    const job = await openrouterJson('/videos', { method: 'POST', body: payload });
    return NextResponse.json(job, { status: 202 });
  } catch (err) {
    return errorResponse(err);
  }
}
