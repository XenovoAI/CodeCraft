const colors = ['red', 'blue', 'green', 'yellow'];
const colorMap = {
  red: '#f87171',
  blue: '#60a5fa',
  green: '#4ade80',
  yellow: '#fbbf24'
};

const state = {
  running: false,
  timeLeft: 60,
  totalTime: 60,
  timerId: null,
  wrongAttempts: 0,
  maxWrongAttempts: 3,
  codeDigits: [],
  revealedDigits: Array(4).fill(null),
  puzzleOrder: [],
  puzzleIndex: 0,
  solved: false,
  briefingOpen: false,
  highScore: Number(localStorage.getItem('defuseHighScore') || 0)
};

const ui = {
  startScreen: document.getElementById('startScreen'),
  gameScreen: document.getElementById('gameScreen'),
  resultScreen: document.getElementById('resultScreen'),
  timer: document.getElementById('timer'),
  dangerMeterFill: document.getElementById('dangerMeterFill'),
  operatorStage: document.getElementById('operatorStage'),
  operatorCaption: document.getElementById('operatorCaption'),
  resultOperatorStage: document.getElementById('resultOperatorStage'),
  resultOperatorCaption: document.getElementById('resultOperatorCaption'),
  digitSlots: document.getElementById('digitSlots'),
  puzzleBox: document.getElementById('puzzleBox'),
  statusMessage: document.getElementById('statusMessage'),
  bestTime: document.getElementById('bestTime'),
  doorInput: document.getElementById('doorInput'),
  keypad: document.getElementById('keypadPanel'),
  resultTag: document.getElementById('resultTag'),
  resultTitle: document.getElementById('resultTitle'),
  resultSummary: document.getElementById('resultSummary'),
  briefingOverlay: document.getElementById('briefingOverlay')
};

const fxCanvas = document.getElementById('fxCanvas');
const fxCtx = fxCanvas.getContext('2d');
let particles = [];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function setStatus(message, failure = false) {
  ui.statusMessage.textContent = message;
  ui.statusMessage.classList.toggle('fail', failure);
}

function updateBestTime() {
  ui.bestTime.textContent = state.highScore > 0 ? `${state.highScore.toFixed(2)}s` : '--';
}

function formatTimer(value) {
  return `${Math.max(0, value).toFixed(2).padStart(5, '0')}`;
}

function updateTimerDisplay() {
  ui.timer.textContent = formatTimer(state.timeLeft);
  ui.timer.classList.toggle('critical', state.timeLeft <= 10);
  const meterValue = state.totalTime > 0 ? (state.timeLeft / state.totalTime) * 100 : 0;
  ui.dangerMeterFill.style.width = `${Math.max(0, Math.min(100, meterValue))}%`;
  if (state.running && state.timeLeft <= 12) {
    setOperatorState('nervous', 'Bomb critical - move!');
  }
}

function setOperatorState(stateName, caption) {
  ui.operatorStage.classList.remove('live', 'nervous', 'dead', 'victory');
  ui.operatorStage.classList.add(stateName);
  ui.operatorCaption.textContent = caption;
  if (ui.resultOperatorStage) {
    ui.resultOperatorStage.classList.remove('live', 'nervous', 'dead', 'victory');
    ui.resultOperatorStage.classList.add(stateName);
    ui.resultOperatorCaption.textContent = caption;
  }
}

function flashScreenEffect(type = 'blast') {
  const overlay = document.createElement('div');
  overlay.className = `fx-overlay ${type} show`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 780);
}

function shakeGameScreen() {
  ui.gameScreen.classList.remove('shake');
  void ui.gameScreen.offsetWidth;
  ui.gameScreen.classList.add('shake');
}

