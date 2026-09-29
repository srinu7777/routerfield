/**
 * Browser-side OpenRouter client for the desktop/Electron build.
 *
 * Unlike the Next.js-hosted studio (which proxies through server routes so
 * the key never reaches the browser), this desktop app has no server at
 * all — it's a local, single-user Vite/Electron build. Just like the old
 * MuAPI integration it replaces, the user's own OpenRouter key is stored
 * locally (see AuthModal.js) and used to call OpenRouter directly from the
 * browser. That's an appropriate trust boundary here: the user IS the key
 * owner, running on their own machine.
 */
import { normalizeImageModel, normalizeVideoModel } from './modelNormalizers.js';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'expired']);

export class OpenRouterClient {
    constructor() {
        this.baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENROUTER_BASE_URL) || DEFAULT_BASE_URL;
        this._imageModelsPromise = null;
        this._videoModelsPromise = null;
    }

    getKey() {
        const key = window.__OPENROUTER_KEY__ || localStorage.getItem('openrouter_key');
        if (!key) throw new Error('OpenRouter API key missing. Please set it in Settings.');
        return key;
    }

    _headers(extra = {}) {
        return { Authorization: `Bearer ${this.getKey()}`, ...extra };
    }

    async _request(path, { method = 'GET', body } = {}) {
        let response;
        try {
            response = await fetch(`${this.baseUrl}${path}`, {
                method,
                headers: this._headers(body ? { 'Content-Type': 'application/json' } : {}),
                body: body ? JSON.stringify(body) : undefined,
            });
        } catch (err) {
            throw new Error(`Could not reach OpenRouter: ${err.message}`);
        }

        if (!response.ok) {
            let message = `OpenRouter request failed (${response.status})`;
            try {
                const errJson = await response.json();
                message = errJson?.error?.message || errJson?.message || message;
            } catch {
                try { message = (await response.text()).slice(0, 200) || message; } catch { /* ignore */ }
            }
            if (response.status === 402) message = 'Insufficient credits on this OpenRouter account.';
            if (response.status === 429) message = message || 'Rate limited by OpenRouter. Please wait and try again.';
            throw new Error(message);
        }

        return response.json();
    }

    // ─── Model discovery ─────────────────────────────────────────────────

    async getImageModels({ force = false } = {}) {
        if (force || !this._imageModelsPromise) {
            this._imageModelsPromise = this._request('/images/models').then(
                (raw) => (raw.data || []).map(normalizeImageModel)
            ).catch((err) => { this._imageModelsPromise = null; throw err; });
        }
        return this._imageModelsPromise;
    }

    async getVideoModels({ force = false } = {}) {
        if (force || !this._videoModelsPromise) {
            this._videoModelsPromise = Promise.all([
                this._request('/videos/models'),
                this._request('/models?output_modalities=video').catch(() => ({ data: [] })),
            ]).then(([videoRaw, generalRaw]) => {
                const byId = new Map((generalRaw.data || []).map((m) => [m.id, m]));
                return (videoRaw.data || []).map((raw) => {
                    const general = byId.get(raw.id);
                    return normalizeVideoModel(raw, {
                        inputModalities: general?.architecture?.input_modalities,
                        outputModalities: general?.architecture?.output_modalities,
                    });
                });
            }).catch((err) => { this._videoModelsPromise = null; throw err; });
        }
        return this._videoModelsPromise;
    }

    // ─── Image generation ────────────────────────────────────────────────

    /**
     * @param {Object} params - { model, prompt, aspect_ratio?, resolution?, quality?, n?, seed?, referenceImages? }
     * @returns {Promise<{ url: string, urls: string[], raw: object }>}
     */
    async generateImage(params) {
        const payload = { model: params.model, prompt: params.prompt };
        if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
        if (params.resolution) payload.resolution = params.resolution;
        if (params.quality) payload.quality = params.quality;
        if (params.n) payload.n = params.n;
        if (params.seed !== undefined && params.seed !== -1) payload.seed = params.seed;
        if (params.referenceImages?.length) {
            payload.input_references = params.referenceImages.map((url) => ({ type: 'image_url', image_url: { url } }));
        }

        const result = await this._request('/images', { method: 'POST', body: payload });
        const urls = (result.data || []).map((img) => img.url || `data:${img.media_type || 'image/png'};base64,${img.b64_json}`);
        return { url: urls[0], urls, raw: result };
    }

    // ─── Video generation (async: create → poll → download) ──────────────

    async createVideoGeneration(params) {
        const payload = { model: params.model, prompt: params.prompt };
        if (params.duration) payload.duration = params.duration;
        if (params.resolution) payload.resolution = params.resolution;
        if (params.aspect_ratio) payload.aspect_ratio = params.aspect_ratio;
        if (params.generate_audio !== undefined) payload.generate_audio = params.generate_audio;
        if (params.seed !== undefined && params.seed !== -1) payload.seed = params.seed;

        if (params.frameImageUrl) {
            payload.frame_images = [{ type: 'image_url', image_url: { url: params.frameImageUrl }, frame_type: 'first_frame' }];
        } else if (params.referenceImageUrls?.length) {
            payload.input_references = params.referenceImageUrls.map((url) => ({ type: 'image_url', image_url: { url } }));
        }

        return this._request('/videos', { method: 'POST', body: payload });
    }

    async getVideoJobStatus(jobId) {
        return this._request(`/videos/${encodeURIComponent(jobId)}`);
    }

    async pollVideoGeneration(jobId, { onUpdate, intervalMs = 4000, timeoutMs = 15 * 60 * 1000 } = {}) {
        const start = Date.now();
        let status = await this.getVideoJobStatus(jobId);
        onUpdate?.(status);

        while (!TERMINAL_STATUSES.has(status.status)) {
            if (Date.now() - start > timeoutMs) throw new Error('Video generation timed out while polling.');
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
            status = await this.getVideoJobStatus(jobId);
            onUpdate?.(status);
        }

        if (status.status === 'failed' || status.status === 'expired') {
            throw new Error(status.error?.message || status.error || 'Video generation failed.');
        }
        if (status.status === 'cancelled') throw new Error('Video generation was cancelled.');
        return status;
    }

    /** Submits a job and polls it to completion; resolves with { url, raw } once the video is ready. */
    async generateVideo(params, onStatus) {
        const job = await this.createVideoGeneration(params);
        onStatus?.(job);
        const final = await this.pollVideoGeneration(job.id, { onUpdate: onStatus });
        // Video content requires the Authorization header, so we fetch it
        // ourselves and hand back a same-origin blob: URL the <video> tag can play.
        const contentPath = final.unsigned_urls?.[0];
        if (!contentPath) throw new Error('OpenRouter did not return a video.');
        const blobUrl = await this._fetchVideoAsBlobUrl(final.id, 0);
        return { url: blobUrl, raw: final };
    }

    async _fetchVideoAsBlobUrl(jobId, index = 0) {
        const response = await fetch(`${this.baseUrl}/videos/${encodeURIComponent(jobId)}/content?index=${index}`, {
            headers: this._headers(),
        });
        if (!response.ok) throw new Error(`Could not download the generated video (${response.status}).`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    }

    // ─── Upload (local only — OpenRouter takes images as data: URLs directly) ──

    /**
     * There is no MuAPI-style "upload, get back a hosted URL" endpoint on
     * OpenRouter: reference images are sent inline as base64 data: URLs.
     * This reads the file locally and resolves with that data: URL.
     */
    async uploadFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read the selected file.'));
            reader.readAsDataURL(file);
        });
    }

    // ─── Not supported by OpenRouter ────────────────────────────────────

    async processLipSync() {
        throw new Error(
            'Lip Sync is not available: OpenRouter does not currently offer a lip-sync generation API.'
        );
    }

    async processV2V() {
        throw new Error(
            'Video-to-video processing is not available: OpenRouter does not currently offer this capability.'
        );
    }
}

export const openrouter = new OpenRouterClient();
