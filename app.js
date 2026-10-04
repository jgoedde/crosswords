const STORAGE_KEY = "kreuzwort-state";

const boardEl = document.getElementById("board");
const kbd = document.getElementById("kbd");
const clueBar = document.getElementById("current-clue");
const listAcross = document.getElementById("clues-across");
const listDown = document.getElementById("clues-down");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");
const autoCheck = document.getElementById("chk-auto");

let puzzle, entries, marks, cellEls, wordAt, sel, seconds, solved, timerId;

// ---------- Setup ----------

function start(seed, saved) {
  puzzle = generatePuzzle(seed);
  location.hash = String(seed);
  entries = saved?.entries ?? emptyGrid("");
  marks = saved?.marks ?? emptyGrid("");
  seconds = saved?.seconds ?? 0;
  solved = saved?.solved ?? false;

  // Für jede Zelle: welches Wort waagerecht/senkrecht
  wordAt = emptyGrid(null).map(row => row.map(() => ({})));
  for (const w of puzzle.words) for (const [r, c] of w.cells) wordAt[r][c][w.dir] = w;

  renderBoard();
  renderClues();
  const first = puzzle.words.find(w => w.dir === "across") || puzzle.words[0];
  sel = { r: first.row, c: first.col, dir: first.dir };
  messageEl.hidden = !solved;
  if (solved) messageEl.textContent = `Gelöst in ${fmtTime(seconds)}.`;
  updateAll();
  startTimer();
}

function emptyGrid(v) {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(v));
}

function renderBoard() {
  boardEl.innerHTML = "";
  cellEls = emptyGrid(null);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const el = document.createElement("div");
      el.className = "cell";
      if (!puzzle.grid[r][c]) {
        el.classList.add("block");
      } else {
        const num = puzzle.numbers.get(r * SIZE + c);
        if (num) el.innerHTML = `<span class="num">${num}</span>`;
        const letter = document.createElement("span");
        letter.className = "letter";
        el.appendChild(letter);
        el.addEventListener("mousedown", e => { e.preventDefault(); onCellClick(r, c); });
      }
      boardEl.appendChild(el);
      cellEls[r][c] = el;
    }
  }
}

