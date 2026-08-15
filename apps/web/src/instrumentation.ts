import { DEFAULT_CLEANUP_RETENTION_HOURS, resolveCleanupConfig } from './lib/cleanup-config';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { LocalStorageAdapter, closeBrowser } = await import('@openkova/core');
    const cleanupConfig = resolveCleanupConfig();
    const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

    if (cleanupConfig.usedFallback) {
      console.warn(
        `[cleanup] Invalid CLEANUP_RETENTION_HOURS=${JSON.stringify(cleanupConfig.rawValue)}; using ${DEFAULT_CLEANUP_RETENTION_HOURS}`,
      );
    }

    if (!cleanupConfig.enabled) {
      console.log('[cleanup] Disabled by CLEANUP_RETENTION_HOURS=0');
    } else {
      const storage = new LocalStorageAdapter();
      const maxAgeMs = cleanupConfig.retentionHours * 60 * 60 * 1000;
      const runCleanup = () =>
        storage
          .cleanup(maxAgeMs)
          .then((n) => { if (n > 0) console.log(`[cleanup] Removed ${n} expired session(s)`); })
          .catch((err) => console.error('[cleanup] Error:', err));

      console.log(`[cleanup] Enabled with ${cleanupConfig.retentionHours}-hour retention`);
      void runCleanup();
      setInterval(runCleanup, CLEANUP_INTERVAL_MS);
    }

    // Graceful shutdown — close the shared Chromium instance before the
    // process exits so it doesn't leave orphan Chrome processes behind.
    const shutdown = () => { void closeBrowser(); };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }
}
