import { useCallback, useEffect, useState } from "react";
import { randomSeed } from "../game/random.ts";

const PARAM = "seed";

/** Seed aus der URL lesen; fehlt er, wird ein zufälliger eingetragen */
function readSeed(): string {
    const url = new URL(window.location.href);
    const seed = url.searchParams.get(PARAM);
    if (seed) return seed;
    const fresh = randomSeed();
    url.searchParams.set(PARAM, fresh);
    window.history.replaceState(null, "", url);
    return fresh;
}

/** Seed im Query-Parameter `?seed=` – gleicher Seed, gleiches Rätsel */
export function useSeed(): [string, (seed: string) => void] {
    const [seed, setSeedState] = useState(readSeed);

    useEffect(() => {
        const onPop = () => setSeedState(readSeed());
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);

    const setSeed = useCallback((next: string) => {
        const url = new URL(window.location.href);
        url.searchParams.set(PARAM, next);
        window.history.pushState(null, "", url);
        setSeedState(next);
    }, []);

    return [seed, setSeed];
}
