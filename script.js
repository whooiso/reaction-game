const game = document.getElementById("game");
const message = document.getElementById("message");
const subtitle = document.getElementById("subtitle");

let state = "idle"; // idle | waiting | ready | result | early
let timeoutId = null;
let startTime = 0;

function setState(newState) {
  state = newState;
  game.className = "state-" + newState;
}

function startWaiting() {
  setState("waiting");
  message.textContent = "Wait for green...";
  subtitle.textContent = "";

  const delay = 1000 + Math.random() * 4000; // 1–5 seconds
  timeoutId = setTimeout(() => {
    setState("ready");
    message.textContent = "Click!";
    startTime = performance.now();
  }, delay);
}

function showResult() {
  const reactionTime = Math.round(performance.now() - startTime);
  setState("result");
  message.textContent = reactionTime + " ms";
  subtitle.textContent = "Click to try again";
}

function tooEarly() {
  clearTimeout(timeoutId);
  setState("early");
  message.textContent = "Too early!";
  subtitle.textContent = "Click to try again";
}

game.addEventListener("click", () => {
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
