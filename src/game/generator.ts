import { buildEntries, type Entry, Trie } from "./dictionary.ts";
import { createRng, hashSeed, type Rng } from "./random.ts";

export const ROWS = 14;
export const COLS = 12;

export type Direction = "across" | "down";

export interface Word {
    id: number;
    answer: string;
    clue: string;
    direction: Direction;
    /** erstes Buchstabenfeld */
    row: number;
    col: number;
    /** Hinweisfeld, in dem der Hinweis steht */
    clueRow: number;
    clueCol: number;
}

export interface Puzzle {
    seed: string;
    /** Lösungsbuchstabe pro Feld, null = Hinweisfeld */
    solution: (string | null)[][];
    words: Word[];
}

const BLOCK = 26;
const EMPTY = -1;
const N = ROWS * COLS;

/** Suchschritte pro Versuch, danach Neustart mit neuem Zufall */
const STEP_LIMIT = 20_000;
const MAX_ATTEMPTS = 300;
/** so viele vollständige Gitter werden verglichen, das dichteste gewinnt */
const CANDIDATES = 6;
/** Anteil der 2-Buchstaben-Wörter, die pro Versuch gesperrt werden (weniger Kleinkram) */
const SHORT_BAN = 0.6;
/** Strafpunkte je 2-Buchstaben-Wort beim Vergleich der Gitter */
const SHORT_PENALTY = 2;
/** pro Feld höchstens so viele Buchstaben probieren */
const MAX_LETTERS = 5;
/** Neigung, Hinweisfelder früh zu probieren (kleiner = dichter) */
const BLOCK_BIAS = 0.3;

interface Layout {
    cells: Int8Array;
    blocks: number;
    /** Hinweisfeld (Knickpfeil) für waagerechte Wörter ab Spalte 0, Index = Zeile */
    bentAcross: Int16Array;
    /** Hinweisfeld (Knickpfeil) für senkrechte Wörter ab Zeile 0, Index = Spalte */
    bentDown: Int16Array;
}

/** Bitset-Breite für Konfliktmengen über alle Felder */
const W = Math.ceil(N / 32);

/**
 * Füllt das Gitter Feld für Feld (zeilenweise) per Backtracking.
 * Jedes Feld wird Buchstabe oder Hinweisfeld; waagerechte und senkrechte
 * Buchstabenfolgen müssen dabei stets Präfixe gültiger Wörter bleiben.
 * Folgen der Länge 1 sind erlaubt, solange das Feld in der anderen Richtung
 * zu einem Wort gehört.
 *
 * Scheitert ein Feld, springt die Suche direkt zum jüngsten Feld zurück,
 * das den Konflikt verursacht hat (Conflict-directed Backjumping).
 * Pro Schritt wird nichts allokiert.
 */
