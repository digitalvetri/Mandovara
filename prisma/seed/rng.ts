// Deterministic PRNG so re-running the seed produces identical data.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: number) {
  const r = mulberry32(seed);
  return {
    next: r,
    int: (min: number, max: number) => min + Math.floor(r() * (max - min + 1)),
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)] as T,
    weighted: <T>(items: readonly [T, number][]): T => {
      const total = items.reduce((s, [, w]) => s + w, 0);
      let n = r() * total;
      for (const [item, w] of items) {
        n -= w;
        if (n <= 0) return item;
      }
      return items[items.length - 1]![0];
    },
    boolean: (p = 0.5) => r() < p,
    daysAgo: (min: number, max: number) => {
      const days = min + Math.floor(r() * (max - min + 1));
      const d = new Date();
      d.setDate(d.getDate() - days);
      d.setHours(9 + Math.floor(r() * 8), Math.floor(r() * 60), 0, 0);
      return d;
    },
  };
}

// Valid Indian GSTIN generator.
// Format: 2 state code + 10 PAN + 1 entity + Z + 1 checksum
// Checksum: mod-36 weighted (positions alternate 1/2 weight)
const B36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function gstinChecksum(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = B36.indexOf(first14[i]!);
    const factor = i % 2 === 0 ? 1 : 2;
    const p = v * factor;
    sum += Math.floor(p / 36) + (p % 36);
  }
  const check = (36 - (sum % 36)) % 36;
  return B36[check]!;
}

// Fake PAN (5 letters + 4 digits + 1 letter). Not real-checksummed — PAN has
// no public checksum algorithm; the field-level validator only checks format.
export function makePan(rng: () => number, entityLetter = "P"): string {
  const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const D = "0123456789";
  const pick = (s: string) => s[Math.floor(rng() * s.length)]!;
  return (
    pick(L) + pick(L) + pick(L) + entityLetter + pick(L) +
    pick(D) + pick(D) + pick(D) + pick(D) + pick(L)
  );
}

export function makeGstin(rng: () => number, stateCode: string): string {
  const pan = makePan(rng, "P");
  const first14 = stateCode + pan + "1" + "Z";
  return first14 + gstinChecksum(first14);
}