function renderClues() {
  listAcross.innerHTML = "";
  listDown.innerHTML = "";
  for (const w of puzzle.words) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="n">${w.number}</span><span>${escapeHtml(w.clue)} (${w.answer.length})</span>`;
    li.addEventListener("mousedown", e => {
      e.preventDefault();
      const idx = w.cells.findIndex(([r, c]) => !entries[r][c]);
      const [r, c] = w.cells[idx >= 0 ? idx : 0];
      sel = { r, c, dir: w.dir };
      updateAll();
      focusInput();
    });
    w.li = li;
    (w.dir === "across" ? listAcross : listDown).appendChild(li);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}

// ---------- Anzeige ----------

function currentWord() {
  const at = wordAt[sel.r][sel.c];
  return at[sel.dir] || at.across || at.down;
}

function updateAll() {
  const at = wordAt[sel.r][sel.c];
  if (!at[sel.dir]) sel.dir = at.across ? "across" : "down";
  const word = currentWord();
  const inWord = new Set(word.cells.map(([r, c]) => r * SIZE + c));

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!puzzle.grid[r][c]) continue;
      const el = cellEls[r][c];
      el.querySelector(".letter").textContent = entries[r][c];
      el.classList.toggle("active", r === sel.r && c === sel.c);
      el.classList.toggle("in-word", inWord.has(r * SIZE + c));
      let mark = marks[r][c];
      if (autoCheck.checked && entries[r][c] && mark !== "revealed") {
        mark = entries[r][c] === puzzle.grid[r][c] ? "" : "wrong";
      }
      el.classList.toggle("wrong", mark === "wrong" && !!entries[r][c]);
      el.classList.toggle("revealed", mark === "revealed");
      el.classList.toggle("correct", mark === "correct");
    }
  }

  const cross = wordAt[sel.r][sel.c][sel.dir === "across" ? "down" : "across"];
  for (const w of puzzle.words) {
    w.li.classList.toggle("active", w === word);
    w.li.classList.toggle("cross", w === cross);
    w.li.classList.toggle("done", w.cells.every(([r, c]) => entries[r][c]));
  }
  scrollIntoViewIfNeeded(word.li);
  if (cross) scrollIntoViewIfNeeded(cross.li);

  clueBar.textContent = `${word.number} ${word.dir === "across" ? "waagerecht" : "senkrecht"}: ${word.clue} (${word.answer.length})`;
  save();
}

function scrollIntoViewIfNeeded(el) {
  const parent = el.closest(".clues > div");
  const pr = parent.getBoundingClientRect(), er = el.getBoundingClientRect();
  if (er.top < pr.top + 40 || er.bottom > pr.bottom) {
    parent.scrollTop += er.top - pr.top - pr.height / 3;
  }
}

// ---------- Eingabe ----------

function focusInput() {
  kbd.focus({ preventScroll: true });
}

function onCellClick(r, c) {
  if (sel.r === r && sel.c === c) {
    toggleDir();
  } else {
    sel.r = r; sel.c = c;
    updateAll();
  }
  focusInput();
}

function toggleDir() {
  const other = sel.dir === "across" ? "down" : "across";
  if (wordAt[sel.r][sel.c][other]) sel.dir = other;
  updateAll();
}

function isLetterCell(r, c) {
  return r >= 0 && c >= 0 && r < SIZE && c < SIZE && !!puzzle.grid[r][c];
}

function typeLetter(ch) {
  if (solved) return;
  const word = currentWord();
  sel.dir = word.dir;
  if (marks[sel.r][sel.c] !== "revealed") {
    entries[sel.r][sel.c] = ch;
    marks[sel.r][sel.c] = "";
  }
  const idx = word.cells.findIndex(([r, c]) => r === sel.r && c === sel.c);
  if (idx < word.cells.length - 1) {
    [sel.r, sel.c] = word.cells[idx + 1];
  } else {
    // Wort fertig: zum nächsten Wort mit Lücken
    jumpWord(1, true);
    checkSolved();
    return;
  }
  updateAll();
  checkSolved();
}

function backspace() {
  if (solved) return;
  const word = currentWord();
  sel.dir = word.dir;
  if (entries[sel.r][sel.c] && marks[sel.r][sel.c] !== "revealed") {
    entries[sel.r][sel.c] = "";
    marks[sel.r][sel.c] = "";
  } else {
    const idx = word.cells.findIndex(([r, c]) => r === sel.r && c === sel.c);
    if (idx > 0) {
      [sel.r, sel.c] = word.cells[idx - 1];
      if (marks[sel.r][sel.c] !== "revealed") {
        entries[sel.r][sel.c] = "";
        marks[sel.r][sel.c] = "";
      }
    }
  }
  updateAll();
}

function move(dr, dc) {
  const dir = dr ? "down" : "across";
  if (sel.dir !== dir && wordAt[sel.r][sel.c][dir]) {
    sel.dir = dir;
    updateAll();
    return;
  }
  let r = sel.r + dr, c = sel.c + dc;
  while (r >= 0 && c >= 0 && r < SIZE && c < SIZE) {
    if (isLetterCell(r, c)) {
      sel.r = r; sel.c = c;
      if (wordAt[r][c][dir]) sel.dir = dir;
      break;
    }
    r += dr; c += dc;
  }
  updateAll();
}

function jumpWord(step, preferEmpty = false) {
  const list = [
    ...puzzle.words.filter(w => w.dir === "across"),
    ...puzzle.words.filter(w => w.dir === "down"),
  ];
  let i = list.indexOf(currentWord());
  for (let n = 0; n < list.length; n++) {
    i = (i + step + list.length) % list.length;
    const w = list[i];
    const empty = w.cells.find(([r, c]) => !entries[r][c]);
    if (!preferEmpty || empty || n === list.length - 1) {
      [sel.r, sel.c] = empty || w.cells[0];
      sel.dir = w.dir;
      break;
    }
  }
  updateAll();
}

const UMLAUTS = { "Ä": "AE", "Ö": "OE", "Ü": "UE", "ß": "SS", "ẞ": "SS" };

function handleText(text) {
  for (const raw of text) {
    const up = raw.toUpperCase();
    const seq = UMLAUTS[raw] || UMLAUTS[up] || (/^[A-Z]$/.test(up) ? up : "");
    for (const ch of seq) typeLetter(ch);
  }
}

kbd.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  let handled = true;
  if (k === "ArrowLeft") move(0, -1);
  else if (k === "ArrowRight") move(0, 1);
  else if (k === "ArrowUp") move(-1, 0);
  else if (k === "ArrowDown") move(1, 0);
  else if (k === "Backspace") backspace();
  else if (k === "Delete") {
    if (marks[sel.r][sel.c] !== "revealed") entries[sel.r][sel.c] = "";
    updateAll();
  }
  else if (k === "Tab") jumpWord(e.shiftKey ? -1 : 1);
  else if (k === " " || k === "Enter") toggleDir();
  else if (k.length === 1) handleText(k);
  else handled = false;
  if (handled) e.preventDefault();
});

// Fallback für Mobilgeräte (dort liefert keydown oft keinen Buchstaben)
kbd.addEventListener("beforeinput", e => {
  if (e.inputType === "deleteContentBackward") {
    e.preventDefault();
    backspace();
  }
});
kbd.addEventListener("input", () => {
  handleText(kbd.value);
  kbd.value = "";
});

// ---------- Prüfen & Aufdecken ----------

function checkCells(cells) {
  for (const [r, c] of cells) {
    if (!entries[r][c] || marks[r][c] === "revealed") continue;
    marks[r][c] = entries[r][c] === puzzle.grid[r][c] ? "correct" : "wrong";
  }
  updateAll();
}

function revealCells(cells) {
  for (const [r, c] of cells) {
    if (entries[r][c] !== puzzle.grid[r][c]) {
      entries[r][c] = puzzle.grid[r][c];
      marks[r][c] = "revealed";
    }
  }
  updateAll();
  checkSolved();
}

function allCells() {
  const out = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (puzzle.grid[r][c]) out.push([r, c]);
  return out;
}

function checkSolved() {
  if (solved) return;
  const done = allCells().every(([r, c]) => entries[r][c] === puzzle.grid[r][c]);
  if (!done) return;
  solved = true;
  stopTimer();
  const helped = allCells().some(([r, c]) => marks[r][c] === "revealed");
  messageEl.textContent = helped
    ? `Fertig – mit etwas Hilfe – in ${fmtTime(seconds)}.`
    : `Geschafft! Gelöst in ${fmtTime(seconds)}.`;
  messageEl.hidden = false;
  save();
}

document.getElementById("btn-check-word").onclick = () => { checkCells(currentWord().cells); focusInput(); };
document.getElementById("btn-check-all").onclick = () => { checkCells(allCells()); focusInput(); };
document.getElementById("btn-reveal-letter").onclick = () => { revealCells([[sel.r, sel.c]]); focusInput(); };
document.getElementById("btn-reveal-word").onclick = () => { revealCells(currentWord().cells); focusInput(); };
document.getElementById("btn-reveal-all").onclick = () => {
  const btn = document.getElementById("btn-reveal-all");
  if (btn.dataset.confirm) {
    delete btn.dataset.confirm;
    btn.textContent = "Lösung";
    revealCells(allCells());
  } else {
    btn.dataset.confirm = "1";
    btn.textContent = "Wirklich?";
    setTimeout(() => { delete btn.dataset.confirm; btn.textContent = "Lösung"; }, 3000);
  }
};
document.getElementById("btn-new").onclick = () => start(randomSeed());
autoCheck.onchange = () => { updateAll(); focusInput(); };

// ---------- Timer & Speichern ----------

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function startTimer() {
  stopTimer();
  timerEl.textContent = fmtTime(seconds);
  if (solved) return;
  timerId = setInterval(() => {
    if (document.hidden) return;
    seconds++;
    timerEl.textContent = fmtTime(seconds);
    if (seconds % 5 === 0) save();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      seed: puzzle.seed, entries, marks, seconds, solved, auto: autoCheck.checked,
    }));
  } catch { /* Speichern nicht möglich – egal */ }
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

function randomSeed() {
  return Math.floor(Math.random() * 1e9);
}

// ---------- Start ----------

const saved = load();
if (saved) autoCheck.checked = !!saved.auto;
const hashSeed = parseInt(location.hash.slice(1), 10);
if (Number.isFinite(hashSeed) && hashSeed !== saved?.seed) start(hashSeed);
else if (saved) start(saved.seed, saved);
else start(randomSeed());

window.addEventListener("hashchange", () => {
  const s = parseInt(location.hash.slice(1), 10);
  if (Number.isFinite(s) && s !== puzzle.seed) start(s);
});
focusInput();
