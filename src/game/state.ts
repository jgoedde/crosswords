import {
    type BoardIndex,
    cellIndex,
    type Cursor,
    cursorOnWord,
    firstEmpty,
    fitDirection,
    neighbourWord,
    step,
    wordAt,
    wordCells,
} from "./board.ts";
import { type Puzzle, SIZE } from "./generator.ts";

export interface GameState {
    puzzle: Puzzle;
    index: BoardIndex;
    /** Eingabe je Feld, "" = leer */
    entries: string[];
    /** aufgedeckte Felder (gesperrt) */
    revealed: boolean[];
    cursor: Cursor;
    /** falsche Buchstaben anzeigen */
    checking: boolean;
}

export type Action =
    | { type: "select"; row: number; col: number }
    | { type: "selectWord"; id: number }
    | { type: "input"; text: string }
    | { type: "backspace" }
    | { type: "delete" }
    | { type: "move"; dr: number; dc: number }
    | { type: "nextWord"; delta: 1 | -1 }
    | { type: "toggleDirection" }
    | { type: "toggleCheck" }
    | { type: "revealCell" }
    | { type: "revealWord" }
    | { type: "revealAll" }
    | { type: "reset" };

/** Umlaute und ß werden wie in der Lösung ausgeschrieben */
export function toLetters(text: string): string {
    return text
        .toUpperCase()
        .replace(/Ä/g, "AE")
        .replace(/Ö/g, "OE")
        .replace(/Ü/g, "UE")
        .replace(/ß|ẞ/g, "SS")
        .replace(/[^A-Z]/g, "");
}

export function initialState(
    puzzle: Puzzle,
    index: BoardIndex,
    saved: { entries: string[]; revealed: boolean[] } | null,
): GameState {
    const first = index.order[0];
    return {
        puzzle,
        index,
        entries: saved?.entries ?? Array(SIZE * SIZE).fill(""),
        revealed: saved?.revealed ?? Array(SIZE * SIZE).fill(false),
        cursor: first
            ? cursorOnWord(first, 0)
            : { row: 0, col: 0, direction: "across" },
        checking: false,
    };
}

const currentWord = (s: GameState) => s.puzzle.words[wordAt(s.index, s.cursor)];

/** Nach einer Eingabe: nächstes Feld im Wort, am Wortende zum nächsten offenen Wort */
function advance(s: GameState, entries: string[]): Cursor {
    const word = currentWord(s);
    const cells = wordCells(word);
    const pos = cells.indexOf(cellIndex(s.cursor.row, s.cursor.col));
    for (let k = pos + 1; k < cells.length; k++)
        if (!s.revealed[cells[k]]) return cursorOnWord(word, k);
    if (
        entries.every(
            (e, i) => e || s.puzzle.solution[(i / SIZE) | 0][i % SIZE] === null,
        )
    )
        return s.cursor;
    return firstEmpty(neighbourWord(s.index, entries, word.id, 1), entries);
}

function reveal(s: GameState, cells: number[]): GameState {
    const entries = [...s.entries];
    const revealed = [...s.revealed];
    for (const i of cells) {
        entries[i] = s.puzzle.solution[(i / SIZE) | 0][i % SIZE] ?? "";
        revealed[i] = true;
    }
    return { ...s, entries, revealed };
}

export function reducer(s: GameState, action: Action): GameState {
    switch (action.type) {
        case "select": {
            const { row, col } = action;
            const same = s.cursor.row === row && s.cursor.col === col;
            const preferred = same
                ? s.cursor.direction === "across"
                    ? "down"
                    : "across"
                : s.cursor.direction;
            return { ...s, cursor: fitDirection(s.index, row, col, preferred) };
        }
        case "selectWord":
            return {
                ...s,
                cursor: firstEmpty(s.puzzle.words[action.id], s.entries),
            };
        case "input": {
            let state = s;
            for (const letter of toLetters(action.text)) {
                const i = cellIndex(state.cursor.row, state.cursor.col);
                const entries = [...state.entries];
                if (!state.revealed[i]) entries[i] = letter;
                state = { ...state, entries, cursor: advance(state, entries) };
            }
            return state;
        }
        case "backspace": {
            const i = cellIndex(s.cursor.row, s.cursor.col);
            if (s.entries[i] && !s.revealed[i]) {
                const entries = [...s.entries];
                entries[i] = "";
                return { ...s, entries };
            }
            // leeres Feld: eins zurück im Wort und dort löschen
            const word = currentWord(s);
            const cells = wordCells(word);
            const pos = cells.indexOf(i);
            if (pos <= 0) return s;
            const prev = cells[pos - 1];
            const entries = [...s.entries];
            if (!s.revealed[prev]) entries[prev] = "";
            return { ...s, entries, cursor: cursorOnWord(word, pos - 1) };
        }
        case "delete": {
            const i = cellIndex(s.cursor.row, s.cursor.col);
            if (s.revealed[i]) return s;
            const entries = [...s.entries];
            entries[i] = "";
            return { ...s, entries };
        }
        case "move": {
            const target = step(
                s.puzzle,
                s.cursor.row,
                s.cursor.col,
                action.dr,
                action.dc,
            );
            const direction = action.dc !== 0 ? "across" : "down";
            if (!target) return s;
            return {
                ...s,
                cursor: fitDirection(s.index, target[0], target[1], direction),
            };
        }
        case "nextWord": {
            const word = neighbourWord(
                s.index,
                s.entries,
                wordAt(s.index, s.cursor),
                action.delta,
            );
            return { ...s, cursor: firstEmpty(word, s.entries) };
        }
        case "toggleDirection":
            return {
                ...s,
                cursor: fitDirection(
                    s.index,
                    s.cursor.row,
                    s.cursor.col,
                    s.cursor.direction === "across" ? "down" : "across",
                ),
            };
        case "toggleCheck":
            return { ...s, checking: !s.checking };
        case "revealCell":
            return reveal(s, [cellIndex(s.cursor.row, s.cursor.col)]);
        case "revealWord":
            return reveal(s, wordCells(currentWord(s)));
        case "revealAll":
            return reveal(
                s,
                s.puzzle.solution.flatMap((row, r) =>
                    row.flatMap((letter, c) =>
                        letter === null ? [] : [cellIndex(r, c)],
                    ),
                ),
            );
        case "reset":
            return initialState(s.puzzle, s.index, null);
    }
}
