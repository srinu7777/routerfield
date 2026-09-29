import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    // Tailwind is processed via postcss.config.js (tailwindcss v3 +
    // autoprefixer) — the same pipeline the Next.js app uses — so Vite
    // picks it up automatically without a separate plugin here.
    //
    // No dev-server proxy needed either: src/lib/openrouter.js calls
    // https://openrouter.ai/api/v1 directly from the browser using the
    // user's own OpenRouter key (see AuthModal.js), the same way the old
    // MuAPI integration called api.muapi.ai directly.
});
