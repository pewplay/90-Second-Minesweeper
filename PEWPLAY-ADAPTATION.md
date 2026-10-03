# 90-Second Minesweeper for PewPlay

This directory contains the original static game adapted for the PewPlay game template. Open `index.html` to play.

`game.json` holds the game page text. `preview.png` and `cover.png` provide the page images. The PewPlay workflow checks pushes to `preview` and `main`. The game remains a draft until you remove `"draft": true` after reviewing it.

Game controls: Reveal safe squares and use the clues to locate the mines before the timer runs out. Flag suspected mines.

## Update (October 2026)
- Rewrote script.js/style.css/index.html: responsive layout that fills the screen (side panel in landscape, stacked in portrait), no Google Fonts CDN.
- Touch: Pointer Events, long-press to flag, Flag mode toggle button, no context menu; keyboard support (arrows, Space, F, M, N).
- Fixed neighbour-counting edge bugs, the timer starting on any click and a mine being possible on the first square; added chording, countdown with time bar, win by revealing all safe squares, in-page result dialog, best time (`90-Second-Minesweeper:best`), timer pause while the page is hidden.
- New cover and screenshots.
