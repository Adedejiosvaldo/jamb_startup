/**
 * Split `total` questions across topics in proportion to weight, capped by
 * how many questions each topic has (largest-remainder method). Leftover
 * capacity is redistributed so we hit `total` whenever enough questions exist.
 */
export function allocateByWeight(
  total: number,
  topics: { id: string; weight: number; available: number }[],
): Map<string, number> {
  const result = new Map<string, number>(topics.map((t) => [t.id, 0]));
  let remaining = Math.min(
    total,
    topics.reduce((s, t) => s + t.available, 0),
  );
  let pool = topics.filter((t) => t.available > 0);

  while (remaining > 0 && pool.length) {
    const sumW = pool.reduce((s, t) => s + (t.weight > 0 ? t.weight : 0), 0);
    const weights = pool.map((t) => (sumW > 0 ? Math.max(0, t.weight) / sumW : 1 / pool.length));
    const raw = pool.map((t, i) => {
      const room = t.available - (result.get(t.id) ?? 0);
      return { t, room, exact: remaining * weights[i]! };
    });
    let given = 0;
    const floors = raw.map((r) => {
      const n = Math.min(r.room, Math.floor(r.exact));
      given += n;
      return n;
    });
    // Hand out the remainder by largest fractional part to topics with room.
    const order = raw
      .map((r, i) => ({ i, frac: r.exact - Math.floor(r.exact), room: r.room - floors[i]! }))
      .filter((x) => x.room > 0)
      .sort((a, b) => b.frac - a.frac);
    for (const x of order) {
      if (given >= remaining) break;
      floors[x.i]! += 1;
      given += 1;
    }
    if (given === 0) {
      // All weights zero for topics with room: spread one each.
      for (let i = 0; i < raw.length && given < remaining; i++) {
        if (raw[i]!.room > 0) {
          floors[i]! += 1;
          given += 1;
        }
      }
    }
    raw.forEach((r, i) => result.set(r.t.id, (result.get(r.t.id) ?? 0) + floors[i]!));
    remaining -= given;
    pool = pool.filter((t) => (result.get(t.id) ?? 0) < t.available);
  }
  return result;
}

/** Fisher–Yates shuffle with injectable randomness for tests. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
