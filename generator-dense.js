// Kreuzworträtsel-Generator: erzeugt ein zufälliges Sperrfeld-Muster (15x15)
// und füllt es per Backtracking mit Wörtern aus WORDS.
const SIZE = 15;

function normalize(word) {
    return word
        .toUpperCase()
        .replace(/Ä/g, "AE")
        .replace(/Ö/g, "OE")
        .replace(/Ü/g, "UE")
        .replace(/ß/g, "SS")
        .replace(/[^A-Z]/g, "");
}

// Deterministischer Zufall, damit ein Rätsel per Seed reproduzierbar ist
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ---------- Wörterbuch ----------

let DICT = null;

function buildDict() {
    if (DICT) return DICT;
    const byAnswer = new Map();
    for (const [raw, ...clues] of WORDS) {
        const answer = normalize(raw);
        const valid = clues.filter((c) => c && c.trim());
        if (answer.length < 3 || answer.length > SIZE || !valid.length)
            continue;
        const prev = byAnswer.get(answer);
        if (prev) prev.clues.push(...valid);
        else byAnswer.set(answer, { answer, clues: valid });
    }
    // Pro Länge: Wortliste + Bitsets je (Position, Buchstabe)
    const byLen = [];
    for (const entry of byAnswer.values()) {
        const L = entry.answer.length;
        (byLen[L] ||= { words: [] }).words.push(entry);
    }
    for (const group of byLen) {
        if (!group) continue;
        const n = group.words.length;
        const blocks = Math.ceil(n / 32);
        group.blocks = blocks;
        group.all = new Uint32Array(blocks).fill(0xffffffff);
        if (n % 32) group.all[blocks - 1] = ((1 << (n % 32)) - 1) >>> 0;
        const L = group.words[0].answer.length;
        group.pos = Array.from({ length: L }, () =>
            Array.from({ length: 26 }, () => new Uint32Array(blocks)),
        );
        group.words.forEach((w, i) => {
            for (let p = 0; p < L; p++)
                group.pos[p][w.answer.charCodeAt(p) - 65][i >> 5] |=
                    1 << (i & 31);
        });
    }
    DICT = { byAnswer, byLen };
    return DICT;
}

function popcount(x) {
    x -= (x >>> 1) & 0x55555555;
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

// ---------- Muster ----------

// Erzeugt ein punktsymmetrisches Muster aus weißen (true) und schwarzen (false) Feldern.
// Alle Wörter haben Länge 3..maxLen; einzelne Felder dürfen in einer Richtung ungekreuzt sein.
// Lokale Suche (Simulated Annealing) über punktsymmetrische Feldpaare.
function makePattern(rnd, maxLen, targetBlack, uncheckedWeight = 1.2) {
    const white = Array.from({ length: SIZE }, () => Array(SIZE).fill(true));
    const flip = (r, c) => {
        const v = !white[r][c];
        white[r][c] = v;
        white[SIZE - 1 - r][SIZE - 1 - c] = v;
    };

    function cost() {
        let blacks = 0,
            bad = 0,
            unchecked = 0;
        for (let r = 0; r < SIZE; r++)
            for (let c = 0; c < SIZE; c++) {
                if (!white[r][c]) {
                    blacks++;
                    continue;
                }
                const h =
                    (c > 0 && white[r][c - 1]) ||
                    (c < SIZE - 1 && white[r][c + 1]);
                const v =
                    (r > 0 && white[r - 1][c]) ||
                    (r < SIZE - 1 && white[r + 1][c]);
                if (!h && !v) bad += 3;
                else if (!h || !v) unchecked++;
            }
        for (const run of allRuns(white)) {
            if (run.len === 2) bad += 2;
            else if (run.len > maxLen) bad += run.len - maxLen;
        }
        return (
            bad * 10 +
            unchecked * uncheckedWeight +
            Math.abs(blacks - targetBlack) * 0.8
        );
    }

    // Start: zufällige schwarze Felder
    for (let i = 0; i < targetBlack / 2; i++) {
        const r = Math.floor(rnd() * SIZE),
            c = Math.floor(rnd() * SIZE);
        if (white[r][c]) flip(r, c);
    }
    let cur = cost();
    const iters = 2500;
    for (let it = 0; it < iters; it++) {
        const temp = 2.5 * (1 - it / iters) + 0.05;
        const r = Math.floor(rnd() * SIZE),
            c = Math.floor(rnd() * SIZE);
        flip(r, c);
        const next = cost();
        if (next <= cur || rnd() < Math.exp((cur - next) / temp)) cur = next;
        else flip(r, c);
    }

    const runs = allRuns(white);
    if (runs.some((r) => r.len === 2 || r.len > maxLen)) return null;
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++) {
            if (!white[r][c]) continue;
            const h =
                (c > 0 && white[r][c - 1]) || (c < SIZE - 1 && white[r][c + 1]);
            const v =
                (r > 0 && white[r - 1][c]) || (r < SIZE - 1 && white[r + 1][c]);
            if (!h && !v) return null;
        }
    if (!connected(white)) return null;
    return { white, runs };
}

