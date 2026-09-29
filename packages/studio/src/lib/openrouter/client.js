/**
 * Browser-side OpenRouter client for the Next.js-hosted studio.
 *
 * IMPORTANT: this file never talks to OpenRouter directly and never touches
 * an API key. Every call goes to our own same-origin `/api/openrouter/*`
 * route handlers (see app/api/openrouter/**), which hold the secret
 * OPENROUTER_API_KEY server-side. This keeps the key out of the browser
 * entirely, per the app's security model.
 */

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    throw new ApiError('Network error — could not reach the server.', { status: 0, code: 'network_error', details: err.message });
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    // no body / non-JSON — fall through to status-based handling below
  }

  if (!response.ok) {
    const err = json?.error;
    throw new ApiError(err?.message || `Request failed (${response.status})`, {
      status: response.status,
      code: err?.code || 'request_error',
      details: err?.details,
    });
  }

  return json;
}

// ─── Model discovery ─────────────────────────────────────────────────────

export async function fetchImageModels() {
  const { data } = await request('/api/openrouter/models?type=image');
  return data;
}

export async function fetchVideoModels() {
  const { data } = await request('/api/openrouter/models?type=video');
  return data;
}

// ─── Image generation ────────────────────────────────────────────────────

/**
 * Generates image(s) from a prompt, optionally guided by reference images.
 * @param {Object} params
 * @param {string} params.model
 * @param {string} params.prompt
 * @param {string} [params.aspect_ratio]
 * @param {string} [params.resolution]
 * @param {string} [params.quality]
 * @param {number} [params.n]
 * @param {number} [params.seed]
 * @param {string[]} [params.referenceImages] - data: URLs or https URLs
 * @returns {Promise<{ urls: string[], raw: object }>}
 */
export async function generateImage(params) {
  const payload = {
    model: params.model,
    prompt: params.prompt,
  };
  if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
  if (params.resolution) payload.resolution = params.resolution;
  if (params.quality) payload.quality = params.quality;
  if (params.n) payload.n = params.n;
  if (params.seed !== undefined && params.seed !== -1) payload.seed = params.seed;
  if (params.referenceImages?.length) {
    payload.referenceImages = params.referenceImages;
  }

  const result = await request('/api/openrouter/images', { method: 'POST', body: payload });
  const urls = (result.data || []).map((img) =>
    img.url || `data:${img.media_type || 'image/png'};base64,${img.b64_json}`
  );
  return { urls, raw: result };
}

// ─── Video generation ────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'expired']);

/**
 * Submits a video generation job. Returns the initial job envelope.
 */
export async function createVideoGeneration(params) {
  const payload = {
    model: params.model,
    prompt: params.prompt,
  };
  if (params.duration) payload.duration = params.duration;
  if (params.resolution) payload.resolution = params.resolution;
  if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
  if (params.generate_audio !== undefined) payload.generate_audio = params.generate_audio;
  if (params.seed !== undefined && params.seed !== -1) payload.seed = params.seed;

  // frame_images (image-to-video) takes precedence over input_references
  // (reference-to-video) if both were somehow supplied.
  if (params.frameImageUrl) {
    payload.frame_images = [
      { type: 'image_url', image_url: { url: params.frameImageUrl }, frame_type: 'first_frame' },
    ];
  } else if (params.referenceImageUrls?.length) {
    payload.input_references = params.referenceImageUrls.map((url) => ({
      type: 'image_url',
      image_url: { url },
    }));
  }

  return request('/api/openrouter/videos', { method: 'POST', body: payload });
}

/** Fetches the current status of a previously-submitted video job. */
export async function getVideoJobStatus(jobId) {
  return request(`/api/openrouter/videos/${encodeURIComponent(jobId)}`);
}

/**
 * Polls a video job until it reaches a terminal state.
 * @param {string} jobId
 * @param {Object} [opts]
 * @param {(status: object) => void} [opts.onUpdate] - called on every poll
 * @param {number} [opts.intervalMs=4000]
 * @param {number} [opts.timeoutMs=15*60*1000]
 */
export async function pollVideoGeneration(jobId, { onUpdate, intervalMs = 4000, timeoutMs = 15 * 60 * 1000, signal } = {}) {
  const start = Date.now();
  // First check immediately (job may already be done for fast providers).
  let status = await getVideoJobStatus(jobId);
  onUpdate?.(status);

  while (!TERMINAL_STATUSES.has(status.status)) {
    if (Date.now() - start > timeoutMs) {
      throw new ApiError('Video generation timed out while polling.', { status: 408, code: 'timeout' });
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    if (signal?.aborted) throw new ApiError('Polling cancelled.', { status: 0, code: 'cancelled' });
    status = await getVideoJobStatus(jobId);
    onUpdate?.(status);
  }

  if (status.status === 'failed' || status.status === 'expired') {
    throw new ApiError(status.error || 'Video generation failed.', { status: 502, code: 'generation_failed', details: status });
  }
  if (status.status === 'cancelled') {
    throw new ApiError('Video generation was cancelled.', { status: 0, code: 'cancelled', details: status });
  }

  return status; // status.unsigned_urls[0] is playable/downloadable directly.
}

/**
 * Convenience wrapper: submits a video job and polls it to completion,
 * matching the old "await and get a URL back" shape the studios use, while
 * still doing the real create → poll → download flow under the hood.
 * @param {Object} params - see createVideoGeneration
 * @param {(status: object) => void} [onStatus] - called on every poll (for progress UI)
 */
export async function generateVideoAndWait(params, onStatus) {
  const job = await createVideoGeneration(params);
  onStatus?.(job);
  const final = await pollVideoGeneration(job.id, { onUpdate: onStatus });
  return { url: final.unsigned_urls?.[0], raw: final };
}

/** Triggers a browser download of a completed, same-origin-proxied video URL. */
export async function downloadGeneratedVideo(url, filename = 'video.mp4') {
  const response = await fetch(url);
  if (!response.ok) throw new ApiError('Could not download the generated video.', { status: response.status });
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
