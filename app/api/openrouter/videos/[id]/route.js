import { NextResponse } from 'next/server';
import { openrouterJson, openrouterBinary } from '@/lib/openrouterServer';
import { errorResponse } from '@/lib/apiRouteHelpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/openrouter/videos/[id]
 *   -> proxies the poll endpoint (GET /api/v1/videos/{id}) and rewrites
 *      `unsigned_urls` to point at our own content proxy below, so the
 *      browser never needs the OpenRouter key to fetch the video bytes.
 *
 * GET /api/openrouter/videos/[id]?content=1&index=0
 *   -> streams the actual video bytes (GET /api/v1/videos/{id}/content),
 *      forwarding our server-side Authorization header.
 */
export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  if (searchParams.get('content')) {
    const index = searchParams.get('index') || '0';
    try {
      const upstream = await openrouterBinary(`/videos/${id}/content?index=${encodeURIComponent(index)}`);
      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'video/mp4',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch (err) {
      return errorResponse(err);
    }
  }

  try {
    const status = await openrouterJson(`/videos/${id}`);
    const rewritten = {
      ...status,
      unsigned_urls: (status.unsigned_urls || []).map((_, i) =>
        `/api/openrouter/videos/${id}?content=1&index=${i}`
      ),
    };
    return NextResponse.json(rewritten);
  } catch (err) {
    return errorResponse(err);
  }
}
