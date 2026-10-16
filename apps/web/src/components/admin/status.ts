export const STATUS_TONE: Record<string, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> =
  {
    draft: 'neutral',
    reviewed: 'accent',
    live: 'success',
    flagged: 'danger',
    retired: 'warning',
    pending: 'warning',
    paid: 'success',
    failed: 'danger',
    refunded: 'neutral',
    open: 'warning',
    resolved: 'success',
    owed: 'warning',
    reversed: 'danger',
  };
