// Prüfseite für Hinweise: zeigt zufällige Hinweise, sammelt Bewertungen in localStorage.
const RATINGS_KEY = "kreuzwort-ratings";

const $ = (id) => document.getElementById(id);
const fileSelect = $("file");
const onlyUnrated = $("only-unrated");

// Jeder Hinweis ist eine eigene Karte
const cards = [];
WORDS.forEach(([raw, ...clues], i) => {
    const src = SOURCES.find((s) => i >= s.start && i < s.end);
    const answer = normalize(raw);
    for (const clue of clues) {
        if (!clue || !clue.trim()) continue;
        cards.push({ raw, answer, clue, file: src ? src.file : "?" });
    }
});
const keyOf = (c) => `${c.answer}|${c.clue}`;

let ratings = loadRatings();
let current = null;
let previous = null;

function loadRatings() {
    try {
        return JSON.parse(localStorage.getItem(RATINGS_KEY)) || {};
    } catch {
        return {};
    }
}

function saveRatings() {
    try {
        localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
    } catch {
        /* egal */
    }
}

function pool() {
    return cards.filter(
        (c) =>
            (fileSelect.value === "" || c.file === fileSelect.value) &&
            (!onlyUnrated.checked || !ratings[keyOf(c)]),
    );
}

function next() {
    const p = pool();
    current = p.length ? p[Math.floor(Math.random() * p.length)] : null;
    $("answer").textContent = "";
    $("rate-actions").hidden = true;
    $("reveal-actions").hidden = !current;
    if (!current) {
        $("clue").textContent = "Alles bewertet. 🎉";
        $("meta").textContent = "";
    } else {
        $("clue").textContent = `${current.clue} (${current.answer.length})`;
        $("meta").textContent = current.file;
    }
    $("prev").textContent = previous
        ? `Zuletzt: ${previous.answer} – ${ratings[keyOf(previous)] || "übersprungen"}`
        : "";
    render();
}

function reveal() {
    if (!current) return;
    $("answer").textContent = current.raw;
    $("reveal-actions").hidden = true;
    $("rate-actions").hidden = false;
}

function rate(value) {
    if (!current || $("rate-actions").hidden) return;
    ratings[keyOf(current)] = value;
    saveRatings();
    previous = current;
    next();
}

function render() {
    const counts = {};
    let rated = 0;
    for (const c of cards) {
        const r = ratings[keyOf(c)];
        if (!r) continue;
        rated++;
        counts[r] = (counts[r] || 0) + 1;
    }
    $("stats").textContent =
        `${rated} von ${cards.length} Hinweisen bewertet` +
        (rated
            ? " – " +
              Object.entries(counts)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(", ")
            : "");

    const lines = cards
        .filter((c) => ratings[keyOf(c)] && ratings[keyOf(c)] !== "gut")
        .map((c) => `[${ratings[keyOf(c)]}] ${c.raw} – ${c.clue} (${c.file})`);
    $("export").value = lines.join("\n");
}

// Dateiauswahl
fileSelect.innerHTML =
    `<option value="">alle (${cards.length})</option>` +
    SOURCES.map(
        (s) =>
            `<option value="${s.file}">${s.file} (${cards.filter((c) => c.file === s.file).length})</option>`,
    ).join("");
fileSelect.onchange = next;
onlyUnrated.onchange = next;

$("btn-reveal").onclick = reveal;
$("btn-skip").onclick = () => {
    previous = current;
    next();
};
document.querySelectorAll("[data-rate]").forEach((b) => {
    b.onclick = () => rate(b.dataset.rate);
});
$("btn-copy").onclick = async () => {
    try {
        await navigator.clipboard.writeText($("export").value);
        $("btn-copy").textContent = "Kopiert!";
    } catch {
        $("export").select();
        $("btn-copy").textContent = "Markiert – Strg+C";
    }
    setTimeout(() => ($("btn-copy").textContent = "Kopieren"), 2000);
};
$("btn-reset").onclick = () => {
    const b = $("btn-reset");
    if (!b.dataset.confirm) {
        b.dataset.confirm = "1";
        b.textContent = "Wirklich alle löschen?";
        setTimeout(() => {
            delete b.dataset.confirm;
            b.textContent = "Alle Bewertungen löschen";
        }, 3000);
        return;
    }
    ratings = {};
    saveRatings();
    delete b.dataset.confirm;
    b.textContent = "Alle Bewertungen löschen";
    next();
};

document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "SELECT" || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "enter") {
        e.preventDefault();
        if (!$("reveal-actions").hidden) reveal();
    } else if (k === "s" && !$("reveal-actions").hidden) {
        previous = current;
        next();
    } else if (["1", "2", "3", "4"].includes(k)) {
        rate(["gut", "zu leicht", "unklar", "falsch"][+k - 1]);
    }
});

next();
