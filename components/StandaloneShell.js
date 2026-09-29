'use client';

import { useState, useEffect } from 'react';
import { ImageStudio, VideoStudio, LipSyncStudio, CinemaStudio } from 'studio';
import ServerNotConfiguredNotice from './ApiKeyModal';

const TABS = [
  { id: 'image',   label: 'Image Studio' },
  { id: 'video',   label: 'Video Studio' },
  { id: 'lipsync', label: 'Lip Sync' },
  { id: 'cinema',  label: 'Cinema Studio' },
];

export default function StandaloneShell() {
  // The OpenRouter key now lives server-side only (see app/api/openrouter/**),
  // so all this needs to know is whether the server has one configured.
  const [status, setStatus] = useState('checking'); // 'checking' | 'ready' | 'not_configured' | 'error'
  const [activeTab, setActiveTab] = useState('image');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/openrouter/status')
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setStatus(data.configured ? 'ready' : 'not_configured'); })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-spin text-[#d9ff00] text-3xl">◌</div>
      </div>
    );
  }

  if (status === 'not_configured' || status === 'error') {
    return <ServerNotConfiguredNotice />;
  }

  return (
    <div className="h-screen bg-[#050505] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-0 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-white font-black text-lg tracking-wider uppercase">
            Routerfield
          </span>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#d9ff00] text-black'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Settings */}
        <button
          onClick={() => setShowSettings(true)}
          className="text-white/40 hover:text-white text-sm transition-colors"
        >
          ⚙ Settings
        </button>
      </header>

      {/* Studio Content */}
      <div className="flex-1">
        {activeTab === 'image'   && <ImageStudio />}
        {activeTab === 'video'   && <VideoStudio />}
        {activeTab === 'lipsync' && <LipSyncStudio />}
        {activeTab === 'cinema'  && <CinemaStudio />}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-md">
            <h2 className="text-white font-bold text-xl mb-6">Settings</h2>
            <p className="text-white/50 text-sm mb-4">
              Connected to OpenRouter via this server&apos;s <code className="text-[#d9ff00]">OPENROUTER_API_KEY</code>.
              To use a different account, update that environment variable and restart the server —
              the key is never stored in this browser.
            </p>
            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
