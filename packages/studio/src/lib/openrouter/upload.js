/**
 * Shared image-upload helpers for the React studios.
 *
 * OpenRouter's Image and Video APIs accept reference images either as an
 * https URL or as a base64 `data:` URL (see `input_references` /
 * `frame_images` in the API docs) — there is no separate "upload file, get
 * back a hosted URL" endpoint like the old MuAPI integration had. So
 * "uploading" an image here just means: validate it, then read it into a
 * data: URL that can be sent straight to OpenRouter.
 */

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB — generous but bounded

export class UploadValidationError extends Error {}

export function validateImageFile(file) {
  if (!file) throw new UploadValidationError('No file selected.');
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new UploadValidationError(
      `Unsupported file type "${file.type || 'unknown'}". Please use PNG, JPEG, or WebP.`
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new UploadValidationError(
      `Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`
    );
  }
  return true;
}

/** Reads a File into a base64 data: URL usable directly as an OpenRouter image reference. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read the selected file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * A lightweight, object-URL-based preview entry. Call `.revoke()` when the
 * image is replaced or removed to avoid leaking memory.
 */
export function createImagePreview(file) {
  const objectUrl = URL.createObjectURL(file);
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    objectUrl,
    revoke: () => URL.revokeObjectURL(objectUrl),
  };
}

/**
 * Validates + reads a File in one step, returning both a preview (for
 * showing in the UI immediately) and the data: URL (for sending to the API).
 */
export async function prepareUploadedImage(file) {
  validateImageFile(file);
  const preview = createImagePreview(file);
  try {
    const dataUrl = await fileToDataUrl(file);
    return { ...preview, dataUrl };
  } catch (err) {
    preview.revoke();
    throw err;
  }
}
