// Filtert data/wikidata-raw.tsv auf rätseltaugliche Begriffe -> data/wikidata-kandidaten.tsv
const fs = require("fs");
const path = require("path");
const dir = __dirname;

const norm = (w) =>
    w
        .toUpperCase()
        .replace(/Ä/g, "AE")
        .replace(/Ö/g, "OE")
        .replace(/Ü/g, "UE")
        .replace(/ß/g, "SS")
        .replace(/[ÉÈÊ]/g, "E")
        .replace(/[ÁÀÂ]/g, "A")
        .replace(/[^A-Z]/g, "");

const rows = fs
    .readFileSync(path.join(dir, "wikidata-raw.tsv"), "utf8")
    .trim()
    .split("\n")
    .map((l) => l.split("\t"));
const out = [];
const seen = new Set();
const byCls = {};
for (const [, label, , sl, cls, desc] of rows) {
    if (/\d/.test(label)) continue;
    if (!/^[\p{L} \-’'&.]+$/u.test(label)) continue;
    if (label.split(/[ \-]/).length > 2) continue;
    const a = norm(label);
    if (a.length < 3 || a.length > 15 || seen.has(a)) continue;
    seen.add(a);
    out.push([a, label, sl, cls, desc].join("\t"));
    const c = cls.split("|")[0];
    byCls[c] = (byCls[c] || 0) + 1;
}
fs.writeFileSync(
    path.join(dir, "wikidata-kandidaten.tsv"),
    "ANTWORT\tLABEL\tSITELINKS\tKLASSE\tBESCHREIBUNG\n" + out.join("\n") + "\n",
);
console.log("Kandidaten:", out.length);
console.log(
    Object.entries(byCls)
        .sort((a, b) => b[1] - a[1])
        .map((x) => x.join(":"))
        .join("  "),
);
