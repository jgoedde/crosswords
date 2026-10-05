#!/usr/bin/env node

/**
 * Prüft die Wortliste auf:
 * - ungültige Antworten
 * - falsche Wortlänge
 * - leere Hinweise
 * - Antwort im Hinweis
 * - doppelte Antworten
 * - ungültige Eintragsstruktur
 *
 * Aufruf:
 *   node data/check-words.js
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const wordsFile = path.join(root, "words.js");

const norm = (value) =>
    String(value)
        .toUpperCase()
        .replace(/Ä/g, "AE")
        .replace(/Ö/g, "OE")
        .replace(/Ü/g, "UE")
        .replace(/ß/g, "SS")
        .replace(/[^A-Z]/g, "");

function loadWords() {
    if (!fs.existsSync(wordsFile)) {
        console.error(`Fehler: ${wordsFile} nicht gefunden.`);
        process.exit(1);
    }

    const source = fs.readFileSync(wordsFile, "utf8");

    // Erwartet: const WORDS = [...]
    const match = source.match(
        /(?:const|let|var)\s+WORDS\s*=\s*(\[[\s\S]*\])\s*;?\s*$/,
    );

    if (!match) {
        console.error(
            `Fehler: Keine gültige "const WORDS = [...]"-Liste in ${wordsFile} gefunden.`,
        );
        process.exit(1);
    }

    try {
        // Die Datei enthält eine reine JS-Array-Struktur.
        // JSON.parse funktioniert deshalb nicht bei einfachen JS-Arrays
        // mit trailing commas etc. -> Function ist hier bewusst lokal
        // und nur auf die eigene words.js angewendet.
        return Function(`"use strict"; return (${match[1]});`)();
    } catch (error) {
        console.error(`Fehler beim Einlesen von ${wordsFile}:`);
        console.error(error.message);
        process.exit(1);
    }
}

const WORDS = loadWords();

const problems = [];
const duplicates = new Map();
const seen = new Map();
const lengths = {};

for (const [index, entry] of WORDS.entries()) {
    const where = `words.js [${index + 1}]`;

    if (!Array.isArray(entry)) {
        problems.push(`${where} – Eintrag ist kein Array`);
        continue;
    }

    if (entry.length < 2) {
        problems.push(`${where} – Antwort oder Hinweis fehlt`);
        continue;
    }

    const [raw, ...clues] = entry;

    if (typeof raw !== "string" || !raw.trim()) {
        problems.push(`${where} – ungültige Antwort: ${String(raw)}`);
        continue;
    }

    const answer = norm(raw);

    // Antwortlänge
    if (answer.length < 2 || answer.length > 15) {
        problems.push(
            `${where}: "${raw}" – Länge ${answer.length} (erlaubt: 3–15)`,
        );
    }

    // Normalisierung darf die Antwort nicht komplett zerstören.
    if (!answer) {
        problems.push(`${where}: "${raw}" – Antwort enthält keine Buchstaben`);
        continue;
    }

    // Hinweise
    const validClues = clues.filter(
        (clue) => typeof clue === "string" && clue.trim(),
    );

    if (!validClues.length) {
        problems.push(`${where}: "${raw}" – kein Hinweis`);
    }

    for (const clue of validClues) {
        const clueWords = clue
            .split(/[^\p{L}]+/u)
            .map(norm)
            .filter(Boolean);

        if (clueWords.includes(answer)) {
            problems.push(`${where}: "${raw}" – Antwort im Hinweis: "${clue}"`);
        }
    }

    // Mehr als 3 Hinweise
    if (validClues.length > 3) {
        problems.push(
            `${where}: "${raw}" – ${validClues.length} Hinweise (maximal 3)`,
        );
    }

    // Doppelte Antworten nach Generator-Normalisierung
    if (seen.has(answer)) {
        const first = seen.get(answer);

        if (!duplicates.has(answer)) {
            duplicates.set(answer, [first]);
        }

        duplicates.get(answer).push(where);
    } else {
        seen.set(answer, where);
    }

    // Statistik nach Länge
    lengths[answer.length] = (lengths[answer.length] || 0) + 1;
}

const uniqueCount = seen.size;
const duplicateCount = WORDS.length - uniqueCount;

console.log("");
console.log("=== WORDLIST CHECK ===");
console.log("");

console.log(`Datei:              words.js`);
console.log(`Einträge gesamt:    ${WORDS.length}`);
console.log(`Eindeutige Wörter:  ${uniqueCount}`);
console.log(`Duplikate:          ${duplicateCount}`);
console.log(`Probleme:           ${problems.length}`);

console.log("");
console.log("Nach Länge:");

for (const [length, count] of Object.entries(lengths).sort(
    ([a], [b]) => Number(a) - Number(b),
)) {
    console.log(`  ${String(length).padStart(2)}: ${count}`);
}

if (duplicates.size) {
    console.log("");
    console.log("Duplikate:");

    for (const [answer, locations] of duplicates) {
        console.log(`  ${answer}`);
        for (const location of locations) {
            console.log(`    - ${location}`);
        }
    }
}

if (problems.length) {
    console.log("");
    console.log("Probleme:");

    for (const problem of problems) {
        console.log(`  - ${problem}`);
    }
}

console.log("");

if (problems.length) {
    console.log("✗ Prüfung fehlgeschlagen.");
    process.exitCode = 1;
} else {
    console.log("✓ Keine technischen Probleme gefunden.");
}
