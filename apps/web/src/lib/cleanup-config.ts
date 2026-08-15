export const DEFAULT_CLEANUP_RETENTION_HOURS = 24;

export interface CleanupConfig {
  enabled: boolean;
  retentionHours: number;
  rawValue: string | undefined;
  usedFallback: boolean;
}

export function resolveCleanupConfig(
  rawValue = process.env.CLEANUP_RETENTION_HOURS?.trim(),
): CleanupConfig {
  const parsedValue = rawValue === undefined || rawValue === ''
    ? DEFAULT_CLEANUP_RETENTION_HOURS
    : Number(rawValue);
  const isValid = Number.isFinite(parsedValue) && parsedValue >= 0;
  const retentionHours = isValid ? parsedValue : DEFAULT_CLEANUP_RETENTION_HOURS;

  return {
    enabled: retentionHours > 0,
    retentionHours,
    rawValue,
    usedFallback: !isValid,
  };
}