function ensureAudio() {
  if (!window.audioCtx) {
    window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (window.audioCtx.state === 'suspended') {
    window.audioCtx.resume();
  }
}

function playTone(freq, duration = 0.12, wave = 'square', volume = 0.05, startDelay = 0) {
  ensureAudio();
  const osc = window.audioCtx.createOscillator();
  const gain = window.audioCtx.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(window.audioCtx.destination);
  const when = window.audioCtx.currentTime + startDelay;
  osc.start(when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.stop(when + duration);
}

function playClick() { playTone(620, 0.08, 'square', 0.03); }
function playSuccess() {
  playTone(760, 0.12, 'triangle', 0.05);
  setTimeout(() => playTone(900, 0.12, 'triangle', 0.05), 90);
  setTimeout(() => playTone(1040, 0.18, 'triangle', 0.05), 180);
}
function playVictoryFanfare() {
  playTone(660, 0.14, 'triangle', 0.05);
  setTimeout(() => playTone(880, 0.14, 'triangle', 0.05), 120);
  setTimeout(() => playTone(1100, 0.22, 'triangle', 0.055), 220);
  setTimeout(() => playTone(1320, 0.28, 'triangle', 0.07), 360);
}
function playCharacterWarning() {
  playTone(180, 0.12, 'square', 0.035);
  setTimeout(() => playTone(130, 0.16, 'square', 0.035), 130);
}
function playCharacterDeath() {
  playTone(240, 0.2, 'sawtooth', 0.055);
  setTimeout(() => playTone(82, 0.55, 'sawtooth', 0.07), 180);
}
function playWrong() {
  playTone(220, 0.16, 'sawtooth', 0.05);
  setTimeout(() => playTone(140, 0.22, 'sawtooth', 0.05), 150);
}
function playExplosion() {
  playTone(140, 0.25, 'sawtooth', 0.09);
  setTimeout(() => playTone(96, 0.38, 'sawtooth', 0.08), 110);
  setTimeout(() => playTone(60, 0.75, 'sawtooth', 0.08), 220);
  setTimeout(() => playTone(34, 1.1, 'square', 0.06), 330);
}
function playAlarm() {
  playTone(540, 0.08, 'square', 0.04);
}

function showBriefing() {
  state.briefingOpen = true;
  ui.briefingOverlay.classList.remove('hidden');
}

function launchMission() {
  if (!state.briefingOpen) return;
  state.briefingOpen = false;
  state.running = true;
  ui.briefingOverlay.classList.add('hidden');
  setOperatorState('live', 'Ready to escape');
  generatePuzzle();
  startTimer();
  playSuccess();
}

function renderDigitSlots() {
  ui.digitSlots.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const value = state.revealedDigits[i] ?? '?';
    const slot = document.createElement('div');
    slot.className = `digit-slot ${value !== '?' ? 'filled' : ''}`;
    slot.textContent = value;
    ui.digitSlots.appendChild(slot);
  }
}

function showScreen(screen) {
  const screens = [ui.startScreen, ui.gameScreen, ui.resultScreen];
  screens.forEach((node) => node.classList.toggle('active', node === screen));
}

function spawnParticles(color, count = 170) {
  const rect = fxCanvas.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 1.2;
    const speed = 1.5 + Math.random() * 3.4;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.4,
      life: 60 + Math.random() * 35,
      size: 3 + Math.random() * 5,
      color
    });
  }
}

function animateParticles() {
  const ratio = window.devicePixelRatio || 1;
  fxCanvas.width = window.innerWidth * ratio;
  fxCanvas.height = window.innerHeight * ratio;
  fxCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= 1;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    fxCtx.beginPath();
    fxCtx.fillStyle = p.color;
    fxCtx.globalAlpha = p.life / 90;
    fxCtx.fillRect(p.x, p.y, p.size, p.size);
    fxCtx.closePath();
  }

  if (particles.length > 0) {
    requestAnimationFrame(animateParticles);
  }
}

function startTimer() {
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (!state.running) return;
    state.timeLeft = Math.max(0, state.timeLeft - 0.1);
    updateTimerDisplay();

    if (state.timeLeft <= 10 && Math.floor(state.timeLeft * 10) % 10 === 0) {
      playAlarm();
    }

    if (state.timeLeft <= 0) {
      endGame(false, 'Bomb detonated');
    }
  }, 100);
}

function reduceTime(bySeconds = 3) {
  state.timeLeft = Math.max(0, state.timeLeft - bySeconds);
  updateTimerDisplay();
  playWrong();
  if (state.timeLeft <= 0) {
    endGame(false, 'Bomb detonated');
  }
}

function markWrongAttempt() {
  state.wrongAttempts += 1;
  reduceTime(3);
  if (state.wrongAttempts >= state.maxWrongAttempts) {
    endGame(false, 'Too many wrong inputs');
  }
}

