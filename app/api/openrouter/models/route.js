import { NextResponse } from 'next/server';
import { openrouterJson } from '@/lib/openrouterServer';
import { errorResponse, badRequest } from '@/lib/apiRouteHelpers';
import { normalizeImageModel, normalizeVideoModel } from '@/lib/modelNormalizers';

export const dynamic = 'force-dynamic';

// Simple in-memory cache (per server instance) so we don't hit OpenRouter's
// model-discovery endpoint on every render. 10 minute TTL.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // type -> { at, data }

async function fetchImageModels() {
  const raw = await openrouterJson('/images/models');
  const list = Array.isArray(raw?.data) ? raw.data : [];
  return list.map(normalizeImageModel);
}

async function fetchVideoModels() {
  // The dedicated /videos/models endpoint has the duration/resolution/aspect
  // ratio specifics we need, but doesn't reliably flag which models accept
  // an image input. The general Models API does carry architecture.input_modalities,
  // so we merge the two by id to get an accurate `supportsImageInput`.
  const [videoRaw, generalRaw] = await Promise.all([
    openrouterJson('/videos/models'),
    openrouterJson('/models?output_modalities=video').catch(() => ({ data: [] })),
  ]);

  const videoList = Array.isArray(videoRaw?.data) ? videoRaw.data : [];
  const generalList = Array.isArray(generalRaw?.data) ? generalRaw.data : [];
  const byId = new Map(generalList.map((m) => [m.id, m]));

  return videoList.map((raw) => {
    const general = byId.get(raw.id);
    return normalizeVideoModel(raw, {
      inputModalities: general?.architecture?.input_modalities,
      outputModalities: general?.architecture?.output_modalities,
    });
  });
}

async function fetchModels(type) {
  const cached = cache.get(type);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const normalized = type === 'video' ? await fetchVideoModels() : await fetchImageModels();

  cache.set(type, { at: Date.now(), data: normalized });
  return normalized;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (type !== 'image' && type !== 'video') {
    return badRequest('Query param "type" must be "image" or "video".');
  }

  try {
    const models = await fetchModels(type);
    return NextResponse.json({ data: models });
  } catch (err) {
    return errorResponse(err);
  }
}
