"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { generateVideoAndWait } from '../lib/openrouter/client.js';
import { loadVideoModels, imageToVideoModels } from '../lib/openrouter/models.js';
import { prepareUploadedImage, UploadValidationError } from '../lib/openrouter/upload.js';

// Video-to-video (watermark removal, etc.) and MuAPI's "extend" continuation
// flow have no OpenRouter equivalent, so those modes are not carried over —
// see the migration report. Every remaining mode maps onto OpenRouter's
// single POST /api/v1/videos endpoint (text-to-video, or image-to-video via
// `frame_images` when a model supports an image input).

async function downloadFile(url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    } catch {
        window.open(url, '_blank');
    }
}

// ── SVG icons (kept inline to avoid extra deps) ───────────────────────────────

const CheckSvg = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" strokeWidth="4">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const VideoIconSvg = ({ className }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
);

const VideoReadySvg = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        <polyline points="7 10 10 13 15 8" stroke="#d9ff00" strokeWidth="2.5" />
    </svg>
);

// ── Dropdown components ───────────────────────────────────────────────────────

function DropdownItem({ label, selected, onClick }) {
    return (
        <div
            className="flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group"
            onClick={onClick}
        >
            <span className="text-xs font-bold text-white opacity-80 group-hover:opacity-100 capitalize">{label}</span>
            {selected && <CheckSvg />}
        </div>
    );
}

