const KNOWN_EXTENSIONS_RE = /\.(?:html?|png|jpe?g|webp|pdf)$/i;
const WINDOWS_RESERVED_RE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function sanitizeBaseName(value: string): string {
  const leaf = value.replace(/\\/g, '/').split('/').pop() ?? '';
  let base = leaf
    .normalize('NFKC')
    .replace(KNOWN_EXTENSIONS_RE, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '')
    .slice(0, 180);

  if (WINDOWS_RESERVED_RE.test(base)) base = `_${base}`;
  return base;
}

function extensionFromImageId(imageId: string): string {
  return imageId.split('.').pop()?.toLowerCase() || 'png';
}

export function createOutputFilename(
  rawFilename: unknown,
  fallbackName: string,
  imageId: string,
  sequence?: { index: number; total: number },
): string {
  const requested = typeof rawFilename === 'string' && rawFilename.trim() !== '';
  const base = sanitizeBaseName(requested ? rawFilename : fallbackName) || 'screenshot';
  const sequencedBase = requested && sequence && sequence.total > 1
    ? `${base}-${sequence.index + 1}`
    : base;
  return `${sequencedBase}.${extensionFromImageId(imageId)}`;
}

export function filenameFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const pathPart = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
    return pathPart ? `${url.hostname}-${pathPart}` : url.hostname;
  } catch {
    return 'screenshot';
  }
}

export function contentDispositionFilename(filename: string): string {
  const asciiFallback = filename
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export function publicImageUrl(sessionId: string, filename: string): string {
  return `/api/image/${sessionId}/${encodeURIComponent(filename)}`;
}
