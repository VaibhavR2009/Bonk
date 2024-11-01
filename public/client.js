const socket = io();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let players = {};
let keys = {};
let aiming = false;

// Popup for username input
const usernamePopup = document.getElementById("usernamePopup");
const usernameInput = document.getElementById("usernameInput");
const joinButton = document.getElementById("joinButton");

// Event listeners to track key presses
window.addEventListener("keydown", (event) => {
  keys[event.key] = true;
});

window.addEventListener("keyup", (event) => {
  keys[event.key] = false;
  if (event.key === "z") {
    const player = players[socket.id];
    const cooldownDuration = 2000; // 2 seconds cooldown
    const cooldownElapsed = Date.now() - player.lastArrowShotTime;

    // Check if cooldown has finished before shooting
    if (cooldownElapsed >= cooldownDuration) {
      socket.emit("releaseArrow");
      aiming = false;
    }
  }
});

// Join game after entering username
joinButton.addEventListener("click", () => {
  const username = usernameInput.value || "Guest";
  socket.emit("setUsername", username);
  usernamePopup.style.display = "none";
});

// Get current players and game state from server
socket.on("currentPlayers", (serverPlayers) => {
  players = serverPlayers;
});

socket.on("newPlayer", ({ id, player }) => {
  players[id] = player;
});

socket.on("gameState", (serverPlayers) => {
  players = serverPlayers;
});

socket.on("playerDisconnected", (id) => {
  delete players[id];
});

function drawPlayers() {
  // Clear the canvas for each frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let id in players) {
    const player = players[id];
    if (player.isDead) continue; // Skip rendering for dead players

    // Draw player circle
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, 2 * Math.PI);
    ctx.fillStyle = player.color;
    ctx.fill();

    // Draw username above player
    ctx.font = "12px Arial";
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.fillText(player.username, player.x, player.y - player.radius - 10);

    // Draw the pointer if aiming
    if (player.isAiming) {
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      const pointerX = player.x + Math.cos(player.aimAngle) * 30;
      const pointerY = player.y + Math.sin(player.aimAngle) * 30;
      ctx.lineTo(pointerX, pointerY);
      ctx.strokeStyle = player.color;
      ctx.stroke();
    }

    // Draw the arrow if it exists
    if (player.arrow) {
      ctx.fillStyle = player.arrow.color;
      ctx.fillRect(
        player.arrow.x,
        player.arrow.y,
        player.arrow.width,
        player.arrow.height
      );
    }

    // Draw the cooldown loading bar if cooldown is active
    if (player.lastArrowShotTime) {
      const cooldownDuration = 2000; // 2-second cooldown
      const timeSinceShot = Date.now() - player.lastArrowShotTime;
      if (timeSinceShot < cooldownDuration) {
        // Draw background for loading bar
        const barWidth = 30;
        const barHeight = 5;
        const barX = player.x - barWidth / 2;
        const barY = player.y + player.radius + 10;
        ctx.fillStyle = "gray";
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Draw loading progress on the bar
        const progress = Math.min(timeSinceShot / cooldownDuration, 1);
        ctx.fillStyle = "green";
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);
      }
    }
  }
}

function gameLoop() {
  // Send movement and aiming data to server
  const moveData = {
    left: keys["ArrowLeft"] || keys["A"] || (keys["a"] && !keys["z"]),
    right: keys["ArrowRight"] || keys["D"] || (keys["d"] && !keys["z"]),
    jump: keys["ArrowUp"] || keys["W"] || keys["w"],
    aiming: keys["z"],
    rotateLeft: keys["ArrowLeft"] || keys["A"] || (keys["a"] && keys["z"]),
    rotateRight: keys["ArrowRight"] || keys["D"] || (keys["d"] && keys["z"]),
  };
  socket.emit("movePlayer", moveData);

  drawPlayers();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const sendButton = document.getElementById("sendButton");

// Send message on button click
sendButton.addEventListener("click", () => {
  const message = chatInput.value.trim();
  if (message) {
    socket.emit("sendMessage", message);
    chatInput.value = "";
  }
});

// Send message on "Enter" key press
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const message = chatInput.value.trim();
    if (message) {
      socket.emit("sendMessage", message);
      chatInput.value = "";
    }
  }
});

// Display incoming messages
socket.on("receiveMessage", ({ username, message }) => {
  const messageElement = document.createElement("div");
  messageElement.textContent = `${username}: ${message}`;
  chatMessages.appendChild(messageElement);

  // Automatically scroll to the latest message
  chatMessages.scrollTop = chatMessages.scrollHeight;
});