function beginGame() {
  state.running = false;
  state.timeLeft = state.totalTime;
  state.wrongAttempts = 0;
  state.solved = false;
  state.codeDigits = Array.from({ length: 4 }, (_, i) => i + 1).map(() => Math.floor(Math.random() * 10));
  state.revealedDigits = Array(4).fill(null);
  state.puzzleOrder = shuffle(['wire', 'memory', 'math', 'slider']);
  state.puzzleIndex = 0;
  ui.doorInput.value = '';
  ui.keypad.classList.add('kp-disabled');
  setOperatorState('live', 'Ready to escape');
  renderDigitSlots();
  updateTimerDisplay();
  setStatus('Awaiting signal', false);
  ui.puzzleBox.innerHTML = '<div class="puzzle-content"><div class="puzzle-header">Mission briefing</div><div class="helper-text">Review the transmission, then begin defusal.</div></div>';
  showBriefing();
}

function completePuzzle() {
  const currentDigit = state.codeDigits[state.puzzleIndex];
  state.revealedDigits[state.puzzleIndex] = currentDigit;
  renderDigitSlots();
  playSuccess();
  state.puzzleIndex += 1;

  if (state.puzzleIndex >= state.puzzleOrder.length) {
    state.solved = true;
    ui.keypad.classList.remove('kp-disabled');
    setStatus('Door code ready', false);
    return;
  }

  setTimeout(() => {
    generatePuzzle();
  }, 260);
}

function handleWrongPuzzle() {
  setStatus('Signal mismatch', true);
  setOperatorState('nervous', 'That was close');
  playCharacterWarning();
  markWrongAttempt();
}

function renderWirePuzzle() {
  const wires = shuffle(['red', 'blue', 'green', 'yellow']);
  const targetMode = randomFrom(['exact', 'not', 'position']);
  let instruction = '';
  let correctIndex = 0;

  if (targetMode === 'exact') {
    const targetColor = randomFrom(colors);
    correctIndex = wires.indexOf(targetColor);
    instruction = `Cut the wire that is ${targetColor.toUpperCase()}`;
  } else if (targetMode === 'not') {
    const banned = randomFrom(colors);
    correctIndex = wires.findIndex((wire) => wire !== banned);
    if (correctIndex < 0) correctIndex = 0;
    instruction = `Cut the wire that is NOT ${banned.toUpperCase()}`;
  } else {
    correctIndex = Math.floor(Math.random() * wires.length);
    instruction = `Cut the ${['1st', '2nd', '3rd', '4th'][correctIndex]} wire from the left`;
  }

  ui.puzzleBox.innerHTML = `
    <div class="puzzle-content">
      <div class="puzzle-header">Wire cutter</div>
      <div class="helper-text">Follow the instruction exactly.</div>
      <div class="math-question" style="font-size: clamp(1.2rem, 2vw, 1.8rem); margin-bottom: 1.2rem; letter-spacing: 0.1em;">${instruction}</div>
      <div class="wire-grid">
        ${wires.map((color, idx) => `
          <button class="wire-btn" data-index="${idx}" style="background:${colorMap[color]};">
            ${color}
          </button>
        `).join('')}
      </div>
    </div>
  `;

  ui.puzzleBox.querySelectorAll('.wire-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chosen = Number(btn.dataset.index);
      if (chosen === correctIndex) {
        setStatus('Wire cut', false);
        completePuzzle();
      } else {
        handleWrongPuzzle();
      }
    });
  });
}