function allRuns(white) {
    const runs = [];
    for (const [dr, dc] of [
        [0, 1],
        [1, 0],
    ]) {
        for (let a = 0; a < SIZE; a++) {
            let start = -1;
            for (let b = 0; b <= SIZE; b++) {
                const r = dr ? b : a,
                    c = dr ? a : b;
                const w = b < SIZE && white[r][c];
                if (w && start < 0) start = b;
                if (!w && start >= 0) {
                    const len = b - start;
                    if (len >= 2)
                        runs.push({
                            r: dr ? start : a,
                            c: dr ? a : start,
                            dr,
                            dc,
                            len,
                        });
                    start = -1;
                }
            }
        }
    }
    return runs;
}

function connected(white) {
    let total = 0,
        sr = -1,
        sc = -1;
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
            if (white[r][c]) {
                total++;
                sr = r;
                sc = c;
            }
    if (!total) return false;
    const seen = new Set([sr * SIZE + sc]);
    const stack = [[sr, sc]];
    while (stack.length) {
        const [r, c] = stack.pop();
        for (const [dr, dc] of [
            [0, 1],
            [1, 0],
            [0, -1],
            [-1, 0],
        ]) {
            const rr = r + dr,
                cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE || !white[rr][cc])
                continue;
            const k = rr * SIZE + cc;
            if (!seen.has(k)) {
                seen.add(k);
                stack.push([rr, cc]);
            }
        }
    }
    return seen.size === total;
}

// ---------- Füllen ----------

function fillPattern(pattern, dict, rnd, deadline) {
    const slots = pattern.runs.map((run, id) => ({
        id,
        ...run,
        cells: Array.from({ length: run.len }, (_, i) => [
            run.r + run.dr * i,
            run.c + run.dc * i,
        ]),
        group: dict.byLen[run.len],
        word: null,
    }));
    if (slots.some((s) => !s.group)) return null;

    const letters = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    const cellSlots = Array.from({ length: SIZE }, () =>
        Array.from({ length: SIZE }, () => []),
    );
    for (const s of slots)
        s.cells.forEach(([r, c], i) => cellSlots[r][c].push([s, i]));
    const used = new Set();
    const order = new Map(); // zufällige Wort-Reihenfolge je Länge
    for (const g of dict.byLen)
        if (g)
            order.set(
                g,
                shuffle(
                    g.words.map((_, i) => i),
                    rnd,
                ),
            );

    function candidates(s) {
        const g = s.group;
        const set = g.all.slice();
        s.cells.forEach(([r, c], i) => {
            const ch = letters[r][c];
            if (!ch) return;
            const bits = g.pos[i][ch.charCodeAt(0) - 65];
            for (let b = 0; b < set.length; b++) set[b] &= bits[b];
        });
        return set;
    }
    function count(set) {
        let n = 0;
        for (let b = 0; b < set.length; b++) if (set[b]) n += popcount(set[b]);
        return n;
    }

    // owner[r][c]: Slot, der den Buchstaben gesetzt hat (für Backjumping)
    const owner = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    function place(slot, w) {
        const changed = [];
        slot.cells.forEach(([r, c], k) => {
            if (!letters[r][c]) {
                letters[r][c] = w.answer[k];
                owner[r][c] = slot;
                changed.push([r, c]);
            }
        });
        slot.word = w;
        used.add(w.answer);
        return changed;
    }
    function unplace(slot, w, changed) {
        slot.word = null;
        used.delete(w.answer);
        for (const [r, c] of changed) {
            letters[r][c] = null;
            owner[r][c] = null;
        }
    }
    function owners(s, into, except) {
        for (const [r, c] of s.cells)
            if (owner[r][c] && owner[r][c] !== except) into.add(owner[r][c]);
        return into;
    }

    // Backtracking mit Conflict-Directed Backjumping.
    // Rückgabe: true bei Erfolg, sonst die Menge der Slots, die den Konflikt verursachen.
    let steps = 0;
    function solve() {
        if (++steps % 64 === 0 && Date.now() > deadline) throw "timeout";
        // MRV: Slot mit den wenigsten Kandidaten
        let best = null,
            bestSet = null,
            bestN = Infinity;
        for (const s of slots) {
            if (s.word) continue;
            const set = candidates(s);
            const n = count(set);
            if (n === 0) return owners(s, new Set());
            if (n < bestN) {
                best = s;
                bestSet = set;
                bestN = n;
                if (n === 1) break;
            }
        }
        if (!best) return true;

        const conflict = owners(best, new Set());
        const g = best.group;
        // Kandidaten sammeln (zufällige Reihenfolge, begrenzt) und per Vorausschau bewerten:
        // Wörter, die den kreuzenden Slots mehr Möglichkeiten lassen, zuerst.
        const scored = [];
        for (const i of order.get(g)) {
            if (!(bestSet[i >> 5] & (1 << (i & 31)))) continue;
            const w = g.words[i];
            if (used.has(w.answer)) continue;
            const changed = place(best, w);
            let score = 0;
            for (const [r, c] of changed) {
                for (const [s] of cellSlots[r][c]) {
                    if (s === best || s.word) continue;
                    const n = count(candidates(s));
                    if (!n) {
                        score = -Infinity;
                        owners(s, conflict, best);
                        break;
                    }
                    score += Math.log(n);
                }
                if (score === -Infinity) break;
            }
            unplace(best, w, changed);
            if (score > -Infinity) scored.push([score + rnd() * 1.5, w]);
            if (scored.length >= 40) break;
        }
        scored.sort((a, b) => b[0] - a[0]);
        for (let t = 0; t < scored.length && t < 10; t++) {
            const w = scored[t][1];
            const changed = place(best, w);
            const res = solve();
            unplace(best, w, changed);
            if (res === true) {
                place(best, w);
                return true;
            }
            if (!res.has(best)) return res; // Konflikt liegt weiter oben: zurückspringen
            for (const x of res) if (x !== best) conflict.add(x);
        }
        return conflict;
    }

    try {
        if (solve() !== true) return null;
    } catch (e) {
        if (e === "timeout") return null;
        throw e;
    }
    // vollständig ausgefüllte, aber nicht als Slot erfasste Zellen gibt es nicht
    return { letters, slots };
}

