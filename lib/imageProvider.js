/**
 * Image generation orchestrator: Muse Image is the primary provider, with
 * OpenRouter as the secondary/fallback — per product decision, not a
 * silent guess. If MODEL_API_KEY isn't configured at all, this skips
 * straight to OpenRouter with no error. If Muse is configured but a
 * specific request fails (bad param, outage, rate limit, etc.), this logs
 * a warning server-side and retries the same request against OpenRouter
 * rather than failing the whole generation.
 */
import { getMuseApiKey, generateMuseImage } from './museServer';
import { openrouterJson } from './openrouterServer';

const OPENROUTER_PASSTHROUGH_FIELDS = [
  'n', 'resolution', 'aspect_ratio', 'size', 'quality',
  'output_format', 'background', 'output_compression',
  'seed', 'provider',
];

async function generateOpenRouterImage(params) {
  const payload = { model: params.model, prompt: params.prompt };
  for (const field of OPENROUTER_PASSTHROUGH_FIELDS) {
    if (params[field] !== undefined) payload[field] = params[field];
  }
  if (params.referenceImages?.length) {
    payload.input_references = params.referenceImages.map((url) => ({
      type: 'image_url',
      image_url: { url },
    }));
  }
  return openrouterJson('/images', { method: 'POST', body: payload });
}

/**
 * @param {Object} params - { model, prompt, aspect_ratio?, resolution?, quality?,
 *   n?, seed?, referenceImages? } — `model` is the OpenRouter model id selected
 *   in the UI, used only if/when the request falls through to OpenRouter; Muse
 *   always uses its own fixed model (muse-image-1.0).
 * @returns {Promise<{ data: object[], usage?: object, provider: 'muse' | 'openrouter' }>}
 */
export async function generateImageWithFallback(params) {
  const museKey = getMuseApiKey();

  if (museKey) {
    try {
      const result = await generateMuseImage(params);
      return { ...result, provider: 'muse' };
    } catch (err) {
      console.warn('[imageProvider] Muse Image failed, falling back to OpenRouter:', err.message);
    }
  }

  const result = await generateOpenRouterImage(params);
  return { ...result, provider: 'openrouter' };
}