function renderMemoryPuzzle() {
  const sequenceLength = 3 + Math.floor(Math.random() * 2);
  const sequence = Array.from({ length: sequenceLength }, () => Math.floor(Math.random() * 9));
  const memory = { sequence, index: 0, locked: false };
  const cells = Array.from({ length: 9 }, (_, idx) => idx);
  const previewDelay = 620;

  ui.puzzleBox.innerHTML = `
    <div class="puzzle-content">
      <div class="puzzle-header">Pattern memory</div>
      <div class="helper-text">Watch the pattern and tap it back.</div>
      <div class="matrix-grid">
        ${cells.map((idx) => `
          <button class="matrix-cell" data-index="${idx}"></button>
        `).join('')}
      </div>
    </div>
  `;

  const nodeList = [...ui.puzzleBox.querySelectorAll('.matrix-cell')];

  const flashSequence = () => {
    sequence.forEach((idx, step) => {
      setTimeout(() => {
        const cell = nodeList[idx];
        if (!cell) return;
        cell.classList.add('review');
        cell.classList.add('active');
        playTone(520 + step * 80, 0.12, 'triangle', 0.04);
        setTimeout(() => {
          cell.classList.remove('active');
          cell.classList.remove('review');
          if (step === sequence.length - 1) {
            memory.locked = true;
            setStatus('Repeat the pattern', false);
          }
        }, 360);
      }, step * previewDelay);
    });
  };

  nodeList.forEach((cell) => {
    cell.addEventListener('click', () => {
      if (!memory.locked) return;
      const clickedIndex = Number(cell.dataset.index);
      if (clickedIndex === sequence[memory.index]) {
        cell.classList.add('good');
        playTone(650, 0.08, 'square', 0.04);
        memory.index += 1;
        setTimeout(() => cell.classList.remove('good'), 160);

        if (memory.index === sequence.length) {
          setStatus('Memory match', false);
          setTimeout(() => completePuzzle(), 220);
        }
      } else {
        cell.classList.add('bad');
        playWrong();
        memory.index = 0;
        handleWrongPuzzle();
        shakeGameScreen();
        setTimeout(() => {
          cell.classList.remove('bad');
          nodeList.forEach((n) => n.classList.remove('good', 'bad'));
          setStatus('Pattern reset. Watch again.', true);
        }, 180);
      }
    });
  });

  flashSequence();
}

function renderMathPuzzle() {
  const ops = [
    { op: '+', fn: (a, b) => a + b },
    { op: '-', fn: (a, b) => a - b },
    { op: '*', fn: (a, b) => a * b }
  ];
  const chosen = randomFrom(ops);
  let a = 4 + Math.floor(Math.random() * 12);
  let b = 3 + Math.floor(Math.random() * 11);
  if (chosen.op === '-') {
    [a, b] = [Math.max(a, b), Math.min(a, b)];
  }

  const answer = chosen.fn(a, b);
  const options = new Set([answer]);
  while (options.size < 4) {
    const offset = Math.floor(Math.random() * 9) - 4;
    options.add(answer + offset);
  }

  const values = shuffle([...options]);

  ui.puzzleBox.innerHTML = `
    <div class="puzzle-content">
      <div class="puzzle-header">Math decrypt</div>
      <div class="helper-text">Solve the equation.</div>
      <div class="math-question">${a} ${chosen.op} ${b} = ?</div>
      <div class="answer-grid">
        ${values.map((value) => `
          <button class="answer-btn" data-value="${value}">${value}</button>
        `).join('')}
      </div>
    </div>
  `;

  ui.puzzleBox.querySelectorAll('.answer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = Number(btn.dataset.value);
      if (value === answer) {
        setStatus('Equation solved', false);
        completePuzzle();
      } else {
        handleWrongPuzzle();
      }
    });
  });
}

function renderSliderPuzzle() {
  const target = Math.floor(Math.random() * 71) + 20;
  const initial = Math.min(100, Math.max(0, target + (Math.random() * 18 - 9)));

  ui.puzzleBox.innerHTML = `
    <div class="puzzle-content">
      <div class="puzzle-header">Frequency lock</div>
      <div class="helper-text">Tune to the target value within ±2%.</div>
      <div class="math-question" style="font-size: clamp(1.4rem, 2vw, 2rem); margin-bottom: 1.1rem; letter-spacing: 0.08em;">Set signal to <span id="targetValue">${target}%</span></div>
      <div class="signal-box">
        <input id="sliderControl" type="range" min="0" max="100" value="${Math.round(initial)}" />
        <div class="signal-line" style="margin-top: 0.8rem;">
          <span>0%</span>
          <span id="currentValue">${Math.round(initial)}%</span>
          <span>100%</span>
        </div>
        <button class="signal-btn" style="margin-top: 1rem;">Lock signal</button>
      </div>
    </div>
  `;

  const slider = document.getElementById('sliderControl');
  const currentValue = document.getElementById('currentValue');
  const targetValue = document.getElementById('targetValue');
  const lockButton = ui.puzzleBox.querySelector('.signal-btn');

  slider.addEventListener('input', (e) => {
    currentValue.textContent = `${e.target.value}%`;
  });

  lockButton.addEventListener('click', () => {
    const value = Number(slider.value);
    const expected = Number(targetValue.textContent.replace('%', ''));
    if (Math.abs(value - expected) <= 2) {
      setStatus('Signal locked', false);
      completePuzzle();
    } else {
      handleWrongPuzzle();
    }
  });
}

