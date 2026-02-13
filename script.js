// --- DOM refs ---
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");
const timerDisplay = document.getElementById("timer-display");
const highScoreEl = document.getElementById("high-score");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlaySub = document.getElementById("overlay-sub");
const startBtn = document.getElementById("start-btn");
const arena = document.getElementById("arena");
const floatContainer = document.getElementById("float-container");
const flashOverlay = document.getElementById("flash-overlay");
const muteBtn = document.getElementById("mute-btn");
const confettiCanvas = document.getElementById("confetti-canvas");
const confettiCtx = confettiCanvas.getContext("2d");

// --- Constants ---
const GAME_DURATION = 30;
const TARGET_SIZE = 120;
const MARGIN_TOP = 70;
const MARGIN = 20;
const MIN_DIST = 140;
const GOLDEN_CHANCE = 0.08;
const REAL_CHANCE = 0.30;

// Async spawn settings
const SPAWN_INTERVAL_MIN = 200;
const SPAWN_INTERVAL_MAX = 450;
const MAX_ON_SCREEN = 5;
const LIFETIME_MIN = 900;
const LIFETIME_MAX = 1400;

const SPEECH_LINES = [
  "&$#@!", "HEY!", "BONK?!", "RUDE!", "NOPE!", "?!?",
  "\u041A\u041E\u0417\u0415\u0420\u041E\u0413!!!"  // КОЗЕРОГ!!!
];

const IMG_PINATA = "assets/images/pinata.png";
const IMG_REAL = "assets/images/real-donkey.png";
const IMG_BG = "assets/images/grass.jpeg";


// --- Preload images ---
const preloadPinata = new Image();
preloadPinata.src = IMG_PINATA;
const preloadReal = new Image();
preloadReal.src = IMG_REAL;

// --- Audio (MP3, iPad-safe) ---
let muted = localStorage.getItem("muted") === "1";
muteBtn.textContent = muted ? "🔇" : "🔊";

const SND_PINATA = "assets/sounds/pinatas.mp3";
const SND_DONKEY = "assets/sounds/donkeys.mp3";

// We create new Audio instances on demand for rapid overlaps (multiple taps).
// But we "unlock" once on first user gesture so iPad/Safari allows playback.
let audioUnlocked = false;

function unlockAudioOnce() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  // Attempt a silent play/pause to unlock audio on iOS/Safari
  [SND_PINATA, SND_DONKEY].forEach((src) => {
    try {
      const a = new Audio(src);
      a.muted = true;
      a.play().then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
      }).catch(() => {
        // ignore; still counts as "gesture happened"
      });
    } catch (_) {}
  });
}

// Call this before any sound play (safe to call repeatedly)
function ensureUnlocked() {
  if (!audioUnlocked) unlockAudioOnce();
}

function playSfx(src, { volume = 1, playbackRate = 1 } = {}) {
  if (muted) return;
  ensureUnlocked();

  try {
    const a = new Audio(src);
    a.volume = volume;
    a.playbackRate = playbackRate;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch (_) {}
}

function playPop() {
  playSfx(SND_PINATA, { volume: 0.9 });
}

function playBray() {
  playSfx(SND_DONKEY, { volume: 0.95 });
}

// Keep a "golden" sound: reuse pinata but higher pitch + slightly louder
function playGolden() {
  playSfx(SND_PINATA, { volume: 1.0, playbackRate: 1.25 });
}

// --- Mute toggle ---
muteBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  muted = !muted;
  localStorage.setItem("muted", muted ? "1" : "0");
  muteBtn.textContent = muted ? "🔇" : "🔊";
});

// Unlock audio on first interaction (important for iPad)
document.addEventListener("pointerdown", unlockAudioOnce, { once: true });
document.addEventListener("touchstart", unlockAudioOnce, { once: true, passive: true });


// --- Mute toggle ---
muteBtn.addEventListener("click", () => {
  muted = !muted;
  muteBtn.textContent = muted ? "\uD83D\uDD07" : "\uD83D\uDD0A";
});

// --- State ---
let score = 0;
let timeLeft = GAME_DURATION;
let timerInterval = null;
let spawnTimerId = null;
let running = false;
let activeTargets = [];

// Stats
let hits = 0;
let misses = 0;
let streak = 0;
let bestStreak = 0;

// High score
let highScore = Number(localStorage.getItem("donkeyHighScore")) || 0;
highScoreEl.textContent = highScore;

