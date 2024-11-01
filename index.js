const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let players = {};
const gravity = 0.05;
const friction = 0.85;
const arrowGravity = 0.003; // Gravity specifically for arrows
const maxSpeed = 5.5;
const acceleration = 0.2;
const jumpStrength = 3;

io.on("connection", (socket) => {
  console.log("New player connected: ${socket.id}");

  function spawnPlayer() {
    const randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16);
    return {
      x: Math.random() * 800,
      y: 0,
      radius: 15,
      velocityX: 0,
      velocityY: 0,
      onGround: false,
      color: randomColor,
      username: "Guest",
      arrow: null,
      isAiming: false,
      aimAngle: 0,
      isDead: false,
      respawnTime: 0,
      lastArrowShotTime: 0,
    };
  }

  players[socket.id] = spawnPlayer();

  socket.emit("currentPlayers", players);
  socket.broadcast.emit("newPlayer", {
    id: socket.id,
    player: players[socket.id],
  });

  socket.on("setUsername", (username) => {
    if (players[socket.id]) players[socket.id].username = username || "Guest";
  });

  socket.on("movePlayer", (data) => {
    const player = players[socket.id];
    if (player && !player.isDead) {
      if (data.aiming) {
        player.isAiming = true;
        if (data.rotateLeft) player.aimAngle -= 0.05;
        if (data.rotateRight) player.aimAngle += 0.05;
      } else {
        player.isAiming = false;
        if (data.left) player.velocityX -= acceleration;
        if (data.right) player.velocityX += acceleration;
        player.velocityX = Math.max(
          -maxSpeed,
          Math.min(maxSpeed, player.velocityX)
        );
        player.velocityX *= friction;
      }

      if (data.jump && player.onGround) {
        player.velocityY = -jumpStrength;
        player.onGround = false;
      }
    }
  });

  socket.on("releaseArrow", () => {
    const player = players[socket.id];
    const currentTime = Date.now();

    if (player && !player.isDead) {
      if (currentTime - player.lastArrowShotTime >= 2000) {
        const arrowSpeed = 3; // Slow down arrow speed
        player.arrow = {
          x: player.x,
          y: player.y,
          width: 20,
          height: 5,
          velocityX: Math.cos(player.aimAngle) * arrowSpeed,
          velocityY: Math.sin(player.aimAngle) * arrowSpeed,
          color: player.color,
        };
        player.isAiming = false;
        player.lastArrowShotTime = currentTime;
      }
    }
  });

  function checkCollision(player, arrow) {
    return (
      arrow.x < player.x + player.radius &&
      arrow.x + arrow.width > player.x - player.radius &&
      arrow.y < player.y + player.radius &&
      arrow.y + arrow.height > player.y - player.radius
    );
  }

  setInterval(() => {
    const currentTime = Date.now();
    for (let id in players) {
      const player = players[id];
      if (!player) continue;

      if (player.isDead && currentTime > player.respawnTime) {
        players[id] = { ...spawnPlayer(), username: player.username };
        continue;
      }

      if (!player.isDead) {
        player.velocityY += gravity;
        player.y += player.velocityY;
        player.x += player.velocityX;

        if (player.y + player.radius >= 600) {
          player.y = 600 - player.radius;
          player.velocityY = 0;
          player.onGround = true;
        } else {
          player.onGround = false;
        }

        if (player.x - player.radius < 0) player.x = player.radius;
        if (player.x + player.radius > 800) player.x = 800 - player.radius;

        if (player.arrow) {
          player.arrow.velocityY += arrowGravity; // Apply gravity to arrow
          player.arrow.x += player.arrow.velocityX;
          player.arrow.y += player.arrow.velocityY;

          for (let targetId in players) {
            const targetPlayer = players[targetId];
            if (
              targetPlayer &&
              targetId !== id &&
              !targetPlayer.isDead &&
              checkCollision(targetPlayer, player.arrow)
            ) {
              targetPlayer.isDead = true;
              targetPlayer.respawnTime = currentTime + 5000;
              player.arrow = null;
              break;
            }
          }

          if (
            player.arrow &&
            (player.arrow.x <= 0 ||
              player.arrow.x + player.arrow.width >= 800 ||
              player.arrow.y <= 0 ||
              player.arrow.y + player.arrow.height >= 600)
          ) {
            player.arrow = null; // Stop arrow at screen boundaries
          }
        }
      }
    }

    io.emit("gameState", players);
  }, 1000 / 60);

  socket.on("disconnect", () => {
    console.log("Player disconnected: ${socket.id}");
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

server.listen(PORT, () => {
  console.log("Server running on port ${PORT}");
});
