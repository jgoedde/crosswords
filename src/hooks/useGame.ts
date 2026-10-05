import { useEffect, useMemo, useReducer } from "react";
import { buildIndex, isSolved } from "../game/board.ts";
import type { Puzzle } from "../game/generator.ts";
import { hashSeed } from "../game/random.ts";
import { initialState, reducer } from "../game/state.ts";

interface Saved {
    entries: string[];
    revealed: boolean[];
}

/**
 * Speicherschlüssel enthält einen Fingerabdruck der Lösung: ändert sich die
 * Wortliste, passt ein alter Spielstand nicht mehr und wird ignoriert.
 */
function storageKey(puzzle: Puzzle): string {
    const solution = puzzle.solution
        .map((row) => row.map((l) => l ?? "#").join(""))
        .join("");
    return `schwedenraetsel:${puzzle.seed}:${hashSeed(solution).toString(36)}`;
}

function load(key: string): Saved | null {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as Saved) : null;
    } catch {
        return null;
    }
}

function save(key: string, saved: Saved) {
    try {
        localStorage.setItem(key, JSON.stringify(saved));
    } catch {
        // Speicher voll oder gesperrt – Spiel läuft trotzdem weiter
    }
}

export function useGame(puzzle: Puzzle) {
    const key = useMemo(() => storageKey(puzzle), [puzzle]);
    const [state, dispatch] = useReducer(reducer, null, () =>
        initialState(puzzle, buildIndex(puzzle), load(key)),
    );

    useEffect(() => {
        save(key, { entries: state.entries, revealed: state.revealed });
    }, [key, state.entries, state.revealed]);

    const solved = useMemo(
        () => isSolved(puzzle, state.entries),
        [puzzle, state.entries],
    );
    return { state, dispatch, solved };
}
