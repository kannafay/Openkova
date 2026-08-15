import fs from 'node:fs/promises';
import path from 'node:path';

export interface StorageAdapter {
  save(sessionId: string, imageId: string, data: Buffer): Promise<void>;
  get(sessionId: string, imageId: string): Promise<Buffer | null>;
  list(sessionId: string): Promise<string[]>;
  delete(sessionId: string, imageId: string): Promise<void>;
  setFilename(sessionId: string, imageId: string, filename: string): Promise<void>;
  getFilename(sessionId: string, imageId: string): Promise<string | null>;
  findImageIdByFilename(sessionId: string, filename: string): Promise<string | null>;
}

// Prevents path traversal: imageId must be a UUID with a known extension,
// sessionId must be a UUID.
const SAFE_IMAGE_ID_RE = /^[a-f0-9-]{36}\.(png|jpe?g|webp|pdf)$/i;
const SAFE_SESSION_ID_RE = /^[a-f0-9-]{36}$/i;

function assertSafeImageId(imageId: string): void {
  if (!SAFE_IMAGE_ID_RE.test(imageId)) {
    throw new Error(`Invalid imageId: ${JSON.stringify(imageId)}`);
  }
}

function assertSafeSessionId(sessionId: string): void {
  if (!SAFE_SESSION_ID_RE.test(sessionId)) {
    throw new Error(`Invalid sessionId: ${JSON.stringify(sessionId)}`);
  }
}

function assertSafeOutputFilename(filename: string): void {
  if (
    !filename ||
    filename.length > 255 ||
    filename === '.' ||
    filename === '..' ||
    /[\\/\u0000-\u001f\u007f]/.test(filename)
  ) {
    throw new Error(`Invalid output filename: ${JSON.stringify(filename)}`);
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  private readonly basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? process.env['OPENKOVA_STORAGE_PATH'] ?? './data';
  }

  private filePath(sessionId: string, imageId: string): string {
    assertSafeSessionId(sessionId);
    assertSafeImageId(imageId);
    return path.join(this.basePath, sessionId, imageId);
  }

  private sessionDir(sessionId: string): string {
    assertSafeSessionId(sessionId);
    return path.join(this.basePath, sessionId);
  }

  private filenameSidecar(sessionId: string, imageId: string): string {
    assertSafeSessionId(sessionId);
    assertSafeImageId(imageId);
    return path.join(this.basePath, sessionId, `.${imageId}.filename`);
  }

  async save(sessionId: string, imageId: string, data: Buffer): Promise<void> {
    const dir = this.sessionDir(sessionId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath(sessionId, imageId), data);
  }

  async get(sessionId: string, imageId: string): Promise<Buffer | null> {
    try {
      const data = await fs.readFile(this.filePath(sessionId, imageId));
      return Buffer.from(data);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async list(sessionId: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.sessionDir(sessionId));
      return entries.filter((e) => SAFE_IMAGE_ID_RE.test(e));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async delete(sessionId: string, imageId: string): Promise<void> {
    await fs.unlink(this.filePath(sessionId, imageId));
    await fs.rm(this.filenameSidecar(sessionId, imageId), { force: true });
  }

  async setFilename(sessionId: string, imageId: string, filename: string): Promise<void> {
    assertSafeOutputFilename(filename);
    await fs.writeFile(this.filenameSidecar(sessionId, imageId), filename, 'utf8');
  }

  async getFilename(sessionId: string, imageId: string): Promise<string | null> {
    try {
      const filename = await fs.readFile(this.filenameSidecar(sessionId, imageId), 'utf8');
      return filename.trim() || null;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async findImageIdByFilename(sessionId: string, filename: string): Promise<string | null> {
    assertSafeOutputFilename(filename);
    const imageIds = await this.list(sessionId);
    for (const imageId of imageIds) {
      if ((await this.getFilename(sessionId, imageId)) === filename) return imageId;
    }
    return null;
  }

  async cleanup(maxAgeMs: number): Promise<number> {
    let deleted = 0;
    let sessions: string[];
    try {
      sessions = await fs.readdir(this.basePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[storage] cleanup: failed to read base directory', err);
      }
      return 0;
    }

    const cutoff = Date.now() - maxAgeMs;
    for (const sessionId of sessions) {
      if (!SAFE_SESSION_ID_RE.test(sessionId)) continue;
      const dir = path.join(this.basePath, sessionId);
      try {
        const stat = await fs.stat(dir);
        if (stat.mtimeMs < cutoff) {
          await fs.rm(dir, { recursive: true });
          deleted++;
        }
      } catch (err) {
        console.error('[storage] cleanup: failed to process session', sessionId, err);
      }
    }
    return deleted;
  }
}
