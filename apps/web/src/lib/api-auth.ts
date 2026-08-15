import { timingSafeEqual } from 'node:crypto';

function readProvidedApiKey(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return request.headers.get('x-api-key')?.trim() || null;
}

function keysMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export function requireApiKey(request: Request): Response | null {
  const expected = process.env.API_KEY?.trim();
  if (!expected) {
    return Response.json(
      { error: 'Server API key is not configured' },
      { status: 503 },
    );
  }

  const provided = readProvidedApiKey(request);
  if (!provided || !keysMatch(provided, expected)) {
    return Response.json(
      { error: 'Invalid or missing API key' },
      {
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer realm="Openkova API"' },
      },
    );
  }

  return null;
}