function generatePuzzle() {
  const type = state.puzzleOrder[state.puzzleIndex];
  if (!type) {
    state.solved = true;
    ui.keypad.classList.remove('kp-disabled');
    setStatus('Door code ready', false);
    return;
  }

  if (type === 'wire') renderWirePuzzle();
  if (type === 'memory') renderMemoryPuzzle();
  if (type === 'math') renderMathPuzzle();
  if (type === 'slider') renderSliderPuzzle();
}

function endGame(won, reason) {
  state.running = false;
  clearInterval(state.timerId);

  if (won) {
    flashScreenEffect('victory');
    setOperatorState('victory', 'You made it out!');
    ui.resultTag.textContent = 'Mission success';
    ui.resultTitle.textContent = 'Escaped';
    const remaining = state.timeLeft;
    ui.resultSummary.innerHTML = `Remaining time: ${remaining.toFixed(2)}s<br>Code: ${state.codeDigits.join('')}`;
    const prev = Number(localStorage.getItem('defuseHighScore') || 0);
    if (remaining > prev) {
      localStorage.setItem('defuseHighScore', String(remaining));
      state.highScore = remaining;
      ui.resultSummary.innerHTML += '<br><span style="color:#67e8f9;">New high score!</span>';
    }
    updateBestTime();
    spawnParticles('#67e8f9', 250);
    spawnParticles('#4ade80', 180);
    spawnParticles('#fbbf24', 110);
    animateParticles();
    playVictoryFanfare();
  } else {
    flashScreenEffect('blast');
    setOperatorState('dead', 'Operator lost');
    ui.resultTag.textContent = 'Mission failed';
    ui.resultTitle.textContent = 'Boom';
    ui.resultSummary.innerHTML = `${reason}<br>Digits collected: ${state.puzzleIndex}`;
    spawnParticles('#f87171', 260);
    spawnParticles('#fbbf24', 140);
    spawnParticles('#fca5a5', 160);
    animateParticles();
    playExplosion();
    playCharacterDeath();
    shakeGameScreen();
  }

  showScreen(ui.resultScreen);
}

function tryUnlock() {
  if (!state.running || !state.solved) return;
  const typed = ui.doorInput.value.trim();
  if (typed.length !== 4) {
    setStatus('Enter 4 digits', true);
    markWrongAttempt();
    return;
  }

  if (typed === state.codeDigits.join('')) {
    endGame(true, 'Door unlocked');
  } else {
    setStatus('Code rejected', true);
    markWrongAttempt();
    ui.doorInput.value = '';
  }
}

function bindControls() {
  document.getElementById('startButton').addEventListener('click', () => {
    ensureAudio();
    playClick();
    beginGame();
    showScreen(ui.gameScreen);
  });

  document.getElementById('briefingStart').addEventListener('click', () => {
    playClick();
    launchMission();
  });

  document.getElementById('briefingSkip').addEventListener('click', () => {
    playClick();
    launchMission();
  });

  document.getElementById('retryButton').addEventListener('click', () => {
    playClick();
    showScreen(ui.startScreen);
  });

  document.querySelectorAll('.key-btn').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.running || !state.solved) return;
      const nextValue = button.textContent.trim();
      if (ui.doorInput.value.length < 4) {
        ui.doorInput.value += nextValue;
        playClick();
      }
    });
  });

  document.getElementById('clearKey').addEventListener('click', () => {
    ui.doorInput.value = '';
    playClick();
  });

  document.getElementById('unlockBtn').addEventListener('click', () => {
    playClick();
    tryUnlock();
  });

  ui.doorInput.addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 4);
  });

  window.addEventListener('keydown', (event) => {
    if (!state.running || !state.solved) return;
    if (/^[0-9]$/.test(event.key) && ui.doorInput.value.length < 4) {
      ui.doorInput.value += event.key;
    }
    if (event.key === 'Backspace') {
      ui.doorInput.value = ui.doorInput.value.slice(0, -1);
    }
    if (event.key === 'Enter') {
      tryUnlock();
    }
  });

  window.addEventListener('resize', () => {
    const ratio = window.devicePixelRatio || 1;
    fxCanvas.width = window.innerWidth * ratio;
    fxCanvas.height = window.innerHeight * ratio;
  });
}

updateBestTime();
renderDigitSlots();
showScreen(ui.startScreen);
updateTimerDisplay();
bindControls();
