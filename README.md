# Monster Hatchery

A small monster collection game built with HTML, CSS, and vanilla JavaScript. Hatch eggs, train and evolve your discoveries, complete achievements, and fight turn-based battles. No framework, build step, account, or runtime dependency is required.

## Run locally

From the project folder, with Python installed:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000**. Stop the server with Ctrl+C. Use this same address and browser profile every time. Opening `index.html` directly may give browser-dependent storage behavior.

## How to play

- Start with 200 coins. Meadow Eggs cost 40; Moon Eggs cost 100 and have better rare-monster odds.
- Gather 25 free coins every 12 seconds. Duplicate monsters award coins.
- Browse the collection, filter by rarity, mark favorites, and open monster details.
- Feed a discovered species for 15 coins to gain 20 XP. The level cap is 10.
- Evolve monsters at levels 5 and 10. Their collection identity and training remain intact.
- Claim completed achievement rewards once each.
- Select a discovered monster in the battle arena. Attack, defend, or heal (twice per battle). Wins award 40 coins; losses have no coin penalty. Unfinished battles are temporary; wins, losses, and rewards persist.
- Reset Progress erases progression only after confirmation. Back up first.

## Saves and recovery

Progress saves automatically to LocalStorage under `monster-hatchery-save-v1`. Hatch outcomes and evolutions save before their animations. Original v1 saves remain compatible; later progression fields are optional.

Saves belong to the **browser profile and origin** (protocol, hostname, and port). `localhost`, `127.0.0.1`, different ports, a local file, and GitHub Pages can show different progress. Returning to the original browser and address may reveal the original save. Private browsing, clearing site data, and browser storage restrictions can remove or hide it. This game has no cloud backup.

If a save cannot be read or validated, play pauses with a visible warning and the stored value stays untouched. The game never replaces it with a fresh save. A tab also refuses to overwrite a save changed by another tab. If saving fails, a persistent warning explains that new progress exists only in the open tab; keep it open and fix storage permissions or free space before trying another action.

To back up a stored save, open browser Developer Tools at the **original game address**, then Application (or Storage) → Local Storage. Find `monster-hatchery-save-v1`, copy its entire value into a text file, and keep the file outside the repository. Reading and copying the value does not change it. Do not clear storage as a debugging step. Restore only a known good backup at that same key, after keeping a copy of the current value and closing other game tabs, then reload.

## Checks

With Node.js 18 or newer:

```sh
node --check script.js
node --check battle.js
node --test tests/game.test.cjs
```

Tests use Node's built-in test runner, disposable in-memory storage, and a minimal DOM substitute. They cover save compatibility, malformed saves, storage denial/failure, stale tabs, persistence across script restarts, hatching, feeding, favorites, evolution, achievements, battle rewards, and confirmed resets. They never access your browser profile.

Before release, also smoke-test in a browser using a separate test origin: hatch, favorite, feed, evolve, claim an achievement, complete a battle, refresh, then close and reopen the address. Verify the same progress returns. These automated checks do not replace browser layout and interaction testing.

## Project files

- `index.html` — game interface and accessible dialogs.
- `style.css` — responsive presentation and animations.
- `script.js` — collection, progression, and persistence.
- `battle.js` — the stable turn-based battle system.
- `tests/game.test.cjs` — dependency-free regression checks.

Feature development is complete. The final version retains the Phase 3A battle system; unfinished Phase 3B work is preserved separately on `backup/phase-3b-before-stabilization`.
