(() => {
  'use strict';

  const canvas = document.querySelector('#screen');
  const context = canvas.getContext('2d');
  const touchBar = document.querySelector('#touch-controls');
  const WIDTH = 960;
  const HEIGHT = 540;
  const ASSET_DIR = 'img/';

  const files = {
    startBg: 'fundo_inicio.png', mapBg: 'fundo_fases.png', playBg: 'ChatGPT Image 10 de set. de 2026, 17_10_44.png',
    logo: 'logo.png', bear: 'ursinho.png', start: 'botao_iniciar.png', back: 'botao_voltar.png',
    pause: '05_botao_pause.png', coin: '01_moeda.png', key: '03_chave.png', crown: '05_coroa.png',
    spike: '09_espinhos.png', box: '10_caixa.png', bridge: '11_ponte.png', mushroom: '12_cogumelo.png',
    flowers: '13_flores_arbusto.png', rock: '15_pedra.png', cave: '16_caverna.png',
    long: '03_monte_m_b.png', wide: '05_monte_p_compri.png', high: '02_plataforma_alta.png', small: '01_plataforma_pequena.png',
    phase1: 'fase_1_1.png', phase2: 'fase_1_2.png', phase3: 'fase_1_3.png', lock4: 'fase_1_4_bloq.png', lock5: 'fase_1_5_bloq.png',
    pausePanel: 'painel_pausado.png', resume: 'botao_continuar.png', retry: 'botao_reiniciar.png', exit: 'botao_sair.png'
  };
  const art = {};
  for (const [name, file] of Object.entries(files)) {
    const image = new Image();
    image.src = ASSET_DIR + encodeURI(file);
    art[name] = image;
  }

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let pixelRatio = 1;
  let state = 'title';
  let isPaused = false;
  let frameTime = 0;
  let previousTime = 0;
  let uiButtons = [];
  const input = { left: false, right: false, jump: false, jumpPressed: false };

  let unlockedLevel = 1;
  let completedLevels = [];
  try {
    unlockedLevel = Math.max(1, Math.min(5, Number(localStorage.getItem('gobear-v2-unlocked')) || 1));
    completedLevels = JSON.parse(localStorage.getItem('gobear-v2-completed') || '[]');
    if (!Array.isArray(completedLevels)) completedLevels = [];
  } catch (_) { /* O jogo continua mesmo se o navegador bloquear o armazenamento local. */ }

  let level = 1;
  let player;
  let platforms = [];
  let coins = [];
  let keys = [];
  let crowns = [];
  let spikes = [];
  let enemies = [];
  let worldWidth = 2000;
  let cameraX = 0;
  let lives = 3;
  let coinTotal = 0;
  let keyTotal = 0;
  let crownTotal = 0;
  let message = '';
  let messageTimer = 0;

  function resize() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(innerWidth * pixelRatio));
    canvas.height = Math.max(1, Math.floor(innerHeight * pixelRatio));
    scale = Math.min(innerWidth / WIDTH, innerHeight / HEIGHT);
    offsetX = (innerWidth - WIDTH * scale) / 2;
    offsetY = (innerHeight - HEIGHT * scale) / 2;
    context.setTransform(pixelRatio * scale, 0, 0, pixelRatio * scale, pixelRatio * offsetX, pixelRatio * offsetY);
  }
  addEventListener('resize', resize);
  resize();

  function drawImage(name, x, y, width, height) {
    const image = art[name];
    if (!image || !image.complete || !image.naturalWidth) return;
    const h = height ?? width * image.naturalHeight / image.naturalWidth;
    context.drawImage(image, x, y, width, h);
  }

  function coverBackground(name) {
    const image = art[name];
    if (!image?.naturalWidth) {
      context.fillStyle = '#68b8d8';
      context.fillRect(0, 0, WIDTH, HEIGHT);
      return;
    }
    const factor = Math.max(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight);
    const w = image.naturalWidth * factor;
    const h = image.naturalHeight * factor;
    context.drawImage(image, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
  }

  function panel(x, y, width, height, fill = '#4b2b19', border = '#e9bd69', radius = 12) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fillStyle = fill;
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = border;
    context.stroke();
  }

  function addButton(x, y, width, height, action) {
    uiButtons.push({ x, y, width, height, action });
  }

  function imageButton(name, x, y, width, height, action) {
    drawImage(name, x, y, width, height);
    addButton(x, y, width, height, action);
  }

  function drawTitle() {
    coverBackground('startBg');
    drawImage('logo', 324, 8, 312, 198);
    drawImage('bear', 412, 211, 116, 161);
    imageButton('start', 360, 384, 240, 76, () => { state = 'map'; });
  }

  function drawLockedBadge(x, y) {
    context.save();
    context.fillStyle = '#14251fd9';
    context.beginPath(); context.arc(x, y, 28, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#eee4c8'; context.lineWidth = 4;
    context.beginPath(); context.arc(x, y - 4, 9, Math.PI, 0); context.stroke();
    panel(x - 12, y - 5, 24, 22, '#e9dfbf', '#3c281b', 3);
    context.fillStyle = '#3c281b'; context.beginPath(); context.arc(x, y + 4, 2, 0, Math.PI * 2); context.fill();
    context.restore();
  }

  function drawMap() {
    coverBackground('mapBg');
    panel(334, 16, 292, 48, '#61371fe8', '#d8a14d', 9);
    context.fillStyle = '#fff0cc'; context.font = 'bold 21px Georgia'; context.textAlign = 'center';
    context.fillText('FLORESTA ENCANTADA', WIDTH / 2, 47);
    const nodes = [
      { n: 1, x: 150, y: 226, image: 'phase1' }, { n: 2, x: 326, y: 289, image: 'phase2' },
      { n: 3, x: 510, y: 228, image: 'phase3' }, { n: 4, x: 693, y: 299, image: 'lock4' }, { n: 5, x: 839, y: 212, image: 'lock5' }
    ];
    for (const node of nodes) {
      const locked = node.n > unlockedLevel;
      if (node.n <= 3) {
        drawImage(node.image, node.x - 47, node.y - 53, 94, 106);
        if (locked) drawLockedBadge(node.x, node.y);
      } else if (locked) {
        drawImage(node.image, node.x - 41, node.y - 48, 82, 96);
      } else {
        context.save(); context.fillStyle = '#155737'; context.strokeStyle = '#f4bd4d'; context.lineWidth = 7;
        context.beginPath(); context.arc(node.x, node.y, 34, 0, Math.PI * 2); context.fill(); context.stroke(); context.restore();
        drawImage('crown', node.x - 20, node.y - 58, 40, 34);
        context.font = 'bold 16px Georgia'; context.textAlign = 'center'; context.lineWidth = 4;
        context.strokeStyle = '#332015'; context.strokeText(`1-${node.n}`, node.x, node.y + 6);
        context.fillStyle = '#fff1d1'; context.fillText(`1-${node.n}`, node.x, node.y + 6);
      }
      if (!locked) {
        if (completedLevels.includes(node.n)) {
          context.font = 'bold 13px Georgia'; context.fillStyle = '#fff0ba'; context.textAlign = 'center';
          context.fillText('CONCLUÍDA', node.x, node.y + 63);
        } else if (node.n === unlockedLevel) {
          drawImage('bear', node.x + 22, node.y - 70, 34, 47);
        }
        addButton(node.x - 52, node.y - 57, 104, 116, () => startLevel(node.n));
      }
    }
    imageButton('back', 25, 461, 215, 55, () => { state = 'title'; });
    context.textAlign = 'left';
  }

  function startLevel(number) {
    level = number;
    lives = 3;
    coinTotal = 0; keyTotal = 0; crownTotal = 0;
    cameraX = 0; isPaused = false; message = ''; messageTimer = 0;
    input.left = input.right = input.jump = input.jumpPressed = false;
    worldWidth = 2000 + (level - 1) * 90;
    player = { x: 62, y: 320, w: 45, h: 64, vx: 0, vy: 0, grounded: false, invulnerable: 0, direction: 1, spawnX: 62 };

    const rise = Math.min((level - 1) * 2, 6);
    platforms = [
      { x: 0, y: 420, w: 350, art: 'long', surface: .28 },
      { x: 420, y: 340 - rise, w: 180, art: 'high', surface: .30 },
      { x: 650, y: 420, w: 340, art: 'wide', surface: .36 },
      { x: 1080, y: 330 - rise, w: 180, art: 'high', surface: .30 },
      { x: 1320, y: 420, w: 350, art: 'long', surface: .28 },
      { x: 1730, y: 360 - rise, w: 220, art: 'small', surface: .18 },
      { x: 1980, y: 420, w: Math.max(150, worldWidth - 1980), art: 'wide', surface: .36 }
    ];
    coins = [
      [155, 367], [218, 337], [470, 280], [535, 280], [710, 365], [775, 340], [850, 365],
      [1120, 270], [1180, 270], [1380, 365], [1450, 338], [1530, 365], [1778, 302], [1840, 302], [2020, 365]
    ].map(([x, y]) => ({ x, y, taken: false }));
    keys = [[487, 275], [1143, 264], [1476, 346]].map(([x, y]) => ({ x, y, taken: false }));
    crowns = [[820, 361], [1800, 298]].map(([x, y]) => ({ x, y, taken: false }));
    spikes = [{ x: 935, y: 394, w: 44, h: 28 }, { x: 1600, y: 394, w: 45, h: 28 }];
    enemies = [{ x: 1385, min: 1360, max: 1535, speed: 72 + level * 5, direction: 1, y: 382, w: 43, h: 38 }];
    state = 'play';
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function showMessage(text) { message = text; messageTimer = 1.8; }

  function takeDamage() {
    if (player.invulnerable > 0) return;
    lives--;
    player.invulnerable = 1.4;
    player.x = player.spawnX;
    player.y = 285;
    player.vx = 0; player.vy = 0;
    if (lives <= 0) state = 'gameover';
  }

  function update(dt) {
    if (state !== 'play' || isPaused) return;
    const moveSpeed = 245;
    player.vx = (input.right ? moveSpeed : 0) - (input.left ? moveSpeed : 0);
    if (player.vx !== 0) player.direction = Math.sign(player.vx);
    const oldBottom = player.y + player.h;
    player.x = Math.max(0, Math.min(worldWidth - player.w, player.x + player.vx * dt));
    if (input.jumpPressed && player.grounded) { player.vy = -510; player.grounded = false; }
    input.jumpPressed = false;
    player.vy = Math.min(900, player.vy + 1350 * dt);
    player.y += player.vy * dt;
    player.grounded = false;
    for (const platform of platforms) {
      if (player.x + player.w > platform.x && player.x < platform.x + platform.w &&
          oldBottom <= platform.y + 3 && player.y + player.h >= platform.y && player.vy >= 0) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.grounded = true;
      }
    }

    if (player.y > HEIGHT + 100) takeDamage();
    const body = { x: player.x + 5, y: player.y + 5, w: player.w - 10, h: player.h - 7 };
    for (const item of coins) if (!item.taken && overlaps(body, { x: item.x, y: item.y, w: 27, h: 31 })) { item.taken = true; coinTotal++; }
    for (const item of keys) if (!item.taken && overlaps(body, { x: item.x, y: item.y, w: 36, h: 32 })) { item.taken = true; keyTotal++; }
    for (const item of crowns) if (!item.taken && overlaps(body, { x: item.x, y: item.y, w: 36, h: 33 })) { item.taken = true; crownTotal++; }

    for (const enemy of enemies) {
      enemy.x += enemy.direction * enemy.speed * dt;
      if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.direction *= -1;
      if (player.invulnerable <= 0 && overlaps(body, enemy)) takeDamage();
    }
    for (const hazard of spikes) if (player.invulnerable <= 0 && overlaps(body, hazard)) takeDamage();
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    if (player.x + player.w >= worldWidth - 72) {
      if (keyTotal >= 3 && crownTotal >= 2) {
        state = 'complete';
        if (!completedLevels.includes(level)) completedLevels.push(level);
        unlockedLevel = Math.min(5, Math.max(unlockedLevel, level + 1));
        try {
          localStorage.setItem('gobear-v2-unlocked', String(unlockedLevel));
          localStorage.setItem('gobear-v2-completed', JSON.stringify(completedLevels));
        } catch (_) { /* O progresso fica disponível durante esta sessão. */ }
      } else {
        player.x = worldWidth - 140;
        showMessage('Pegue as 3 chaves e as 2 coroas!');
      }
    }
    cameraX = Math.max(0, Math.min(worldWidth - WIDTH, player.x - WIDTH * .34));
    if (messageTimer > 0) messageTimer -= dt;
  }

  function drawForest() {
    const image = art.playBg;
    if (!image?.naturalWidth) {
      context.fillStyle = '#65bde0'; context.fillRect(0, 0, WIDTH, HEIGHT);
      context.fillStyle = '#316b43'; context.fillRect(0, 300, WIDTH, 240);
      return;
    }
    const h = HEIGHT;
    const w = image.naturalWidth * h / image.naturalHeight;
    const cycle = Math.max(1, w - WIDTH);
    const x = -(cameraX * .18 % cycle);
    context.drawImage(image, x, 0, w, h);
    context.drawImage(image, x + w - 2, 0, w, h);
  }

  function drawWater() {
    const water = context.createLinearGradient(0, 420, 0, HEIGHT);
    water.addColorStop(0, '#29add9'); water.addColorStop(1, '#0873a8');
    context.fillStyle = water; context.fillRect(0, 420, WIDTH, HEIGHT - 420);
    context.fillStyle = '#9ceaf2';
    for (let x = 0; x < WIDTH; x += 48) context.fillRect(x + (Math.floor(frameTime * 4) % 18), 420, 24, 4);
  }

  function drawPlatform(platform) {
    const image = art[platform.art];
    if (!image?.naturalWidth) {
      panel(platform.x, platform.y, platform.w, 90, '#76502c', '#41732d', 6);
      context.fillStyle = '#63a83d'; context.fillRect(platform.x, platform.y, platform.w, 12);
      return;
    }
    const imageHeight = platform.w * image.naturalHeight / image.naturalWidth;
    const top = platform.y - imageHeight * platform.surface;
    drawImage(platform.art, platform.x, top, platform.w, imageHeight);
  }

  function drawGameWorld() {
    drawForest();
    drawWater();
    context.save(); context.translate(-cameraX, 0);
    for (const platform of platforms) drawPlatform(platform);
    drawImage('bridge', 347, 386, 75, 30);
    drawImage('bridge', 600, 386, 54, 27);
    drawImage('box', 865, 362, 42, 46);
    drawImage('mushroom', 1027, 372, 40, 45);
    drawImage('flowers', 1255, 380, 65, 40);
    drawImage('cave', worldWidth - 91, 344, 84, 58);

    for (const hazard of spikes) drawImage('spike', hazard.x, hazard.y - 5, hazard.w, hazard.h + 7);
    for (const item of coins) if (!item.taken) drawImage('coin', item.x, item.y, 27, 31);
    for (const item of keys) if (!item.taken) drawImage('key', item.x, item.y, 36, 33);
    for (const item of crowns) if (!item.taken) drawImage('crown', item.x, item.y, 36, 33);
    for (const enemy of enemies) drawImage('rock', enemy.x, enemy.y, enemy.w, enemy.h);

    if (player.invulnerable <= 0 || Math.floor(player.invulnerable * 12) % 2 === 0) {
      const bob = player.grounded && player.vx !== 0 ? Math.sin(frameTime * 18) * 2 : 0;
      context.save();
      if (player.direction < 0) {
        context.translate(player.x + player.w, 0); context.scale(-1, 1);
        drawImage('bear', 0, player.y + bob, player.w, player.h);
      } else drawImage('bear', player.x, player.y + bob, player.w, player.h);
      context.restore();
    }
    context.restore();
    drawHud();
  }

  function drawHud() {
    panel(15, 14, 238, 72, '#f3cf8c', '#573118', 12);
    drawImage('bear', 23, 19, 49, 60);
    for (let i = 0; i < 3; i++) {
      context.fillStyle = i < lives ? '#dd3336' : '#987363';
      context.font = 'bold 29px Georgia'; context.fillText('♥', 80 + i * 34, 47);
    }
    drawImage('coin', 82, 53, 19, 23);
    context.fillStyle = '#472816'; context.font = 'bold 17px Georgia'; context.fillText(`× ${coinTotal}`, 106, 72);
    panel(355, 17, 250, 58, '#f3cf8c', '#573118', 12);
    drawImage('key', 366, 27, 28, 34); context.fillStyle = '#392416'; context.font = 'bold 19px Georgia'; context.fillText(`${keyTotal}/3`, 399, 53);
    drawImage('crown', 470, 27, 32, 30); context.fillText(`${crownTotal}/2`, 507, 53);
    drawImage('pause', 886, 12, 58, 56);
    addButton(886, 12, 58, 56, () => { isPaused = true; });
  }

  function drawMessage() {
    if (messageTimer <= 0) return;
    panel(255, 91, 450, 47, '#4a2a18ed', '#efc76e', 10);
    context.fillStyle = '#fff1d1'; context.textAlign = 'center'; context.font = 'bold 18px Georgia';
    context.fillText(message, WIDTH / 2, 121); context.textAlign = 'left';
  }

  function drawOverlay(title, buttons, usePausePanel = false) {
    context.fillStyle = '#10221fa6'; context.fillRect(0, 0, WIDTH, HEIGHT);
    if (usePausePanel) {
      drawImage('pausePanel', 333, 84, 294, 300);
    } else {
      panel(328, 88, 304, 344, '#f1d29a', '#593319', 19);
      panel(343, 103, 274, 62, '#8b4d26', '#482713', 11);
      context.fillStyle = '#fff0cf'; context.textAlign = 'center'; context.font = 'bold 24px Georgia';
      context.fillText(title, WIDTH / 2, 143);
    }
    const firstY = buttons.length === 1 ? 232 : buttons.length === 2 ? 202 : 171;
    buttons.forEach((button, index) => imageButton(button.image, 374, firstY + index * 70, 212, 59, button.action));
    context.textAlign = 'left';
  }

  function draw() {
    context.setTransform(pixelRatio * scale, 0, 0, pixelRatio * scale, pixelRatio * offsetX, pixelRatio * offsetY);
    context.clearRect(0, 0, WIDTH, HEIGHT);
    uiButtons = [];
    touchBar.classList.toggle('playing', state === 'play' && !isPaused);
    if (state === 'title') drawTitle();
    else if (state === 'map') drawMap();
    else {
      drawGameWorld();
      if (isPaused) {
        drawOverlay('PAUSADO', [
          { image: 'resume', action: () => { isPaused = false; } },
          { image: 'retry', action: () => startLevel(level) },
          { image: 'exit', action: () => { isPaused = false; state = 'map'; } }
        ], true);
      } else if (state === 'gameover') {
        drawOverlay('FIM DE JOGO', [
          { image: 'retry', action: () => startLevel(level) },
          { image: 'exit', action: () => { state = 'map'; } }
        ]);
      } else if (state === 'complete') {
        drawOverlay('FASE CONCLUÍDA!', [
          { image: 'resume', action: () => { state = 'map'; } }
        ]);
      } else drawMessage();
    }
  }

  function animationLoop(now) {
    const dt = Math.min((now - previousTime) / 1000 || 0, 1 / 30);
    previousTime = now;
    frameTime += dt;
    update(dt);
    draw();
    requestAnimationFrame(animationLoop);
  }
  requestAnimationFrame(animationLoop);

  function canvasPoint(event) {
    const x = (event.clientX - offsetX) / scale;
    const y = (event.clientY - offsetY) / scale;
    return { x, y };
  }
  canvas.addEventListener('pointerdown', event => {
    const point = canvasPoint(event);
    for (const button of [...uiButtons].reverse()) {
      if (point.x >= button.x && point.x <= button.x + button.width && point.y >= button.y && point.y <= button.y + button.height) {
        button.action();
        break;
      }
    }
  });

  addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', ' ', 'escape'].includes(key)) event.preventDefault();
    if (key === 'arrowleft' || key === 'a') input.left = true;
    if (key === 'arrowright' || key === 'd') input.right = true;
    if ((key === ' ' || key === 'arrowup' || key === 'w') && !input.jump) {
      input.jump = true;
      input.jumpPressed = true;
    }
    if (key === 'escape' && state === 'play') isPaused = !isPaused;
    if ((key === 'enter' || key === ' ') && state === 'title') state = 'map';
  });
  addEventListener('keyup', event => {
    const key = event.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') input.left = false;
    if (key === 'arrowright' || key === 'd') input.right = false;
    if (key === ' ' || key === 'arrowup' || key === 'w') input.jump = false;
  });

  document.querySelectorAll('#touch-controls [data-control]').forEach(button => {
    const direction = button.dataset.control;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (direction === 'jump' && !input.jump) input.jumpPressed = true;
      input[direction] = true;
      button.setPointerCapture(event.pointerId);
    });
    const release = event => { event.preventDefault(); input[direction] = false; };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });
})();
