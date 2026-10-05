import { Arrow, type ArrowSpec } from "./Arrow.tsx";
import styles from "./LetterCell.module.css";

interface Props {
    letter: string;
    arrows: ArrowSpec[];
    isCursor: boolean;
    inWord: boolean;
    wrong: boolean;
    revealed: boolean;
    onSelect: () => void;
}

export function LetterCell({
    letter,
    arrows,
    isCursor,
    inWord,
    wrong,
    revealed,
    onSelect,
}: Props) {
    const classes = [
        styles.cell,
        inWord && styles.inWord,
        isCursor && styles.cursor,
        wrong && styles.wrong,
        revealed && styles.revealed,
    ]
        .filter(Boolean)
        .join(" ");
    return (
        <div
            className={classes}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onSelect}
        >
            {arrows.map(({ kind, half }) => (
                <Arrow key={kind} kind={kind} half={half} />
            ))}
            <span className={styles.letter}>{letter}</span>
        </div>
    );
}
