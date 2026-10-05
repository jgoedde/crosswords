import { Board } from "./components/Board.tsx";
import { ClueBar } from "./components/ClueBar.tsx";
import { Toolbar } from "./components/Toolbar.tsx";
import type { Puzzle } from "./game/generator.ts";
import { randomSeed } from "./game/random.ts";
import { useGame } from "./hooks/useGame.ts";
import { usePuzzle } from "./hooks/usePuzzle.ts";
import { useSeed } from "./hooks/useSeed.ts";
import styles from "./App.module.css";

export function App() {
    const [seed, setSeed] = useSeed();
    const { puzzle, error } = usePuzzle(seed);
    const newPuzzle = () => setSeed(randomSeed());

    if (!puzzle)
        return (
            <main className={styles.app}>
                <p className={styles.status}>
                    {error
                        ? `Fehler beim Erzeugen: ${error}`
                        : "Rätsel wird erstellt …"}
                </p>
            </main>
        );

    // key: neuer Seed = frischer Spielzustand aus dem Speicher
    return <Game key={puzzle.seed} puzzle={puzzle} onNewPuzzle={newPuzzle} />;
}

function Game({
    puzzle,
    onNewPuzzle,
}: {
    puzzle: Puzzle;
    onNewPuzzle: () => void;
}) {
    const { state, dispatch, solved } = useGame(puzzle);
    return (
        <main className={styles.app}>
            <Toolbar
                seed={puzzle.seed}
                checking={state.checking}
                dispatch={dispatch}
                onNewPuzzle={onNewPuzzle}
            />
            <ClueBar state={state} solved={solved} />
            <Board state={state} dispatch={dispatch} />
            <p className={styles.help}>
                Feld anklicken und tippen · nochmal klicken oder Leertaste:
                Richtung wechseln · Tab: nächstes Wort · Ä, Ö, Ü, ß werden zu
                AE, OE, UE, SS
            </p>
        </main>
    );
}