function ModelDropdown({ models, selectedModel, onSelect, onClose }) {
    const [search, setSearch] = useState('');

    const lf = search.toLowerCase();
    const filtered = (models || []).filter(
        m => m.name.toLowerCase().includes(lf) || m.id.toLowerCase().includes(lf)
    );

    const getIconColor = (m) => {
        if (m.id.includes('kling')) return 'bg-blue-500/10 text-blue-400';
        if (m.id.includes('veo')) return 'bg-purple-500/10 text-purple-400';
        if (m.id.includes('sora')) return 'bg-rose-500/10 text-rose-400';
        return 'bg-primary/10 text-primary';
    };

    const renderItem = (m) => (
        <div
            key={m.id}
            className={`flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-white/5 ${selectedModel === m.id ? 'bg-white/5 border-white/5' : ''}`}
            onClick={(e) => { e.stopPropagation(); onSelect(m); onClose(); }}
        >
            <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 ${getIconColor(m)} border border-white/5 rounded-xl flex items-center justify-center font-black text-sm shadow-inner uppercase`}>
                    {m.name.charAt(0)}
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-white tracking-tight">{m.name}</span>
                </div>
            </div>
            {selectedModel === m.id && <CheckSvg />}
        </div>
    );

    return (
        <div className="flex flex-col h-full max-h-[70vh]">
            <div className="px-2 pb-3 mb-2 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-white/5 focus-within:border-primary/50 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search models..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className="bg-transparent border-none text-xs text-white focus:ring-0 w-full p-0 outline-none"
                    />
                </div>
            </div>
            <div className="text-[10px] font-bold text-secondary uppercase tracking-widest px-3 py-2 shrink-0">
                Video models
            </div>
            <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-1 pb-2">
                {filtered.map(m => renderItem(m))}
                {filtered.length === 0 && (
                    <div className="text-xs text-secondary px-3 py-4 text-center opacity-60">No models found.</div>
                )}
            </div>
        </div>
    );
}

// ── Control button ────────────────────────────────────────────────────────────

function ControlBtn({ icon, label, onClick, style }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={style}
            className="flex items-center gap-1.5 md:gap-2.5 px-3 md:px-4 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 rounded-xl md:rounded-2xl transition-all border border-white/5 group whitespace-nowrap"
        >
            {icon}
            <span className="text-xs font-bold text-white group-hover:text-primary transition-colors">{label}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-20 group-hover:opacity-100 transition-opacity">
                <path d="M6 9l6 6 6-6" />
            </svg>
        </button>
    );
}

// ── Dropdown panel ─────────────────────────────────────────────────────────────
// Rendered inside a `relative` wrapper div; floats above the anchor button.


// ── Main component ────────────────────────────────────────────────────────────

export default function VideoStudio({ onGenerationComplete, historyItems }) {
    // ── model discovery ──
    const [allModels, setAllModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [modelsError, setModelsError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setModelsLoading(true);
        loadVideoModels()
            .then((models) => { if (!cancelled) { setAllModels(models); setModelsError(null); } })
            .catch((err) => { if (!cancelled) setModelsError(err.message || 'Could not load video models from OpenRouter.'); })
            .finally(() => !cancelled && setModelsLoading(false));
        return () => { cancelled = true; };
    }, []);

    const t2vModels = allModels; // every discovered video model supports text-to-video
    const i2vModels = useMemo(() => imageToVideoModels(allModels), [allModels]);

    // ── mode state ──
    const [imageMode, setImageMode] = useState(false);   // i2v

    // ── model / params ──
    const [selectedModel, setSelectedModel] = useState(null);
    const [selectedModelName, setSelectedModelName] = useState('');
    const [selectedAr, setSelectedAr] = useState('16:9');
    const [selectedDuration, setSelectedDuration] = useState(null);
    const [selectedResolution, setSelectedResolution] = useState('');

    // ── control visibility ──
    const [showAr, setShowAr] = useState(true);
    const [showDuration, setShowDuration] = useState(true);
    const [showResolution, setShowResolution] = useState(false);

    // ── uploads ──
    const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
    const [imageUploading, setImageUploading] = useState(false);
    const imageRevokeRef = useRef(null);

    // ── generation / canvas ──
    const [generating, setGenerating] = useState(false);
    const [generateStatus, setGenerateStatus] = useState(null); // status.status while polling ('pending'|'in_progress'|...)
    const [generateError, setGenerateError] = useState(null);
    const [canvasUrl, setCanvasUrl] = useState(null);
    const [showCanvas, setShowCanvas] = useState(false);

    // ── history ──
    const [localHistory, setLocalHistory] = useState([]);
    const [activeHistoryIdx, setActiveHistoryIdx] = useState(0);

    // ── dropdown ──
    const [openDropdown, setOpenDropdown] = useState(null); // 'model'|'ar'|'duration'|'resolution'|null

    // ── prompt ──
    const [prompt, setPrompt] = useState('');

    // ── refs ──
    const containerRef = useRef(null);
    const textareaRef = useRef(null);
    const dropdownRef = useRef(null);
    const imageFileInputRef = useRef(null);
    const resultVideoRef = useRef(null);

    // ── derived data ──
    const history = historyItems ?? localHistory;

    const getCurrentModels = useCallback(() => (imageMode ? i2vModels : t2vModels), [imageMode, i2vModels, t2vModels]);
    const getCurrentModel = useCallback(() => allModels.find(m => m.id === selectedModel) || null, [allModels, selectedModel]);

    // ── update controls when model/mode changes ──────────────────────────────
    const applyControlsForModel = useCallback((modelId) => {
        const model = allModels.find(m => m.id === modelId);
        const ars = model?.aspectRatios || [];
        setSelectedAr(ars[0] || '16:9');
        setShowAr(ars.length > 0);

        const durations = model?.durations || [];
        setSelectedDuration(durations[0] ?? null);
        setShowDuration(durations.length > 0);

        const resolutions = model?.resolutions || [];
        setSelectedResolution(resolutions[0] || '');
        setShowResolution(resolutions.length > 0);
    }, [allModels]);

    // Once models load, select the first text-to-video model by default.
    useEffect(() => {
        if (selectedModel || t2vModels.length === 0) return;
        const first = t2vModels[0];
        setSelectedModel(first.id);
        setSelectedModelName(first.name);
        applyControlsForModel(first.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t2vModels]);

    // ── close dropdown on outside click ─────────────────────────────────────
    useEffect(() => {
        if (!openDropdown) return;
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpenDropdown(null);
            }
        };
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, [openDropdown]);

    // ── textarea auto-resize ──────────────────────────────────────────────────
    const handlePromptInput = (e) => {
        setPrompt(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        const maxH = window.innerWidth < 768 ? 150 : 250;
        el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
    };

    // ── image upload ─────────────────────────────────────────────────────────
    // OpenRouter's video API takes the start frame as a data: URL directly
    // (`frame_images`), so "uploading" is just local validation + a FileReader
    // read — no network round-trip and no separate hosted-file step.
    const handleImageFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImageUploading(true);

        try {
            const prepared = await prepareUploadedImage(file);
            imageRevokeRef.current?.(); // release any previous preview URL
            imageRevokeRef.current = prepared.revoke;
            setUploadedImageUrl(prepared.dataUrl);

            if (!imageMode && i2vModels.length > 0) {
                const firstI2V = i2vModels[0];
                setImageMode(true);
                setSelectedModel(firstI2V.id);
                setSelectedModelName(firstI2V.name);
                applyControlsForModel(firstI2V.id);
            }
        } catch (err) {
            console.error('[VideoStudio] Image upload failed:', err);
            const message = err instanceof UploadValidationError ? err.message : 'Image upload failed. Please try a different file.';
            alert(message);
        } finally {
            setImageUploading(false);
            if (imageFileInputRef.current) imageFileInputRef.current.value = '';
        }
    };

    const clearImageUpload = () => {
        imageRevokeRef.current?.();
        imageRevokeRef.current = null;
        setUploadedImageUrl(null);
        setImageMode(false);
        const first = t2vModels[0];
        if (first) {
            setSelectedModel(first.id);
            setSelectedModelName(first.name);
            applyControlsForModel(first.id);
        }
    };

    // ── model selection from dropdown ─────────────────────────────────────────
    const handleModelSelect = useCallback((m) => {
        // Switching to a model that doesn't support image input drops any
        // uploaded start-frame image, since it would otherwise be silently ignored.
        if (imageMode && !m.supportsImageInput) {
            imageRevokeRef.current?.();
            imageRevokeRef.current = null;
            setUploadedImageUrl(null);
            setImageMode(false);
        }
        setSelectedModel(m.id);
        setSelectedModelName(m.name);
        applyControlsForModel(m.id);
    }, [imageMode, applyControlsForModel]);

    // ── add to local history ──────────────────────────────────────────────────
    const addToLocalHistory = useCallback((entry) => {
        setLocalHistory(prev => [entry, ...prev].slice(0, 30));
        setActiveHistoryIdx(0);
    }, []);

    // ── show result in canvas ─────────────────────────────────────────────────
    const showVideoInCanvas = useCallback((url) => {
        setCanvasUrl(url);
        setShowCanvas(true);
    }, []);

    // ── generate ──────────────────────────────────────────────────────────────
    // Real create-job → poll → download flow (see lib/openrouter/client.js):
    // no fake progress, no synthetic URLs — every state shown here reflects
    // an actual OpenRouter job status.
    const handleGenerate = useCallback(async () => {
        const trimmedPrompt = prompt.trim();

        if (imageMode) {
            if (!uploadedImageUrl) { alert('Please upload a start frame image first.'); return; }
        } else if (!trimmedPrompt) {
            alert('Please enter a prompt to generate a video.'); return;
        }
        if (!selectedModel) { alert('Models are still loading — try again in a moment.'); return; }

        setGenerating(true);
        setGenerateStatus('pending');
        setGenerateError(null);

        try {
            const params = { model: selectedModel };
            if (trimmedPrompt) params.prompt = trimmedPrompt;
            if (showAr) params.aspect_ratio = selectedAr;
            if (showDuration && selectedDuration) params.duration = selectedDuration;
            if (showResolution && selectedResolution) params.resolution = selectedResolution;
            if (imageMode) params.frameImageUrl = uploadedImageUrl;

            const { url } = await generateVideoAndWait(params, (status) => setGenerateStatus(status.status));
            if (!url) throw new Error('OpenRouter did not return a video.');

            const genId = Date.now().toString();
            const entry = { id: genId, url, prompt: trimmedPrompt, model: selectedModel, aspect_ratio: selectedAr, duration: selectedDuration, timestamp: new Date().toISOString() };
            addToLocalHistory(entry);
            showVideoInCanvas(url);
            onGenerationComplete?.({ url, model: selectedModel, prompt: trimmedPrompt, type: 'video' });
        } catch (e) {
            console.error('[VideoStudio]', e);
            setGenerateError((e.message || 'Generation failed').slice(0, 80));
            setTimeout(() => setGenerateError(null), 4000);
        } finally {
            setGenerating(false);
            setGenerateStatus(null);
        }
    }, [
        prompt, imageMode, selectedModel, selectedAr, selectedDuration, selectedResolution,
        showAr, showDuration, showResolution, uploadedImageUrl,
        addToLocalHistory, showVideoInCanvas, onGenerationComplete,
    ]);

    // ── reset to prompt bar ───────────────────────────────────────────────────
    const resetToPromptBar = useCallback(() => {
        setShowCanvas(false);
    }, []);

    const handleNewPrompt = useCallback(() => {
        resetToPromptBar();
        setPrompt('');
        imageRevokeRef.current?.();
        imageRevokeRef.current = null;
        setUploadedImageUrl(null);
        setImageMode(false);
        const first = t2vModels[0];
        if (first) {
            setSelectedModel(first.id);
            setSelectedModelName(first.name);
            applyControlsForModel(first.id);
        }
        setTimeout(() => textareaRef.current?.focus(), 50);
    }, [resetToPromptBar, applyControlsForModel, t2vModels]);

    // ── derived UI values ────────────────────────────────────────────────────
    const promptPlaceholder = imageMode
        ? 'Describe the motion or effect (optional)'
        : 'Describe the video you want to create';

    const toggleDropdown = (type) => (e) => {
        e.stopPropagation();
        setOpenDropdown(prev => prev === type ? null : type);
    };

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div
            ref={containerRef}
            className="w-full h-full flex flex-col items-center justify-center bg-app-bg relative p-4 md:p-6 overflow-y-auto custom-scrollbar overflow-x-hidden"
        >
            {/* ── History Sidebar ── */}
            {history.length > 0 && (
                <div className="fixed right-0 top-0 h-full w-20 md:w-24 bg-black/60 backdrop-blur-xl border-l border-white/5 z-50 flex flex-col items-center py-4 gap-3 overflow-y-auto transition-all duration-500">
                    <div className="text-[9px] font-bold text-muted uppercase tracking-widest mb-2">History</div>
                    <div className="flex flex-col gap-2 w-full px-2">
                        {history.map((entry, idx) => (
                            <div
                                key={entry.id || idx}
                                className={`relative group/thumb cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 ${activeHistoryIdx === idx ? 'border-primary shadow-glow' : 'border-white/10 hover:border-white/30'}`}
                                onClick={(e) => {
                                    if (e.target.closest('.hist-download')) {
                                        downloadFile(entry.url, `video-${entry.id || idx}.mp4`);
                                        return;
                                    }
                                    setActiveHistoryIdx(idx);
                                    if (entry.model === 'seedance-v2.0-t2v' || entry.model === 'seedance-v2.0-i2v') {
                                        setLastGenerationId(entry.id);
                                        setLastGenerationModel(entry.model);
                                    } else {
                                        setLastGenerationId(null);
                                        setLastGenerationModel(null);
                                    }
                                    showVideoInCanvas(entry.url, entry.model);
                                }}
                            >
                                <video src={entry.url} preload="metadata" muted className="w-full aspect-square object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                    <button className="hist-download p-1.5 bg-primary rounded-lg text-black hover:scale-110 transition-transform" title="Download">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Canvas / Result View ── */}
            {showCanvas && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 min-[800px]:p-16 z-10 transition-all duration-1000">
                    <div className="relative group">
                        <video
                            ref={resultVideoRef}
                            key={canvasUrl}
                            src={canvasUrl}
                            className="max-h-[60vh] max-w-[80vw] rounded-3xl shadow-3xl border border-white/10 interactive-glow object-contain"
                            controls
                            loop
                            autoPlay
                            muted
                            playsInline
                        />
                    </div>
                    <div className="mt-6 flex gap-3 justify-center">
                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={generating}
                            className="bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 backdrop-blur-lg text-white"
                        >
                            ↻ Regenerate
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const entry = history.find(e => e.url === canvasUrl);
                                downloadFile(canvasUrl, `video-${entry?.id || 'clip'}.mp4`);
                            }}
                            className="bg-primary text-black px-6 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-glow active:scale-95"
                        >
                            ↓ Download
                        </button>
                        <button
                            type="button"
                            onClick={handleNewPrompt}
                            className="bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border border-white/5 backdrop-blur-lg text-white"
                        >
                            + New
                        </button>
                    </div>
                </div>
            )}

            {/* ── Hero + Prompt Bar (hidden when canvas is showing) ── */}
            {!showCanvas && (
                <>
                    {/* Hero */}
                    <div className="flex flex-col items-center mb-10 md:mb-20 animate-fade-in-up transition-all duration-700">
                        <div className="mb-10 relative group">
                            <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full opacity-40 group-hover:opacity-70 transition-opacity duration-1000" />
                            <div className="relative w-24 h-24 md:w-32 md:h-32 bg-teal-900/40 rounded-3xl flex items-center justify-center border border-white/5 overflow-hidden">
                                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary opacity-20 absolute -right-4 -bottom-4">
                                    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                </svg>
                                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-glow relative z-10">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                                        <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                    </svg>
                                </div>
                                <div className="absolute top-4 right-4 text-primary animate-pulse">✨</div>
                            </div>
                        </div>
                        <h1 className="text-2xl sm:text-4xl md:text-7xl font-black text-white tracking-widest uppercase mb-4 selection:bg-primary selection:text-black text-center px-4">
                            Video Studio
                        </h1>
                        <p className="text-secondary text-sm font-medium tracking-wide opacity-60">
                            Animate images into stunning AI videos with motion effects
                        </p>
                    </div>

                    {/* Prompt Bar */}
                    <div className="w-full max-w-4xl relative z-40 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <div className="w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-3 md:p-5 flex flex-col gap-3 md:gap-5 shadow-3xl">

                            {/* Top row: image picker + video picker + textarea */}
                            <div className="flex items-start gap-5 px-2">

                                {/* Image upload button */}
                                <div className="relative mt-1.5">
                                    <input
                                        ref={imageFileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageFileChange}
                                    />
                                    <button
                                        type="button"
                                        title={uploadedImageUrl ? 'Clear image' : 'Upload image for Image-to-Video'}
                                        onClick={() => uploadedImageUrl ? clearImageUpload() : imageFileInputRef.current?.click()}
                                        className={`w-10 h-10 shrink-0 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden ${uploadedImageUrl ? 'border-primary/60 bg-primary/10' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/40'} group`}
                                    >
                                        {imageUploading ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
                                                <div className="w-4 h-4 rounded-full border border-primary/30 border-t-primary animate-spin" />
                                            </div>
                                        ) : null}

                                        {uploadedImageUrl ? (
                                            <img src={uploadedImageUrl} alt="" className={`w-full h-full object-cover rounded-xl ${imageUploading ? 'opacity-40 blur-[2px]' : 'opacity-100'}`} />
                                        ) : !imageUploading && (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted group-hover:text-primary transition-colors">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                <circle cx="8.5" cy="8.5" r="1.5" />
                                                <polyline points="21 15 16 10 5 21" />
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {/* Prompt textarea */}
                                <textarea
                                    ref={textareaRef}
                                    value={prompt}
                                    onChange={handlePromptInput}
                                    placeholder={promptPlaceholder}
                                    rows={1}
                                    className="flex-1 bg-transparent border-none text-white text-base md:text-xl placeholder:text-muted focus:outline-none resize-none pt-2.5 leading-relaxed min-h-[40px] max-h-[150px] md:max-h-[250px] overflow-y-auto custom-scrollbar disabled:opacity-40"
                                />
                            </div>

                            {/* Live job-status banner while a video job is running — no fake percentages,
                                just the real OpenRouter job status (pending / in_progress / completed / failed). */}
                            {generating && (
                                <div className="flex items-center gap-2 px-4 py-2 mx-2 mt-2 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary">
                                    <span className="animate-spin inline-block">◌</span>
                                    <span>Video job {generateStatus || 'submitted'}… this can take a minute or more.</span>
                                </div>
                            )}
                            {modelsError && (
                                <div className="flex items-center gap-2 px-4 py-2 mx-2 mt-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                                    Couldn't load models from OpenRouter: {modelsError}
                                </div>
                            )}

                            {/* Bottom row: controls + generate */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 px-2 pt-4 border-t border-white/5">
                                <div className="flex items-center gap-1.5 md:gap-2.5 relative flex-wrap">

                                    {/* Model btn */}
                                    <div className="relative">
                                        <ControlBtn
                                            icon={
                                                <div className="w-5 h-5 bg-primary rounded-md flex items-center justify-center shadow-lg shadow-primary/20">
                                                    <span className="text-[10px] font-black text-black">V</span>
                                                </div>
                                            }
                                            label={selectedModelName}
                                            onClick={toggleDropdown('model')}
                                        />
                                        {openDropdown === 'model' && (
                                            <div ref={dropdownRef} onClick={e => e.stopPropagation()} className="absolute bottom-[calc(100%+8px)] left-0 z-50 bg-[#111] rounded-3xl p-3 border border-white/10 flex flex-col w-[calc(100vw-3rem)] max-w-xs">
                                                <ModelDropdown
                                                    models={getCurrentModels()}
                                                    selectedModel={selectedModel}
                                                    onSelect={handleModelSelect}
                                                    onClose={() => setOpenDropdown(null)}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Aspect ratio btn */}
                                    {showAr && (
                                        <div className="relative">
                                            <ControlBtn
                                                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60 text-secondary"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>}
                                                label={selectedAr}
                                                onClick={toggleDropdown('ar')}
                                            />
                                            {openDropdown === 'ar' && (
                                                <div ref={dropdownRef} onClick={e => e.stopPropagation()} className="absolute bottom-[calc(100%+8px)] left-0 z-50 bg-[#111] rounded-3xl p-3 border border-white/10 flex flex-col w-52 max-w-[240px]">
                                                    <div className="text-[10px] font-bold text-muted uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-2">Aspect Ratio</div>
                                                    <div className="flex flex-col gap-1">
                                                        {(getCurrentModel()?.aspectRatios || []).map(r => (
                                                            <div
                                                                key={r}
                                                                className="flex items-center justify-between p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition-all group"
                                                                onClick={(e) => { e.stopPropagation(); setSelectedAr(r); setOpenDropdown(null); }}
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-6 h-6 border-2 border-white/20 rounded-md shadow-inner flex items-center justify-center group-hover:border-primary/50 transition-colors">
                                                                        <div className="w-3 h-3 bg-white/10 rounded-sm" />
                                                                    </div>
                                                                    <span className="text-xs font-bold text-white opacity-80 group-hover:opacity-100 transition-opacity">{r}</span>
                                                                </div>
                                                                {selectedAr === r && <CheckSvg />}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Duration btn */}
                                    {showDuration && (
                                        <div className="relative">
                                            <ControlBtn
                                                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60 text-secondary"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
                                                label={`${selectedDuration}s`}
                                                onClick={toggleDropdown('duration')}
                                            />
                                            {openDropdown === 'duration' && (
                                                <div ref={dropdownRef} onClick={e => e.stopPropagation()} className="absolute bottom-[calc(100%+8px)] left-0 z-50 bg-[#111] rounded-3xl p-3 border border-white/10 flex flex-col w-52 max-w-[240px]">
                                                    <div className="text-[10px] font-bold text-secondary uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-2">Duration</div>
                                                    <div className="flex flex-col gap-1">
                                                        {(getCurrentModel()?.durations || []).map(d => (
                                                            <DropdownItem key={d} label={`${d}s`} selected={selectedDuration === d} onClick={(e) => { e.stopPropagation(); setSelectedDuration(d); setOpenDropdown(null); }} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Resolution btn */}
                                    {showResolution && (
                                        <div className="relative">
                                            <ControlBtn
                                                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60 text-secondary"><path d="M6 2L3 6v15a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" /></svg>}
                                                label={selectedResolution || '720p'}
                                                onClick={toggleDropdown('resolution')}
                                            />
                                            {openDropdown === 'resolution' && (
                                                <div ref={dropdownRef} onClick={e => e.stopPropagation()} className="absolute bottom-[calc(100%+8px)] left-0 z-50 bg-[#111] rounded-3xl p-3 border border-white/10 flex flex-col w-52 max-w-[240px]">
                                                    <div className="text-[10px] font-bold text-secondary uppercase tracking-widest px-3 py-2 border-b border-white/5 mb-2">Resolution</div>
                                                    <div className="flex flex-col gap-1">
                                                        {(getCurrentModel()?.resolutions || []).map(r => (
                                                            <DropdownItem key={r} label={r} selected={selectedResolution === r} onClick={(e) => { e.stopPropagation(); setSelectedResolution(r); setOpenDropdown(null); }} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Generate button */}
                                <button
                                    type="button"
                                    onClick={handleGenerate}
                                    disabled={generating}
                                    className="bg-primary text-black px-6 md:px-8 py-3 md:py-3.5 rounded-xl md:rounded-[1.5rem] font-black text-sm md:text-base hover:shadow-glow hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5 w-full sm:w-auto shadow-lg disabled:opacity-60 disabled:scale-100"
                                >
                                    {generating ? (
                                        <><span className="animate-spin inline-block text-black">◌</span> Generating...</>
                                    ) : generateError ? (
                                        `Error: ${generateError}`
                                    ) : (
                                        'Generate ✨'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
