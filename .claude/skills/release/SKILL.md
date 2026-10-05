---
name: release
description: Neue Version veröffentlichen – Version per PR auf main bumpen, danach Tag pushen, der den GitHub-Pages-Deploy auslöst. Nur auf ausdrücklichen Aufruf (/release).
argument-hint: "[prerelease|patch|minor|major|<version>]"
disable-model-invocation: true
---

# Release

`main` ist geschützt (PR Pflicht, Checks `prettier` + `knip` müssen grün sein, Branch muss aktuell sein).
GitHub Pages deployt nur bei einem Tag-Push `v*` (`.github/workflows/deploy.yml`).
Deshalb: Version per PR bumpen, Tag erst danach auf `main` setzen.

Argument: `$ARGUMENTS` – Bump-Typ für `npm version`. Leer = `prerelease`.

## Ablauf

1. **Vorbedingungen prüfen** – bei Verstoß abbrechen und dem Nutzer sagen, was fehlt:
    - `git status --porcelain` ist leer.
    - Aktueller Branch ist `main`; `git pull --ff-only` läuft durch.
    - `gh auth status` ist ok.

2. **Neue Version bestimmen**
    - `npm version <typ> --no-git-tag-version` (ändert `package.json` und `package-lock.json`).
    - Neue Version aus `package.json` lesen → `VERSION` (ohne `v`).
    - Prüfen, dass Tag `vVERSION` weder lokal noch auf `origin` existiert (`git ls-remote --tags origin vVERSION`).

3. **Release-PR**
    - Branch `release/vVERSION` anlegen, beide Dateien committen: `chore(release): vVERSION`.
    - `git push -u origin release/vVERSION`.
    - `gh pr create --base main --title "chore(release): vVERSION" --body "Version auf VERSION setzen. Nach dem Merge wird \`vVERSION\` getaggt und deployt."`
    - `gh pr checks --watch --fail-fast` – schlägt ein Check fehl: abbrechen, Link zum Lauf zeigen, nichts mergen.
    - `gh pr merge --squash --delete-branch`.

4. **Taggen und deployen**
    - `git checkout main && git pull --ff-only`.
    - Sicherstellen, dass `package.json` auf `main` jetzt `VERSION` enthält.
    - `git tag vVERSION && git push origin vVERSION` (Tags sind nicht geschützt).
    - Deploy-Lauf abwarten: `gh run list --workflow "Deploy GitHub Pages" --limit 1`, dann `gh run watch <id> --exit-status`.

5. **Abschluss melden**: Version, PR-Link, Deploy-Ergebnis, Seite `https://jgoedde.github.io/crosswords/`.

## Regeln

- Nie direkt auf `main` pushen, nie `--force`, Branch Protection nicht umgehen oder ändern.
- Schlägt ein Schritt nach dem Merge fehl (Tag, Deploy), nicht zurückrollen – Zustand melden und Nutzer fragen.
- Keine weiteren Änderungen in den Release-PR packen.
