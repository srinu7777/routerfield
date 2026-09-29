/**
 * Client-side model discovery + caching for the desktop/Electron build.
 *
 * Replaces the old 8000+ line hard-coded MuAPI model catalog with live
 * discovery against OpenRouter's `/images/models` and `/videos/models`
 * endpoints (via openrouter.js), normalized and cached in memory.
 */
import { openrouter } from './openrouter.js';

export function loadImageModels(opts) {
    return openrouter.getImageModels(opts);
}

export function loadVideoModels(opts) {
    return openrouter.getVideoModels(opts);
}

export function getModelById(models, id) {
    return models?.find((m) => m.id === id) || null;
}

/** Image models that accept a reference image — usable for image-to-image / editing. */
export function imageToImageModels(models) {
    return (models || []).filter((m) => m.supportsImageInput);
}

/** Video models that accept a starting frame image — usable for image-to-video. */
export function imageToVideoModels(models) {
    return (models || []).filter((m) => m.supportsImageInput);
}
