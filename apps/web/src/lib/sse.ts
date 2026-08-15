export type SSEEvent =
  | { type: 'progress'; message: string }
  | { type: 'done'; message: string; data: Record<string, unknown> }
  | { type: 'error'; message: string };

// Cookie TTL: 7 days (independent of the 24-hour storage cleanup)
const SESSION_COOKIE_TTL_SECS = 60 * 60 * 24 * 7;

export type ResponseMode = 'sse' | 'json';

function sessionCookie(sessionId: string): string {
  return `openkova_session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_COOKIE_TTL_SECS}`;
}

export function resolveResponseMode(request: Request, rawMode?: unknown): ResponseMode {
  const queryMode = new URL(request.url).searchParams.get('responseMode');
  return queryMode === 'json' || rawMode === 'json' ? 'json' : 'sse';
}

export function sseResponse(
  fn: (send: (event: SSEEvent) => void) => Promise<void>,
  sessionId: string,
): Response {
  const encoder = new TextEncoder();
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c;
    },
  });

  const send = (event: SSEEvent) => {
    try {
      ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // controller already closed — drop the event
    }
  };

  fn(send)
    .catch(() => send({ type: 'error', message: 'Internal server error' }))
    .finally(() => ctrl.close());

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Set-Cookie': sessionCookie(sessionId),
    },
  });
}

async function jsonResponse(
  fn: (send: (event: SSEEvent) => void) => Promise<void>,
  sessionId: string,
): Promise<Response> {
  let finalEvent: SSEEvent | null = null;
  const send = (event: SSEEvent) => {
    if (event.type === 'done' || event.type === 'error') finalEvent = event;
  };

  try {
    await fn(send);
  } catch {
    finalEvent = { type: 'error', message: 'Internal server error' };
  }

  const event: SSEEvent = finalEvent ?? { type: 'error', message: 'Conversion produced no result' };
  return Response.json(event, {
    status: event.type === 'error' ? 500 : 200,
    headers: { 'Set-Cookie': sessionCookie(sessionId) },
  });
}

export function conversionResponse(
  mode: ResponseMode,
  fn: (send: (event: SSEEvent) => void) => Promise<void>,
  sessionId: string,
): Response | Promise<Response> {
  return mode === 'json' ? jsonResponse(fn, sessionId) : sseResponse(fn, sessionId);
}

export async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const dataLine = part.split('\n').find((l) => l.startsWith('data: '));
        if (!dataLine) continue;
        try {
          yield JSON.parse(dataLine.slice(6)) as SSEEvent;
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }
}
