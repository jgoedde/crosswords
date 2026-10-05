import {
    type Dispatch,
    type KeyboardEvent,
    useEffect,
    useMemo,
    useRef,
} from "react";
import { arrowKind, cellIndex, wordAt, wordCells } from "../game/board.ts";
import { SIZE } from "../game/generator.ts";
import type { Action, GameState } from "../game/state.ts";
import type { ArrowSpec, ClueHalf } from "./Arrow.tsx";
import styles from "./Board.module.css";
import { ClueCell } from "./ClueCell.tsx";
import { LetterCell } from "./LetterCell.tsx";

interface Props {
    state: GameState;
    dispatch: Dispatch<Action>;
}

const MOVES: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
};

export function Board({ state, dispatch }: Props) {
    const { puzzle, index, entries, revealed, cursor, checking } = state;
    const input = useRef<HTMLInputElement>(null);

    const arrowsAt = useMemo(() => {
        const map = new Map<number, ArrowSpec[]>();
        for (const word of puzzle.words) {
            const i = cellIndex(word.row, word.col);
            // geteiltes Hinweisfeld: oben steht der erste Hinweis, unten der zweite
            const clues =
                index.cluesAt.get(cellIndex(word.clueRow, word.clueCol)) ?? [];
            const half: ClueHalf =
                clues.length < 2 ? null : clues[0] === word ? "top" : "bottom";
            map.set(i, [
                ...(map.get(i) ?? []),
                { kind: arrowKind(word), half },
            ]);
        }
        return map;
    }, [puzzle, index]);

    const activeId = wordAt(index, cursor);
    const activeCells = useMemo(
        () => new Set(activeId >= 0 ? wordCells(puzzle.words[activeId]) : []),
        [puzzle, activeId],
    );

    // Tastatur bleibt aktiv; auf dem Handy öffnet der Fokus die Bildschirmtastatur
    useEffect(() => {
        input.current?.focus({ preventScroll: true });
    }, [cursor]);

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const move = MOVES[e.key];
        if (move) dispatch({ type: "move", dr: move[0], dc: move[1] });
        else if (e.key === "Backspace") dispatch({ type: "backspace" });
        else if (e.key === "Delete") dispatch({ type: "delete" });
        else if (e.key === "Tab")
            dispatch({ type: "nextWord", delta: e.shiftKey ? -1 : 1 });
        else if (e.key === " " || e.key === "Enter")
            dispatch({ type: "toggleDirection" });
        else if (/^[a-zäöüß]$/i.test(e.key))
            dispatch({ type: "input", text: e.key });
        else return;
        e.preventDefault();
    };

    const select = (row: number, col: number) => {
        dispatch({ type: "select", row, col });
        input.current?.focus({ preventScroll: true });
    };

    const cells = [];
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++) {
            const i = cellIndex(r, c);
            const solution = puzzle.solution[r][c];
            cells.push(
                solution === null ? (
                    <ClueCell
                        key={i}
                        clues={index.cluesAt.get(i) ?? []}
                        activeId={activeId}
                        onSelect={(id) => {
                            dispatch({ type: "selectWord", id });
                            input.current?.focus({ preventScroll: true });
                        }}
                    />
                ) : (
                    <LetterCell
                        key={i}
                        letter={entries[i]}
                        arrows={arrowsAt.get(i) ?? []}
                        isCursor={cursor.row === r && cursor.col === c}
                        inWord={activeCells.has(i)}
                        wrong={
                            checking &&
                            entries[i] !== "" &&
                            entries[i] !== solution
                        }
                        revealed={revealed[i]}
                        onSelect={() => select(r, c)}
                    />
                ),
            );
        }

    return (
        <div className={styles.wrap}>
            <div className={styles.board} role="grid" aria-label="Rätselgitter">
                {cells}
            </div>
            <input
                ref={input}
                className={styles.input}
                aria-label="Buchstabe eingeben"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                value=""
                onKeyDown={onKeyDown}
                // Handy-Tastaturen liefern oft kein brauchbares keydown – dann über input
                onChange={(e) => {
                    if (e.target.value)
                        dispatch({ type: "input", text: e.target.value });
                }}
            />
        </div>
    );
}