// --- Confetti ---
let particles = [];
let confettiAnimId = null;

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeConfetti();
window.addEventListener("resize", resizeConfetti);

function spawnConfetti(cx, cy) {
  const colors = ["#f1c40f", "#e67e22", "#e74c3c", "#2ecc71", "#3498db", "#9b59b6"];
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: 0.012 + Math.random() * 0.014,
    });
  }
  if (!confettiAnimId) animateConfetti();
}

function animateConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  let alive = false;
  for (const p of particles) {
    if (p.life <= 0) continue;
    alive = true;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= p.decay;
    confettiCtx.globalAlpha = Math.max(0, p.life);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(p.x, p.y, p.size, p.size);
  }
  confettiCtx.globalAlpha = 1;
  if (alive) {
    confettiAnimId = requestAnimationFrame(animateConfetti);
  } else {
    particles = [];
    confettiAnimId = null;
  }
}

// --- Floating text ---
function showFloat(x, y, text, cls) {
  const el = document.createElement("div");
  el.className = "float-text " + cls;
  el.textContent = text;
  el.style.left = x + "px";
  el.style.top = y + "px";
  floatContainer.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

// --- Red flash ---
function flashRed() {
  flashOverlay.classList.add("active");
  setTimeout(() => flashOverlay.classList.remove("active"), 180);
}

// --- Positioning with collision avoidance ---
function findPosition(maxAttempts) {
  const areaW = window.innerWidth - MARGIN * 2 - TARGET_SIZE;
  const areaH = window.innerHeight - MARGIN_TOP - MARGIN - TARGET_SIZE;

  for (let i = 0; i < maxAttempts; i++) {
    const x = MARGIN + Math.random() * areaW;
    const y = MARGIN_TOP + Math.random() * areaH;
    const cx = x + TARGET_SIZE / 2;
    const cy = y + TARGET_SIZE / 2;

    let ok = true;
    for (const t of activeTargets) {
      const dx = cx - t.cx;
      const dy = cy - t.cy;
      if (Math.sqrt(dx * dx + dy * dy) < MIN_DIST) { ok = false; break; }
    }
    if (ok) return { x, y, cx, cy };
  }
  return null;
}

// --- Pick target type ---
function pickType() {
  const r = Math.random();
  if (r < GOLDEN_CHANCE) return "golden";
  if (r < GOLDEN_CHANCE + REAL_CHANCE) return "real";
  return "pinata";
}

// --- Remove a target from the active list ---
function removeTarget(entry) {
  const idx = activeTargets.indexOf(entry);
  if (idx !== -1) activeTargets.splice(idx, 1);
  clearTimeout(entry.timeoutId);
}

// --- Spawn a single target ---
function spawnTarget(type, pos) {
  const el = document.createElement("div");
  el.className = "target spawning " + type;

  const img = document.createElement("img");
  img.src = type === "real" ? IMG_REAL : IMG_PINATA;
  img.alt = type;
  img.draggable = false;
  el.appendChild(img);

  // Add mouth overlay for real donkeys (used for "mouth open" illusion)
  if (type === "real") {
    const mouthOverlay = document.createElement("div");
    mouthOverlay.className = "mouth-overlay";
    el.appendChild(mouthOverlay);
  }

  el.style.left = pos.x + "px";
  el.style.top = pos.y + "px";

  const entry = { el, type, cx: pos.cx, cy: pos.cy, timeoutId: null, hit: false };

  // Lifetime: auto-expire independently
  const lifetime = LIFETIME_MIN + Math.random() * (LIFETIME_MAX - LIFETIME_MIN);
  entry.timeoutId = setTimeout(() => {
    if (!el.parentNode || entry.hit) return;
    misses++;
    el.className = "target expiring";
    el.addEventListener("animationend", () => el.remove());
    removeTarget(entry);
  }, lifetime);

  // pointerdown handler — each target independently handles its own hit
  el.addEventListener("pointerdown", (e) => {
    if (!running || entry.hit) return;
    // Ignore if already animating out
    if (el.className.includes("hit-") || el.className.includes("expiring")) return;

    e.preventDefault();
    entry.hit = true;
    clearTimeout(entry.timeoutId);
    removeTarget(entry);

    const rect = el.getBoundingClientRect();
    const fx = rect.left + rect.width / 2 - 10;
    const fy = rect.top;

    if (type === "pinata") {
      score++;
      hits++;
      streak++;
      if (streak > bestStreak) bestStreak = streak;
      showFloat(fx, fy, "+1", "positive");
      playPop();
      el.className = "target hit-pinata";
    } else if (type === "real") {
      score--;
      hits++;
      streak = 0;
      showFloat(fx, fy, "-1", "negative");
      playBray();
      flashRed();

      // A) Speech bubble (sometimes)
      if (Math.random() < 0.7) {
        const bubble = document.createElement("div");
        bubble.className = "speech-bubble";
        bubble.textContent = SPEECH_LINES[Math.floor(Math.random() * SPEECH_LINES.length)];
        el.appendChild(bubble);
      }

      // B) "Mouth open" illusion
      const imgEl = el.querySelector("img");
      const mouthOv = el.querySelector(".mouth-overlay");
      if (imgEl) imgEl.classList.add("mouth-open");
      if (mouthOv) mouthOv.classList.add("active");
      setTimeout(() => {
        if (imgEl) imgEl.classList.remove("mouth-open");
        if (mouthOv) mouthOv.classList.remove("active");
      }, 120);

      el.className = "target real hit-real";
    } else {
      // golden
      score += 5;
      hits++;
      streak++;
      if (streak > bestStreak) bestStreak = streak;
      showFloat(fx, fy, "+5", "golden");
      playGolden();
      spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      el.className = "target hit-golden";
    }

    scoreEl.textContent = score;
    el.addEventListener("animationend", () => el.remove());
  });

  arena.appendChild(el);
  activeTargets.push(entry);
}

// --- Async chaotic spawner (replaces wave-based) ---
function scheduleNextSpawn() {
  if (!running) return;
  const delay = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
  spawnTimerId = setTimeout(() => {
    if (!running) return;

    // Only spawn if under the on-screen cap
    if (activeTargets.length < MAX_ON_SCREEN) {
      const type = pickType();
      const pos = findPosition(30);
      if (pos) {
        spawnTarget(type, pos);
      }
    }

    // Schedule the next one regardless
    scheduleNextSpawn();
  }, delay);
}

// --- Timer ---
function tick() {
  timeLeft--;
  timerEl.textContent = timeLeft;
  if (timeLeft <= 5) timerDisplay.classList.add("urgent");
  if (timeLeft <= 0) endGame();
}

// --- Game lifecycle ---
function startGame() {
  score = 0;
  timeLeft = GAME_DURATION;
  hits = 0;
  misses = 0;
  streak = 0;
  bestStreak = 0;
  running = true;

  scoreEl.textContent = "0";
  timerEl.textContent = timeLeft;
  timerDisplay.classList.remove("urgent");

  // Clear any leftover targets
  arena.querySelectorAll(".target").forEach(el => el.remove());
  activeTargets = [];

  overlay.classList.remove("visible");

  // Start async spawner after short delay
  spawnTimerId = setTimeout(scheduleNextSpawn, 300);
  timerInterval = setInterval(tick, 1000);
}

function endGame() {
  running = false;
  clearInterval(timerInterval);
  clearTimeout(spawnTimerId);

  // Expire all remaining targets instantly
  for (const entry of [...activeTargets]) {
    clearTimeout(entry.timeoutId);
    entry.el.remove();
  }
  activeTargets = [];

  // High score
  let newBest = false;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("donkeyHighScore", highScore);
    highScoreEl.textContent = highScore;
    newBest = true;
  }

  const total = hits + misses;
  const accuracy = total > 0 ? Math.round((hits / total) * 100) : 0;

  overlayTitle.textContent = "Time's up!";
  overlaySub.innerHTML =
    (newBest && score > 0 ? "<strong>New high score!</strong><br><br>" : "") +
    '<div class="end-stats">' +
      '<span class="label">Score</span><span class="value">' + score + '</span>' +
      '<span class="label">Hits</span><span class="value">' + hits + '</span>' +
      '<span class="label">Missed</span><span class="value">' + misses + '</span>' +
      '<span class="label">Accuracy</span><span class="value">' + accuracy + '%</span>' +
      '<span class="label">Best streak</span><span class="value">' + bestStreak + '</span>' +
    '</div>';
  startBtn.textContent = "Play Again";
  overlay.classList.add("visible");
}

// --- Start button ---
startBtn.addEventListener("click", () => {
  if (audioCtx.state === "suspended") audioCtx.resume();
  startGame();
});

// Prevent default touch behaviors on the arena during gameplay
arena.addEventListener("touchstart", (e) => {
  if (running && e.target.closest(".target")) {
    e.preventDefault();
  }
}, { passive: false });