function fillGrid(trie: Trie, banned: Uint8Array, rng: Rng): Layout | null {
    const entryCount = banned.length;
    const cells = new Int8Array(N).fill(EMPTY);
    const hNode = new Int32Array(N);
    const vNode = new Int32Array(N);
    const hLen = new Int8Array(N);
    const vLen = new Int8Array(N);
    // Feld darunter / rechts daneben muss ein Buchstabe sein
    const needDown = new Uint8Array(N);
    const needRight = new Uint8Array(N);
    // Feld muss Hinweisfeld werden (Knickpfeil für Wörter am linken Rand)
    const forceBlock = new Uint8Array(N);
    const used = banned.slice();
    // Anzahl Hinweise pro Hinweisfeld (max. 2)
    const load = new Uint8Array(N);
    // welche Felder die Hinweise eines Hinweisfeldes ausgelöst haben
    const loaders = new Int16Array(N * 2);
    // Endfeld, an dem ein Wort bereits verwendet wurde
    const usedAt = new Int16Array(entryCount);
    // gesperrte Wörter: kein Feld ist schuld
    for (let w = 0; w < entryCount; w++) if (used[w]) usedAt[w] = -1;
    const bentAcross = new Int16Array(ROWS).fill(-1);
    const bentDown = new Int16Array(COLS).fill(-1);
    // Kandidaten pro Feld (max. 26 Buchstaben + Hinweisfeld)
    const options = new Int8Array(N * 27);
    const keys = new Float64Array(27);
    // Konfliktmenge pro Feld und die zuletzt gemeldete eines gescheiterten Feldes
    const conflicts = new Uint32Array(N * W);
    const failed = new Uint32Array(W);
    let steps = 0;
    let blocks = 0;

    const add = (base: number, k: number) => {
        if (k >= 0) conflicts[base + (k >>> 5)] |= 1 << (k & 31);
    };

    /** Felder, deren Belegung die Möglichkeiten von Feld i bestimmt */
    const collectConflicts = (i: number, r: number, c: number) => {
        const base = i * W;
        conflicts.fill(0, base, base + W);
        for (let k = i - 1; k >= r * COLS; k--) {
            add(base, k);
            if (cells[k] === BLOCK) break;
        }
        for (let k = i - COLS; k >= 0; k -= COLS) {
            add(base, k);
            if (cells[k] === BLOCK) break;
        }
        // Nachbarn der Vorzeile (Pflichtfelder, Vorausschau rechts, Randregeln)
        if (r > 0)
            for (let dc = -1; dc <= 2; dc++)
                if (c + dc >= 0 && c + dc < COLS) {
                    for (let k = i - COLS + dc; k >= 0; k -= COLS) {
                        add(base, k);
                        if (cells[k] === BLOCK) break;
                    }
                }
        if (r > 1) add(base, i - 2 * COLS);
    };

    /** Wortindex einer abgeschlossenen Folge; -1 = kein Wort nötig, -2 = ungültig */
    let conf = 0;
    const closeRun = (node: number, len: number): number => {
        if (len < 2) return -1;
        const w = trie.wordAt[node];
        if (w < 0) return -2;
        if (used[w] !== 0) {
            // Konflikt mit dem Feld, an dem das Wort schon steht
            add(conf, usedAt[w]);
            return -2;
        }
        return w;
    };
    /** Hinweisfeld voll: die Felder, die es gefüllt haben, sind schuld */
    const full = (block: number): boolean => {
        if (load[block] < 2) return false;
        add(conf, block);
        add(conf, loaders[block * 2]);
        add(conf, loaders[block * 2 + 1]);
        return true;
    };

    /** Hat das Feld rechts neben (r, c) noch irgendeine Möglichkeit, wenn links Knoten hc liegt? */
    const rightFeasible = (r: number, c: number, hc: number, hl: number) => {
        const j = r * COLS + c + 1;
        const upJ = r > 0 && cells[j - COLS] !== BLOCK ? j - COLS : -1;
        const vp = upJ >= 0 ? vNode[upJ] : Trie.ROOT;
        const vl = upJ >= 0 ? vLen[upJ] : 0;
        const blockOk =
            (hl === 1 || trie.wordAt[hc] >= 0) &&
            (vl <= 1 ? !(upJ >= 0 && needDown[upJ]) : trie.wordAt[vp] >= 0);
        if (blockOk) return true;
        if (forceBlock[j]) return false;
        for (let l = 0; l < 26; l++) {
            const h2 = trie.child(hc, l);
            if (h2 < 0 || !trie.canEndWithin(h2, COLS - 2 - c)) continue;
            const v2 = trie.child(vp, l);
            if (v2 >= 0 && (vl === 0 || trie.canEndWithin(v2, ROWS - 1 - r)))
                return true;
        }
        return false;
    };

    const solve = (i: number): boolean => {
        if (i === N) return true;
        if (++steps > STEP_LIMIT) return false;
        const r = (i / COLS) | 0;
        const c = i % COLS;
        const left = c > 0 && cells[i - 1] !== BLOCK ? i - 1 : -1;
        const up = r > 0 && cells[i - COLS] !== BLOCK ? i - COLS : -1;
        const hp = left >= 0 ? hNode[left] : Trie.ROOT;
        const hl = left >= 0 ? hLen[left] : 0;
        const vp = up >= 0 ? vNode[up] : Trie.ROOT;
        const vl = up >= 0 ? vLen[up] : 0;
        const mustLetter =
            (r > 0 && needDown[i - COLS] > 0) ||
            (c > 0 && needRight[i - 1] > 0);
        const own = i * W;
        conf = own;
        collectConflicts(i, r, c);

        // Kandidaten: Buchstaben gewichtet nach Anzahl möglicher Fortsetzungen
        const base = i * 27;
        let count = 0;
        if (!forceBlock[i]) {
            for (let l = 0; l < 26; l++) {
                const hc = trie.child(hp, l);
                if (hc < 0) continue;
                if (hl > 0 && !trie.canEndWithin(hc, COLS - 1 - c)) continue;
                const vc = trie.child(vp, l);
                if (vc < 0) continue;
                if (vl > 0 && !trie.canEndWithin(vc, ROWS - 1 - r)) continue;
                const weight = Math.sqrt(trie.count[hc] * trie.count[vc]);
                const key = Math.log(rng()) / weight;
                // Einfügen, absteigend nach key
                let k = count++;
                while (k > 0 && keys[k - 1] < key) {
                    keys[k] = keys[k - 1];
                    options[base + k] = options[base + k - 1];
                    k--;
                }
                keys[k] = key;
                options[base + k] = l;
            }
            if (count > MAX_LETTERS) count = MAX_LETTERS;
        }
        if (!mustLetter) {
            // Hinweisfelder sparsam setzen: meist erst nach den Buchstaben probieren
            const early =
                BLOCK_BIAS * (hl >= 2 ? 0.35 : hl === 0 ? 0.03 : 0.12);
            if (rng() < early) {
                for (let k = count; k > 0; k--)
                    options[base + k] = options[base + k - 1];
                options[base] = BLOCK;
            } else options[base + count] = BLOCK;
            count++;
        }

        for (let o = 0; o < count; o++) {
            const letter = options[base + o];
            let useA = -1;
            let useB = -1;
            let markDown = -1;
            let markRight = -1;
            let markForce = -1;
            let loadA = -1;
            let loadB = -1;
            let ok = true;

            if (letter === BLOCK) {
                // waagerechte Folge links davon endet hier
                if (left >= 0) {
                    const w = closeRun(hp, hl);
                    if (w === -2) ok = false;
                    else if (w >= 0) useA = w;
                    else if (vLen[left] < 2) {
                        // Einzelbuchstabe braucht ein senkrechtes Wort
                        if (r === ROWS - 1) ok = false;
                        else markDown = left;
                    }
                }
                if (ok && up >= 0) {
                    const w = closeRun(vp, vl);
                    if (w === -2 || (w >= 0 && w === useA)) ok = false;
                    else if (w >= 0) useB = w;
                }
            } else {
                const hc = trie.child(hp, letter);
                const vc = trie.child(vp, letter);
                hNode[i] = hc;
                vNode[i] = vc;
                hLen[i] = hl + 1;
                vLen[i] = vl + 1;
                if (c === COLS - 1) {
                    const w = closeRun(hc, hl + 1);
                    if (w === -2) ok = false;
                    else if (w >= 0) useA = w;
                    else if (vl === 0) {
                        if (r === ROWS - 1) ok = false;
                        else markDown = i;
                    }
                } else if (!rightFeasible(r, c, hc, hl + 1)) ok = false;
                if (ok && r === ROWS - 1) {
                    const w = closeRun(vc, vl + 1);
                    if (w === -2 || (w >= 0 && w === useA)) ok = false;
                    else if (w >= 0) useB = w;
                    else if (hl === 0) {
                        if (c === COLS - 1) ok = false;
                        else markRight = i;
                    }
                }
                // Ein neues waagerechtes Wort beginnt: Hinweisfeld davor belasten
                if (ok && hl === 1) {
                    if (c >= 2) loadA = i - 2;
                    else {
                        // Wort am linken Rand: Knickpfeil von oben oder unten
                        const above = i - 1 - COLS;
                        if (r > 0 && cells[above] === BLOCK && !full(above))
                            loadA = above;
                        else {
                            // Feld darunter muss Hinweisfeld werden können
                            const closable =
                                vLen[i - 1] === 1 ||
                                trie.wordAt[vNode[i - 1]] >= 0;
                            if (r === ROWS - 1 || !closable) ok = false;
                            else {
                                markForce = i - 1 + COLS;
                                loadA = markForce;
                            }
                        }
                        if (ok) bentAcross[r] = loadA;
                    }
                }
                // Ein neues senkrechtes Wort beginnt
                if (ok && vl === 1) {
                    if (r >= 2) loadB = i - 2 * COLS;
                    else {
                        // Wort am oberen Rand: Knickpfeil von links oder rechts
                        // (das waagerechte Wort dieses Schritts zählt mit)
                        const room = (b: number) =>
                            cells[b] === BLOCK &&
                            !full(b) &&
                            !(b === loadA && load[b] === 1);
                        if (c > 0 && room(c - 1)) loadB = c - 1;
                        else if (c < COLS - 1 && room(c + 1)) loadB = c + 1;
                        else ok = false;
                        if (ok) bentDown[c] = loadB;
                    }
                }
                if (
                    (loadA >= 0 && full(loadA)) ||
                    (loadB >= 0 && full(loadB)) ||
                    (loadA >= 0 && loadA === loadB && load[loadA] > 0)
                )
                    ok = false;
            }

            if (!ok) continue;
            cells[i] = letter;
            if (letter === BLOCK) blocks++;
            if (useA >= 0) {
                used[useA] = 1;
                usedAt[useA] = i;
            }
            if (useB >= 0) {
                used[useB] = 1;
                usedAt[useB] = i;
            }
            if (markDown >= 0) needDown[markDown]++;
            if (markRight >= 0) needRight[markRight]++;
            if (markForce >= 0) forceBlock[markForce]++;
            if (loadA >= 0) loaders[loadA * 2 + load[loadA]++] = i;
            if (loadB >= 0) loaders[loadB * 2 + load[loadB]++] = i;
            const solved = solve(i + 1);
            if (solved) return true;
            conf = own;
            if (useA >= 0) used[useA] = 0;
            if (useB >= 0) used[useB] = 0;
            if (markDown >= 0) needDown[markDown]--;
            if (markRight >= 0) needRight[markRight]--;
            if (markForce >= 0) forceBlock[markForce]--;
            if (loadA >= 0) load[loadA]--;
            if (loadB >= 0) load[loadB]--;
            if (letter === BLOCK) blocks--;
            cells[i] = EMPTY;
            if (steps > STEP_LIMIT) return false;
            // Konflikt hat nichts mit diesem Feld zu tun: weiter zurückspringen
            if ((failed[i >>> 5] & (1 << (i & 31))) === 0) return false;
            for (let k = 0; k < W; k++) conflicts[own + k] |= failed[k];
        }
        conflicts[own + (i >>> 5)] &= ~(1 << (i & 31));
        failed.set(conflicts.subarray(own, own + W));
        return false;
    };

    return solve(0) ? { cells, blocks, bentAcross, bentDown } : null;
}

