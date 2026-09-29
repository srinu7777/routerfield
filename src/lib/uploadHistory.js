// Uploaded images are now stored as base64 data: URLs (OpenRouter takes
// reference images inline — there's no hosted-upload endpoint to point to),
// which are much larger than the short hosted URLs MuAPI used to return.
// We keep a smaller history and fail soft on localStorage quota errors so
// a large image can never crash the upload flow.
const STORAGE_KEY = 'openrouter_uploads';
const MAX_UPLOADS = 8;

export function getUploadHistory() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function trySave(history) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        return true;
    } catch {
        return false;
    }
}

export function saveUpload({ id, name, uploadedUrl, thumbnail, timestamp }) {
    let history = getUploadHistory();
    history.unshift({ id, name, uploadedUrl, thumbnail, timestamp });
    history = history.slice(0, MAX_UPLOADS);

    // If we're over quota (common with several base64 images), keep trimming
    // from the oldest end until it fits, rather than losing the newest upload.
    while (history.length > 0 && !trySave(history)) {
        history.pop();
    }
}

export function removeUpload(id) {
    const history = getUploadHistory().filter(e => e.id !== id);
    trySave(history);
}

/**
 * Generates a square 80×80 base64 JPEG thumbnail from a File.
 * @param {File} file
 * @returns {Promise<string|null>}
 */
export async function generateThumbnail(file) {
    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const SIZE = 80;
            const canvas = document.createElement('canvas');
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext('2d');
            const size = Math.min(img.width, img.height);
            const sx = (img.width - size) / 2;
            const sy = (img.height - size) / 2;
            ctx.drawImage(img, sx, sy, size, size, 0, 0, SIZE, SIZE);
            URL.revokeObjectURL(objectUrl);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
        };
        img.src = objectUrl;
    });
}
