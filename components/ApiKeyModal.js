'use client';

// This app now talks to OpenRouter through server-side API routes
// (see app/api/openrouter/**), so it no longer asks visitors to paste an
// API key into the browser — the key lives only in the server's
// OPENROUTER_API_KEY environment variable. This screen is shown instead
// when that variable hasn't been set yet, so a fresh deployment fails
// loudly and helpfully rather than with confusing 500s from every studio.
export default function ServerNotConfiguredNotice() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-[#d9ff00]/10 rounded-2xl flex items-center justify-center border border-[#d9ff00]/20 mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" strokeWidth="1.5">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L12 17.25l-4.5-4.5L15.5 7.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-2">
            Routerfield
          </h1>
          <p className="text-white/40 text-sm">
            This server hasn&apos;t been configured with an{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="text-[#d9ff00] hover:underline"
            >
              OpenRouter
            </a>{' '}
            API key yet.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-left">
            <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
              To fix this
            </p>
            <ol className="text-white/70 text-sm space-y-2 list-decimal list-inside">
              <li>
                Get a key from{' '}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-[#d9ff00] hover:underline">
                  openrouter.ai/keys
                </a>
              </li>
              <li>
                Add it to <code className="text-[#d9ff00]">.env.local</code> as{' '}
                <code className="text-[#d9ff00]">OPENROUTER_API_KEY</code>
              </li>
              <li>Restart the server</li>
            </ol>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full bg-[#d9ff00] text-black font-black py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            I&apos;ve set it — reload
          </button>
        </div>
      </div>
    </div>
  );
}
