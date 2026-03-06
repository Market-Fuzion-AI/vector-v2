export type NormalizedMissionStatus = 'Active' | 'Queue' | 'Backlog' | 'Completed';

export function normalizeStatus(raw: unknown): NormalizedMissionStatus {
  if (typeof raw !== 'string') return 'Backlog';
  const trimmed = raw.trim();
  if (!trimmed) return 'Backlog';

  switch (trimmed.toLowerCase()) {
    case 'completed':
      return 'Completed';
    case 'active':
      return 'Active';
    case 'queue':
      return 'Queue';
    case 'backlog':
      return 'Backlog';
    default:
      // Unknown/missing status → treat as Backlog to avoid mis-bucketing.
      return 'Backlog';
  }
}

export function isCompleted(raw: unknown): boolean {
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'completed') return true;
  return normalizeStatus(raw) === 'Completed';
}
