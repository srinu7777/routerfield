/**
 * Normalizes raw OpenRouter model-discovery records into the shape our UI
 * components consume. Keeping this in one place means the studios never
 * have to know about OpenRouter's raw response shapes.
 */

function enumValues(descriptor) {
  if (!descriptor) return [];
  if (descriptor.type === 'enum') return descriptor.values || [];
  if (descriptor.type === 'range') return { min: descriptor.min, max: descriptor.max };
  if (descriptor.type === 'boolean') return true;
  return [];
}

export function normalizeImageModel(raw) {
  const supported = raw.supported_parameters || {};
  const inputModalities = raw.architecture?.input_modalities || [];
  const outputModalities = raw.architecture?.output_modalities || ['image'];

  return {
    id: raw.id,
    name: raw.name || raw.id,
    description: raw.description || '',
    provider: raw.id?.split('/')?.[0] || 'unknown',
    kind: 'image',
    inputModalities,
    outputModalities,
    supportsImageInput: inputModalities.includes('image'),
    supportsStreaming: Boolean(raw.supports_streaming),
    aspectRatios: enumValues(supported.aspect_ratio),
    resolutions: enumValues(supported.resolution),
    qualities: enumValues(supported.quality),
    outputFormats: enumValues(supported.output_format),
    supportsSeed: Boolean(supported.seed),
    supportsN: supported.n ? enumValues(supported.n) : null,
    supportedParameters: supported,
    pricing: raw.pricing || null,
  };
}

export function normalizeVideoModel(raw, extra = {}) {
  const inputModalities = extra.inputModalities || raw.architecture?.input_modalities || [];

  return {
    id: raw.id,
    name: raw.name || raw.id,
    description: raw.description || '',
    provider: raw.id?.split('/')?.[0] || 'unknown',
    kind: 'video',
    inputModalities,
    outputModalities: extra.outputModalities || raw.architecture?.output_modalities || ['video'],
    // OpenRouter's dedicated /videos/models listing doesn't always carry an
    // explicit input-modalities flag, so callers may merge in data from the
    // general Models API (see route.js) to fill this in accurately.
    supportsImageInput: inputModalities.includes('image'),
    supportsAudio: extra.supportsAudio ?? null,
    durations: raw.supported_durations || [],
    resolutions: raw.supported_resolutions || [],
    aspectRatios: raw.supported_aspect_ratios || [],
    sizes: raw.supported_sizes || [],
    pricingSkus: raw.pricing_skus || {},
    allowedPassthroughParameters: raw.allowed_passthrough_parameters || [],
  };
}
