const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const playerImg = new Image();
playerImg.src = "b.png";

const enemyImg = new Image();
enemyImg.src = "a.png";

let keys = {};
document.addEventListener("keydown", (e) => keys[e.key] = true);
document.addEventListener("keyup", (e) => keys[e.key] = false);

class Entity {
  constructor(x, y, w, h, img) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.img = img;
    this.alive = true;
  }
  draw() {
    ctx.drawImage(this.img, this.x, this.y, this.w, this.h);
  }
}

class Bullet {
  constructor(x, y, speed, friendly = true) {
    this.x = x;
    this.y = y;
    this.w = 10;
    this.h = 10;
    this.speed = speed;
    this.friendly = friendly;
  }
  update() {
    this.y += this.speed;
  }
  draw() {
    if (this.friendly) {
      // tiro do jogador - redondo e branco
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 5, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.shadowColor = "white";
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.closePath();
      ctx.shadowBlur = 0;
    } else {
      // tiro inimigo - vermelho
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2, this.y + this.h / 2, 5, 0, Math.PI * 2);
      ctx.fillStyle = "red";
      ctx.shadowColor = "red";
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.closePath();
      ctx.shadowBlur = 0;
    }
  }
}

const player = new Entity(canvas.width / 2 - 25, canvas.height - 100, 60, 60, playerImg);
let playerSpeed = 6;
let bullets = [];
let enemies = [];
let enemyBullets = [];
let enemySpawnRate = 2.5; // segundos
let lastEnemySpawn = 0;
let enemySpeed = 1.2;
let lastShot = 0;
let health = 100;
let points = 0;
let timeElapsed = 0;
let gameOver = false;

function spawnEnemy() {
  let x = Math.random() * (canvas.width - 60);
  enemies.push(new Entity(x, -60, 60, 60, enemyImg));
}

function updatePlayer() {
  if (keys["ArrowLeft"] || keys["a"]) player.x -= playerSpeed;
  if (keys["ArrowRight"] || keys["d"]) player.x += playerSpeed;
  if (keys["ArrowUp"] || keys["w"]) player.y -= playerSpeed;
  if (keys["ArrowDown"] || keys["s"]) player.y += playerSpeed;

  player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));
  player.y = Math.max(0, Math.min(canvas.height - player.h, player.y));

  if (keys[" "] && Date.now() - lastShot > 250) {
    bullets.push(new Bullet(player.x + player.w / 2 - 5, player.y, -10, true));
    lastShot = Date.now();
  }
}

function updateBullets() {
  bullets.forEach((b, i) => {
    b.update();
    if (b.y < -20) bullets.splice(i, 1);
  });
  enemyBullets.forEach((b, i) => {
    b.update();
    if (b.y > canvas.height + 20) enemyBullets.splice(i, 1);
  });
}

function updateEnemies() {
  if (Date.now() - lastEnemySpawn > enemySpawnRate * 1000) {
    spawnEnemy();
    lastEnemySpawn = Date.now();
  }

  enemies.forEach((e, i) => {
    if (!e.alive) return;
    e.y += enemySpeed;
    // tiros inimigos ocasionais
    if (Math.random() < 0.005) {
      enemyBullets.push(new Bullet(e.x + e.w / 2, e.y + e.h, 5, false));
    }
    // remove se sair da tela
    if (e.y > canvas.height) enemies.splice(i, 1);
  });
}

function checkCollisions() {
  bullets.forEach((b, bi) => {
    enemies.forEach((e, ei) => {
      if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
        enemies.splice(ei, 1);
        bullets.splice(bi, 1);
        points += 5;
        document.getElementById("pontos").textContent = "Pontos: " + points;
      }
    });
  });

  enemyBullets.forEach((b, bi) => {
    if (b.x < player.x + player.w && b.x + b.w > player.x && b.y < player.y + player.h && b.y + b.h > player.y) {
      enemyBullets.splice(bi, 1);
      health -= 10;
      updateHealthBar();
      if (health <= 0) endGame();
    }
  });
}

function updateHealthBar() {
  const fill = document.getElementById("vidaFill");
  fill.style.width = health + "%";
}

function endGame() {
  gameOver = true;
  document.getElementById("gameOver").style.display = "flex";
  document.getElementById("resultado").innerHTML =
    `💀 GAME OVER 💀<br>Tempo: ${timeElapsed}s<br>Pontos: ${points}`;
}

document.getElementById("restartBtn").onclick = () => {
  window.location.reload();
};

// aumenta dificuldade a cada minuto
setInterval(() => {
  if (!gameOver) {
    if (enemySpawnRate > 0.5) enemySpawnRate -= 0.3;
    enemySpeed += 0.3;
  }
}, 60000);

// cronômetro
setInterval(() => {
  if (!gameOver) {
    timeElapsed++;
    document.getElementById("timer").textContent = "Tempo: " + timeElapsed + "s";
  }
}, 1000);

function gameLoop() {
  if (gameOver) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updatePlayer();
  updateBullets();
  updateEnemies();
  checkCollisions();

  player.draw();
  bullets.forEach(b => b.draw());
  enemies.forEach(e => e.draw());
  enemyBullets.forEach(b => b.draw());

  requestAnimationFrame(gameLoop);
}

gameLoop();
