// ============================================
// SPACEWAR - Jogo Completo
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Redimensionar canvas
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================

let gameRunning = true;
let gamePaused = false;
let gameScore = 0;
let gameLives = 3;
let gameLevel = 1;
let gameTime = 0;
let lastLevelUpTime = 0;

// Arrays de objetos
let nave = null;
let bullets = [];
let alienBullets = [];
let asteroids = [];
let aliens = [];
let explosions = [];
let particles = [];

// Controles
const keys = {};
const mouse = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    firing: false
};
let audioContext = null;

function enableAudio() {
    if (!audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        audioContext = new AudioContext();
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    return audioContext;
}

function playShotSound(type) {
    const context = enableAudio();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const alienShot = type === 'alien';

    oscillator.type = alienShot ? 'sawtooth' : 'square';
    oscillator.frequency.setValueAtTime(alienShot ? 180 : 760, now);
    oscillator.frequency.exponentialRampToValueAtTime(alienShot ? 70 : 220, now + 0.12);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
}

function playDamageSound() {
    const context = enableAudio();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(130, now);
    oscillator.frequency.exponentialRampToValueAtTime(45, now + 0.2);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
}

// ============================================
// CLASSE NAVE
// ============================================

class Nave {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.width = 40;
        this.height = 40;
        this.speed = 5;
        this.rotationSpeed = 0.15;
        this.fireRate = 10; // frames entre tiros
        this.fireCounter = 0;
        this.invulnerableTimer = 0;
        this.img = new Image();
        this.img.src = 'nave-espacial.png';
    }

    update() {
        if (this.invulnerableTimer > 0) {
            this.invulnerableTimer--;
        }

        // A frente visual da nave acompanha o cursor do mouse.
        this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x) + Math.PI / 2;

        // Movimento frente/trás com as setas, relativo à direção da nave
        if (keys['arrowup']) {
            this.vx += Math.cos(this.angle) * 0.12;
            this.vy += Math.sin(this.angle) * 0.12;
        }
        if (keys['arrowdown']) {
            this.vx -= Math.cos(this.angle) * 0.08;
            this.vy -= Math.sin(this.angle) * 0.08;
        }

        // Movimento direto com WASD: W cima, A esquerda, S baixo, D direita
        if (keys['w']) {
            this.vy -= 0.12;
        }
        if (keys['a']) {
            this.vx -= 0.12;
        }
        if (keys['s']) {
            this.vy += 0.08;
        }
        if (keys['d']) {
            this.vx += 0.12;
        }

        // Atrito (desaceleração) - aumentado para movimento mais suave
        this.vx *= 0.96;
        this.vy *= 0.96;

        // Limite de velocidade - reduzido
        const maxSpeed = 3;
        const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        // Atualizar posição
        this.x += this.vx;
        this.y += this.vy;

        // Wrap around (passa de um lado pro outro)
        if (this.x - this.width / 2 > canvas.width) this.x = -this.width / 2;
        if (this.x + this.width / 2 < 0) this.x = canvas.width + this.width / 2;
        if (this.y - this.height / 2 > canvas.height) this.y = -this.height / 2;
        if (this.y + this.height / 2 < 0) this.y = canvas.height + this.height / 2;

        // Tiro
        this.fireCounter++;
        if ((keys[' '] || keys['control'] || mouse.firing) && this.fireCounter >= this.fireRate) {
            this.shoot();
            this.fireCounter = 0;
        }
    }

    shoot() {
        // A imagem da nave aponta para cima quando o ângulo é zero.
        const shotAngle = this.angle - Math.PI / 2;
        const bullet = new Bullet(
            this.x + Math.cos(shotAngle) * 20,
            this.y + Math.sin(shotAngle) * 20,
            Math.cos(shotAngle) * 8,
            Math.sin(shotAngle) * 8
        );
        bullets.push(bullet);
        playShotSound('ship');
        
        // Efeito de retroção
        this.vx -= Math.cos(shotAngle) * 0.5;
        this.vy -= Math.sin(shotAngle) * 0.5;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Tentar desenhar imagem
        if (this.img.complete) {
            ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            // Fallback: desenha um triângulo
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.moveTo(0, -this.height / 2);
            ctx.lineTo(this.width / 2, this.height / 2);
            ctx.lineTo(-this.width / 2, this.height / 2);
            ctx.closePath();
            ctx.fill();
            
            // Borda
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

// ============================================
// CLASSE BALA
// ============================================

class Bullet {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    isOutOfBounds() {
        return this.x < 0 || this.x > canvas.width ||
               this.y < 0 || this.y > canvas.height;
    }
}

// ============================================
// CLASSE ALIENIGENA
// ============================================

class Alien {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 24;
        this.width = 52;
        this.height = 36;
        this.speed = 0.7 + gameLevel * 0.04;
        this.fireRate = Math.max(55, 130 - gameLevel * 5);
        this.fireCounter = Math.floor(Math.random() * this.fireRate);
        this.img = new Image();
        this.img.src = 'ufo.png';
    }

    update() {
        if (!nave) return;

        const dx = nave.x - this.x;
        const dy = nave.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        this.x += (dx / distance) * this.speed;
        this.y += (dy / distance) * this.speed;

        this.fireCounter++;
        if (this.fireCounter >= this.fireRate) {
            this.shoot();
            this.fireCounter = 0;
        }
    }

    shoot() {
        const dx = nave.x - this.x;
        const dy = nave.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 4;

        alienBullets.push(new AlienBullet(
            this.x,
            this.y,
            (dx / distance) * speed,
            (dy / distance) * speed
        ));
        playShotSound('alien');
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.img.complete && this.img.naturalWidth > 0) {
            ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            ctx.fillStyle = '#d86cff';
            ctx.beginPath();
            ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#f0b8ff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }
}

class AlienBullet {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 4;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.fillStyle = '#ff5ce1';
        ctx.shadowColor = '#ff5ce1';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    isOutOfBounds() {
        return this.x < -20 || this.x > canvas.width + 20 ||
               this.y < -20 || this.y > canvas.height + 20;
    }
}

// ============================================
// CLASSE ASTEROIDE
// ============================================

class Asteroid {
    constructor(x, y, size = 3) {
        this.x = x;
        this.y = y;
        this.size = size; // 1 = pequeno, 2 = médio, 3 = grande
        this.radius = size * 15;
        this.vx = (Math.random() - 0.5) * (4 - size);
        this.vy = (Math.random() - 0.5) * (4 - size);
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
        this.img = new Image();
        this.img.src = 'asteroid.png';
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;

        // Wrap around
        if (this.x - this.radius > canvas.width) this.x = -this.radius;
        if (this.x + this.radius < 0) this.x = canvas.width + this.radius;
        if (this.y - this.radius > canvas.height) this.y = -this.radius;
        if (this.y + this.radius < 0) this.y = canvas.height + this.radius;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.img.complete) {
            ctx.drawImage(this.img, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
        } else {
            // Fallback: desenha um círculo
            ctx.fillStyle = 'rgba(150, 100, 50, 0.8)';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#ccaa55';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }

    isOutOfBounds() {
        return this.x + this.radius < -100 || 
               this.x - this.radius > canvas.width + 100 ||
               this.y + this.radius < -100 || 
               this.y - this.radius > canvas.height + 100;
    }
}

// ============================================
// CLASSE EXPLOSÃO
// ============================================

class Explosion {
    constructor(x, y, size = 1) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.radius = 10 * size;
        this.maxRadius = 40 * size;
        this.lifetime = 30;
        this.maxLifetime = 30;
    }

    update() {
        this.lifetime--;
        this.radius = (this.maxRadius - 5) * (1 - this.lifetime / this.maxLifetime) + 5;
    }

    draw() {
        const opacity = this.lifetime / this.maxLifetime;
        
        ctx.fillStyle = `rgba(255, 100, 0, ${opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 200, 0, ${opacity})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    isDone() {
        return this.lifetime <= 0;
    }
}

// ============================================
// CLASSE PARTÍCULA
// ============================================

class Particle {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.lifetime = 40;
        this.maxLifetime = 40;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // gravidade
        this.lifetime--;
    }

    draw() {
        const opacity = this.lifetime / this.maxLifetime;
        ctx.fillStyle = this.color.replace('1)', `${opacity})`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    isDone() {
        return this.lifetime <= 0;
    }
}

// ============================================
// FUNÇÕES DE COLISÃO
// ============================================

function checkCollisions() {
    // Bala vs Asteroide
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const bullet = bullets[i];
            const asteroid = asteroids[j];

            const dx = bullet.x - asteroid.x;
            const dy = bullet.y - asteroid.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < asteroid.radius + bullet.radius) {
                // Colisão!
                destroyAsteroid(j);
                bullets.splice(i, 1);
                gameScore += 10;
                break;
            }
        }
    }

    // Bala vs Alienigena
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = aliens.length - 1; j >= 0; j--) {
            const bullet = bullets[i];
            const alien = aliens[j];

            const dx = bullet.x - alien.x;
            const dy = bullet.y - alien.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < alien.radius + bullet.radius) {
                destroyAlien(j);
                bullets.splice(i, 1);
                gameScore += 25;
                break;
            }
        }
    }

    // Nave vs Asteroide
    if (nave && gameRunning) {
        for (let i = asteroids.length - 1; i >= 0; i--) {
            const asteroid = asteroids[i];
            const dx = nave.x - asteroid.x;
            const dy = nave.y - asteroid.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < asteroid.radius + nave.width / 2) {
                // Colisão com nave!
                damageNave();
                destroyAsteroid(i);
                break;
            }
        }

        // Tiro alienigena vs Nave
        for (let i = alienBullets.length - 1; i >= 0; i--) {
            const bullet = alienBullets[i];
            const dx = nave.x - bullet.x;
            const dy = nave.y - bullet.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < nave.width / 2 + bullet.radius) {
                damageNave();
                alienBullets.splice(i, 1);
            }
        }

        // Nave vs Alienigena
        for (let i = aliens.length - 1; i >= 0; i--) {
            const alien = aliens[i];
            const dx = nave.x - alien.x;
            const dy = nave.y - alien.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < alien.radius + nave.width / 2) {
                damageNave();
                destroyAlien(i);
                break;
            }
        }
    }
}

function destroyAsteroid(index) {
    const asteroid = asteroids[index];
    
    // Criar explosão
    explosions.push(new Explosion(asteroid.x, asteroid.y, asteroid.size));

    // Criar partículas
    for (let i = 0; i < 8 * asteroid.size; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        const color = `rgba(${200 + Math.random() * 50}, ${100 + Math.random() * 50}, 0, 1)`;
        
        particles.push(new Particle(
            asteroid.x + (Math.random() - 0.5) * 20,
            asteroid.y + (Math.random() - 0.5) * 20,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            color
        ));
    }

    // Dividir asteroide
    if (asteroid.size > 1) {
        for (let i = 0; i < 2; i++) {
            asteroids.push(new Asteroid(
                asteroid.x + (Math.random() - 0.5) * 30,
                asteroid.y + (Math.random() - 0.5) * 30,
                asteroid.size - 1
            ));
        }
    }

    asteroids.splice(index, 1);
}

function destroyAlien(index) {
    const alien = aliens[index];

    explosions.push(new Explosion(alien.x, alien.y, 1.2));

    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        particles.push(new Particle(
            alien.x,
            alien.y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            `rgba(220, 90, 255, 1)`
        ));
    }

    aliens.splice(index, 1);
}

function damageNave() {
    if (!nave || nave.invulnerableTimer > 0) return;

    playDamageSound();
    gameLives--;
    nave.invulnerableTimer = 90;
    
    // Explosão na nave
    for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 3;
        const color = `rgba(255, ${50 + Math.random() * 150}, 0, 1)`;
        
        particles.push(new Particle(
            nave.x + (Math.random() - 0.5) * 30,
            nave.y + (Math.random() - 0.5) * 30,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed,
            color
        ));
    }

    if (gameLives <= 0) {
        endGame();
    }
}

// ============================================
// SPAWNEAR ASTEROIDES
// ============================================

function spawnAsteroids() {
    const count = 2 + gameLevel;
    
    for (let i = 0; i < count; i++) {
        let x, y;
        const side = Math.floor(Math.random() * 4);

        switch (side) {
            case 0: // topo
                x = Math.random() * canvas.width;
                y = -30;
                break;
            case 1: // direita
                x = canvas.width + 30;
                y = Math.random() * canvas.height;
                break;
            case 2: // baixo
                x = Math.random() * canvas.width;
                y = canvas.height + 30;
                break;
            case 3: // esquerda
                x = -30;
                y = Math.random() * canvas.height;
                break;
        }

        asteroids.push(new Asteroid(x, y, 3));
    }
}

function spawnAliens() {
    const count = 1 + Math.floor((gameLevel - 1) / 2);

    for (let i = 0; i < count; i++) {
        let x;
        let y;
        const side = Math.floor(Math.random() * 4);

        switch (side) {
            case 0:
                x = Math.random() * canvas.width;
                y = -50;
                break;
            case 1:
                x = canvas.width + 50;
                y = Math.random() * canvas.height;
                break;
            case 2:
                x = Math.random() * canvas.width;
                y = canvas.height + 50;
                break;
            default:
                x = -50;
                y = Math.random() * canvas.height;
                break;
        }

        aliens.push(new Alien(x, y));
    }
}

function spawnWave() {
    spawnAsteroids();
    spawnAliens();
}

// ============================================
// GAME LOOP
// ============================================

function update() {
    if (!gameRunning || gamePaused) return;

    // Atualizar tempo
    gameTime += 1 / 60;

    // Atualizar nave
    if (nave) {
        nave.update();
    }

    // Atualizar balas
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        if (bullets[i].isOutOfBounds()) {
            bullets.splice(i, 1);
        }
    }

    // Atualizar asteroides
    for (let i = asteroids.length - 1; i >= 0; i--) {
        asteroids[i].update();
        if (asteroids[i].isOutOfBounds()) {
            asteroids.splice(i, 1);
        }
    }

    // Atualizar aliens
    for (let i = aliens.length - 1; i >= 0; i--) {
        aliens[i].update();
    }

    // Atualizar tiros alienigenas
    for (let i = alienBullets.length - 1; i >= 0; i--) {
        alienBullets[i].update();
        if (alienBullets[i].isOutOfBounds()) {
            alienBullets.splice(i, 1);
        }
    }

    // Atualizar explosões
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].update();
        if (explosions[i].isDone()) {
            explosions.splice(i, 1);
        }
    }

    // Atualizar partículas
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].isDone()) {
            particles.splice(i, 1);
        }
    }

    // Checar colisões
    checkCollisions();

    // Aumentar dificuldade a cada 30 segundos
    const currentLevel = Math.floor(gameTime / 30) + 1;
    if (currentLevel !== gameLevel) {
        gameLevel = currentLevel;
        spawnWave();
    }

    // Iniciar uma nova onda quando todos os inimigos forem derrotados
    if (asteroids.length === 0 && aliens.length === 0 && bullets.length === 0) {
        spawnWave();
    }
}

function draw() {
    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenhar asteroides
    for (let asteroid of asteroids) {
        asteroid.draw();
    }

    // Desenhar aliens
    for (let alien of aliens) {
        alien.draw();
    }

    // Desenhar balas
    for (let bullet of bullets) {
        bullet.draw();
    }

    // Desenhar tiros alienigenas
    for (let bullet of alienBullets) {
        bullet.draw();
    }

    // Desenhar explosões
    for (let explosion of explosions) {
        explosion.draw();
    }

    // Desenhar partículas
    for (let particle of particles) {
        particle.draw();
    }

    // Desenhar nave
    if (nave) {
        nave.draw();
    }

    // Efeito de vinheta
    ctx.fillStyle = 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)';
    const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height));
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function gameLoop() {
    if (!gamePaused) {
        update();
        draw();
        updateHUD();
    }
    requestAnimationFrame(gameLoop);
}

// ============================================
// HUD (INTERFACE)
// ============================================

function updateHUD() {
    // Timer
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer').textContent = timeStr;

    // Score
    document.getElementById('score').textContent = gameScore.toString().padStart(8, '0');

    // Lives
    let livesStr = '';
    for (let i = 0; i < gameLives; i++) livesStr += '❤️';
    if (gameLives === 0) livesStr = '💀';
    document.getElementById('lives').textContent = livesStr || '💀';

    // Level
    document.getElementById('level').textContent = gameLevel;
}

// ============================================
// FIM DO JOGO
// ============================================

function endGame() {
    gameRunning = false;
    
    setTimeout(() => {
        const gameOverScreen = document.getElementById('gameOverScreen');
        gameOverScreen.classList.remove('hidden');

        const minutes = Math.floor(gameTime / 60);
        const seconds = Math.floor(gameTime % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        document.getElementById('finalTime').textContent = timeStr;
        document.getElementById('finalScore').textContent = gameScore.toString().padStart(8, '0');
        document.getElementById('finalLevel').textContent = gameLevel;
    }, 500);
}

// ============================================
// RESTART JOGO
// ============================================

function restartGame() {
    gameRunning = true;
    gamePaused = false;
    gameScore = 0;
    gameLives = 3;
    gameLevel = 1;
    gameTime = 0;
    
    bullets = [];
    alienBullets = [];
    asteroids = [];
    aliens = [];
    explosions = [];
    particles = [];

    nave = new Nave();
    spawnWave();

    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
}

function togglePause() {
    if (!gameRunning) return;

    gamePaused = !gamePaused;
    document.getElementById('pauseScreen').classList.toggle('hidden', !gamePaused);
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('keydown', (e) => {
    enableAudio();

    if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
    }

    keys[e.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

canvas.addEventListener('mousedown', (e) => {
    enableAudio();

    if (e.button === 0) {
        mouse.firing = true;
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        mouse.firing = false;
    }
});

document.getElementById('restartBtn').addEventListener('click', restartGame);

// Redimensionar canvas quando a janela muda de tamanho
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// ============================================
// INICIALIZAR JOGO
// ============================================

nave = new Nave();
spawnWave();
gameLoop();

// Instruções
console.log('CONTROLES DO JOGO:');
console.log('- Mouse: Girar a nave');
console.log('- W: Cima | A: Esquerda | S: Baixo | D: Direita');
console.log('- Setas ↑↓: Movimento relativo à nave');
console.log('- Espaço ou Ctrl: Atirar');
console.log('- A cada 30 segundos surgem mais asteroides e alienigenas');
console.log('- Destrua asteroides e sobreviva!');
