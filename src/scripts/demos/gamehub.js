// gamehub.js: Paddle duel live game demo (2D Canvas on demand)
import { setSiteKeysSuspended } from '../keys.js';
import { notify } from '../notify.js';

export function mount(slot) {
  if (!slot) return;
  slot.textContent = '';

  let mode = 'cpu'; // 'cpu' | '2p'
  let isPlaying = false;
  let isPaused = false;
  let gameOver = false;
  let winner = '';

  // Game state (internal 320x180 resolution)
  const W = 320;
  const H = 180;
  const PADDLE_W = 6;
  const PADDLE_H = 34;
  const BALL_R = 4;
  const WIN_SCORE = 5;

  let leftY = (H - PADDLE_H) / 2;
  let rightY = (H - PADDLE_H) / 2;
  let leftScore = 0;
  let rightScore = 0;

  let ballX = W / 2;
  let ballY = H / 2;
  let ballVx = 2.4;
  let ballVy = 1.4;
  let ballSpeedMult = 1.0;

  let keysDown = { w: false, s: false, up: false, down: false };
  let cpuTargetY = rightY;
  let lastCpuUpdate = 0;

  // DOM Layout
  const wrapper = document.createElement('div');
  wrapper.className = 'live-gamehub';

  // Mode toggles
  const toggleRow = document.createElement('div');
  toggleRow.className = 'live-gamehub__toggles';

  const cpuChip = document.createElement('button');
  cpuChip.type = 'button';
  cpuChip.className = 'live-gamehub__chip is-active';
  cpuChip.textContent = 'vs cpu';
  cpuChip.setAttribute('aria-pressed', 'true');

  const p2Chip = document.createElement('button');
  p2Chip.type = 'button';
  p2Chip.className = 'live-gamehub__chip';
  p2Chip.textContent = '2 players';
  p2Chip.setAttribute('aria-pressed', 'false');

  toggleRow.appendChild(cpuChip);
  toggleRow.appendChild(p2Chip);
  wrapper.appendChild(toggleRow);

  // TV + controllers arena
  const arena = document.createElement('div');
  arena.className = 'live-gamehub__arena';

  function buildPhone(phoneEl, labelText) {
    const label = document.createElement('span');
    label.className = 'live-gamehub__phone-label';
    label.textContent = labelText;
    const screen = document.createElement('div');
    screen.className = 'live-gamehub__phone-screen';
    phoneEl.appendChild(label);
    phoneEl.appendChild(screen);
  }

  // Left Phone
  const leftPhone = document.createElement('div');
  leftPhone.className = 'live-gamehub__phone live-gamehub__phone--left';
  leftPhone.setAttribute('aria-hidden', 'true');
  buildPhone(leftPhone, 'P1 (W/S)');

  // TV frame
  const tv = document.createElement('div');
  tv.className = 'live-gamehub__tv';
  tv.setAttribute('tabindex', '0');
  tv.setAttribute('data-gamehub-tv', '');
  tv.setAttribute('data-left-y', String(Math.round(leftY)));

  // Pre-play overlay
  const preOverlay = document.createElement('div');
  preOverlay.className = 'live-gamehub__tv-pre';

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'live-gamehub__play-btn';
  playBtn.setAttribute('aria-label', 'Start paddle duel game');

  const playSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  playSvg.setAttribute('viewBox', '0 0 24 24');
  playSvg.setAttribute('width', '22');
  playSvg.setAttribute('height', '22');
  playSvg.setAttribute('fill', 'currentColor');
  playSvg.setAttribute('aria-hidden', 'true');
  const playPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  playPath.setAttribute('d', 'M7 5v14l12-7z');
  playSvg.appendChild(playPath);

  const playSpan = document.createElement('span');
  playSpan.textContent = 'play';

  playBtn.appendChild(playSvg);
  playBtn.appendChild(playSpan);
  preOverlay.appendChild(playBtn);
  tv.appendChild(preOverlay);

  // Right Phone
  const rightPhone = document.createElement('div');
  rightPhone.className = 'live-gamehub__phone live-gamehub__phone--right';
  rightPhone.setAttribute('aria-hidden', 'true');
  buildPhone(rightPhone, 'P2 (CPU)');

  arena.appendChild(leftPhone);
  arena.appendChild(tv);
  arena.appendChild(rightPhone);
  wrapper.appendChild(arena);

  // Status line
  const statusLine = document.createElement('div');
  statusLine.className = 'live-gamehub__status';
  statusLine.setAttribute('aria-live', 'polite');
  statusLine.textContent = 'press play to start · W/S controls left paddle';
  wrapper.appendChild(statusLine);

  // Fake join panel
  const joinPanel = document.createElement('div');
  joinPanel.className = 'live-gamehub__join';
  const joinBadge = document.createElement('span');
  joinBadge.className = 'live-gamehub__join-badge';
  joinBadge.textContent = 'scan to join';
  const joinCaption = document.createElement('span');
  joinCaption.className = 'live-gamehub__join-caption';
  joinCaption.textContent = '(in the real thing, your phone is the controller)';
  joinPanel.appendChild(joinBadge);
  joinPanel.appendChild(joinCaption);
  wrapper.appendChild(joinPanel);

  slot.appendChild(wrapper);

  // Canvas elements created ON DEMAND
  let canvas = null;
  let ctx = null;
  let animId = null;

  function getThemeColors() {
    const cs = getComputedStyle(document.documentElement);
    return {
      accent: cs.getPropertyValue('--accent').trim() || '#78a9ff',
      accent2: cs.getPropertyValue('--accent-2').trim() || '#be95ff',
      base05: cs.getPropertyValue('--base05').trim() || '#ffffff',
      base03: cs.getPropertyValue('--base03').trim() || '#393939',
      base00: cs.getPropertyValue('--base00').trim() || '#161616',
    };
  }

  let colors = getThemeColors();
  window.addEventListener('agemo:accent-changed', () => {
    colors = getThemeColors();
  });

  function resetBall(servingRight = true) {
    ballX = W / 2;
    ballY = H / 2;
    ballSpeedMult = 1.0;
    const dir = servingRight ? 1 : -1;
    ballVx = dir * (2.2 + Math.random() * 0.4);
    ballVy = (Math.random() - 0.5) * 2.5;
  }

  function renderGame() {
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    // Center dashed line
    ctx.strokeStyle = colors.base03;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Scores
    ctx.fillStyle = colors.base03;
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(leftScore), W / 2 - 30, 32);
    ctx.fillText(String(rightScore), W / 2 + 30, 32);

    // Left paddle
    ctx.fillStyle = colors.accent;
    ctx.fillRect(10, leftY, PADDLE_W, PADDLE_H);

    // Right paddle
    ctx.fillStyle = colors.accent2;
    ctx.fillRect(W - 10 - PADDLE_W, rightY, PADDLE_W, PADDLE_H);

    // Ball
    ctx.fillStyle = colors.base05;
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    // Paused overlay
    if (isPaused && !gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = colors.base05;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2 - 6);
      ctx.font = '11px monospace';
      ctx.fillStyle = colors.accent;
      ctx.fillText('Press Space or click to resume', W / 2, H / 2 + 14);
    }

    // Game Over overlay
    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = colors.accent;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(winner.toUpperCase(), W / 2, H / 2 - 10);
      ctx.fillStyle = colors.base05;
      ctx.font = '12px monospace';
      ctx.fillText('Click TV for rematch', W / 2, H / 2 + 16);
    }
  }

  function updatePhysics() {
    if (isPaused || gameOver) return;

    // Move left paddle
    const paddleSpeed = 3.6;
    if (keysDown.w) {
      leftY = Math.max(2, leftY - paddleSpeed);
      leftPhone.classList.add('is-active');
    } else if (keysDown.s) {
      leftY = Math.min(H - PADDLE_H - 2, leftY + paddleSpeed);
      leftPhone.classList.add('is-active');
    } else {
      leftPhone.classList.remove('is-active');
    }

    // Sync data-left-y for tests
    tv.setAttribute('data-left-y', String(Math.round(leftY)));

    // Move right paddle
    if (mode === '2p') {
      if (keysDown.up) {
        rightY = Math.max(2, rightY - paddleSpeed);
        rightPhone.classList.add('is-active');
      } else if (keysDown.down) {
        rightY = Math.min(H - PADDLE_H - 2, rightY + paddleSpeed);
        rightPhone.classList.add('is-active');
      } else {
        rightPhone.classList.remove('is-active');
      }
    } else {
      // CPU AI: beatable, max speed 70% of ball, reaction delay 120ms
      const now = Date.now();
      if (now - lastCpuUpdate > 120) {
        lastCpuUpdate = now;
        // Target ball position with slight error margin
        cpuTargetY = ballY - PADDLE_H / 2 + (Math.random() - 0.5) * 8;
      }
      const maxCpuSpeed = Math.abs(ballVx) * 0.7;
      const diff = cpuTargetY - rightY;
      if (Math.abs(diff) > 2) {
        rightY += Math.sign(diff) * Math.min(Math.abs(diff), maxCpuSpeed);
        rightY = Math.max(2, Math.min(H - PADDLE_H - 2, rightY));
        rightPhone.classList.add('is-active');
      } else {
        rightPhone.classList.remove('is-active');
      }
    }

    // Ball movement
    ballX += ballVx * ballSpeedMult;
    ballY += ballVy * ballSpeedMult;

    // Top / Bottom wall bounce
    if (ballY - BALL_R <= 0) {
      ballY = BALL_R;
      ballVy = -ballVy;
    } else if (ballY + BALL_R >= H) {
      ballY = H - BALL_R;
      ballVy = -ballVy;
    }

    // Left paddle collision
    const leftPaddleX = 10 + PADDLE_W;
    if (
      ballX - BALL_R <= leftPaddleX &&
      ballX + BALL_R >= 10 &&
      ballY >= leftY &&
      ballY <= leftY + PADDLE_H &&
      ballVx < 0
    ) {
      ballX = leftPaddleX + BALL_R;
      const hitOffset = (ballY - (leftY + PADDLE_H / 2)) / (PADDLE_H / 2);
      ballVx = Math.abs(ballVx);
      ballVy = hitOffset * 3.2;
      ballSpeedMult = Math.min(2.2, ballSpeedMult * 1.04);
    }

    // Right paddle collision
    const rightPaddleX = W - 10 - PADDLE_W;
    if (
      ballX + BALL_R >= rightPaddleX &&
      ballX - BALL_R <= W - 10 &&
      ballY >= rightY &&
      ballY <= rightY + PADDLE_H &&
      ballVx > 0
    ) {
      ballX = rightPaddleX - BALL_R;
      const hitOffset = (ballY - (rightY + PADDLE_H / 2)) / (PADDLE_H / 2);
      ballVx = -Math.abs(ballVx);
      ballVy = hitOffset * 3.2;
      ballSpeedMult = Math.min(2.2, ballSpeedMult * 1.04);
    }

    // Score checks
    if (ballX < 0) {
      rightScore++;
      updateStatus();
      if (rightScore >= WIN_SCORE) {
        gameOver = true;
        winner = mode === 'cpu' ? 'cpu wins' : 'right wins';
        notify({ title: 'game won', body: winner, icon: '🏓' });
      } else {
        resetBall(true);
      }
    } else if (ballX > W) {
      leftScore++;
      updateStatus();
      if (leftScore >= WIN_SCORE) {
        gameOver = true;
        winner = mode === 'cpu' ? 'you win' : 'left wins';
        notify({ title: 'game won', body: winner, icon: '🏓' });
      } else {
        resetBall(false);
      }
    }
  }

  function updateStatus() {
    if (gameOver) {
      statusLine.textContent = `${winner} (${leftScore} - ${rightScore}) · click TV to rematch`;
    } else if (isPaused) {
      statusLine.textContent = `paused · score: ${leftScore} - ${rightScore} · press Space to resume`;
    } else {
      statusLine.textContent = `score: ${leftScore} - ${rightScore} (first to 5) · W/S controls left`;
    }
  }

  function loop() {
    if (isPlaying) {
      updatePhysics();
      renderGame();
      animId = requestAnimationFrame(loop);
    }
  }

  function startOrResume() {
    if (!isPlaying) {
      // Create canvas on demand
      isPlaying = true;
      preOverlay.remove();

      canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      canvas.className = 'live-gamehub__canvas';
      canvas.setAttribute('aria-label', 'Paddle duel game');
      tv.appendChild(canvas);
      ctx = canvas.getContext('2d');

      resetBall();
      animId = requestAnimationFrame(loop);
    } else if (gameOver) {
      gameOver = false;
      leftScore = 0;
      rightScore = 0;
      resetBall();
    } else if (isPaused) {
      isPaused = false;
      updateStatus();
    }

    tv.focus();
    setSiteKeysSuspended(true);
    updateStatus();
  }

  function pauseGame() {
    if (!isPlaying || isPaused || gameOver) return;
    isPaused = true;
    setSiteKeysSuspended(false);
    updateStatus();
    renderGame();
  }

  playBtn.addEventListener('click', startOrResume);

  tv.addEventListener('click', () => {
    if (!isPlaying) {
      startOrResume();
    } else if (gameOver) {
      startOrResume();
    } else if (isPaused) {
      isPaused = false;
      setSiteKeysSuspended(true);
      updateStatus();
    }
  });

  tv.addEventListener('focus', () => {
    if (isPlaying && !gameOver) {
      setSiteKeysSuspended(true);
    }
  });

  tv.addEventListener('blur', () => {
    setSiteKeysSuspended(false);
    pauseGame();
  });

  // Game controls on TV element
  tv.addEventListener('keydown', (e) => {
    if (!isPlaying) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      pauseGame();
      tv.blur();
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (isPaused) {
        isPaused = false;
        setSiteKeysSuspended(true);
      } else {
        pauseGame();
      }
      updateStatus();
      return;
    }

    const k = e.key.toLowerCase();
    if (k === 'w') {
      e.preventDefault();
      keysDown.w = true;
      leftY = Math.max(2, leftY - 4);
      tv.setAttribute('data-left-y', String(Math.round(leftY)));
    } else if (k === 's') {
      e.preventDefault();
      keysDown.s = true;
      leftY = Math.min(H - PADDLE_H - 2, leftY + 4);
      tv.setAttribute('data-left-y', String(Math.round(leftY)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      keysDown.up = true;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      keysDown.down = true;
    }
  });

  tv.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w') keysDown.w = false;
    if (k === 's') keysDown.s = false;
    if (e.key === 'ArrowUp') keysDown.up = false;
    if (e.key === 'ArrowDown') keysDown.down = false;
  });

  // Touch controls on phones
  function bindPhoneTouch(phoneEl, isLeft) {
    phoneEl.style.touchAction = 'none';
    let tracking = false;

    phoneEl.addEventListener('pointerdown', (e) => {
      tracking = true;
      try {
        phoneEl.setPointerCapture(e.pointerId);
      } catch {}
      handleMove(e);
    });

    const handleMove = (e) => {
      if (!tracking) return;
      const rect = phoneEl.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      const targetPos = Math.max(2, Math.min(H - PADDLE_H - 2, ratio * H - PADDLE_H / 2));
      if (isLeft) {
        leftY = targetPos;
        tv.setAttribute('data-left-y', String(Math.round(leftY)));
      } else if (mode === '2p') {
        rightY = targetPos;
      }
    };

    phoneEl.addEventListener('pointermove', handleMove);
    const stopTracking = (e) => {
      tracking = false;
      if (e && e.pointerId) {
        try {
          phoneEl.releasePointerCapture(e.pointerId);
        } catch {}
      }
    };
    phoneEl.addEventListener('pointerup', stopTracking);
    phoneEl.addEventListener('pointercancel', stopTracking);
  }

  bindPhoneTouch(leftPhone, true);
  bindPhoneTouch(rightPhone, false);

  // Mode toggling
  cpuChip.addEventListener('click', () => {
    mode = 'cpu';
    cpuChip.classList.add('is-active');
    cpuChip.setAttribute('aria-pressed', 'true');
    p2Chip.classList.remove('is-active');
    p2Chip.setAttribute('aria-pressed', 'false');
    rightPhone.querySelector('.live-gamehub__phone-label').textContent = 'P2 (CPU)';
  });

  p2Chip.addEventListener('click', () => {
    mode = '2p';
    p2Chip.classList.add('is-active');
    p2Chip.setAttribute('aria-pressed', 'true');
    cpuChip.classList.remove('is-active');
    cpuChip.setAttribute('aria-pressed', 'false');
    rightPhone.querySelector('.live-gamehub__phone-label').textContent = 'P2 (↑/↓)';
  });

  // Pause on hidden document
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseGame();
    }
  });

  return () => {
    if (animId) cancelAnimationFrame(animId);
    setSiteKeysSuspended(false);
  };
}
