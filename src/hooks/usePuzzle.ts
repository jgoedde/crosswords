import { useEffect, useState } from "react";
import type { Puzzle } from "../game/generator.ts";

type Result =
    { puzzle: Puzzle; error: null } | { puzzle: null; error: string | null };

/** Erzeugt das Rätsel zum Seed im Web Worker */
export function usePuzzle(seed: string): Result {
    const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
    const [error, setError] = useState<{
        seed: string;
        message: string;
    } | null>(null);

    useEffect(() => {
        const worker = new Worker(
            new URL("../game/puzzle.worker.ts", import.meta.url),
            {
                type: "module",
            },
        );
        worker.onmessage = (event: MessageEvent<Puzzle>) =>
            setPuzzle(event.data);
        worker.onerror = (event) => setError({ seed, message: event.message });
        worker.postMessage(seed);
        // Seed gewechselt, bevor das Rätsel fertig ist: alte Berechnung abbrechen
        return () => worker.terminate();
    }, [seed]);

    if (puzzle?.seed === seed) return { puzzle, error: null };
    return { puzzle: null, error: error?.seed === seed ? error.message : null };
}
