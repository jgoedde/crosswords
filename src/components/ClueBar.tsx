import { wordAt } from "../game/board.ts";
import type { GameState } from "../game/state.ts";
import type { useReports } from "../hooks/useReports.ts";
import styles from "./ClueBar.module.css";
import { ReportButton } from "./ReportButton.tsx";

interface Props {
    state: GameState;
    solved: boolean;
    reports: ReturnType<typeof useReports>;
}

/** Aktueller Hinweis in voller Größe – im Gitter ist die Schrift winzig */
export function ClueBar({ state, solved, reports }: Props) {
    if (solved)
        return (
            <div
                className={`${styles.bar} ${styles.solved}`}
                aria-live="polite"
            >
                Geschafft – alles richtig!
            </div>
        );
    const id = wordAt(state.index, state.cursor);
    const word = id >= 0 ? state.puzzle.words[id] : null;
    return (
        <div className={styles.bar} aria-live="polite">
            {word && (
                <>
                    <span className={styles.direction}>
                        {word.direction === "across" ? "→" : "↓"}
                    </span>
                    <span className={styles.clue}>{word.clue}</span>
                    <span className={styles.length}>{word.answer.length}</span>
                    <ReportButton
                        // neues Wort = Formular zurücksetzen
                        key={word.id}
                        word={word}
                        seed={state.puzzle.seed}
                        reported={reports.isReported(word.answer, word.clue)}
                        onReport={reports.add}
                    />
                </>
            )}
        </div>
    );
}
