import type { ArrowKind } from "../game/board.ts";
import styles from "./Arrow.module.css";

/** Hälfte des Hinweisfeldes, aus der der Hinweis kommt (bei zwei Hinweisen) */
export type ClueHalf = "top" | "bottom" | null;

export interface ArrowSpec {
    kind: ArrowKind;
    half: ClueHalf;
}

/**
 * Pfeile wie im gedruckten Schwedenrätsel: gefülltes Dreieck an der Kante
 * zum Hinweisfeld, bei Knickpfeilen mit kurzem Strich davor.
 * Seitlich startende Pfeile sitzen auf Höhe ihres Hinweises, damit bei
 * geteilten Hinweisfeldern klar ist, welcher Hinweis gemeint ist.
 * Koordinaten in Prozent der Feldgröße (viewBox 100×100).
 */
function shape(
    kind: ArrowKind,
    half: ClueHalf,
): { line?: string; head: string } {
    const y = half === "top" ? 25 : half === "bottom" ? 75 : null;
    switch (kind) {
        case "right": {
            const c = y ?? 50;
            return { head: `0,${c - 12} 13,${c} 0,${c + 12}` };
        }
        case "down":
            return { head: "38,0 62,0 50,13" };
        // Knickpfeile kompakt in der Ecke am Hinweisfeld, damit sie nicht
        // mit einem geraden Pfeil derselben Kante kollidieren
        case "down-right":
            return { line: "M10 0V22H14", head: "14,12 26,22 14,32" };
        case "up-right":
            return { line: "M10 100V78H14", head: "14,68 26,78 14,88" };
        case "right-down":
        case "left-down": {
            const c = y ?? 10;
            const from = kind === "right-down" ? 0 : 100;
            const x = kind === "right-down" ? 22 : 78;
            return {
                line: `M${from} ${c}H${x}V${c + 4}`,
                head: `${x - 10},${c + 4} ${x + 10},${c + 4} ${x},${c + 16}`,
            };
        }
    }
}

export function Arrow({ kind, half }: { kind: ArrowKind; half: ClueHalf }) {
    const { line, head } = shape(kind, half);
    return (
        <svg className={styles.arrow} viewBox="0 0 100 100" aria-hidden>
            {line && <path className={styles.line} d={line} />}
            <polygon className={styles.head} points={head} />
        </svg>
    );
}
