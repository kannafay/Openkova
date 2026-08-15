import { type NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { contentDispositionFilename } from '@/lib/output-filename';

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; id: string }> },
) {
  const { sessionId, id } = await params;
  let storageId = id;
  let data: Buffer | null;
  let filename: string | null;
  try {
    try {
      data = await storage.get(sessionId, storageId);
    } catch {
      storageId = await storage.findImageIdByFilename(sessionId, id) ?? '';
      data = storageId ? await storage.get(sessionId, storageId) : null;
    }
    filename = storageId ? await storage.getFilename(sessionId, storageId) : null;
  } catch {
    return NextResponse.json({ error: 'Invalid image ID' }, { status: 400 });
  }

  if (!data) {
    return new NextResponse(null, { status: 404 });
  }

  const ext = (filename ?? storageId).split('.').pop()?.toLowerCase() ?? 'png';
  const contentType = CONTENT_TYPES[ext] ?? 'image/png';

  const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600, immutable',
  };
  if (filename) headers['Content-Disposition'] = contentDispositionFilename(filename);

  return new NextResponse(new Uint8Array(data), {
    headers,
  });
}
