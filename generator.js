// Kreuzworträtsel-Generator: legt zufällig Wörter aus WORDS kreuzend in ein 15x15-Gitter.
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

// Doppelte Antworten (z. B. aus verschiedenen Wortdateien) werden zusammengeführt:
// ihre Hinweise landen gemeinsam in einem Eintrag.
function buildPool() {
    const byAnswer = new Map();
    for (const [raw, ...clues] of WORDS) {
        const answer = normalize(raw);
        const valid = clues.filter((c) => c && c.trim());
        if (answer.length < 3 || answer.length > SIZE || !valid.length)
            continue;
        const entry = byAnswer.get(answer);
        if (entry) {
            for (const c of valid)
                if (!entry.clues.includes(c)) entry.clues.push(c);
        } else {
            byAnswer.set(answer, { answer, clues: valid });
        }
    }
    return [...byAnswer.values()];
}

const POOL_PER_TRY = 700;
const TRIES = 100;

function tryLayout(pool, rnd) {
    const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    // Hinweisfelder: Feld direkt vor jedem Wortanfang, max. ein Hinweis pro Richtung
    const clueGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    const placed = [];
    const get = (r, c) =>
        r < 0 || c < 0 || r >= SIZE || c >= SIZE ? null : grid[r][c];

    // Längere Wörter bevorzugt zuerst, aber mit Zufall
    // Zufällige Teilmenge pro Versuch: schneller, und jedes Rätsel wirkt anders
    const order = shuffle(pool.slice(), rnd)
        .slice(0, POOL_PER_TRY)
        .map((w) => ({ w, k: w.answer.length + rnd() * 6 }))
        .sort((a, b) => b.k - a.k)
        .map((x) => x.w);

    function check(word, r, c, dir) {
        const dr = dir === "down" ? 1 : 0,
            dc = dir === "across" ? 1 : 0;
        const len = word.length;
        const endR = r + dr * (len - 1),
            endC = c + dc * (len - 1);
        if (r < 0 || c < 0 || endR >= SIZE || endC >= SIZE) return -1;
        // Wort braucht ein Hinweisfeld davor, darf also nicht am Rand beginnen
        if (r - dr < 0 || c - dc < 0) return -1;
        if (get(r - dr, c - dc) || get(endR + dr, endC + dc)) return -1;
        if (clueGrid[r - dr][c - dc]?.[dir]) return -1;
        let crossings = 0;
        for (let i = 0; i < len; i++) {
            const rr = r + dr * i,
                cc = c + dc * i;
            const cur = grid[rr][cc];
            if (clueGrid[rr][cc]) return -1; // Hinweisfeld bleibt frei
            if (cur) {
                if (cur !== word[i]) return -1;
                crossings++;
            } else if (get(rr + dc, cc + dr) || get(rr - dc, cc - dr)) {
                return -1; // seitliche Nachbarn würden ungültige Wörter bilden
            }
        }
        if (crossings === len) return -1;
        return crossings;
    }

    function place(entry, r, c, dir) {
        const dr = dir === "down" ? 1 : 0,
            dc = dir === "across" ? 1 : 0;
        for (let i = 0; i < entry.answer.length; i++)
            grid[r + dr * i][c + dc * i] = entry.answer[i];
        const word = { ...entry, row: r, col: c, dir };
        (clueGrid[r - dr][c - dc] ||= {})[dir] = word;
        placed.push(word);
    }

    // Erstes Wort mittig
    const first =
        order.find((w) => w.answer.length >= 7 && w.answer.length <= 11) ||
        order.find((w) => w.answer.length <= SIZE - 2);
    const firstDir = rnd() < 0.5 ? "across" : "down";
    const off = Math.floor((SIZE - first.answer.length) / 2);
    const mid = Math.floor(SIZE / 2);
    if (firstDir === "across") place(first, mid, off, "across");
    else place(first, off, mid, "down");

    const used = new Set([first.answer]);
    let progress = true;
    while (progress) {
        progress = false;
        for (const entry of order) {
            if (used.has(entry.answer)) continue;
            const w = entry.answer;
            let best = null,
                bestScore = -Infinity;
            for (let r = 0; r < SIZE; r++) {
                for (let c = 0; c < SIZE; c++) {
                    const letter = grid[r][c];
                    if (!letter) continue;
                    for (let i = 0; i < w.length; i++) {
                        if (w[i] !== letter) continue;
                        for (const dir of ["across", "down"]) {
                            const sr = dir === "down" ? r - i : r;
                            const sc = dir === "across" ? c - i : c;
                            const x = check(w, sr, sc, dir);
                            if (x < 1) continue;
                            const score =
                                x * 20 +
                                (x / w.length) * 10 +
                                rnd() * 3;
                            if (score > bestScore) {
                                bestScore = score;
                                best = [sr, sc, dir];
                            }
                        }
                    }
                }
            }
            if (best) {
                place(entry, ...best);
                used.add(w);
                progress = true;
            }
        }
    }

    let filled = 0;
    for (const row of grid) for (const ch of row) if (ch) filled++;
    return { grid, clueGrid, placed, filled };
}

function generatePuzzle(seed) {
    const rnd = mulberry32(seed);
    const pool = buildPool();
    let best = null;
    for (let attempt = 0; attempt < TRIES; attempt++) {
        const res = tryLayout(pool, rnd);
        if (!best || res.filled > best.filled) best = res;
    }

    best.placed.sort((a, b) => a.row - b.row || a.col - b.col);
    for (const w of best.placed) {
        w.clue = w.clues[Math.floor(rnd() * w.clues.length)];
        w.cells = [];
        for (let i = 0; i < w.answer.length; i++) {
            w.cells.push(
                w.dir === "across" ? [w.row, w.col + i] : [w.row + i, w.col],
            );
        }
        delete w.clues;
    }

    return {
        seed,
        grid: best.grid,
        clueGrid: best.clueGrid,
        words: best.placed,
    };
}
