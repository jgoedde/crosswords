import { type FormEvent, useState } from "react";
import type { Word } from "../game/generator.ts";
import type { Report } from "../hooks/useReports.ts";
import styles from "./ReportButton.module.css";

interface Props {
    word: Word;
    seed: string;
    reported: boolean;
    onReport: (report: Report) => void;
}

/** „Melden“-Knopf, wird beim Klick zum Eingabefeld für den Grund */
export function ReportButton({ word, seed, reported, onReport }: Props) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");

    if (reported && !open)
        return <span className={styles.done}>⚑ Gemeldet</span>;

    if (!open)
        return (
            <button
                type="button"
                className={styles.button}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpen(true)}
            >
                ⚑ Melden
            </button>
        );

    const submit = (e: FormEvent) => {
        e.preventDefault();
        onReport({
            answer: word.answer,
            clue: word.clue,
            seed,
            reason: reason.trim(),
        });
        setOpen(false);
        setReason("");
    };

    return (
        <form className={styles.form} onSubmit={submit}>
            <input
                className={styles.input}
                autoFocus
                placeholder="Grund, z. B. Hinweis unklar"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            />
            <button type="submit" className={styles.button}>
                Speichern
            </button>
            <button
                type="button"
                className={styles.button}
                aria-label="Abbrechen"
                title="Abbrechen"
                onClick={() => setOpen(false)}
            >
                ✕
            </button>
        </form>
    );
}
