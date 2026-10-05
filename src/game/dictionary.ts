export interface Entry {
    answer: string;
    clues: string[];
}

export function normalize(word: string): string {
    return word
        .toUpperCase()
        .replace(/Ä/g, "AE")
        .replace(/Ö/g, "OE")
        .replace(/Ü/g, "UE")
        .replace(/ß/g, "SS")
        .replace(/[^A-Z]/g, "");
}

/** Führt doppelte Antworten zusammen und verwirft ungültige Einträge. */
export function buildEntries(words: string[][], maxLength: number): Entry[] {
    const byAnswer = new Map<string, Entry>();
    for (const [raw, ...rest] of words) {
        const answer = normalize(raw);
        const clues = rest.map((c) => c.trim()).filter(Boolean);
        if (answer.length < 2 || answer.length > maxLength || !clues.length)
            continue;
        const entry = byAnswer.get(answer);
        if (!entry) byAnswer.set(answer, { answer, clues });
        else
            for (const c of clues)
                if (!entry.clues.includes(c)) entry.clues.push(c);
    }
    return [...byAnswer.values()];
}

/**
 * Präfixbaum über alle Antworten. Knoten sind Indizes in flachen Arrays,
 * das hält die Suche im Generator schnell.
 */
export class Trie {
    static readonly ROOT = 0;
    private next: Int32Array;
    /** Index des Eintrags, der an diesem Knoten endet, sonst -1 */
    readonly wordAt: Int32Array;
    /** Anzahl der Wörter unterhalb des Knotens (Heuristik) */
    readonly count: Int32Array;
    /** Bit k gesetzt = ein Wort endet nach k weiteren Buchstaben */
    readonly endMask: Int32Array;

    constructor(entries: Entry[]) {
        const capacity =
            entries.reduce((sum, e) => sum + e.answer.length, 0) + 1;
        this.next = new Int32Array(capacity * 26).fill(-1);
        this.wordAt = new Int32Array(capacity).fill(-1);
        this.count = new Int32Array(capacity);
        let size = 1;
        entries.forEach((entry, index) => {
            let node = Trie.ROOT;
            this.count[node]++;
            for (const ch of entry.answer) {
                const slot = node * 26 + ch.charCodeAt(0) - 65;
                if (this.next[slot] < 0) this.next[slot] = size++;
                node = this.next[slot];
                this.count[node]++;
            }
            this.wordAt[node] = index;
        });
        this.endMask = new Int32Array(size);
        // Kinder haben immer größere Indizes, also rückwärts aufsummieren
        for (let node = size - 1; node >= 0; node--) {
            let mask = this.wordAt[node] >= 0 ? 1 : 0;
            for (let l = 0; l < 26; l++) {
                const child = this.next[node * 26 + l];
                if (child >= 0) mask |= this.endMask[child] << 1;
            }
            this.endMask[node] = mask;
        }
    }

    /** Kann ab diesem Knoten innerhalb von höchstens `remaining` Buchstaben ein Wort enden? */
    canEndWithin(node: number, remaining: number): boolean {
        return (this.endMask[node] & ((2 << remaining) - 1)) !== 0;
    }

    /** Folgeknoten für Buchstabe 0..25 oder -1 */
    child(node: number, letter: number): number {
        return this.next[node * 26 + letter];
    }
}
