import {
    COLS,
    type Direction,
    type Puzzle,
    ROWS,
    type Word,
} from "./generator.ts";

export interface Cursor {
    row: number;
    col: number;
    direction: Direction;
}

/** Pfeil im ersten Buchstabenfeld: zeigt, aus welchem Hinweisfeld das Wort kommt */
export type ArrowKind =
    | "right" // Hinweis links, Wort nach rechts
    | "down" // Hinweis oben, Wort nach unten
    | "down-right" // Hinweis oben, Wort nach rechts
    | "up-right" // Hinweis unten, Wort nach rechts
    | "right-down" // Hinweis links, Wort nach unten
    | "left-down"; // Hinweis rechts, Wort nach unten

export interface BoardIndex {
    /** Wort-ID je Feld und Richtung, -1 = keins */
    across: Int16Array;
    down: Int16Array;
    /** Hinweise je Hinweisfeld (max. 2), waagerechte zuerst */
    cluesAt: Map<number, Word[]>;
    /** Wörter in Lesereihenfolge für Tab-Navigation */
    order: Word[];
}

export const cellIndex = (row: number, col: number) => row * COLS + col;

export function wordCells(word: Word): number[] {
    return Array.from({ length: word.answer.length }, (_, i) =>
        word.direction === "across"
            ? cellIndex(word.row, word.col + i)
            : cellIndex(word.row + i, word.col),
    );
}

export function arrowKind(word: Word): ArrowKind {
    const dr = word.row - word.clueRow;
    const dc = word.col - word.clueCol;
    if (word.direction === "across") {
        if (dc === 1) return "right";
        return dr === 1 ? "down-right" : "up-right";
    }
    if (dr === 1) return "down";
    return dc === 1 ? "right-down" : "left-down";
}

export function buildIndex(puzzle: Puzzle): BoardIndex {
    const across = new Int16Array(ROWS * COLS).fill(-1);
    const down = new Int16Array(ROWS * COLS).fill(-1);
    const cluesAt = new Map<number, Word[]>();
    for (const word of puzzle.words) {
        const target = word.direction === "across" ? across : down;
        for (const i of wordCells(word)) target[i] = word.id;
        const key = cellIndex(word.clueRow, word.clueCol);
        const list = cluesAt.get(key) ?? [];
        list.push(word);
        list.sort(
            (a, b) =>
                (a.direction === "across" ? -1 : 1) -
                (b.direction === "across" ? -1 : 1),
        );
        cluesAt.set(key, list);
    }
    const order = [...puzzle.words].sort(
        (a, b) =>
            a.row - b.row ||
            a.col - b.col ||
            (a.direction === "across" ? -1 : 1),
    );
    return { across, down, cluesAt, order };
}

export function wordAt(index: BoardIndex, cursor: Cursor): number {
    const i = cellIndex(cursor.row, cursor.col);
    return cursor.direction === "across" ? index.across[i] : index.down[i];
}

/** Richtung so wählen, dass das Feld zu einem Wort gehört (bevorzugt die gewünschte) */
export function fitDirection(
    index: BoardIndex,
    row: number,
    col: number,
    preferred: Direction,
): Cursor {
    const i = cellIndex(row, col);
    const has = (d: Direction) =>
        (d === "across" ? index.across[i] : index.down[i]) >= 0;
    const direction = has(preferred)
        ? preferred
        : preferred === "across"
          ? "down"
          : "across";
    return { row, col, direction };
}

/** Nächstes Buchstabenfeld in Pfeilrichtung, Hinweisfelder werden übersprungen */
export function step(
    puzzle: Puzzle,
    row: number,
    col: number,
    dr: number,
    dc: number,
): [number, number] | null {
    for (
        let r = row + dr, c = col + dc;
        r >= 0 && c >= 0 && r < ROWS && c < COLS;
        r += dr, c += dc
    )
        if (puzzle.solution[r][c] !== null) return [r, c];
    return null;
}

export function cursorOnWord(word: Word, offset: number): Cursor {
    return word.direction === "across"
        ? { row: word.row, col: word.col + offset, direction: "across" }
        : { row: word.row + offset, col: word.col, direction: "down" };
}

/** Erstes leeres Feld eines Wortes, sonst Wortanfang */
export function firstEmpty(word: Word, entries: string[]): Cursor {
    const offset = wordCells(word).findIndex((i) => !entries[i]);
    return cursorOnWord(word, Math.max(offset, 0));
}

/** Nächstes (bzw. vorheriges) Wort in Lesereihenfolge, bevorzugt unvollständige */
export function neighbourWord(
    index: BoardIndex,
    entries: string[],
    currentId: number,
    delta: 1 | -1,
): Word {
    const { order } = index;
    const start = Math.max(
        order.findIndex((w) => w.id === currentId),
        0,
    );
    for (let k = 1; k <= order.length; k++) {
        const word =
            order[(start + delta * k + order.length * k) % order.length];
        if (wordCells(word).some((i) => !entries[i])) return word;
    }
    return order[(start + delta + order.length) % order.length];
}

export function isSolved(puzzle: Puzzle, entries: string[]): boolean {
    return puzzle.solution.every((row, r) =>
        row.every(
            (letter, c) =>
                letter === null || entries[cellIndex(r, c)] === letter,
        ),
    );
}