interface Slot {
    direction: Direction;
    row: number;
    col: number;
    answer: string;
}

function findSlots(cells: Int8Array): Slot[] {
    const slots: Slot[] = [];
    const letterAt = (r: number, c: number) =>
        r >= 0 &&
        c >= 0 &&
        r < ROWS &&
        c < COLS &&
        cells[r * COLS + c] !== BLOCK
            ? String.fromCharCode(65 + cells[r * COLS + c])
            : null;
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
            for (const direction of ["across", "down"] as const) {
                const [dr, dc] = direction === "across" ? [0, 1] : [1, 0];
                if (!letterAt(r, c) || letterAt(r - dr, c - dc)) continue;
                let answer = "";
                for (
                    let ch = letterAt(r, c), k = 0;
                    ch;
                    k++, ch = letterAt(r + dr * k, c + dc * k)
                )
                    answer += ch;
                if (answer.length >= 2)
                    slots.push({ direction, row: r, col: c, answer });
            }
        }
    return slots;
}

/** Hinweisfeld je Wort: direkt davor, am Rand per Knickpfeil laut Suche */
function clueCellsFor(layout: Layout, slots: Slot[]): [number, number][] {
    return slots.map((s) => {
        if (s.direction === "across") {
            if (s.col > 0) return [s.row, s.col - 1];
            const k = layout.bentAcross[s.row];
            return [(k / COLS) | 0, k % COLS];
        }
        if (s.row > 0) return [s.row - 1, s.col];
        const k = layout.bentDown[s.col];
        return [(k / COLS) | 0, k % COLS];
    });
}

