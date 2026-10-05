import { useLayoutEffect, useRef } from "react";
import type { Word } from "../game/generator.ts";
import styles from "./ClueCell.module.css";

interface Props {
    clues: Word[];
    activeId: number;
    onSelect: (id: number) => void;
}

/** Schriftgröße in % der Feldbreite: einheitlich, nur bei Platzmangel kleiner */
const MAX_SIZE = { single: 22, split: 19 };
const MIN_SIZE = 9;

function Clue(props: {
    word: Word;
    split: boolean;
    active: boolean;
    onSelect: (id: number) => void;
}) {
    const { word, split, active, onSelect } = props;
    const ref = useRef<HTMLButtonElement>(null);

    // so lange verkleinern, bis der Text ins Feld passt (ohne Umbruch mitten im Wort)
    useLayoutEffect(() => {
        const el = ref.current!;
        let cancelled = false;
        const fit = () => {
            let size = split ? MAX_SIZE.split : MAX_SIZE.single;
            el.style.fontSize = `${size}cqw`;
            while (
                size > MIN_SIZE &&
                (el.scrollHeight > el.clientHeight ||
                    el.scrollWidth > el.clientWidth)
            ) {
                size -= 0.5;
                el.style.fontSize = `${size}cqw`;
            }
        };
        fit();
        // Webfont kommt evtl. später und hat andere Maße
        document.fonts.ready.then(() => !cancelled && fit());
        return () => {
            cancelled = true;
        };
    }, [word.clue, split]);

    return (
        <button
            ref={ref}
            type="button"
            tabIndex={-1}
            className={`${styles.clue} ${active ? styles.active : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(word.id)}
            title={word.clue}
        >
            {word.clue}
        </button>
    );
}

export function ClueCell({ clues, activeId, onSelect }: Props) {
    if (clues.length === 0)
        return <div className={`${styles.cell} ${styles.empty}`} />;
    return (
        <div className={styles.cell}>
            {clues.map((word) => (
                <Clue
                    key={word.id}
                    word={word}
                    split={clues.length > 1}
                    active={word.id === activeId}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
}
