/** Deterministischer Zufallsgenerator (mulberry32), damit ein Seed immer dasselbe Rätsel liefert. */
export type Rng = () => number;

export function createRng(seed: number): Rng {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Wandelt beliebigen Seed-Text in eine 32-Bit-Zahl um (FNV-1a). */
export function hashSeed(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

export function randomSeed(): string {
    return Math.floor(Math.random() * 36 ** 6)
        .toString(36)
        .padStart(6, "0");
}