/** Hinweisfelder ohne Hinweis (je weniger, desto dichter wirkt das Rätsel) */
function deadBlocks(cells: Int8Array, clueCells: [number, number][]): number {
    const used = new Set(clueCells.map(([r, c]) => r * COLS + c));
    let dead = 0;
    for (let i = 0; i < N; i++) if (cells[i] === BLOCK && !used.has(i)) dead++;
    return dead;
}

let cache: { entries: Entry[]; trie: Trie } | null = null;

export function generatePuzzle(seed: string, wordList: string[][]): Puzzle {
    if (!cache) {
        const entries = buildEntries(wordList, Math.max(ROWS, COLS));
        cache = { entries, trie: new Trie(entries) };
    }
    const { entries, trie } = cache;
    const index = new Map(entries.map((e) => [e.answer, e]));
    const rng = createRng(hashSeed(seed));

    let best: {
        cells: Int8Array;
        slots: Slot[];
        clueCells: [number, number][];
        score: number;
    } | null = null;
    let found = 0;
    for (
        let attempt = 0;
        attempt < MAX_ATTEMPTS && found < CANDIDATES;
        attempt++
    ) {
        // gesperrte Wörter gelten in fillGrid als bereits verwendet
        const banned = new Uint8Array(entries.length);
        entries.forEach((e, w) => {
            if (e.answer.length === 2 && rng() < SHORT_BAN) banned[w] = 1;
        });
        const layout = fillGrid(trie, banned, rng);
        if (!layout) continue;
        const slots = findSlots(layout.cells);
        const clueCells = clueCellsFor(layout, slots);
        found++;
        const short = slots.filter((s) => s.answer.length === 2).length;
        const score =
            layout.blocks +
            2 * deadBlocks(layout.cells, clueCells) +
            SHORT_PENALTY * short;
        if (!best || score < best.score)
            best = { cells: layout.cells, slots, clueCells, score };
    }
    if (!best) throw new Error("Kein Rätsel gefunden");

    const solution = Array.from({ length: ROWS }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => {
            const v = best.cells[r * COLS + c];
            return v === BLOCK ? null : String.fromCharCode(65 + v);
        }),
    );
    const words: Word[] = best.slots.map((s, id) => {
        const clues = index.get(s.answer)!.clues;
        return {
            id,
            answer: s.answer,
            clue: clues[Math.floor(rng() * clues.length)],
            direction: s.direction,
            row: s.row,
            col: s.col,
            clueRow: best.clueCells[id][0],
            clueCol: best.clueCells[id][1],
        };
    });
    return { seed, solution, words };
}
