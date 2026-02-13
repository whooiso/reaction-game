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
const donkeyEmoji = document.getElementById("donkey-emoji");
const donkeyLabel = document.getElementById("donkey-label");
const floatContainer = document.getElementById("float-container");

// --- Constants ---
const GAME_DURATION = 30;
const SPAWN_DELAY_MIN = 400;
const SPAWN_DELAY_MAX = 1200;
const PINATA_CHANCE = 0.65;

// Safe zone: keep donkeys away from edges
const MARGIN_TOP = 80;   // below HUD
const MARGIN_SIDE = 30;
const MARGIN_BOTTOM = 30;
const DONKEY_SIZE = 90;   // approximate rendered size

// --- Audio (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playPop() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  // Bright two-tone ding: quick rise
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

  // Low dull buzz that drops off
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

// --- Donkey spawning ---
function spawnDonkey() {
  if (!running) return;

  // Pick type
  currentType = Math.random() < PINATA_CHANCE ? "pinata" : "real";

  // Pick random position within the arena
  const maxX = window.innerWidth - DONKEY_SIZE - MARGIN_SIDE;
  const maxY = window.innerHeight - DONKEY_SIZE - MARGIN_BOTTOM;
  const x = MARGIN_SIDE + Math.random() * (maxX - MARGIN_SIDE);
  const y = MARGIN_TOP + Math.random() * (maxY - MARGIN_TOP);

  donkey.style.left = x + "px";
  donkey.style.top = y + "px";

  // Set appearance
  if (currentType === "pinata") {
    donkeyEmoji.textContent = "\uD83C\uDF89"; // party popper as pinata stand-in
    donkeyLabel.textContent = "pinata";
  } else {
    donkeyEmoji.textContent = "\uD83D\uDC34"; // horse/donkey face
    donkeyLabel.textContent = "real";
  }

  donkey.className = "visible " + currentType;
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
donkey.addEventListener("click", (e) => {
  if (!running || donkey.classList.contains("clicked")) return;

  const rect = donkey.getBoundingClientRect();
  const floatX = rect.left + rect.width / 2 - 10;
  const floatY = rect.top;

  if (currentType === "pinata") {
    score++;
    showFloat(floatX, floatY, "+1", true);
    playPop();
  } else {
    score--;
    showFloat(floatX, floatY, "-1", false);
    playError();
  }

  scoreEl.textContent = score;

  // Shrink-out animation, then schedule next
  donkey.classList.add("clicked");
  donkey.classList.remove("visible");
  setTimeout(() => {
    hideDonkey();
    scheduleNextSpawn();
  }, 200);
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

  // First spawn after a short beat
  spawnTimeout = setTimeout(spawnDonkey, 600);
  timerInterval = setInterval(tick, 1000);
}

function endGame() {
  running = false;
  clearInterval(timerInterval);
  clearTimeout(spawnTimeout);
  hideDonkey();

  // Check high score
  let newBest = false;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("donkeyHighScore", highScore);
    highScoreEl.textContent = highScore;
    newBest = true;
  }

  // Show game-over overlay
  overlayTitle.textContent = "Time's up!";
  const lines = ["Final score: " + score];
  if (newBest && score > 0) lines.push("New high score!");
  overlaySub.innerHTML = lines.join("<br>");
  startBtn.textContent = "Play Again";
  overlay.classList.add("visible");
}

// --- Start button ---
startBtn.addEventListener("click", () => {
  // Resume AudioContext on first user gesture (browser policy)
  if (audioCtx.state === "suspended") audioCtx.resume();
  startGame();
});
