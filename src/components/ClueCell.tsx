import type { Word } from "../game/generator.ts";
import styles from "./ClueCell.module.css";

interface Props {
    clues: Word[];
    activeId: number;
    onSelect: (id: number) => void;
}

/** Schriftstufe nach Textlänge, damit auch lange Hinweise ins Feld passen */
function sizeClass(text: string, split: boolean): string {
    const length = text.length + (split ? 6 : 0);
    if (length <= 7) return styles.large;
    if (length <= 13) return styles.medium;
    if (length <= 20) return styles.small;
    return styles.tiny;
}

export function ClueCell({ clues, activeId, onSelect }: Props) {
    if (clues.length === 0)
        return <div className={`${styles.cell} ${styles.empty}`} />;
    const split = clues.length > 1;
    return (
        <div className={styles.cell}>
            {clues.map((word) => (
                <button
                    key={word.id}
                    type="button"
                    tabIndex={-1}
                    className={`${styles.clue} ${sizeClass(word.clue, split)} ${
                        word.id === activeId ? styles.active : ""
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onSelect(word.id)}
                    title={word.clue}
                >
                    {word.clue}
                </button>
            ))}
        </div>
    );
}
