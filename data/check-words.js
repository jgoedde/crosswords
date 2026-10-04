// Prüft die Wortlisten: Duplikate, Länge, Antwort im Hinweis, leere Hinweise.
// Aufruf: node data/check-words.js
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const files = [...html.matchAll(/<script src="(words[^"]*)"/g)].map(
    (m) => m[1],
);

const norm = (w) =>
    w
        .toUpperCase()
        .replace(/Ä/g, "AE")
        .replace(/Ö/g, "OE")
        .replace(/Ü/g, "UE")
        .replace(/ß/g, "SS")
        .replace(/[^A-Z]/g, "");

let WORDS;
const sources = [];
for (const f of files) {
    const src = fs
        .readFileSync(path.join(root, f), "utf8")
        .replace("const WORDS", "WORDS");
    const before = WORDS ? WORDS.length : 0;
    eval(src);
    sources.push([f, before, WORDS.length]);
}
const fileOf = (i) => sources.find(([, a, b]) => i >= a && i < b)[0];

const seen = new Map();
const problems = [];
const dupes = []; // werden im Generator zusammengeführt, nur Info
const lengths = {};
WORDS.forEach(([raw, ...clues], i) => {
    const a = norm(raw);
    const where = `${fileOf(i)}: ${raw}`;
    if (a.length < 3 || a.length > 15)
        problems.push(`${where} – Länge ${a.length}`);
    if (!clues.some((c) => c && c.trim()))
        problems.push(`${where} – kein Hinweis`);
    for (const c of clues) {
        const words = c.split(/[^\p{L}]+/u).map(norm);
        if (words.includes(a))
            problems.push(`${where} – Antwort im Hinweis: "${c}"`);
    }
    if (seen.has(a)) dupes.push(`${raw} (${seen.get(a)} + ${fileOf(i)})`);
    else seen.set(a, fileOf(i));
    lengths[a.length] = (lengths[a.length] || 0) + 1;
});

console.log(
    "Dateien:",
    sources.map(([f, a, b]) => `${f} (${b - a})`).join(", "),
);
console.log(
    "Einträge gesamt:",
    WORDS.length,
    "– eindeutige Antworten:",
    seen.size,
);
console.log(
    "Nach Länge:",
    Object.entries(lengths)
        .map(([l, n]) => `${l}:${n}`)
        .join(" "),
);
if (dupes.length)
    console.log(
        `Doppelt (Hinweise werden zusammengeführt): ${dupes.length} – ${dupes.join(", ")}`,
    );
console.log(problems.length ? problems.join("\n") : "Keine Probleme gefunden.");
