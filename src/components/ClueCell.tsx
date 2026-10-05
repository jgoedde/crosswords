import type { Word } from "../game/generator.ts";
import styles from "./ClueCell.module.css";

interface Props {
    clues: Word[];
    activeId: number;
    onSelect: (id: number) => void;
}

/**
 * Schriftgröße (in % der Feldbreite), so groß wie der Platz erlaubt:
 * Fläche reicht für die Zeichenzahl, längstes Wort wird höchstens einmal getrennt.
 */
function fontSize(text: string, split: boolean): number {
    const area = split ? 66 : 95;
    const max = split ? 24 : 30;
    const longest = Math.max(...text.split(/[\s-]+/).map((w) => w.length));
    const size = Math.min(area / Math.sqrt(text.length), 230 / longest, max);
    return Math.max(size, split ? 12 : 14);
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
                    className={`${styles.clue} ${
                        word.id === activeId ? styles.active : ""
                    }`}
                    style={{ fontSize: `${fontSize(word.clue, split)}cqw` }}
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
