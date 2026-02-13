const game = document.getElementById("game");
const message = document.getElementById("message");
const subtitle = document.getElementById("subtitle");
const difficultySelect = document.getElementById("difficulty");
const resetPbBtn = document.getElementById("reset-pb");

const statLast = document.getElementById("stat-last");
const statBest = document.getElementById("stat-best");
const statAvg = document.getElementById("stat-avg");
const statTries = document.getElementById("stat-tries");
const statStreak = document.getElementById("stat-streak");
const statPb = document.getElementById("stat-pb");

const DIFFICULTIES = {
  chill:  [1000, 3000],
  normal: [2000, 6000],
  insane: [3000, 10000],
};

let state = "idle";
let timeoutId = null;
let startTime = 0;

// Session stats
let times = [];
let streak = 0;

// Personal best from localStorage
let personalBest = Number(localStorage.getItem("reactionPB")) || null;
if (personalBest) statPb.textContent = personalBest + " ms";

// --- Confetti ---
const confettiCanvas = document.getElementById("confetti");
const ctx = confettiCanvas.getContext("2d");
let particles = [];
let confettiAnimId = null;

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeConfetti();
window.addEventListener("resize", resizeConfetti);

function spawnConfetti() {
  particles = [];
  const colors = ["#f1c40f", "#e74c3c", "#2ecc71", "#3498db", "#e67e22", "#9b59b6"];
  const cx = confettiCanvas.width / 2;
  const cy = confettiCanvas.height / 2;

  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: 0.01 + Math.random() * 0.015,
    });
  }

  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  animateConfetti();
}

function animateConfetti() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  let alive = false;

  for (const p of particles) {
    if (p.life <= 0) continue;
    alive = true;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12; // gravity
    p.life -= p.decay;

    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  ctx.globalAlpha = 1;

  if (alive) {
    confettiAnimId = requestAnimationFrame(animateConfetti);
  } else {
    confettiAnimId = null;
  }
}

// --- State management ---
function setState(newState) {
  state = newState;
  game.className = "state-" + newState;
}

function getDelay() {
  const [min, max] = DIFFICULTIES[difficultySelect.value] || DIFFICULTIES.normal;
  return min + Math.random() * (max - min);
}

function startWaiting() {
  setState("waiting");
  message.textContent = "Wait for green...";
  subtitle.textContent = "";

  timeoutId = setTimeout(() => {
    setState("ready");
    message.textContent = "Click!";
    startTime = performance.now();
  }, getDelay());
}

function showResult() {
  const reactionTime = Math.round(performance.now() - startTime);
  times.push(reactionTime);

  // Streak
  if (reactionTime < 250) {
    streak++;
  } else {
    streak = 0;
  }

  // Check personal best
  let newPb = false;
  if (!personalBest || reactionTime < personalBest) {
    personalBest = reactionTime;
    localStorage.setItem("reactionPB", personalBest);
    newPb = true;
  }

  setState("result");
  message.textContent = reactionTime + " ms";
  subtitle.textContent = newPb ? "New personal best!" : "Click to try again";

  updateStats();

  if (newPb) spawnConfetti();
}

function tooEarly() {
  clearTimeout(timeoutId);
  streak = 0;
  setState("early");
  message.textContent = "Too soon!";
  subtitle.textContent = "Click to restart";
  updateStats();
}

function updateStats() {
  const last = times[times.length - 1];
  const best = Math.min(...times);
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

  statLast.textContent = last ? last + " ms" : "—";
  statBest.textContent = times.length ? best + " ms" : "—";
  statAvg.textContent = times.length ? avg + " ms" : "—";
  statTries.textContent = times.length;
  statStreak.textContent = streak;
  statPb.textContent = personalBest ? personalBest + " ms" : "—";
}

// --- Events ---
game.addEventListener("click", (e) => {
  // Ignore clicks on controls
  if (e.target.closest("#controls") || e.target.closest("#reset-pb")) return;

  switch (state) {
    case "idle":
    case "result":
    case "early":
      startWaiting();
      break;
    case "waiting":
      tooEarly();
      break;
    case "ready":
      showResult();
      break;
  }
});

// Stop dropdown clicks from triggering the game
difficultySelect.addEventListener("click", (e) => e.stopPropagation());

resetPbBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  personalBest = null;
  localStorage.removeItem("reactionPB");
  statPb.textContent = "—";
});
