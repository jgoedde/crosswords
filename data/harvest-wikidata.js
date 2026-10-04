// Holt Kandidaten aus Wikidata pro Klasse, schreibt candidates.tsv
const fs = require("fs");
const OUT = process.argv[2];
// [Klasse, min. Sitelinks, Bezeichnung, P279* ja/nein]
const CLASSES = [
    ["Q7397", 25, "Software"],
    ["Q40056", 25, "Computerprogramm"],
    ["Q620615", 15, "App"],
    ["Q35127", 20, "Website"],
    ["Q19967801", 15, "Onlinedienst"],
    ["Q59152282", 8, "Videostreaming"],
    ["Q15590336", 8, "Musikstreaming"],
    ["Q3220391", 10, "Soziales Netzwerk"],
    ["Q2462003", 10, "Messenger"],
    ["Q559856", 10, "Videoportal"],
    ["Q9143", 30, "Programmiersprache", true],
    ["Q235557", 20, "Dateiformat", true],
    ["Q5398426", 45, "Fernsehserie"],
    ["Q117467246", 30, "Animationsserie"],
    ["Q581714", 30, "Zeichentrickserie"],
    ["Q7889", 40, "Computerspiel"],
    ["Q4830453", 60, "Unternehmen"],
    ["Q6881511", 60, "Unternehmen"],
    ["Q891723", 60, "Börsenunternehmen"],
    ["Q431289", 25, "Marke"],
    ["Q786820", 25, "Autohersteller"],
    ["Q59773381", 30, "Automodell"],
    ["Q215380", 60, "Musikgruppe"],
    ["Q15632617", 40, "Fiktiver Mensch"],
    ["Q95074", 40, "Fiktive Figur"],
    ["Q15711870", 30, "Animierte Figur"],
    ["Q15773317", 40, "Fernsehfigur"],
    ["Q1114461", 40, "Comicfigur"],
    ["Q188784", 30, "Superheld"],
    ["Q202866", 60, "Animationsfilm"],
    ["Q11424", 80, "Film"],
    ["Q19861951", 25, "Gericht/Lebensmittel"],
    ["Q8195619", 30, "Lebensmittel"],
    ["Q2095", 30, "Nahrung"],
    ["Q40050", 25, "Getränk"],
    ["Q131436", 20, "Brettspiel"],
    ["Q31629", 30, "Sportart"],
    ["Q23442", 70, "Insel"],
    ["Q3624078", 0, "Staat"],
    ["Q1549591", 90, "Großstadt"],
    ["Q515", 90, "Stadt"],
    ["Q16521", 180, "Taxon"],
    ["Q13479982", 15, "Kryptowährung"],
    ["Q196600", 30, "Franchise"],
    ["Q8076", 25, "Spielkonsole"],
    ["Q15416", 40, "Fernsehsendung"],
    ["Q188451", 50, "Musikgenre"],
    ["Q39367", 40, "Hunderasse"],
    ["Q476028", 70, "Fußballverein"],
    ["Q11639", 40, "Tanz", true],
    ["Q1420", 0, "Auto"],
    ["Q22811662", 20, "Smartphone-Modell"],
    ["Q9135", 25, "Betriebssystem", true],
    ["Q12737077", 60, "Beruf"],
    ["Q28640", 60, "Beruf"],
    ["Q1047113", 40, "Fachgebiet"],
    ["Q11344", 60, "Chemisches Element"],
    ["Q634", 0, "Planet"],
    ["Q4022", 80, "Fluss"],
    ["Q8502", 80, "Berg"],
    ["Q6256", 0, "Land"],
    ["Q39614", 80, "Kap/Halbinsel"],
    ["Q34442", 0, "Straße"],
    ["Q1792379", 40, "Kunstrichtung"],
    ["Q1190554", 50, "Ereignis"],
    ["Q132241", 40, "Fest"],
    ["Q1445650", 40, "Feiertag"],
    ["Q11032", 60, "Zeitung"],
    ["Q41298", 60, "Zeitschrift"],
    ["Q1002697", 60, "Periodikum"],
    ["Q7366", 60, "Lied"],
    ["Q482994", 60, "Album"],
    ["Q2188189", 40, "Musikwerk"],
    ["Q7725634", 80, "Literarisches Werk"],
    ["Q47461344", 80, "Schriftwerk"],
    ["Q571", 80, "Buch"],
    ["Q1004", 40, "Comic"],
    ["Q21198342", 40, "Manga"],
    ["Q63952888", 40, "Anime-Serie"],
    ["Q1667921", 40, "Romanreihe"],
    ["Q24856", 40, "Filmreihe"],
    ["Q7058673", 40, "Spielreihe"],
    ["Q41710", 80, "Ethnie"],
    ["Q34770", 100, "Sprache"],
    ["Q1288568", 100, "Sprache"],
    ["Q2424752", 40, "Produkt"],
    ["Q15401930", 40, "Produkt"],
    ["Q1183543", 40, "Gerät"],
    ["Q39546", 40, "Werkzeug", true],
    ["Q11019", 50, "Maschine"],
    ["Q3966", 50, "Hardware", true],
    ["Q28803", 40, "Möbel", true],
    ["Q11460", 40, "Kleidung", true],
    ["Q34379", 40, "Musikinstrument", true],
    ["Q1310239", 50, "Spielzeug", true],
    ["Q11410", 50, "Spiel", true],
    ["Q1371849", 30, "Instant Messaging"],
    ["Q1153191", 20, "Online-Enzyklopädie"],
    ["Q4182287", 30, "Suchmaschine", true],
    ["Q6576792", 15, "Online-Community"],
    ["Q118140435", 0, "Große Plattform"],
    ["Q3918", 80, "Universität"],
    ["Q4671277", 50, "Akademische Institution"],
    ["Q7278", 60, "Partei"],
    ["Q43229", 120, "Organisation"],
    ["Q484652", 60, "Internationale Organisation"],
    ["Q18127", 40, "Plattenlabel"],
    ["Q1137809", 40, "Kurier/Logistik"],
    ["Q507619", 40, "Einzelhandelskette"],
    ["Q18043413", 30, "Supermarktkette"],
    ["Q1631129", 40, "Fast-Food-Kette"],
    ["Q46970", 40, "Fluggesellschaft"],
    ["Q1616075", 40, "Fernsehsender"],
    ["Q14350", 40, "Radiosender"],
    ["Q1331793", 40, "Medienunternehmen"],
    ["Q210167", 40, "Videospielentwickler"],
    ["Q1137109", 40, "Spieleentwickler"],
    ["Q12136", 80, "Krankheit"],
    ["Q929833", 80, "Seltene Krankheit"],
    ["Q169872", 60, "Symptom"],
    ["Q12140", 60, "Medikament"],
    ["Q11173", 120, "Chemische Verbindung"],
    ["Q7187", 300, "Gen"],
    ["Q4936952", 60, "Anatomische Struktur"],
    ["Q712378", 60, "Organ"],
    ["Q2221906", 0, "Ort"],
    ["Q2385804", 60, "Bildungseinrichtung"],
    ["Q1248784", 60, "Flughafen"],
    ["Q570116", 80, "Sehenswürdigkeit"],
    ["Q839954", 80, "Ausgrabungsstätte"],
    ["Q9259", 80, "Welterbe"],
    ["Q33506", 80, "Museum"],
    ["Q483110", 80, "Stadion"],
    ["Q1440300", 80, "Turm"],
    ["Q12280", 80, "Brücke"],
    ["Q23413", 80, "Burg"],
    ["Q16970", 80, "Kirche"],
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function run(q) {
    for (let t = 0; t < 3; t++) {
        const r = await fetch(
            "https://query.wikidata.org/sparql?format=json&query=" +
                encodeURIComponent(q),
            {
                headers: {
                    "User-Agent": "crossword-wordlist-builder/0.1",
                    Accept: "application/sparql-results+json",
                },
            },
        );
        if (r.ok) return (await r.json()).results.bindings;
        console.error("  HTTP", r.status);
        await sleep(5000);
    }
    return [];
}
(async () => {
    const rows = new Map();
    for (const [cls, min, name, sub] of CLASSES) {
        const path = sub ? "wdt:P31/wdt:P279*" : "wdt:P31";
        const q = `SELECT ?item ?lde ?lmul ?title ?desc ?sl WHERE {
      ?item ${path} wd:${cls}; wikibase:sitelinks ?sl. FILTER(?sl >= ${min})
      ?a schema:about ?item; schema:isPartOf <https://de.wikipedia.org/>; schema:name ?title.
      OPTIONAL { ?item rdfs:label ?lde FILTER(lang(?lde)="de") }
      OPTIONAL { ?item rdfs:label ?lmul FILTER(lang(?lmul)="mul") }
      OPTIONAL { ?item schema:description ?desc FILTER(lang(?desc)="de") }
    } LIMIT 5000`;
        const res = await run(q);
        let n = 0;
        for (const b of res) {
            const id = b.item.value.split("/").pop();
            const label = (b.lde || b.lmul || b.title).value;
            const prev = rows.get(id);
            if (prev) {
                if (!prev.cls.includes(name)) prev.cls.push(name);
                continue;
            }
            rows.set(id, {
                id,
                label,
                title: b.title.value,
                desc: b.desc?.value || "",
                sl: +b.sl.value,
                cls: [name],
            });
            n++;
        }
        console.error(
            `${name.padEnd(28)} ${String(res.length).padStart(5)} neu ${n}`,
        );
        await sleep(800);
    }
    const lines = [...rows.values()]
        .sort((a, b) => b.sl - a.sl)
        .map((r) =>
            [
                r.id,
                r.label,
                r.title,
                r.sl,
                r.cls.join("|"),
                r.desc.replace(/\t/g, " "),
            ].join("\t"),
        );
    fs.writeFileSync(OUT, lines.join("\n") + "\n");
    console.error("gesamt", rows.size);
})();
