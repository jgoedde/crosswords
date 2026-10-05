import { wordAt } from "../game/board.ts";
import type { GameState } from "../game/state.ts";
import styles from "./ClueBar.module.css";

/** Aktueller Hinweis in voller Größe – im Gitter ist die Schrift winzig */
export function ClueBar({
    state,
    solved,
}: {
    state: GameState;
    solved: boolean;
}) {
    if (solved)
        return (
            <p className={`${styles.bar} ${styles.solved}`} aria-live="polite">
                Geschafft – alles richtig!
            </p>
        );
    const id = wordAt(state.index, state.cursor);
    const word = id >= 0 ? state.puzzle.words[id] : null;
    return (
        <p className={styles.bar} aria-live="polite">
            {word && (
                <>
                    <span className={styles.direction}>
                        {word.direction === "across" ? "→" : "↓"}
                    </span>
                    <span className={styles.clue}>{word.clue}</span>
                    <span className={styles.length}>{word.answer.length}</span>
                </>
            )}
        </p>
    );
}
