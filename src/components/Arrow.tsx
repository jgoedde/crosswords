import type { ArrowKind } from "../game/board.ts";
import styles from "./Arrow.module.css";

const PATHS: Record<ArrowKind, string> = {
    right: "M1 6H10M7 3L10 6L7 9",
    down: "M6 1V10M3 7L6 10L9 7",
    "down-right": "M3 0V7H10M7 4L10 7L7 10",
    "up-right": "M3 12V5H10M7 2L10 5L7 8",
    "right-down": "M0 3H7V10M4 7L7 10L10 7",
    "left-down": "M12 3H5V10M2 7L5 10L8 7",
};

/** Kleiner Pfeil am Wortanfang, der zum Hinweisfeld zeigt */
export function Arrow({ kind }: { kind: ArrowKind }) {
    return (
        <svg
            className={`${styles.arrow} ${styles[kind]}`}
            viewBox="0 0 12 12"
            aria-hidden
        >
            <path d={PATHS[kind]} />
        </svg>
    );
}
