/* =========================================================
   GO BEAR! – lógica do jogo (HTML + CSS + JavaScript puro)
   ========================================================= */
(() => {
  "use strict";

  // ---------- Constantes ----------
  const TILE = 48;
  const VW = 960;
  const VH = 540;
  const GRAVITY = 2000;
  const JUMP_V = 860;
  const MAX_SPEED = 290;
  const ACCEL = 2200;
  const FRICTION = 2600;
  const MAX_FALL = 1100;
  const MAX_HEARTS = 3;
  const SAVE_KEY = "gobear-save-v1";

  // ---------- Elementos ----------
  const $ = (s) => document.querySelector(s);
  const canvas = $("#game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const screens = {
    title: $("#screen-title"),
    map: $("#screen-map"),
    game: $("#screen-game"),
  };
  const modals = {
    pause: $("#modal-pause"),
    win: $("#modal-win"),
    over: $("#modal-over"),
  };

  // ---------- Imagens ----------
  function loadImg(src) {
    const i = new Image();
    i.src = src;
    return i;
  }
  const IMG = {
    bear: loadImg("assets/bear.png"),
    bg: loadImg("assets/level-bg.jpg"),
  };

  // ---------- Save ----------
  let save = { unlocked: 1, stars: [], coins: 0 };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s) save = Object.assign(save, s);
  } catch (e) {}
  const persist = () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  };

  // ---------- Áudio (efeitos simples com WebAudio) ----------
  let actx = null;
  function sfx(type) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const presets = {
        jump:  [[420, 720], 0.12, "square", 0.06],
        coin:  [[990, 1480], 0.10, "square", 0.05],
        key:   [[660, 1320], 0.25, "triangle", 0.09],
        crown: [[520, 1560], 0.35, "triangle", 0.09],
        stomp: [[300, 90], 0.15, "square", 0.07],
        hurt:  [[260, 60], 0.35, "sawtooth", 0.07],
        win:   [[520, 1040], 0.6, "triangle", 0.1],
        flag:  [[600, 900], 0.2, "triangle", 0.07],
      };
      const [[f1, f2], dur, wave, vol] = presets[type];
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(f1, actx.currentTime);
      o.frequency.exponentialRampToValueAtTime(f2, actx.currentTime + dur);
      g.gain.setValueAtTime(vol, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      o.connect(g).connect(actx.destination);
      o.start();
      o.stop(actx.currentTime + dur);
    } catch (e) {}
  }

  // =========================================================
  //  TELAS
  // =========================================================
  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }
  function openModal(name) {
    Object.values(modals).forEach((m) => m.classList.remove("show"));
    if (name) modals[name].classList.add("show");
  }

  $("#btn-start").addEventListener("click", () => { sfx("coin"); buildMap(); show("map"); });
  $("#btn-home").addEventListener("click", () => show("title"));
  $("#btn-pause").addEventListener("click", () => pause());

  document.querySelectorAll("[data-action]").forEach((b) =>
    b.addEventListener("click", () => {
      const a = b.dataset.action;
      if (a === "resume") resume();
      if (a === "restart") startLevel(game.levelIndex);
      if (a === "exit") exitToMap();
      if (a === "next") {
        const n = game.levelIndex + 1;
        if (n < LEVELS.length) startLevel(n);
        else exitToMap();
      }
    })
  );

  // =========================================================
  //  MAPA
  // =========================================================
  const NODES = [
    { x: 13, y: 62 },
    { x: 30, y: 76 },
    { x: 46, y: 54 },
    { x: 63, y: 72 },
    { x: 86, y: 30 },
  ];
  let mapSelected = 0;

  function starsHTML(n) {
    let h = "";
    for (let i = 0; i < 3; i++) h += `<span class="star ${i < n ? "on" : ""}">★</span>`;
    return h;
  }

  function buildMap() {
    // caminho
    const svg = $("#map-path");
    let d = `M ${NODES[0].x} ${NODES[0].y}`;
    for (let i = 1; i < NODES.length; i++) {
      const a = NODES[i - 1], b = NODES[i];
      const mx = (a.x + b.x) / 2;
      d += ` C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
    }
    svg.innerHTML = `
      <path d="${d}" fill="none" stroke="#24130a" stroke-width="30" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <path d="${d}" fill="none" stroke="#d9b06a" stroke-width="22" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <path d="${d}" fill="none" stroke="#f3d79a" stroke-width="4" stroke-dasharray="10 14" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;

    // nós das fases
    const wrap = $("#map-nodes");
    wrap.innerHTML = "";
    NODES.forEach((n, i) => {
      const locked = i >= save.unlocked;
      const btn = document.createElement("button");
      btn.className = "node" + (locked ? " locked" : "");
      btn.style.left = n.x + "%";
      btn.style.top = n.y + "%";
      btn.title = LEVELS[i].name;
      const img = document.createElement("img");
      img.className = "node-img";
      img.draggable = false;
      img.alt = LEVELS[i].name;
      img.src = locked ? `assets/fase_1_${i + 1}_bloq.png` : `assets/fase_1_${i + 1}.png`;
      btn.appendChild(img);
      if (!locked) {
        btn.addEventListener("click", () => {
          if (mapSelected !== i) {
            mapSelected = i;
            placeMapBear();
            setTimeout(() => startLevel(i), 650);
          } else startLevel(i);
        });
      }
      wrap.appendChild(btn);
    });
    mapSelected = Math.min(mapSelected, save.unlocked - 1);
    if (mapSelected < 0) mapSelected = 0;
    placeMapBear();
    $("#map-coins").textContent = save.coins;
  }
  function placeMapBear() {
    const n = NODES[mapSelected];
    const b = $("#map-bear");
    b.style.left = n.x + 3.5 + "%";
    b.style.top = n.y - 4 + "%";
  }

  // =========================================================
  //  ENTRADA (teclado + toque)
  // =========================================================
  const input = { left: false, right: false, jump: false, jumpPressed: false };
  const KEYMAP = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "jump", KeyW: "jump", Space: "jump",
  };
  function setKey(k, v) {
    if (k === "jump" && v && !input.jump) input.jumpPressed = true;
    input[k] = v;
  }
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" || e.code === "KeyP") {
      if (game.state === "play") pause();
      else if (game.state === "pause") resume();
      return;
    }
    const k = KEYMAP[e.code];
    if (k) { setKey(k, true); e.preventDefault(); }
  });
  window.addEventListener("keyup", (e) => {
    const k = KEYMAP[e.code];
    if (k) setKey(k, false);
  });
  document.querySelectorAll(".tbtn").forEach((b) => {
    const k = b.dataset.key;
    const on = (e) => { e.preventDefault(); setKey(k, true); b.classList.add("pressed"); };
    const off = (e) => { e.preventDefault(); setKey(k, false); b.classList.remove("pressed"); };
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", off);
    b.addEventListener("pointerleave", off);
    b.addEventListener("pointercancel", off);
  });
  window.addEventListener("blur", () => { if (game.state === "play") pause(); });

  // =========================================================
  //  SPRITES EM PIXEL ART (desenhados uma vez em canvas)
  // =========================================================
  function makeSprite(w, h, draw, scale = 3) {
    const c = document.createElement("canvas");
    c.width = w * scale;
    c.height = h * scale;
    const g = c.getContext("2d");
    const p = (col, x, y, ww = 1, hh = 1) => { g.fillStyle = col; g.fillRect(x * scale, y * scale, ww * scale, hh * scale); };
    draw(p);
    return c;
  }
  // gerador pseudo-aleatório fixo para os detalhes
  const rnd = (s) => { const x = Math.sin(s * 999.7) * 43758.5; return x - Math.floor(x); };

  function dirt(p, seed, fromY) {
    p("#8a4f24", 0, fromY, 16, 16 - fromY);
    for (let i = 0; i < 7; i++) {
      const x = Math.floor(rnd(seed + i) * 14), y = fromY + 1 + Math.floor(rnd(seed + i * 3.1) * (14 - fromY));
      p("#6e3b18", x, y, 2, 2);
      p("#a8652f", x, y, 1, 1);
    }
  }
  const SPR = {
    grass: makeSprite(16, 16, (p) => {
      dirt(p, 1, 4);
      p("#58c13a", 0, 0, 16, 4);
      p("#8ee05a", 0, 0, 16, 1);
      [1, 4, 6, 9, 12, 14].forEach((x, i) => p("#3d9a25", x, 4, 1 + (i % 2), 1 + (i % 3 === 0 ? 1 : 0)));
      p("#2e7a1b", 0, 3, 16, 1);
      [3, 10].forEach((x) => p("#b8f07a", x, 1, 1, 1));
    }),
    dirt: makeSprite(16, 16, (p) => dirt(p, 7, 0)),
    platform: makeSprite(16, 16, (p) => {
      p("#24130a", 0, 0, 16, 13);
      p("#8a4f24", 1, 5, 14, 7);
      p("#6e3b18", 3, 8, 2, 2); p("#6e3b18", 10, 7, 2, 2); p("#a8652f", 7, 10, 2, 1);
      p("#58c13a", 0, 0, 16, 4); p("#8ee05a", 0, 0, 16, 1); p("#2e7a1b", 1, 4, 14, 1);
      p("#3d9a25", 3, 5, 1, 1); p("#3d9a25", 11, 5, 1, 1);
    }),
    crate: makeSprite(16, 16, (p) => {
      p("#24130a", 0, 0, 16, 16);
      p("#c98a3d", 1, 1, 14, 14);
      p("#9a5f22", 2, 2, 12, 12);
      p("#c98a3d", 3, 3, 10, 10);
      for (let i = 0; i < 10; i++) { p("#9a5f22", 3 + i, 3 + i, 1, 1); p("#9a5f22", 12 - i, 3 + i, 1, 1); }
      p("#e8b066", 1, 1, 14, 1);
    }),
    spikes: makeSprite(16, 16, (p) => {
      for (let s = 0; s < 3; s++) {
        const ox = 1 + s * 5;
        for (let r = 0; r < 7; r++) {
          const w = Math.max(1, Math.floor((r + 1) * 0.7));
          p("#24130a", ox + 2 - Math.floor(w / 2) - 0, 9 + r - 0, w + 1, 1);
          p(r < 2 ? "#ffffff" : "#c4c9d1", ox + 2 - Math.floor(w / 2) + (r > 1 ? 1 : 0), 9 + r, Math.max(1, w - 1), 1);
        }
      }
      p("#5a5f66", 0, 15, 16, 1);
    }),
    key: makeSprite(12, 12, (p) => {
      p("#24130a", 1, 3, 5, 6); p("#24130a", 0, 4, 7, 4);
      p("#ffcc1f", 1, 4, 5, 4); p("#ffcc1f", 2, 3.5, 3, 5);
      p("#24130a", 3, 5, 1, 2);
      p("#24130a", 6, 5, 6, 3); p("#24130a", 9, 8, 1, 2); p("#24130a", 11, 8, 1, 2);
      p("#ffcc1f", 6, 6, 5, 1); p("#fff6a0", 2, 4, 1, 1);
    }, 3),
    crown: makeSprite(12, 11, (p) => {
      p("#24130a", 0, 1, 12, 10);
      p("#ffcc1f", 1, 4, 10, 6);
      p("#ffcc1f", 1, 2, 1, 2); p("#ffcc1f", 5, 1, 2, 3); p("#ffcc1f", 10, 2, 1, 2);
      p("#24130a", 2, 1, 3, 3); p("#24130a", 7, 1, 3, 3);
      p("#24130a", 0, 0, 2, 1); p("#24130a", 10, 0, 2, 1);
      p("#ffcc1f", 2, 3, 1, 1); p("#ffcc1f", 9, 3, 1, 1);
      p("#e2402f", 5, 6, 2, 2); p("#4aa3ff", 2, 7, 1, 1); p("#4aa3ff", 9, 7, 1, 1);
      p("#fff6a0", 1, 4, 10, 1); p("#d98b00", 1, 9, 10, 1);
    }, 3),
    enemy: [0, 1].map((f) => makeSprite(16, 14, (p) => {
      // cogumelo bravo
      p("#24130a", 2, 0, 12, 1); p("#24130a", 1, 1, 14, 1); p("#24130a", 0, 2, 16, 6);
      p("#e2402f", 2, 1, 12, 1); p("#e2402f", 1, 2, 14, 5);
      p("#ffffff", 3, 2, 2, 2); p("#ffffff", 10, 2, 3, 2); p("#ffffff", 7, 4, 2, 2);
      p("#ff8a7a", 3, 1, 4, 1);
      p("#24130a", 3, 7, 10, 5); p("#f6e3b4", 4, 7, 8, 4);
      p("#24130a", 5, 8, 2, 2); p("#24130a", 9, 8, 2, 2); // olhos
      p("#24130a", 4, 7, 3, 1); p("#24130a", 9, 7, 3, 1); // sobrancelhas
      if (f === 0) { p("#24130a", 3, 12, 4, 2); p("#24130a", 9, 12, 4, 2); }
      else { p("#24130a", 2, 12, 4, 2); p("#24130a", 10, 12, 4, 2); }
    })),
    flag: [false, true].map((on) => makeSprite(12, 32, (p) => {
      p("#24130a", 1, 0, 3, 32); p("#d9d9d9", 2, 1, 1, 31);
      p("#24130a", 3, 2, 9, 8);
      p(on ? "#4fb52b" : "#e2402f", 3, 3, 8, 6);
      p(on ? "#8ee05a" : "#ff8a7a", 3, 3, 8, 1);
      p("#24130a", 0, 29, 5, 3);
    }, 3)),
  };

  // =========================================================
  //  ESTADO DO JOGO
  // =========================================================
  const game = {
    state: "idle",
    levelIndex: 0,
    grid: [],
    cols: 0,
    rows: 0,
    items: [],
    enemies: [],
    particles: [],
    checkpoints: [],
    door: null,
    player: null,
    spawn: { x: 0, y: 0 },
    camX: 0,
    camY: 0,
    hearts: MAX_HEARTS,
    coins: 0,
    keys: 0,
    keysTotal: 0,
    crowns: 0,
    crownsTotal: 0,
    time: 0,
    doorMsgCooldown: 0,
    theme: "day",
  };

  function startLevel(i) {
    const L = LEVELS[i];
    game.levelIndex = i;
    game.theme = L.theme;
    game.rows = L.map.length;
    game.cols = Math.max(...L.map.map((r) => r.length));
    game.grid = [];
    game.items = [];
    game.enemies = [];
    game.particles = [];
    game.checkpoints = [];
    game.door = null;
    game.hearts = MAX_HEARTS;
    game.coins = 0;
    game.keys = game.keysTotal = 0;
    game.crowns = game.crownsTotal = 0;
    game.time = 0;

    for (let y = 0; y < game.rows; y++) {
      const row = [];
      const line = L.map[y].padEnd(game.cols, ".");
      for (let x = 0; x < game.cols; x++) {
        const ch = line[x];
        const px = x * TILE, py = y * TILE;
        let tile = ".";
        switch (ch) {
          case "#": case "=": case "B": case "^": case "~": tile = ch; break;
          case "o": game.items.push({ type: "coin", x: px + 12, y: py + 10, w: 24, h: 28 }); break;
          case "k": game.items.push({ type: "key", x: px + 6, y: py + 8, w: 36, h: 36 }); game.keysTotal++; break;
          case "c": game.items.push({ type: "crown", x: px + 6, y: py + 6, w: 36, h: 33 }); game.crownsTotal++; break;
          case "E": game.enemies.push({ x: px + 4, y: py + TILE - 42, w: 40, h: 42, vx: -70, vy: 0, alive: true, dead: 0 }); break;
          case "C": game.checkpoints.push({ x: px + 12, y: py - TILE, w: 36, h: TILE * 2, on: false }); break;
          case "D": game.door = { x: px, y: py - TILE, w: TILE, h: TILE * 2 }; break;
          case "P": game.spawn = { x: px + 9, y: py - 20 }; break;
        }
        row.push(tile);
      }
      game.grid.push(row);
    }
    spawnPlayer();
    game.camX = clamp(game.player.x - VW * 0.4, 0, game.cols * TILE - VW);
    updateHUD();
    openModal(null);
    show("game");
    game.state = "play";
    toast(L.name);
  }

  function spawnPlayer() {
    game.player = {
      x: game.spawn.x, y: game.spawn.y, w: 30, h: 60,
      vx: 0, vy: 0, onGround: false, facing: 1,
      coyote: 0, jumpBuffer: 0, invuln: 1.2, anim: 0, squash: 0,
    };
  }

  function pause() {
    if (game.state !== "play") return;
    game.state = "pause";
    openModal("pause");
  }
  function resume() {
    game.state = "play";
    openModal(null);
    last = performance.now();
  }
  function exitToMap() {
    game.state = "idle";
    openModal(null);
    buildMap();
    show("map");
  }

  // ---------- HUD ----------
  function updateHUD() {
    let h = "";
    for (let i = 0; i < MAX_HEARTS; i++) h += `<span class="heart ${i < game.hearts ? "" : "empty"}"></span>`;
    $("#hud-hearts").innerHTML = h;
    $("#hud-coins").textContent = game.coins;
    $("#hud-keys").textContent = `${game.keys}/${game.keysTotal}`;
    $("#hud-crowns").textContent = `${game.crowns}/${game.crownsTotal}`;
  }
  let toastTimer = 0;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2000);
  }

  // =========================================================
  //  FÍSICA / COLISÃO
  // =========================================================
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function tileAt(tx, ty) {
    if (tx < 0 || tx >= game.cols) return "#"; // paredes invisíveis nas laterais
    if (ty < 0 || ty >= game.rows) return ".";
    return game.grid[ty][tx];
  }
  const isSolid = (t) => t === "#" || t === "B";
  const isOneWay = (t) => t === "=";

  function moveBody(b, dt) {
    // eixo X
    b.x += b.vx * dt;
    let hitWall = false;
    const top = Math.floor(b.y / TILE), bottom = Math.floor((b.y + b.h - 1) / TILE);
    if (b.vx > 0) {
      const tx = Math.floor((b.x + b.w) / TILE);
      for (let ty = top; ty <= bottom; ty++) if (isSolid(tileAt(tx, ty))) { b.x = tx * TILE - b.w; b.vx = 0; hitWall = true; break; }
    } else if (b.vx < 0) {
      const tx = Math.floor(b.x / TILE);
      for (let ty = top; ty <= bottom; ty++) if (isSolid(tileAt(tx, ty))) { b.x = (tx + 1) * TILE; b.vx = 0; hitWall = true; break; }
    }
    // eixo Y
    const prevBottom = b.y + b.h;
    b.y += b.vy * dt;
    b.onGround = false;
    const left = Math.floor(b.x / TILE), right = Math.floor((b.x + b.w - 1) / TILE);
    if (b.vy > 0) {
      const ty = Math.floor((b.y + b.h) / TILE);
      for (let tx = left; tx <= right; tx++) {
        const t = tileAt(tx, ty);
        if (isSolid(t) || (isOneWay(t) && prevBottom <= ty * TILE + 1)) {
          b.y = ty * TILE - b.h; b.vy = 0; b.onGround = true; break;
        }
      }
    } else if (b.vy < 0) {
      const ty = Math.floor(b.y / TILE);
      for (let tx = left; tx <= right; tx++) if (isSolid(tileAt(tx, ty))) { b.y = (ty + 1) * TILE; b.vy = 0; break; }
    }
    return hitWall;
  }

  function touchesTile(b, type, inset = 0) {
    const l = Math.floor((b.x + inset) / TILE), r = Math.floor((b.x + b.w - 1 - inset) / TILE);
    const t = Math.floor((b.y + inset) / TILE), btm = Math.floor((b.y + b.h - 1) / TILE);
    for (let ty = t; ty <= btm; ty++) for (let tx = l; tx <= r; tx++) {
      if (tileAt(tx, ty) !== type) continue;
      if (type === "^") { // espinhos ocupam só a metade de baixo do bloco
        if (b.y + b.h > ty * TILE + TILE * 0.55) return true;
      } else return true;
    }
    return false;
  }

  // =========================================================
  //  ATUALIZAÇÃO
  // =========================================================
  function hurt(fromX) {
    const p = game.player;
    if (p.invuln > 0) return;
    game.hearts--;
    sfx("hurt");
    updateHUD();
    burst(p.x + p.w / 2, p.y + p.h / 2, "#ff6b5a", 12);
    if (game.hearts <= 0) return gameOver();
    p.invuln = 1.6;
    p.vy = -520;
    p.vx = (p.x + p.w / 2 < fromX ? -1 : 1) * 320;
  }
  function fallOut() {
    game.hearts--;
    sfx("hurt");
    updateHUD();
    if (game.hearts <= 0) return gameOver();
    spawnPlayer();
    toast("Cuidado com a água!");
  }
  function gameOver() {
    game.state = "over";
    setTimeout(() => openModal("over"), 400);
  }
  function winLevel() {
    game.state = "win";
    sfx("win");
    const stars = 1 + game.crowns;
    const i = game.levelIndex;
    save.stars[i] = Math.max(save.stars[i] || 0, stars);
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, i + 2));
    save.coins += game.coins;
    mapSelected = Math.min(i + 1, LEVELS.length - 1);
    persist();
    $("#win-stars").innerHTML = starsHTML(stars);
    $("#win-coins").textContent = game.coins;
    const nextBtn = modals.win.querySelector('[data-action="next"]');
    nextBtn.style.display = i + 1 < LEVELS.length ? "" : "none";
    modals.win.querySelector("h2").textContent = i + 1 < LEVELS.length ? "FASE COMPLETA!" : "VOCÊ VENCEU!";
    setTimeout(() => openModal("win"), 500);
  }

  function burst(x, y, color, n = 8, speed = 220) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0.5 + Math.random() * 0.3, color, size: 4 + Math.random() * 4 });
    }
  }

  function update(dt) {
    game.time += dt;
    const p = game.player;

    // --- movimento horizontal ---
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
      p.vx += dir * ACCEL * dt;
      p.vx = clamp(p.vx, -MAX_SPEED, MAX_SPEED);
      p.facing = dir;
    } else {
      const f = FRICTION * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }

    // --- pulo (com "coyote time" e buffer) ---
    p.coyote = p.onGround ? 0.1 : p.coyote - dt;
    p.jumpBuffer = input.jumpPressed ? 0.12 : p.jumpBuffer - dt;
    input.jumpPressed = false;
    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = -JUMP_V;
      p.coyote = 0;
      p.jumpBuffer = 0;
      p.squash = -0.25;
      sfx("jump");
    }
    if (!input.jump && p.vy < -300) p.vy = -300; // pulo variável

    p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);
    const wasGround = p.onGround;
    moveBody(p, dt);
    if (p.onGround && !wasGround) {
      p.squash = 0.2;
      burst(p.x + p.w / 2, p.y + p.h, "#e8d3a0", 5, 90);
    }
    p.squash *= 0.85;
    p.anim += Math.abs(p.vx) * dt * 0.05;
    if (p.invuln > 0) p.invuln -= dt;

    // --- perigos ---
    if (p.y > game.rows * TILE + 40 || touchesTile(p, "~", 6)) return fallOut();
    if (touchesTile(p, "^", 6)) hurt(p.x + p.w / 2 + p.facing * 10);

    // --- itens ---
    for (const it of game.items) {
      if (it.got || !overlap(p, it)) continue;
      it.got = true;
      const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
      if (it.type === "coin") { game.coins++; sfx("coin"); burst(cx, cy, "#ffcc1f", 6, 150); }
      if (it.type === "key") {
        game.keys++; sfx("key"); burst(cx, cy, "#fff6a0", 14);
        toast(game.keys === game.keysTotal ? "Todas as chaves! Vá até a porta!" : `Chave ${game.keys}/${game.keysTotal}`);
      }
      if (it.type === "crown") { game.crowns++; sfx("crown"); burst(cx, cy, "#ffcc1f", 18, 260); toast("Coroa encontrada! ★"); }
      updateHUD();
    }

    // --- checkpoints ---
    for (const c of game.checkpoints) {
      if (!c.on && overlap(p, c)) {
        c.on = true;
        game.spawn = { x: c.x, y: c.y + c.h - p.h - 2 };
        sfx("flag");
        toast("Checkpoint!");
        burst(c.x + 18, c.y + 20, "#8ee05a", 10);
      }
    }

    // --- porta ---
    game.doorMsgCooldown -= dt;
    if (game.door && overlap(p, game.door)) {
      if (game.keys >= game.keysTotal) return winLevel();
      if (game.doorMsgCooldown <= 0) {
        toast(`A porta está trancada! Chaves ${game.keys}/${game.keysTotal}`);
        game.doorMsgCooldown = 2.2;
      }
    }

    // --- inimigos ---
    for (const e of game.enemies) {
      if (!e.alive) { e.dead += dt; continue; }
      const onScreen = e.x > game.camX - 300 && e.x < game.camX + VW + 300;
      if (!onScreen) continue;
      e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);
      const speed = e.vx;
      const hit = moveBody(e, dt);
      if (hit) e.vx = -speed; else e.vx = speed;
      // vira na beirada
      if (e.onGround) {
        const aheadX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
        const below = tileAt(Math.floor(aheadX / TILE), Math.floor((e.y + e.h + 4) / TILE));
        if (!isSolid(below) && !isOneWay(below)) e.vx = -e.vx;
      }
      if (e.y > game.rows * TILE) e.alive = false;

      if (overlap(p, e)) {
        const stomp = p.vy > 0 && p.y + p.h - e.y < 26;
        if (stomp) {
          e.alive = false;
          p.vy = input.jump ? -JUMP_V * 0.85 : -520;
          sfx("stomp");
          burst(e.x + e.w / 2, e.y + e.h / 2, "#e2402f", 12);
          game.coins++;
          updateHUD();
        } else {
          hurt(e.x + e.w / 2);
        }
      }
    }

    // --- partículas ---
    for (const pt of game.particles) {
      pt.life -= dt;
      pt.vy += 900 * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    game.particles = game.particles.filter((pt) => pt.life > 0);

    // --- câmera ---
    const maxX = game.cols * TILE - VW;
    const targetX = clamp(p.x + p.w / 2 - VW * 0.42 + p.facing * 40, 0, maxX);
    game.camX += (targetX - game.camX) * Math.min(1, dt * 6);
    const maxY = game.rows * TILE - VH;
    const targetY = clamp(p.y - VH * 0.55, 0, maxY);
    game.camY += (targetY - game.camY) * Math.min(1, dt * 5);
  }

  // =========================================================
  //  DESENHO
  // =========================================================
  function drawBackground() {
    const bg = IMG.bg;
    ctx.fillStyle = game.theme === "cave" ? "#1b2433" : "#2d8de0";
    ctx.fillRect(0, 0, VW, VH);
    if (bg.complete && bg.naturalWidth) {
      const s = 0.68;
      const w = bg.naturalWidth * s, h = bg.naturalHeight * s;
      const off = -(game.camX * 0.3) % (w * 2);
      for (let i = -1; i < 4; i++) {
        const x = off + i * w;
        if (x > VW || x + w < 0) continue;
        ctx.save();
        // espelha uma cópia sim, outra não, para emendar sem costura
        if (((i % 2) + 2) % 2 === 1) { ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(bg, 0, -40 - game.camY * 0.2, w, h); }
        else ctx.drawImage(bg, x, -40 - game.camY * 0.2, w, h);
        ctx.restore();
      }
      ctx.fillStyle = "#2e6d2a";
      ctx.fillRect(0, h - 75 - game.camY * 0.2, VW, VH);
    }
    // tom de cor por tema
    if (game.theme === "sunset") {
      const g = ctx.createLinearGradient(0, 0, 0, VH);
      g.addColorStop(0, "rgba(255,120,60,.45)");
      g.addColorStop(1, "rgba(120,40,90,.25)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);
    } else if (game.theme === "cave") {
      ctx.fillStyle = "rgba(10,14,40,.62)";
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  function drawTiles() {
    const x0 = Math.floor(game.camX / TILE), x1 = Math.ceil((game.camX + VW) / TILE);
    const y0 = Math.floor(game.camY / TILE), y1 = Math.ceil((game.camY + VH) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = tileAt(tx, ty);
        if (tx < 0 || tx >= game.cols) continue;
        const sx = Math.round(tx * TILE - game.camX), sy = Math.round(ty * TILE - game.camY);
        if (t === "#") {
          const above = tileAt(tx, ty - 1);
          ctx.drawImage(isSolid(above) ? SPR.dirt : SPR.grass, sx, sy, TILE, TILE);
          // borda escura nas laterais expostas
          ctx.fillStyle = "#24130a";
          if (!isSolid(tileAt(tx - 1, ty)) && tx > 0) ctx.fillRect(sx, sy, 3, TILE);
          if (!isSolid(tileAt(tx + 1, ty)) && tx < game.cols - 1) ctx.fillRect(sx + TILE - 3, sy, 3, TILE);
        } else if (t === "=") ctx.drawImage(SPR.platform, sx, sy, TILE, TILE);
        else if (t === "B") ctx.drawImage(SPR.crate, sx, sy, TILE, TILE);
        else if (t === "^") ctx.drawImage(SPR.spikes, sx, sy, TILE, TILE);
        else if (t === "~") {
          const wave = Math.sin(game.time * 3 + tx) * 3;
          ctx.fillStyle = "#1f6fd1";
          ctx.fillRect(sx, sy + 10 + wave, TILE, TILE - 10 - wave);
          ctx.fillStyle = "#57b3ff";
          ctx.fillRect(sx, sy + 8 + wave, TILE, 6);
          ctx.fillStyle = "#c9ecff";
          ctx.fillRect(sx + ((game.time * 40 + tx * 13) % TILE), sy + 9 + wave, 10, 3);
        }
      }
    }
  }

  function drawItems() {
    for (const it of game.items) {
      if (it.got) continue;
      const sx = it.x - game.camX, sy = it.y - game.camY + Math.sin(game.time * 4 + it.x) * 3;
      if (sx < -60 || sx > VW + 60) continue;
      if (it.type === "coin") {
        const sc = Math.abs(Math.cos(game.time * 4 + it.x * 0.1));
        const w = Math.max(4, it.w * sc);
        const cx = sx + it.w / 2;
        ctx.fillStyle = "#24130a";
        ctx.fillRect(cx - w / 2 - 3, sy, w + 6, it.h);
        ctx.fillRect(cx - w / 2, sy - 3, w, it.h + 6);
        ctx.fillStyle = "#ffcc1f";
        ctx.fillRect(cx - w / 2, sy, w, it.h);
        ctx.fillStyle = "#d98b00";
        ctx.fillRect(cx - w / 2, sy + it.h - 6, w, 6);
        if (w > 10) { ctx.fillStyle = "#fff6a0"; ctx.fillRect(cx - w / 4, sy + 4, Math.max(2, w / 5), it.h - 12); }
      } else if (it.type === "key") {
        ctx.save();
        ctx.shadowColor = "#fff6a0"; ctx.shadowBlur = 14;
        ctx.drawImage(SPR.key, sx, sy, it.w, it.h);
        ctx.restore();
      } else if (it.type === "crown") {
        ctx.save();
        ctx.shadowColor = "#ffe66b"; ctx.shadowBlur = 18;
        ctx.drawImage(SPR.crown, sx, sy, it.w, it.h);
        ctx.restore();
      }
    }
  }

  function drawDoorAndFlags() {
    for (const c of game.checkpoints) {
      ctx.drawImage(SPR.flag[c.on ? 1 : 0], c.x - game.camX, c.y - game.camY, 36, 96);
    }
    const d = game.door;
    if (!d) return;
    const sx = d.x - game.camX, sy = d.y - game.camY;
    const open = game.keys >= game.keysTotal;
    // moldura de pedra
    ctx.fillStyle = "#24130a";
    ctx.fillRect(sx - 6, sy + 6, d.w + 12, d.h - 6);
    ctx.beginPath(); ctx.arc(sx + d.w / 2, sy + 24, d.w / 2 + 6, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#8b8f97";
    ctx.fillRect(sx - 3, sy + 24, d.w + 6, d.h - 24);
    ctx.beginPath(); ctx.arc(sx + d.w / 2, sy + 24, d.w / 2 + 3, Math.PI, 0); ctx.fill();
    // porta
    ctx.fillStyle = open ? "#111" : "#9a5f22";
    ctx.fillRect(sx + 4, sy + 24, d.w - 8, d.h - 24);
    ctx.beginPath(); ctx.arc(sx + d.w / 2, sy + 24, d.w / 2 - 4, Math.PI, 0); ctx.fill();
    if (!open) {
      ctx.fillStyle = "#6e3b18";
      for (let i = 1; i < 3; i++) ctx.fillRect(sx + 4 + i * ((d.w - 8) / 3), sy + 10, 3, d.h - 10);
      // cadeado
      ctx.fillStyle = "#24130a"; ctx.fillRect(sx + d.w / 2 - 10, sy + 44, 20, 18);
      ctx.fillStyle = "#ffcc1f"; ctx.fillRect(sx + d.w / 2 - 7, sy + 47, 14, 12);
      ctx.strokeStyle = "#24130a"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(sx + d.w / 2, sy + 44, 6, Math.PI, 0); ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(255, 230, 120, ${0.25 + Math.sin(game.time * 5) * 0.15})`;
      ctx.fillRect(sx + 4, sy + 24, d.w - 8, d.h - 24);
      ctx.fillStyle = "#ffcc1f";
      ctx.font = "bold 22px 'Pixelify Sans', monospace";
      ctx.textAlign = "center";
      ctx.fillText("▼", sx + d.w / 2, sy - 14 + Math.sin(game.time * 6) * 4);
    }
  }

  function drawEnemies() {
    for (const e of game.enemies) {
      if (!e.alive && e.dead > 0.4) continue;
      const sx = e.x - game.camX, sy = e.y - game.camY;
      if (sx < -60 || sx > VW + 60) continue;
      if (!e.alive) {
        ctx.globalAlpha = 1 - e.dead / 0.4;
        ctx.drawImage(SPR.enemy[0], sx, sy + e.h * 0.6, e.w + 6, e.h * 0.4);
        ctx.globalAlpha = 1;
        continue;
      }
      const frame = Math.floor(game.time * 6) % 2;
      ctx.save();
      if (e.vx > 0) { ctx.translate(sx + e.w, sy); ctx.scale(-1, 1); ctx.drawImage(SPR.enemy[frame], 0, 0, e.w, e.h); }
      else ctx.drawImage(SPR.enemy[frame], sx, sy, e.w, e.h);
      ctx.restore();
    }
  }

  function drawPlayer() {
    const p = game.player;
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
    const img = IMG.bear;
    const dh = 74, dw = img.naturalWidth ? (img.naturalWidth / img.naturalHeight) * dh : 41;
    let sy = 1 - p.squash, sx = 1 + p.squash;
    let bob = 0, tilt = 0;
    if (p.onGround && Math.abs(p.vx) > 20) { bob = Math.abs(Math.sin(p.anim * 2)) * -5; tilt = Math.sin(p.anim * 2) * 0.08; }
    if (!p.onGround) tilt = clamp(p.vy / 4000, -0.15, 0.15) * p.facing;
    const cx = p.x + p.w / 2 - game.camX, by = p.y + p.h - game.camY;
    // sombra
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(cx - 16, by - 3, 32, 4);
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(by + bob));
    ctx.rotate(tilt);
    ctx.scale(p.facing * sx, sy);
    if (img.complete && img.naturalWidth) ctx.drawImage(img, -dw / 2, -dh, dw, dh);
    else { ctx.fillStyle = "#b5652a"; ctx.fillRect(-15, -60, 30, 60); }
    ctx.restore();
  }

  function drawParticles() {
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life * 2));
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - game.camX - pt.size / 2, pt.y - game.camY - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    drawBackground();
    drawTiles();
    drawDoorAndFlags();
    drawItems();
    drawEnemies();
    drawPlayer();
    drawParticles();
    if (game.theme === "cave") {
      // luz ao redor do ursinho
      const p = game.player;
      const g = ctx.createRadialGradient(p.x - game.camX + 15, p.y - game.camY + 30, 80, p.x - game.camX + 15, p.y - game.camY + 30, 520);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,20,.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  // =========================================================
  //  LOOP PRINCIPAL
  // =========================================================
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    if (game.state === "play") {
      // sub-passos para colisão estável
      const steps = 2;
      for (let i = 0; i < steps && game.state === "play"; i++) update(dt / steps);
    } else if (game.state === "win" || game.state === "over") {
      game.time += dt;
      for (const pt of game.particles) { pt.life -= dt; pt.vy += 900 * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; }
    }
    if (game.state !== "idle" && game.player) draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Para testes no console
  window.GoBear = { game, startLevel };
})();
