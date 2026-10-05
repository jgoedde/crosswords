import { useCallback, useState } from "react";

/** Meldung eines fragwürdigen Begriffs aus dem Review-Modus */
export interface Report {
    answer: string;
    clue: string;
    seed: string;
    reason: string;
}

const KEY = "schwedenraetsel:reports";

function load(): Report[] {
    try {
        return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Report[];
    } catch {
        return [];
    }
}

export function useReports() {
    const [reports, setReports] = useState(load);

    const add = useCallback((report: Report) => {
        // frisch lesen: Meldungen aus anderen Tabs nicht überschreiben
        const next = [...load(), report];
        try {
            localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
            // Speicher voll oder gesperrt
        }
        setReports(next);
    }, []);

    const isReported = (answer: string, clue: string) =>
        reports.some((r) => r.answer === answer && r.clue === clue);

    return { reports, add, isReported };
}
