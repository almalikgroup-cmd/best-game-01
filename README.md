# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/almalikgroup-cmd/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/almalikgroup-cmd/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Emberfall** — an original wave-defense arcade game in vanilla JavaScript and Canvas, with no libraries and no network requests. You pilot a warden-orb over the ember-line: aim with the mouse, move with WASD or the arrow keys, and shoot the falling ember-motes — swaying drifters, snaking weavers, diving streakers and four-hit brutes — before they cross the line. Every crossing costs one of your three lives; streak kills build a combo multiplier up to ×5 as the waves escalate. It has a title screen with instructions, a score/wave/lives/combo HUD, pause, a game-over results screen with press-to-restart, and WebAudio-synthesised sound effects and ambience (no audio files). Serve the `game/` folder with any static server and open `game/index.html` in a desktop browser to play. `main.ts` (Node 22, standard library only) hands the entry in: it copies `game/` and `screenshots/` to the output directory and writes the judge's `dossier.json` with the vendored make.fun library.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=fp1aw4h5&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
