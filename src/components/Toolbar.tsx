import { type Dispatch, type ReactNode, useState } from "react";
import type { Action } from "../game/state.ts";
import styles from "./Toolbar.module.css";

interface Props {
    seed: string;
    checking: boolean;
    dispatch: Dispatch<Action>;
    onNewPuzzle: () => void;
}

type Pending = "revealAll" | "reset" | null;

/** Knopf, der den Fokus im Gitter lässt (sonst bricht die Tastatureingabe ab) */
function ToolButton(props: {
    onClick: () => void;
    pressed?: boolean;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            className={styles.button}
            aria-pressed={props.pressed}
            onMouseDown={(e) => e.preventDefault()}
            onClick={props.onClick}
        >
            {props.children}
        </button>
    );
}

export function Toolbar({ seed, checking, dispatch, onNewPuzzle }: Props) {
    const [pending, setPending] = useState<Pending>(null);
    const [copied, setCopied] = useState(false);

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Zwischenablage nicht verfügbar – Link steht ja in der Adresszeile
        }
    };

    if (pending)
        return (
            <div className={styles.bar}>
                <span className={styles.question}>
                    {pending === "reset"
                        ? "Alle Eingaben löschen?"
                        : "Ganze Lösung zeigen?"}
                </span>
                <ToolButton
                    onClick={() => {
                        dispatch({ type: pending });
                        setPending(null);
                    }}
                >
                    Ja
                </ToolButton>
                <ToolButton onClick={() => setPending(null)}>
                    Abbrechen
                </ToolButton>
            </div>
        );

    return (
        <div className={styles.bar}>
            <h1 className={styles.title}>Schwedenrätsel</h1>
            <button
                type="button"
                className={styles.seed}
                onMouseDown={(e) => e.preventDefault()}
                onClick={copyLink}
                title="Link zu diesem Rätsel kopieren"
            >
                {copied ? "Link kopiert" : `#${seed}`}
            </button>
            <span className={styles.spacer} />
            <ToolButton
                onClick={() => dispatch({ type: "toggleCheck" })}
                pressed={checking}
            >
                Prüfen
            </ToolButton>
            <ToolButton onClick={() => dispatch({ type: "revealCell" })}>
                Buchstabe
            </ToolButton>
            <ToolButton onClick={() => dispatch({ type: "revealWord" })}>
                Wort
            </ToolButton>
            <ToolButton onClick={() => setPending("revealAll")}>
                Lösung
            </ToolButton>
            <ToolButton onClick={() => setPending("reset")}>Leeren</ToolButton>
            <ToolButton onClick={onNewPuzzle}>Neues Rätsel</ToolButton>
        </div>
    );
}
