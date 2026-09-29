/**
 * Client-side model discovery + caching for the Next.js-hosted studio.
 *
 * Instead of a hard-coded catalog of models (the old MuAPI-era models.js
 * was 8000+ lines of static data), we fetch OpenRouter's live model
 * discovery endpoints through our own `/api/openrouter/models` route and
 * cache the normalized result in memory for the life of the tab.
 *
 * Each model object looks like:
 *   {
 *     id, name, description, provider, kind: 'image' | 'video',
 *     supportsImageInput, aspectRatios, resolutions, qualities,
 *     durations (video only), sizes (video only), pricing / pricingSkus,
 *   }
 */
import { fetchImageModels, fetchVideoModels } from './client.js';

let imageModelsPromise = null;
let videoModelsPromise = null;

export function loadImageModels({ force = false } = {}) {
  if (force || !imageModelsPromise) {
    imageModelsPromise = fetchImageModels().catch((err) => {
      imageModelsPromise = null; // allow retry on next call
      throw err;
    });
  }
  return imageModelsPromise;
}

export function loadVideoModels({ force = false } = {}) {
  if (force || !videoModelsPromise) {
    videoModelsPromise = fetchVideoModels().catch((err) => {
      videoModelsPromise = null;
      throw err;
    });
  }
  return videoModelsPromise;
}

export function getModelById(models, id) {
  return models?.find((m) => m.id === id) || null;
}

/** Image models that do NOT require/accept a reference image — pure text-to-image. */
export function textToImageModels(models) {
  return models || [];
}

/** Image models that accept a reference image — usable for image-to-image / editing. */
export function imageToImageModels(models) {
  return (models || []).filter((m) => m.supportsImageInput);
}

/** Video models that accept a starting frame image — usable for image-to-video. */
export function imageToVideoModels(models) {
  return (models || []).filter((m) => m.supportsImageInput);
}

export function modelSupportsValue(model, field, value) {
  const list = model?.[field];
  if (!Array.isArray(list) || list.length === 0) return true; // unknown = don't block the UI
  return list.includes(value);
}
