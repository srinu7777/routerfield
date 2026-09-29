# Routerfield: Technical Documentation & Context

This document serves as a comprehensive knowledge base for the Routerfield project. It details the architecture, key components, API integration patterns, and state management strategies used in the application.

## 1. Project Vision & Overview

**Routerfield** is an ambitious open-source project dedicated to **replicating the full functionality of the Higgsfield platform**.

- **Core Goal:** To build a feature-complete, self-hosted alternative to Higgsfield, starting with **Image Generation** (Nano) and expanding into **Video Generation** (Cinema) and other creative tools.
- **Current State:** The Image Studio ("Nano Banana Pro" interface) is fully operational, featuring a premium dark-mode UI, history management, and multi-model support via OpenRouter's Image and Video generation APIs.
- **Future Direction:** The architecture is designed to scale for video generation, model training interfaces, and advanced editing tools, mirroring the evolving capabilities of Higgsfield.

- **Stack:** Vite, Vanilla JavaScript, Tailwind CSS v3.
- **Repository:** `https://github.com/Anil-matcha/Open-Higgsfield-AI`
- **Primary Branch:** `main`

## 2. Architecture & File Structure

The project follows a component-based architecture using vanilla JS, where each component is a function that returns a DOM element.

```tree
src/
├── components/
│   ├── ImageStudio.js    # Core logic: Prompts, model picking, canvas, history.
│   ├── Header.js         # Navigation, user settings, auth status.
│   ├── AuthModal.js      # Modal for capturing and validating the OpenRouter API key.
│   ├── SettingsModal.js   # Panel for managing settings (clearing API key).
│   └── Sidebar.js        # (Currently unused/placeholder) Navigation sidebar.
├── lib/
│   ├── openrouter.js     # The API Client. Handles auth, image/video generation, job polling.
│   ├── modelNormalizers.js # Converts raw OpenRouter model-discovery records to our schema.
│   └── models.js         # Live model discovery + caching (replaces the old static catalog).
├── styles/
│   ├── global.css        # Global resets, fonts, and animation keyframes.
│   ├── studio.css        # Specific styles for the studio interface.
│   └── variables.css     # CSS custom properties (colors, blur amounts).
├── main.js               # Entry point. Renders the app layout and Header/Studio.
└── style.css             # Tailwind CSS entry file (imports other CSS).
```

## 3. Key Components & Logic

### `ImageStudio.js` (The Brain)
This is the most complex component. It handles:
- **State:** Selected model (`selectedModel`), aspect ratio (`selectedAr`), and generation status.
- **Prompt Input:** A textarea with auto-grow logic and max-height constraints (fixed in `bf2efdb`).
- **Dynamic Controls:**
    - **Model Picker:** Lists models discovered live from `models.js` (loaded asynchronously from OpenRouter).
    - **Quality/Resolution:** Only appears for models that report resolution/quality options in OpenRouter's model discovery response.
- **Generation Flow:**
    1. Checks for API key in `localStorage`. If missing, opens `AuthModal`.
    2. Calls `openrouter.generateImage()` — a single synchronous request; OpenRouter's Image API returns the image directly (no polling).
    3. On success, adds result to `generationHistory` and displays it.
- **History:**
    - Stored in `localStorage` key `openrouter_history`.
    - Slides in from the right sidebar.
    - Thumbnails are clickable to re-view; hover to download.

### `openrouter.js` (The Engine)
Encapsulates all communication with `https://openrouter.ai/api/v1`.
- **Authentication:** Uses `Authorization: Bearer <key>` (the user's own key, stored client-side — this is a single-user desktop/Electron build, so that trust boundary is appropriate here; the separate Next.js web app instead proxies through server routes so the key never reaches the browser).
- **Image generation:** `POST /images` — synchronous, returns image data (URL or base64) directly.
- **Video generation:** genuinely asynchronous — `POST /videos` returns a job, then `GET /videos/{id}` is polled until the job reaches a terminal status, and the video bytes are fetched from `GET /videos/{id}/content`.
- **Uploads:** reference images are read locally into base64 `data:` URLs (`uploadFile()`) rather than uploaded to a hosted-file endpoint — OpenRouter's APIs accept inline image data directly, so there's no separate upload/hosting step.
- **Not supported:** lip-sync generation and video-to-video processing have no OpenRouter equivalent; calling `processLipSync()` / `processV2V()` throws a clear, user-facing error rather than faking a response.

### `models.js` (The Data)
Replaces the old static catalog with **live discovery**: `loadImageModels()` / `loadVideoModels()` fetch and cache OpenRouter's `/images/models` and `/videos/models` results (normalized by `modelNormalizers.js`), so the model list, resolutions, aspect ratios, and durations always reflect what OpenRouter currently offers — nothing is hard-coded.

## 4. UI & Styling (Tailwind v4)

- **Theme:** Dark mode by default (`bg-app-bg` = `#050505`).
- **Accent:** Neon Yellow-Green (`#d9ff00`) used for primary actions and glows.
- **Glassmorphism:** Extensive use of `backdrop-blur` and `bg-white/5` or `bg-black/60` for panels, headers, and modals.
- **Responsiveness:**
    - **Mobile:** Stacked layout, simplified controls, hidden sidebar.
    - **Desktop:** Wide canvas, floating prompt bar, side-by-side history.
- **Animations:** Custom keyframes in `global.css` for `fade-in-up`, `pulse-glow`, etc.

## 5. Development Setup

- **No dev-server proxy needed:** `openrouter.js` calls `https://openrouter.ai/api/v1` directly from the browser using the user's own key — there's no CORS-avoidance proxy in `vite.config.js` the way the old MuAPI integration needed.
- **Environment:** set the user's OpenRouter key via the in-app `AuthModal` (stored in `localStorage` under `openrouter_key`); no build-time environment variable is required for this Vite/Electron build.

## 6. Known Gotchas & Fixes

- **Prompt Bar Overflow:** Fixed by limiting textarea max-height and enabling scrolling.
- **Flux Resolution Picker:** Fixed logic to only show the resolution picker if the model *explicitly* lists enum values for resolution/megapixels.
- **Hero Visibility:** The "Nano Banana Pro" hero text is completely hidden (`display: none`) when an image is shown to prevent bleed-through.
- **API Key Logging:** Debug logs printing the API key were removed for security.
- **Local base64 uploads:** because reference images are now stored as base64 `data:` URLs rather than short hosted URLs, `uploadHistory.js` keeps a smaller history (8 entries) and fails soft on `localStorage` quota errors.

## 7. Future Roadmap (Potential)

- **Lip Sync / Video-to-Video:** re-enable if/when OpenRouter adds equivalent APIs.
- **In-painting/Out-painting:** Add canvas editing tools.
- **User Accounts:** Move beyond local storage for history.
