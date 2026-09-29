/**
 * Server-only Meta Model API client (Muse Image).
 *
 * Imported only from Next.js Route Handlers / lib/imageProvider.js. Reads
 * MODEL_API_KEY, which is never sent to the browser.
 *
 * Confirmed from Meta's own developer docs (dev.meta.ai) and blog post
 * ("Build with Muse Image" on developer.meta.com):
 *   - Base URL: https://api.meta.ai/v1
 *   - Auth:     Authorization: Bearer <MODEL_API_KEY>
 *   - Model:    muse-image-1.0
 *   - The endpoints deliberately "mirror the OpenAI Images API" — generate
 *     is POST /v1/images/generations with a JSON body, matching the OpenAI
 *     SDK's client.images.generate(model, prompt, n) -> { data: [{ b64_json }], usage }.
 *     Edit is POST /v1/images/edits, which (like OpenAI's edit endpoint)
 *     takes multipart/form-data rather than JSON — an image file plus a
 *     text instruction, not a hosted URL.
 *
 * Muse does not currently expose a video generation API, so this client is
 * image-only; Video/Cinema Studio continue to use OpenRouter exclusively.
 */

const MUSE_BASE_URL = process.env.MUSE_BASE_URL || 'https://api.meta.ai/v1';
const MUSE_IMAGE_MODEL = process.env.MUSE_IMAGE_MODEL || 'muse-image-1.0';

export function getMuseApiKey() {
  return process.env.MODEL_API_KEY || null;
}

export class MuseError extends Error {
  constructor(message, { status = 500, details = null } = {}) {
    super(message);
    this.name = 'MuseError';
    this.status = status;
    this.details = details;
  }
}

async function parseErrorBody(response) {
  try {
    const json = await response.json();
    return json?.error?.message || json?.message || null;
  } catch {
    try {
      const text = await response.text();
      return text?.slice(0, 300) || null;
    } catch {
      return null;
    }
  }
}

/** Decodes a `data:<mime>;base64,<data>` URL into a Buffer + content type. */
function dataUrlToBuffer(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new MuseError('Reference image must be a base64 data: URL.', { status: 400 });
  }
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

/** Text-to-image: POST /images/generations (JSON body, OpenAI-Images-shaped). */
export async function museGenerateImage({ prompt, n, aspect_ratio, seed }) {
  const apiKey = getMuseApiKey();
  if (!apiKey) throw new MuseError('MODEL_API_KEY is not configured.', { status: 500 });

  const payload = { model: MUSE_IMAGE_MODEL, prompt };
  if (n) payload.n = n;
  // aspect_ratio is documented on Muse's Partner Node integrations (14 ratios
  // + "auto"); forwarded only when supplied, since it's optional.
  if (aspect_ratio) payload.aspect_ratio = aspect_ratio;
  if (seed !== undefined && seed !== -1) payload.seed = seed;

  let response;
  try {
    response = await fetch(`${MUSE_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new MuseError(`Could not reach Meta Model API: ${err.message}`, { status: 503 });
  }

  if (!response.ok) {
    const msg = await parseErrorBody(response);
    throw new MuseError(msg || `Muse Image request failed (${response.status})`, { status: response.status });
  }

  return response.json(); // { data: [{ b64_json }], usage }
}

/** Image-to-image: POST /images/edits (multipart/form-data, up to 10 reference images). */
export async function museEditImage({ prompt, n, referenceImages }) {
  const apiKey = getMuseApiKey();
  if (!apiKey) throw new MuseError('MODEL_API_KEY is not configured.', { status: 500 });
  if (!referenceImages?.length) throw new MuseError('At least one reference image is required for an edit.', { status: 400 });

  const form = new FormData();
  form.set('model', MUSE_IMAGE_MODEL);
  form.set('prompt', prompt);
  if (n) form.set('n', String(n));

  referenceImages.slice(0, 10).forEach((dataUrl, i) => {
    const { contentType, buffer } = dataUrlToBuffer(dataUrl);
    const blob = new Blob([buffer], { type: contentType });
    // OpenAI-mirrored multi-image edit convention: repeated `image[]` fields.
    form.append('image[]', blob, `reference-${i}.${contentType.split('/')[1] || 'png'}`);
  });

  let response;
  try {
    response = await fetch(`${MUSE_BASE_URL}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` }, // don't set Content-Type — fetch sets the multipart boundary
      body: form,
    });
  } catch (err) {
    throw new MuseError(`Could not reach Meta Model API: ${err.message}`, { status: 503 });
  }

  if (!response.ok) {
    const msg = await parseErrorBody(response);
    throw new MuseError(msg || `Muse Image edit failed (${response.status})`, { status: response.status });
  }

  return response.json(); // { data: [{ b64_json }], usage }
}

/** Dispatches to generate or edit based on whether reference images were supplied. */
export async function generateMuseImage(params) {
  if (params.referenceImages?.length) return museEditImage(params);
  return museGenerateImage(params);
}
