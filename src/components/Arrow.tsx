import type { ArrowKind } from "../game/board.ts";
import styles from "./Arrow.module.css";

/**
 * Pfeile wie im gedruckten Schwedenrätsel: gefülltes Dreieck an der Kante
 * zum Hinweisfeld, bei Knickpfeilen mit kurzem Strich davor.
 * Koordinaten in Prozent der Feldgröße (viewBox 100×100).
 */
const SHAPES: Record<ArrowKind, { line?: string; head: string }> = {
    right: { head: "0,38 13,50 0,62" },
    down: { head: "38,0 62,0 50,13" },
    "down-right": { line: "M18 0V50H22", head: "22,39 34,50 22,61" },
    "up-right": { line: "M18 100V50H22", head: "22,39 34,50 22,61" },
    "right-down": { line: "M0 18H50V22", head: "39,22 61,22 50,34" },
    "left-down": { line: "M100 18H50V22", head: "39,22 61,22 50,34" },
};

export function Arrow({ kind }: { kind: ArrowKind }) {
    const { line, head } = SHAPES[kind];
    return (
        <svg className={styles.arrow} viewBox="0 0 100 100" aria-hidden>
            {line && <path className={styles.line} d={line} />}
            <polygon className={styles.head} points={head} />
        </svg>
    );
}
