import { type NextRequest } from 'next/server';
import { screenshotSnippet } from '@openkova/core';
import { conversionResponse, resolveResponseMode } from '@/lib/sse';
import { parseFormat, parseViewport, resolveSessionId } from '@/lib/parse';
import { MAX_HTML_BYTES } from '@/lib/config';
import { requireApiKey } from '@/lib/api-auth';
import { storage } from '@/lib/storage';
import { createOutputFilename, publicImageUrl } from '@/lib/output-filename';

export async function POST(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { html, sessionId: providedSessionId, viewport: rawViewport, fullPage, format: rawFormat, responseMode: rawResponseMode, filename: rawFilename } = body as {
    html?: unknown;
    sessionId?: unknown;
    viewport?: unknown;
    fullPage?: unknown;
    format?: unknown;
    responseMode?: unknown;
    filename?: unknown;
  };

  if (typeof html !== 'string' || html.trim().length === 0) {
    return Response.json({ error: 'html must be a non-empty string' }, { status: 400 });
  }

  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
    return Response.json({ error: 'html exceeds 5 MB limit' }, { status: 413 });
  }

  const sessionId = resolveSessionId(providedSessionId);
  const viewport = parseViewport(rawViewport);
  const format = parseFormat(rawFormat);
  const responseMode = resolveResponseMode(req, rawResponseMode);

  return conversionResponse(responseMode, async (send) => {
    try {
      send({ type: 'progress', message: 'Launching virtual browser' });
      const storageId = await screenshotSnippet(html, sessionId, {
        viewport,
        fullPage: fullPage === true,
        format,
        onProgress: (msg) => send({ type: 'progress', message: msg }),
      });
      const filename = createOutputFilename(rawFilename, 'snippet', storageId);
      await storage.setFilename(sessionId, storageId, filename);
      send({
        type: 'done',
        message: 'Done — screenshot saved',
        data: {
          sessionId,
          imageId: filename,
          filename,
          url: publicImageUrl(sessionId, filename),
        },
      });
    } catch (err) {
      console.error('[convert/snippet]', err);
      send({ type: 'error', message: 'Conversion failed' });
    }
  }, sessionId);
}
