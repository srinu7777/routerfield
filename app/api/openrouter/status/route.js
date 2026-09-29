import { NextResponse } from 'next/server';
import { getServerApiKey } from '@/lib/openrouterServer';
import { getMuseApiKey } from '@/lib/museServer';

// Lets the client know (without ever seeing either key) which providers are
// configured. Video/Cinema/LipSync-notice always need OpenRouter, so the
// app still gates on that; `museConfigured` is informational (Image Studio
// UI uses it to show which provider is primary right now).
export async function GET() {
  return NextResponse.json({
    configured: Boolean(getServerApiKey()),
    openrouterConfigured: Boolean(getServerApiKey()),
    museConfigured: Boolean(getMuseApiKey()),
  });
}
