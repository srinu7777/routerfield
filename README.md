# Routerfield — Open-Source Alternative to Higgsfield AI

> **The free, open-source alternative to Higgsfield AI.** Generate AI images and videos using 200+ state-of-the-art models — without the closed ecosystem or subscription fees.

## 🌐 Try it Online — No Install Required

Deploy the Next.js app (in `app/` + `packages/studio`) to any Node host and set `OPENROUTER_API_KEY` in its environment — the key stays server-side (see `app/api/openrouter/**`), so visitors never need their own key.

---

## ⬇️ Download Desktop App

One-click installers — no Node.js or terminal required.

| Platform | Download |
|---|---|
| macOS Apple Silicon (M1/M2/M3/M4) | [Routerfield-1.0.0-arm64.dmg](https://github.com/Anil-matcha/Open-Higgsfield-AI/releases/download/v1.0.0/Open.Higgsfield.AI-1.0.0-arm64.dmg) |
| macOS Intel (x64) | [Routerfield-1.0.0.dmg](https://github.com/Anil-matcha/Open-Higgsfield-AI/releases/download/v1.0.0/Open.Higgsfield.AI-1.0.0.dmg) |
| Windows (x64 + ARM64) | [Routerfield Setup 1.0.0.exe](https://github.com/Anil-matcha/Open-Higgsfield-AI/releases/download/v1.0.0/Open.Higgsfield.AI.Setup.1.0.0.exe) |

All releases: [github.com/Anil-matcha/Open-Higgsfield-AI/releases](https://github.com/Anil-matcha/Open-Higgsfield-AI/releases)

### macOS Installation Guide

Because the app is not notarized by Apple, macOS Gatekeeper will block it on first launch. Follow these steps:

**Step 1** — Mount the DMG and drag the app to `/Applications`

**Step 2** — Open Terminal and run:
```bash
xattr -cr "/Applications/Routerfield.app"
```

**Step 3** — Right-click the app in `/Applications` → click **Open** → click **Open** again on the dialog

> You only need to do this once. After that, the app opens normally.

**Alternative (no Terminal):**
1. Try to open the app — macOS will block it
2. Go to **System Settings → Privacy & Security**
3. Scroll down to find _"Routerfield was blocked"_
4. Click **Open Anyway** → **Open**

### Windows Installation — SmartScreen warning fix

Windows SmartScreen may show a warning because the installer is not code-signed:

1. Click **More info** on the SmartScreen dialog
2. Click **Run anyway**

The app will install silently to `%LocalAppData%` with a Start Menu shortcut.

---

Routerfield is an open-source AI image, video, and cinema studio that brings Higgsfield-style creative workflows to everyone. Powered by [OpenRouter](https://openrouter.ai), it supports text-to-image, image-to-image, text-to-video, and image-to-video generation across whatever models OpenRouter currently lists (discovered live, never hard-coded) — all from a sleek, modern interface you can self-host and customize.

> **Note on Lip Sync:** OpenRouter does not currently offer a lip-sync generation API. The Lip Sync Studio UI is still present but generation is disabled with an explanation, pending OpenRouter adding that capability. Video-to-video (e.g. watermark removal) is similarly unavailable and has been removed.

**Why Routerfield instead of Higgsfield AI?**
- **Free & open-source** — no subscription, no vendor lock-in
- **Self-hosted** — your data stays on your machine
- **Live model catalog** — text-to-image, image-to-image, text-to-video, image-to-video models are discovered from OpenRouter at runtime, so the list is always current
- **Multi-image input** — feed multiple reference images into compatible models
- **Extensible** — add your own models, modify the UI, build on top of it

For a deep dive into the technical architecture and the philosophy behind the "Infinite Budget" cinema workflow, see our [comprehensive guide and roadmap](https://medium.com/@anilmatcha/building-open-higgsfield-ai-an-open-source-ai-cinema-studio-83c1e0a2a5f1).

![Studio Demo](docs/assets/studio_demo.webp)

## ✨ Features

- **Image Studio** — Generate images from text prompts or transform existing images, using whatever image models OpenRouter currently lists. Switches to image-input-capable models automatically when a reference image is provided. Quality and resolution controls visible for models that support them.
- **Multi-Image Input** — Upload multiple reference images for compatible edit models. Multi-select picker with order badges, batch upload, and a "Use Selected" confirmation flow.
- **Video Studio** — Generate videos from text prompts, or animate a start-frame image on models that support image input. Same intelligent mode switching as Image Studio. Video generation is asynchronous: jobs are submitted, polled, and the finished video is fetched once ready.
- **Cinema Studio** — Higgsfield AI-style interface for photorealistic cinematic shots with pro camera controls (Lens, Focal Length, Aperture)
- **Upload History** — Reference images are read locally and stored as part of your upload history. A picker panel lets you reuse any previously uploaded image across sessions.
- **Smart Controls** — Dynamic aspect ratio, resolution/quality, and duration pickers that adapt to each model's actual reported capabilities
- **Generation History** — Browse, revisit, and download all past generations (persisted in browser storage)
- **Image & Video Download** — One-click download of generated outputs in full resolution
- **API Key Security** — The Next.js web app keeps `OPENROUTER_API_KEY` server-side only (never sent to the browser); the desktop/Electron build stores your own OpenRouter key locally, the same way it always stored the provider key
- **Responsive Design** — Works seamlessly on desktop and mobile with dark glassmorphism UI

### 🖼️ Image Studio — Dual Mode

The Image Studio automatically switches between two model sets, both discovered live from OpenRouter's `/images/models` endpoint — nothing below is hard-coded:

| Mode | Trigger | Models | Prompt |
| :--- | :--- | :--- | :--- |
| **Text-to-Image** | Default (no image) | Every image model OpenRouter currently lists | Required |
| **Image-to-Image** | Reference image uploaded | The subset of those models that report image-input support | Optional |

#### Multi-Image Input

Models that report image-input support in OpenRouter's model discovery accept a multi-select picker (currently capped at 4 reference images client-side, since discovery doesn't publish a per-model maximum):

- **Checkboxes with order numbers** — images are sent to the model in the order you select them
- **Batch upload** — pick multiple files at once from your file dialog
- **Count badge** on the trigger shows how many images are active; a `+` badge appears when more slots are available
- **"Use Selected" button** confirms and closes the picker

### 🎬 Video Studio — Dual Mode

The Video Studio follows the same pattern, discovered live from OpenRouter's `/videos/models` endpoint:

| Mode | Trigger | Models | Prompt |
| :--- | :--- | :--- | :--- |
| **Text-to-Video** | Default (no image) | Every video model OpenRouter currently lists | Required |
| **Image-to-Video** | Start frame uploaded | The subset of those models that report image-input support | Optional |

Video generation is asynchronous: a job is submitted (`POST /videos`), polled (`GET /videos/{id}`) until it reaches a terminal status, and the finished video is fetched (`GET /videos/{id}/content`) once ready — the UI shows the real job status rather than a synthetic progress bar.

> **Not carried over from the MuAPI-era build:** video-to-video processing (e.g. watermark removal) and the Seedance-specific "Extend" continuation flow both depended on MuAPI-specific capabilities with no OpenRouter equivalent, so those modes have been removed rather than left pointing at a provider that no longer exists.

### 🎙️ Lip Sync Studio — currently unavailable

OpenRouter does not currently offer a lip-sync / talking-portrait generation API. The Lip Sync Studio UI is preserved (mode toggle, uploads, layout) so it doesn't look broken, but the **Generate** button is disabled with an explanation. This is intentional — the app never fakes a job, a URL, or a success response. This studio will come back online automatically once OpenRouter adds an equivalent API.

### 🎥 Cinema Studio Controls

The **Cinema Studio** offers precise control over the virtual camera, translating your choices into optimized prompt modifiers:

| Category | Available Options |
| :--- | :--- |
| **Cameras** | Modular 8K Digital, Full-Frame Cine Digital, Grand Format 70mm Film, Studio Digital S35, Classic 16mm Film, Premium Large Format Digital |
| **Lenses** | Creative Tilt, Compact Anamorphic, Extreme Macro, 70s Cinema Prime, Classic Anamorphic, Premium Modern Prime, Warm Cinema Prime, Swirl Bokeh Portrait, Vintage Prime, Halation Diffusion, Clinical Sharp Prime |
| **Focal Lengths** | 8mm (Ultra-Wide), 14mm, 24mm, 35mm (Human Eye), 50mm (Portrait), 85mm (Tight Portrait) |
| **Apertures** | f/1.4 (Shallow DoF), f/4 (Balanced), f/11 (Deep Focus) |

Cinema Studio always shoots with a single high-quality image model, preferring an OpenRouter Nano Banana / Gemini model when available and otherwise falling back to whatever image model OpenRouter lists first.

### 📁 Upload History & Picker

Every image you upload is read locally and saved to your upload history (as a base64 `data:` URL + thumbnail) so you never upload the same file twice:

- Click the upload button to open the **reference image picker**
- Previously uploaded images appear in a 3-column grid with thumbnails

- **Single-image models** — click a thumbnail to instantly select and close
- **Multi-image models** — toggle multiple thumbnails (shown with order numbers), then click **Use Selected**
- Upload new images with the **Upload files** button (supports multi-file selection in multi-image mode)
- Remove individual images from history with the ✕ button
- History persists across browser sessions (stored in `localStorage`)

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- An [OpenRouter](https://openrouter.ai/keys) API key

### Setup

```bash
# Clone the repository
git clone https://github.com/Anil-matcha/Open-Higgsfield-AI.git
cd Open-Higgsfield-AI

# Install dependencies (installs root + packages/studio workspace)
npm install

# Set your OpenRouter key (server-side only — never sent to the browser)
cp .env.example .env.local
# edit .env.local and set OPENROUTER_API_KEY

# Start the development server
npm run dev
```

Open `http://localhost:3000` in your browser — the app is ready to use as soon as the server has a valid `OPENROUTER_API_KEY`; no in-browser key entry is needed for the Next.js app.

### Production Build

```bash
npm run build
npm run start
```

### Desktop App Build

Build native desktop apps with Electron:

```bash
# macOS (DMG — Intel + Apple Silicon)
npm run electron:build

# Windows (NSIS installer — x64 + ARM64)
npm run electron:build:win

# Both platforms in one pass
npm run electron:build:all
```

Installers are output to the `release/` folder. Pre-built binaries are also available on the [Releases page](https://github.com/Anil-matcha/Open-Higgsfield-AI/releases). Unlike the Next.js app, the desktop build has no server, so it asks each user for their own OpenRouter key on first use (stored locally, sent directly to OpenRouter) — the same trust model the old MuAPI integration used.

## 🏗️ Architecture

The app is a **Next.js monorepo** with a shared `packages/studio` component library.

```
Open-Higgsfield-AI/
├── app/                        # Next.js App Router
│   ├── layout.js               # Root layout (Tailwind, fonts)
│   ├── page.js                 # Redirects → /studio
│   ├── studio/
│   │   └── page.js             # Studio page — renders StandaloneShell
│   └── api/openrouter/         # Server-only routes proxying OpenRouter
│       ├── status/route.js     # Reports whether OPENROUTER_API_KEY is configured
│       ├── models/route.js     # GET ?type=image|video — live model discovery
│       ├── images/route.js     # POST — image generation
│       └── videos/
│           ├── route.js        # POST — create a video generation job
│           └── [id]/route.js   # GET — poll status / stream video content
├── lib/
│   ├── openrouterServer.js     # Server-only OpenRouter client (holds the key)
│   ├── apiRouteHelpers.js      # Shared error handling for the routes above
│   └── modelNormalizers.js     # Normalizes raw OpenRouter model records
├── components/
│   ├── StandaloneShell.js      # Tab nav; checks /api/openrouter/status
│   └── ApiKeyModal.js          # Shown only if the server has no key configured
├── packages/
│   └── studio/                 # Shared React component library
│       └── src/
│           ├── index.js        # Exports: ImageStudio, VideoStudio, LipSyncStudio, CinemaStudio
│           └── lib/openrouter/
│               ├── client.js   # Browser client — calls our own /api/openrouter/* routes
│               ├── models.js   # Live model discovery + caching
│               └── upload.js   # Local file validation + base64 read (no upload endpoint needed)
│           └── components/
│               ├── ImageStudio.jsx    # Dual-mode t2i/i2i studio
│               ├── VideoStudio.jsx    # Dual-mode t2v/i2v studio
│               ├── LipSyncStudio.jsx  # Disabled — no OpenRouter lip-sync API
│               └── CinemaStudio.jsx   # Pro studio with camera controls
├── next.config.mjs             # transpilePackages: ['studio']
├── tailwind.config.js
└── package.json                # workspaces: ["packages/studio"]
```

## 🔌 API Integration

The app communicates with [OpenRouter](https://openrouter.ai/docs) via `https://openrouter.ai/api/v1`:

- **Image generation** — `POST /images`, synchronous: the response contains the image data (hosted URL or base64) directly.
- **Video generation** — asynchronous: `POST /videos` returns a job, `GET /videos/{id}` is polled until it reaches a terminal status, and `GET /videos/{id}/content` returns the finished video bytes.
- **Model discovery** — `GET /images/models` and `GET /videos/models` return the live, current catalog (merged with `GET /models?output_modalities=video` for video models, to determine which ones accept an image input) — nothing is hard-coded.
- **Reference images** — sent inline as base64 `data:` URLs (`input_references` for images, `frame_images` for video start frames) rather than uploaded to a separate hosted-file endpoint, since OpenRouter has no such endpoint.

Authentication uses `Authorization: Bearer <key>`. In the Next.js app, `OPENROUTER_API_KEY` is read only inside `lib/openrouterServer.js` and never sent to the browser — the React components call same-origin `/api/openrouter/*` routes instead. The desktop/Electron build (`src/`) has no server, so it calls OpenRouter directly from the browser using the user's own key, stored in `localStorage`.

### Image Studio's two-provider fallback chain

Image Studio (and Cinema Studio, which shares the same code path) tries **[Meta's Muse Image](https://dev.meta.ai)** first, then falls back to OpenRouter automatically:

1. If `MODEL_API_KEY` is set, the request goes to Meta Model API (`https://api.meta.ai/v1`, model `muse-image-1.0`) — text-to-image via `POST /images/generations`, image-to-image via `POST /images/edits` (multipart, up to 10 reference images).
2. If `MODEL_API_KEY` isn't set, or the Muse request fails for any reason (outage, rate limit, unsupported param), the same request is retried against OpenRouter automatically.
3. The response includes a `provider` field (`"muse"` or `"openrouter"`) so the UI can show which one actually served the request.

This logic lives entirely in `lib/imageProvider.js` / `lib/museServer.js` — no changes were needed in the studio UI components beyond a small status banner. Muse has no public video API, so Video and Cinema's video generation, and Cinema's own stills when Muse is unavailable, always use OpenRouter.

## 🎨 Supported Model Categories

| Category | Source |
|---|---|
| **Text-to-Image** | Every image model listed by OpenRouter's `GET /images/models` |
| **Image-to-Image** | The subset of those models that report image-input support |
| **Text-to-Video** | Every video model listed by OpenRouter's `GET /videos/models` |
| **Image-to-Video** | The subset of those models that report image-input support |
| **Lip Sync** | Not currently available — no OpenRouter API for this yet |

Browse the current catalog anytime at [openrouter.ai/models](https://openrouter.ai/models).

## 🛠️ Tech Stack

- **Next.js 14** — App Router, server components, fast dev server
- **React 18** — Studio UI components
- **Tailwind CSS v3** — Utility-first styling
- **npm workspaces** — Monorepo with shared `packages/studio` library
- **OpenRouter** — unified API for AI image and video generation models

## 🤔 How is this different from Higgsfield AI?

Higgsfield AI is a proprietary AI video and image generation platform. **Routerfield** is a community-driven, open-source alternative that provides similar creative capabilities without the closed ecosystem:

| | Higgsfield AI | Routerfield |
| :--- | :--- | :--- |
| **Cost** | Subscription-based | Free (open-source); you pay OpenRouter directly for generations |
| **Models** | Proprietary | Whatever OpenRouter currently lists, discovered live |
| **Multi-image input** | Limited | Multiple reference images per request |
| **Lip sync** | No | Not currently available (no OpenRouter API for it yet) |
| **Self-hosting** | No | Yes |
| **Customizable** | No | Fully hackable |
| **Data privacy** | Cloud-based | Your data stays local; only your prompts/images go to OpenRouter |
| **Source code** | Closed | MIT licensed |

## 📄 License

MIT

## 🙏 Credits

Built with [OpenRouter](https://openrouter.ai) — a unified API for AI image and video generation models.

---
**Deep Dive**: For more details on the "AI Influencer" engine, upcoming "Popcorn" storyboarding features, and the future of this project, read the [full technical overview](https://medium.com/@anilmatcha/building-open-higgsfield-ai-an-open-source-ai-cinema-studio-83c1e0a2a5f1).

---
*Looking for a free Higgsfield AI alternative? Routerfield is an open-source AI image and video generation studio and Higgsfield AI replacement that you can self-host, customize, and extend.*
