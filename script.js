// 90-Second Minesweeper
// Originally based on Ania Kubow's Minesweeper tutorial (c) 2020; reworked for PewPlay:
// responsive layout, touch controls (long-press + flag mode), safe first click, chording, best time.
(function () {
  'use strict';

  var SIZE = 10;
  var MINES = 20;
  var LIMIT = 90; // seconds
  var LONG_PRESS = 380; // ms
  var KEY_BEST = '90-Second-Minesweeper:best';

  var app = document.getElementById('app');
  var board = document.getElementById('board');
  var wrap = document.getElementById('wrap');
  var flagsEl = document.getElementById('flags');
  var timerEl = document.getElementById('timer');
  var timebar = document.getElementById('timebar');
  var timebarFill = timebar.firstElementChild;
  var face = document.getElementById('face');
  var modeBtn = document.getElementById('mode');
  var modeLabel = document.getElementById('modeLabel');
  var statusEl = document.getElementById('status');
  var dialog = document.getElementById('dialog');
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  var cells = [];
  var mine, open, flag, adj;
  var placed, over, flags, opened, flagMode = false;
  var started = false, elapsed = 0, lastTick = 0, raf = 0;
  var cursor = -1;

  // ---------- storage ----------
  function loadBest() {
    try { var v = parseFloat(localStorage.getItem(KEY_BEST)); return isFinite(v) && v > 0 ? v : 0; } catch (e) { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(KEY_BEST, String(v)); } catch (e) { /* storage unavailable */ }
  }

  // ---------- board ----------
  for (var i = 0; i < SIZE * SIZE; i++) {
    var d = document.createElement('div');
    d.className = 'c';
    d.setAttribute('role', 'gridcell');
    d.dataset.i = i;
    board.appendChild(d);
    cells.push(d);
  }

  function neighbors(i) {
    var r = Math.floor(i / SIZE), c = i % SIZE, out = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) out.push(rr * SIZE + cc);
      }
    }
    return out;
  }

  function newGame() {
    var n = SIZE * SIZE;
    mine = new Array(n).fill(false);
    open = new Array(n).fill(false);
    flag = new Array(n).fill(false);
    adj = new Array(n).fill(0);
    placed = false; over = false; flags = 0; opened = 0;
    started = false; elapsed = 0;
    cancelAnimationFrame(raf);
    cells.forEach(function (el) { el.className = 'c'; el.textContent = ''; el.style.animationDelay = ''; el.removeAttribute('aria-label'); });
    if (cursor >= 0) cells[cursor].classList.add('cursor');
    board.classList.remove('over');
    hideDialog();
    face.textContent = '🙂';
    face.classList.remove('attn');
    setStatus(coarse ? 'Tap any square to start the clock' : 'Click any square to start the clock');
    updateFlags();
    updateTimer();
  }

  // Mines are placed on the first reveal, never on or around the first square.
  function placeMines(safe) {
    var banned = {};
    banned[safe] = true;
    neighbors(safe).forEach(function (k) { banned[k] = true; });
    var pool = [];
    for (var i = 0; i < SIZE * SIZE; i++) if (!banned[i]) pool.push(i);
    for (var m = 0; m < MINES; m++) {
      var j = m + Math.floor(Math.random() * (pool.length - m));
      var t = pool[m]; pool[m] = pool[j]; pool[j] = t;
      mine[pool[m]] = true;
    }
    for (var k = 0; k < SIZE * SIZE; k++) {
      adj[k] = neighbors(k).reduce(function (s, q) { return s + (mine[q] ? 1 : 0); }, 0);
    }
    placed = true;
  }

  function startClock() {
    if (started) return;
    started = true;
    lastTick = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (over || !started) return;
    if (!document.hidden) {
      elapsed += Math.min(0.25, (now - lastTick) / 1000);
    }
    lastTick = now;
    if (elapsed >= LIMIT) { elapsed = LIMIT; updateTimer(); timeUp(); return; }
    updateTimer();
    raf = requestAnimationFrame(tick);
  }

  function updateTimer() {
    var left = Math.max(0, LIMIT - elapsed);
    timerEl.textContent = String(Math.ceil(left - 1e-9)).padStart(2, '0');
    timebarFill.style.transform = 'scaleX(' + (left / LIMIT).toFixed(4) + ')';
    var warn = started && !over && left <= 15;
    timerEl.classList.toggle('warn', warn);
    timebar.classList.toggle('warn', warn);
  }

  function updateFlags() {
    flagsEl.textContent = String(MINES - flags).padStart(2, '0');
  }

  function setStatus(t) { statusEl.textContent = t; }

  // ---------- actions ----------
  function reveal(i) {
    if (over || open[i] || flag[i]) return;
    if (!placed) placeMines(i);
    startClock();
    if (mine[i]) { lose(i); return; }
    // flood fill (breadth first, so the opening ripples outwards)
    var queue = [i], dist = {};
    dist[i] = 0;
    open[i] = true;
    while (queue.length) {
      var k = queue.shift();
      paintOpen(k, dist[k]);
      if (adj[k] === 0) {
        neighbors(k).forEach(function (q) {
          if (!open[q] && !flag[q] && !mine[q]) { open[q] = true; dist[q] = dist[k] + 1; queue.push(q); }
        });
      }
    }
    if (opened === SIZE * SIZE - MINES) win();
    else setStatus(hint());
  }

  function paintOpen(k, delay) {
    var el = cells[k];
    opened++;
    el.classList.add('open');
    el.style.animationDelay = Math.min(delay * 22, 300) + 'ms';
    if (adj[k]) { el.textContent = adj[k]; el.classList.add('n', 'n' + adj[k]); }
  }

  // Click a revealed number whose flags are all placed to open the rest of its neighbours.
  function chord(i) {
    if (over || !open[i] || !adj[i]) return;
    var nb = neighbors(i);
    var f = nb.filter(function (q) { return flag[q]; }).length;
    if (f !== adj[i]) { flashCells(nb.filter(function (q) { return !open[q] && !flag[q]; })); return; }
    for (var n = 0; n < nb.length; n++) {
      var q = nb[n];
      if (!open[q] && !flag[q]) {
        if (mine[q]) { lose(q); return; }
        reveal(q);
        if (over) return;
      }
    }
  }

  function flashCells(list) {
    list.forEach(function (q) { cells[q].classList.add('press'); });
    setTimeout(function () { list.forEach(function (q) { cells[q].classList.remove('press'); }); }, 160);
  }

  function toggleFlag(i) {
    if (over || open[i]) return;
    if (!flag[i] && flags >= MINES) {
      flagsEl.classList.remove('bump'); void flagsEl.offsetWidth; flagsEl.classList.add('bump');
      setStatus('No flags left: remove a wrong one first');
      return;
    }
    flag[i] = !flag[i];
    flags += flag[i] ? 1 : -1;
    cells[i].classList.toggle('flag', flag[i]);
    updateFlags();
    if (placed) startClock();
    checkFlagWin();
    if (!over) setStatus(hint());
  }

  function checkFlagWin() {
    if (!placed || flags !== MINES) return;
    for (var i = 0; i < SIZE * SIZE; i++) if (flag[i] !== mine[i]) return;
    win();
  }

  function hint() {
    var left = MINES - flags;
    return left ? left + (left === 1 ? ' mine' : ' mines') + ' left to flag' : 'All flags placed: check them!';
  }

  function endGame() {
    over = true;
    cancelAnimationFrame(raf);
    board.classList.add('over');
    timerEl.classList.remove('warn');
    timebar.classList.remove('warn');
    face.classList.add('attn');
  }

  function showMines(boomAt) {
    for (var i = 0; i < SIZE * SIZE; i++) {
      var el = cells[i];
      if (mine[i] && !flag[i]) { el.classList.add('mine'); el.style.animationDelay = ''; }
      if (!mine[i] && flag[i]) el.classList.add('wrong');
    }
    if (boomAt >= 0) cells[boomAt].classList.add('boom');
  }

  function lose(i) {
    endGame();
    showMines(i);
    face.textContent = '😵';
    setStatus('BOOM! Game over');
    if (navigator.vibrate) { try { navigator.vibrate(120); } catch (e) { /* ignore */ } }
    showDialog('😵', 'BOOM! Game over', 'You uncovered a mine with ' + secondsLeft() + ' seconds left.', '');
  }

  function timeUp() {
    endGame();
    showMines(-1);
    timerEl.textContent = '00';
    face.textContent = '😞';
    setStatus('Out of time!');
    showDialog('😞', 'Out of time!', 'The 90 seconds ran out with ' + (MINES - correctFlags()) + ' mines still unflagged.', '');
  }

  function win() {
    endGame();
    for (var i = 0; i < SIZE * SIZE; i++) {
      if (mine[i] && !flag[i]) { flag[i] = true; cells[i].classList.add('flag'); }
    }
    flags = MINES;
    updateFlags();
    face.textContent = '😎';
    var t = Math.max(0.1, Math.round(elapsed * 10) / 10);
    var best = loadBest();
    var bestText;
    if (!best || t < best) { saveBest(t); bestText = best ? 'New best time! (old: ' + best.toFixed(1) + ' s)' : 'New best time!'; }
    else bestText = 'Best time: ' + best.toFixed(1) + ' s';
    setStatus('YOU WIN! ' + t.toFixed(1) + ' s');
    showDialog('😎', 'You win!', 'Minefield cleared in ' + t.toFixed(1) + ' seconds.', bestText);
  }

  function correctFlags() {
    var n = 0;
    for (var i = 0; i < SIZE * SIZE; i++) if (flag[i] && mine[i]) n++;
    return n;
  }
  function secondsLeft() { return Math.max(0, Math.ceil(LIMIT - elapsed)); }

  // ---------- dialog ----------
  var dlgTimer = 0;
  function showDialog(emoji, title, text, best) {
    document.getElementById('dlgFace').textContent = emoji;
    document.getElementById('dlgTitle').textContent = title;
    document.getElementById('dlgText').textContent = text;
    document.getElementById('dlgBest').textContent = best;
    clearTimeout(dlgTimer);
    dlgTimer = setTimeout(function () {
      dialog.classList.remove('hidden');
      document.getElementById('dlgNew').focus({ preventScroll: true });
    }, 650);
  }
  function hideDialog() { clearTimeout(dlgTimer); dialog.classList.add('hidden'); }
  document.getElementById('dlgNew').addEventListener('click', newGame);
  document.getElementById('dlgView').addEventListener('click', hideDialog);

  // ---------- flag mode ----------
  function setFlagMode(on) {
    flagMode = on;
    modeBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    modeLabel.textContent = on ? 'Flag mode: on' : 'Flag mode: off';
    board.classList.toggle('flagmode', on);
  }
  modeBtn.addEventListener('click', function () { setFlagMode(!flagMode); });
  face.addEventListener('click', newGame);

  // ---------- pointer input ----------
  var press = null; // {id, i, x, y, timer, done}

  function cellFromEvent(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !el.classList || !el.classList.contains('c')) return -1;
    return +el.dataset.i;
  }

  function primary(i) {
    if (open[i]) chord(i);
    else if (flagMode) toggleFlag(i);
    else reveal(i);
  }
  function secondary(i) {
    if (open[i]) chord(i);
    else if (flagMode) reveal(i);
    else toggleFlag(i);
  }

  function clearPress() {
    if (!press) return;
    clearTimeout(press.timer);
    if (press.i >= 0) cells[press.i].classList.remove('press');
    press = null;
    if (!over) face.textContent = '🙂';
  }

  board.addEventListener('pointerdown', function (e) {
    if (over) return;
    var i = cellFromEvent(e);
    if (i < 0) return;
    e.preventDefault();
    if (e.pointerType === 'mouse' && e.button === 2) { secondary(i); return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    clearPress();
    press = { id: e.pointerId, i: i, x: e.clientX, y: e.clientY, done: false, timer: 0 };
    cells[i].classList.add('press');
    face.textContent = '😬';
    press.timer = setTimeout(function () {
      if (!press || press.done) return;
      press.done = true;
      cells[press.i].classList.remove('press');
      if (navigator.vibrate) { try { navigator.vibrate(18); } catch (err) { /* ignore */ } }
      secondary(press.i);
    }, LONG_PRESS);
  });

  board.addEventListener('pointermove', function (e) {
    if (!press || e.pointerId !== press.id || press.done) return;
    var dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (dx * dx + dy * dy > 144) {
      // finger slid away: follow it to another cell (desktop-style), but cancel the long-press
      clearTimeout(press.timer);
      var i = cellFromEvent(e);
      if (i !== press.i) {
        cells[press.i].classList.remove('press');
        press.i = i;
        if (i >= 0) cells[i].classList.add('press');
      }
    }
  });

  window.addEventListener('pointerup', function (e) {
    if (!press || e.pointerId !== press.id) return;
    var p = press;
    clearPress();
    if (p.done || p.i < 0 || over) return;
    if (cellFromEvent(e) !== p.i) return;
    primary(p.i);
  });
  window.addEventListener('pointercancel', clearPress);
  board.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  board.addEventListener('pointerover', function (e) {
    if (over || press || e.pointerType !== 'mouse') return;
    if (e.target.classList && e.target.classList.contains('c')) face.textContent = '🤔';
  });
  board.addEventListener('pointerleave', function () { if (!over && !press) face.textContent = '🙂'; });

  // ---------- keyboard ----------
  function setCursor(i) {
    if (cursor >= 0) cells[cursor].classList.remove('cursor');
    cursor = i;
    if (cursor >= 0) cells[cursor].classList.add('cursor');
  }
  window.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'n' || k === 'N' || k === 'r' || k === 'R') { newGame(); return; }
    if (k === 'm' || k === 'M') { setFlagMode(!flagMode); return; }
    if (k === 'Escape') { hideDialog(); return; }
    var moves = { ArrowUp: -SIZE, ArrowDown: SIZE, ArrowLeft: -1, ArrowRight: 1 };
    if (k in moves) {
      e.preventDefault();
      if (cursor < 0) { setCursor(44); return; }
      var r = Math.floor(cursor / SIZE), c = cursor % SIZE;
      if (k === 'ArrowUp') r = Math.max(0, r - 1);
      if (k === 'ArrowDown') r = Math.min(SIZE - 1, r + 1);
      if (k === 'ArrowLeft') c = Math.max(0, c - 1);
      if (k === 'ArrowRight') c = Math.min(SIZE - 1, c + 1);
      setCursor(r * SIZE + c);
      return;
    }
    if (cursor < 0 || over) return;
    if (k === ' ' || k === 'Enter') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      e.preventDefault(); primary(cursor);
    } else if (k === 'f' || k === 'F') { secondary(cursor); }
  });

  // ---------- layout ----------
  function layout() {
    var W = window.innerWidth, H = window.innerHeight;
    var side = W > H * 1.2;
    app.classList.toggle('side', side);
    var label = coarse ? 'Tap' : 'Click';
    if (!started && !over) setStatus(label + ' any square to start the clock');
    // space left for the board (board = 10 cells + 0.32 cell padding + 8px borders)
    var cs = getComputedStyle(app);
    var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var availW, availH;
    if (side) {
      var sideW = Math.round(Math.min(330, Math.max(190, (W - padX) * 0.28)));
      document.documentElement.style.setProperty('--side', sideW + 'px');
      availW = W - padX - sideW - 14;
      availH = H - padY;
    } else {
      var hud = document.getElementById('hud'), tools = document.getElementById('tools');
      availW = W - padX;
      availH = H - padY - hud.offsetHeight - timebar.offsetHeight - tools.offsetHeight - 8 * 3;
    }
    var cell = Math.floor((Math.min(availW, availH) - 8) / (SIZE + 0.32));
    cell = Math.max(22, Math.min(cell, 92));
    var bw = Math.round(cell * (SIZE + 0.32) + 8);
    document.documentElement.style.setProperty('--cell', cell + 'px');
    document.documentElement.style.setProperty('--bw', bw + 'px');
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 120); });
  if (window.ResizeObserver) new ResizeObserver(layout).observe(app);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) lastTick = performance.now();
  });

  // tiny hook for automated screenshots/tests
  window.__ms = {
    state: function () { return { mine: mine.slice(), open: open.slice(), flag: flag.slice(), adj: adj.slice(), over: over, placed: placed }; },
    reveal: reveal, flag: toggleFlag, place: function (i) { if (!placed) placeMines(i); },
    setElapsed: function (s) { elapsed = s; updateTimer(); }
  };

  newGame();
  layout();
})();