// ---------- Hauptfunktion ----------

// Dichtestufen: von vollständig gekreuzt (schwer zu füllen) bis locker
const LEVELS = [
    { maxLen: 8, black: 52, unchecked: 1.2 },
    { maxLen: 8, black: 56, unchecked: 0.5 },
    { maxLen: 7, black: 60, unchecked: 0.25 },
    { maxLen: 7, black: 64, unchecked: 0.1 },
];

function generatePuzzle(seed, timeBudgetMs = 4000) {
    const rnd = mulberry32(seed);
    const dict = buildDict();
    const end = Date.now() + timeBudgetMs;
    let result = null;
    let attempt = 0;
    while (!result && Date.now() < end) {
        attempt++;
        // Erst dichte Muster versuchen, mit der Zeit lockerer werden
        const level = Math.min(
            LEVELS.length - 1,
            Math.floor((attempt - 1) / 3),
        );
        const { maxLen, black, unchecked } = LEVELS[level];
        const pattern = makePattern(
            rnd,
            maxLen + Math.floor(rnd() * 2),
            black + Math.floor(rnd() * 6),
            unchecked,
        );
        if (!pattern) continue;
        result = fillPattern(
            pattern,
            dict,
            rnd,
            Math.min(end, Date.now() + 800),
        );
    }
    if (!result) return null;

    const grid = result.letters;
    const words = result.slots.map((s) => ({
        answer: s.word.answer,
        clue: s.word.clues[Math.floor(rnd() * s.word.clues.length)],
        row: s.r,
        col: s.c,
        dir: s.dr ? "down" : "across",
        cells: s.cells,
    }));
    words.sort((a, b) => a.row - b.row || a.col - b.col);
    const numbers = new Map();
    let n = 0;
    for (const w of words) {
        const key = w.row * SIZE + w.col;
        if (!numbers.has(key)) numbers.set(key, ++n);
        w.number = numbers.get(key);
    }
    return {
        seed,
        grid,
        words,
        numbers,
        attempts: attempt,
        level: Math.min(LEVELS.length - 1, Math.floor((attempt - 1) / 3)),
    };
}
