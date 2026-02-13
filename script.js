// --- DOM refs ---
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");
const timerDisplay = document.getElementById("timer-display");
const highScoreEl = document.getElementById("high-score");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlaySub = document.getElementById("overlay-sub");
const startBtn = document.getElementById("start-btn");
const donkey = document.getElementById("donkey");
const donkeyImg = document.getElementById("donkey-img");
const floatContainer = document.getElementById("float-container");
const flashOverlay = document.getElementById("flash-overlay");

// --- Constants ---
const GAME_DURATION = 30;
const SPAWN_DELAY_MIN = 400;
const SPAWN_DELAY_MAX = 1200;
const PINATA_CHANCE = 0.65;

const IMG_PINATA = "assets/pinata.png";
const IMG_REAL = "assets/real-donkey.png";

// --- Preload images ---
const preloadPinata = new Image();
preloadPinata.src = IMG_PINATA;
const preloadReal = new Image();
preloadReal.src = IMG_REAL;

// --- Audio (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playPop() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.08);

  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.2);
}

function playError() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = "triangle";
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.18);

  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.25);
}

// --- State ---
let score = 0;
let timeLeft = GAME_DURATION;
let timerInterval = null;
let spawnTimeout = null;
let running = false;
let currentType = null; // "pinata" | "real"

// High score from localStorage
let highScore = Number(localStorage.getItem("donkeyHighScore")) || 0;
highScoreEl.textContent = highScore;

// --- Floating score feedback ---
function showFloat(x, y, text, positive) {
  const el = document.createElement("div");
  el.className = "float-text " + (positive ? "positive" : "negative");
  el.textContent = text;
  el.style.left = x + "px";
  el.style.top = y + "px";
  floatContainer.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

// --- Red flash ---
function flashRed() {
  flashOverlay.classList.add("active");
  setTimeout(() => flashOverlay.classList.remove("active"), 200);
}

// --- Donkey spawning (centered) ---
function spawnDonkey() {
  if (!running) return;

  currentType = Math.random() < PINATA_CHANCE ? "pinata" : "real";
  donkeyImg.src = currentType === "pinata" ? IMG_PINATA : IMG_REAL;

  donkey.className = "visible";
}

function hideDonkey() {
  donkey.className = "hidden";
  currentType = null;
}

function scheduleNextSpawn() {
  const delay = SPAWN_DELAY_MIN + Math.random() * (SPAWN_DELAY_MAX - SPAWN_DELAY_MIN);
  spawnTimeout = setTimeout(spawnDonkey, delay);
}

// --- Click handler ---
donkey.addEventListener("click", () => {
  if (!running || donkey.className === "hidden") return;
  // Prevent double-clicks during hit animation
  if (donkey.className.startsWith("hit-")) return;

  const rect = donkey.getBoundingClientRect();
  const floatX = rect.left + rect.width / 2 - 10;
  const floatY = rect.top;

  if (currentType === "pinata") {
    score++;
    showFloat(floatX, floatY, "+1", true);
    playPop();
    donkey.className = "hit-pinata";
  } else {
    score--;
    showFloat(floatX, floatY, "-1", false);
    playError();
    flashRed();
    donkey.className = "hit-real";
  }

  scoreEl.textContent = score;

  // Wait for animation to finish, then hide and schedule next
  const delay = currentType === "pinata" ? 350 : 400;
  setTimeout(() => {
    hideDonkey();
    scheduleNextSpawn();
  }, delay);
});

// --- Timer ---
function tick() {
  timeLeft--;
  timerEl.textContent = timeLeft;

  if (timeLeft <= 5) {
    timerDisplay.classList.add("urgent");
  }

  if (timeLeft <= 0) {
    endGame();
  }
}

// --- Game lifecycle ---
function startGame() {
  score = 0;
  timeLeft = GAME_DURATION;
  running = true;
  scoreEl.textContent = "0";
  timerEl.textContent = timeLeft;
  timerDisplay.classList.remove("urgent");

  overlay.classList.remove("visible");
  hideDonkey();

  spawnTimeout = setTimeout(spawnDonkey, 600);
  timerInterval = setInterval(tick, 1000);
}

function endGame() {
  running = false;
  clearInterval(timerInterval);
  clearTimeout(spawnTimeout);
  hideDonkey();

  let newBest = false;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("donkeyHighScore", highScore);
    highScoreEl.textContent = highScore;
    newBest = true;
  }

  overlayTitle.textContent = "Time's up!";
  const lines = ["Final score: " + score];
  if (newBest && score > 0) lines.push("New high score!");
  overlaySub.innerHTML = lines.join("<br>");
  startBtn.textContent = "Play Again";
  overlay.classList.add("visible");
}

// --- Start button ---
startBtn.addEventListener("click", () => {
  if (audioCtx.state === "suspended") audioCtx.resume();
  startGame();
});
