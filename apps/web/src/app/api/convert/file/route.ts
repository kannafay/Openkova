import { type NextRequest } from 'next/server';
import { screenshotSnippet } from '@openkova/core';
import { conversionResponse, resolveResponseMode } from '@/lib/sse';
import { parseFormat, parseViewport, resolveSessionId } from '@/lib/parse';
import { MAX_FILES, MAX_FILE_SIZE } from '@/lib/config';
import { requireApiKey } from '@/lib/api-auth';
import { storage } from '@/lib/storage';
import { createOutputFilename, publicImageUrl } from '@/lib/output-filename';

export async function POST(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const rawFiles = formData.getAll('files');
  const files = rawFiles.filter((f) => f instanceof Blob && f.size > 0) as File[];

  if (files.length === 0) {
    return Response.json({ error: 'No HTML files provided' }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return Response.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 });
  }

  const oversized = files.find((f) => f.size > MAX_FILE_SIZE);
  if (oversized) {
    return Response.json({ error: `File "${oversized.name}" exceeds 10 MB limit` }, { status: 413 });
  }

  const sessionId = resolveSessionId(formData.get('sessionId'));

  const rawViewport = formData.get('viewport');
  let parsedViewport: unknown = null;
  if (rawViewport) {
    try {
      parsedViewport = JSON.parse(rawViewport as string);
    } catch {
      return Response.json({ error: 'Invalid viewport JSON' }, { status: 400 });
    }
  }
  const viewport = parseViewport(parsedViewport);
  const fullPage = formData.get('fullPage') === 'true';
  const format = parseFormat(formData.get('format'));
  const responseMode = resolveResponseMode(req, formData.get('responseMode'));
  const rawFilename = formData.get('filename');

  return conversionResponse(responseMode, async (send) => {
    try {
      send({ type: 'progress', message: 'Launching virtual browser' });

      const results: { imageId: string; filename: string; sourceFilename: string; url: string }[] = [];
      for (let index = 0; index < files.length; index++) {
        const file = files[index]!;
        send({ type: 'progress', message: `Rendering ${file.name}` });
        const buffer = Buffer.from(await file.arrayBuffer());
        const html = buffer.toString('utf-8');
        const storageId = await screenshotSnippet(html, sessionId, { viewport, fullPage, format });
        const filename = createOutputFilename(
          rawFilename,
          file.name,
          storageId,
          { index, total: files.length },
        );
        await storage.setFilename(sessionId, storageId, filename);
        results.push({
          imageId: filename,
          filename,
          sourceFilename: file.name,
          url: publicImageUrl(sessionId, filename),
        });
      }

      const total = results.length;
      send({
        type: 'done',
        message: `Done — ${total} screenshot${total !== 1 ? 's' : ''} saved`,
        data: { sessionId, results },
      });
    } catch (err) {
      console.error('[convert/file]', err);
      send({ type: 'error', message: 'Conversion failed' });
    }
  }, sessionId);
}
