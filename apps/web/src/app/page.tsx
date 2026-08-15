import { cookies } from 'next/headers';
import ConverterTabs from '@/components/ConverterTabs';
import { resolveCleanupConfig } from '@/lib/cleanup-config';

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('openkova_session')?.value ?? null;
  const cleanupConfig = resolveCleanupConfig();

  return (
    <main className="page">
      <h1 className="page__title">HTML to Image</h1>
      <p className="page__subtitle">
        Convert HTML snippets, files, or websites to screenshots — instantly.
      </p>
      <ConverterTabs
        initialSessionId={sessionId}
        cleanupEnabled={cleanupConfig.enabled}
        cleanupRetentionHours={cleanupConfig.retentionHours}
      />
    </main>
  );
}
