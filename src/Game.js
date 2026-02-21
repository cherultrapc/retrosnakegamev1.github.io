import Snake from './Snake.js';
import Forest from './Forest.js';
import Food from './Food.js';
import Human from './Human.js';
import AudioSystem from './AudioSystem.js';

// Configuration
const CONFIG = {
    TIME_SCALE: 1,
    DAY_LENGTH_MS: 120000,
    HUNGER_TIME_MS: 60000,
    STARVATION_TIME_MS: 60000,
    DIGESTION_TIME_MS: 30000,
    BASE_SPEED_FPS: 12,
    TIRED_SPEED_FPS: 8,
    WALL_DAMAGE_MS: 30000,
    MAX_LIVES: 3,
    MAX_FRUITS_PER_GAME: 2
};

export default class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.lastTime = 0;
        this.accumulatedTime = 0;

        this.gridSize = 25;

        this.isRunning = false;
        this.isPaused = false;
        this.lives = 1;
        this.currentSpeed = CONFIG.BASE_SPEED_FPS;

        this.dragonFruit = { active: false, x: 0, y: 0 };
        this.dragonFruitCount = 0;
        this.lastDragonFruitTime = 0;

        this.input = { x: 0, y: 0 };
        this.nextInput = { x: 0, y: 0 };

        this.audio = new AudioSystem();

        this.bindInput();
    }

    bindInput() {
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            const code = e.code;

            // Global Toggles
            if (key === 'm') {
                const btn = document.getElementById('sound-btn');
                if (btn) btn.click();
                return;
            }

            if (key === 'p') {
                const btn = document.getElementById('pause-btn');
                if (btn) btn.click();
                return;
            }

            if (code === 'Escape') {
                if (this.isPaused) {
                    const quitBtn = document.getElementById('quit-btn');
                    if (quitBtn) quitBtn.click();
                } else if (this.isRunning) {
                    this.togglePause();
                }
                return;
            }

            if (code === 'Space') {
                if (this.isPaused) {
                    this.togglePause();
                } else if (!this.isRunning) {
                    const startBtn = document.getElementById('start-btn');
                    const restartBtn = document.getElementById('restart-btn');

                    if (!document.getElementById('start-screen').classList.contains('w-hidden')) {
                        startBtn.click();
                    } else if (!document.getElementById('game-over-screen').classList.contains('w-hidden')) {
                        restartBtn.click();
                    }
                }
                e.preventDefault();
                return;
            }

            if (!this.isRunning || this.isPaused) return;

            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d"].indexOf(key) > -1) {
                if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(code) > -1) e.preventDefault();
            }

            switch (key) {
                case 'arrowup': case 'w':
                    if (this.input.y === 0) this.nextInput = { x: 0, y: -1 }; break;
                case 'arrowdown': case 's':
                    if (this.input.y === 0) this.nextInput = { x: 0, y: 1 }; break;
                case 'arrowleft': case 'a':
                    if (this.input.x === 0) this.nextInput = { x: -1, y: 0 }; break;
                case 'arrowright': case 'd':
                    if (this.input.x === 0) this.nextInput = { x: 1, y: 0 }; break;
            }
        });
    }

    togglePause() {
        if (!this.isRunning) return;
        this.isPaused = !this.isPaused;
        const pauseScreen = document.getElementById('pause-screen');

        if (this.isPaused) {
            pauseScreen.classList.remove('w-hidden');
            this.audio.music.day.volume = 0.02;
            this.audio.music.night.volume = 0.02;
        } else {
            pauseScreen.classList.add('w-hidden');
            this.lastTime = performance.now();
            this.audio.music.day.volume = 0.1;
            this.audio.music.night.volume = 0.1;
        }
    }

    start() {
        this.reset();
        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now();
        this.audio.playMusic('day');
        requestAnimationFrame(this.loop.bind(this));
    }

    restart() {
        this.start();
    }

    reset() {
        this.startTime = performance.now();
        this.timePlayed = 0;
        this.currentTimeScale = CONFIG.TIME_SCALE;
        this.currentDay = 1;
        this.currentSpeed = CONFIG.BASE_SPEED_FPS;
        this.lives = 1;

        this.hungerTimer = CONFIG.HUNGER_TIME_MS;
        this.starvationTimer = CONFIG.STARVATION_TIME_MS;
        this.dragonFruit = { active: false, x: -1, y: -1 };
        this.dragonFruitCount = 0;
        this.lastDragonFruitTime = 0;

        this.lastDragonFruitTime = 0;

        // FIX: Use dimensions calculated in resizeArena regarding Border
        // Do NOT recalculate based on full canvas width
        const cols = this.cols;
        const rows = this.rows;

        this.forest = new Forest(this.arenaWidth, this.arenaHeight, this.gridSize);
        this.snake = new Snake(cols, rows, this.gridSize);
        this.food = new Food(cols, rows, this.gridSize, this.forest, this.snake);
        this.humans = [];

        this.spawnHumans(3);

        this.input = { x: 1, y: 0 };
        this.nextInput = { x: 1, y: 0 };

        this.updateUI();
    }

    spawnHumans(count) {
        const cols = Math.floor(this.canvas.width / this.gridSize);
        const rows = Math.floor(this.canvas.height / this.gridSize);
        for (let i = 0; i < count; i++) {
            const h = new Human(cols, rows, this.gridSize, this.forest);
            h.spawn(this.humans);
            this.humans.push(h);
        }
    }

    loop(currentTime) {
        if (!this.isRunning) return;
        if (this.isPaused) {
            requestAnimationFrame(this.loop.bind(this));
            return;
        }

        let realDelta = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.timePlayed += realDelta * this.currentTimeScale;

        let baseFPS = this.currentSpeed;
        if (this.snake.isTired) baseFPS = CONFIG.TIRED_SPEED_FPS;

        const penalty = this.snake.getFullnessPenalty();
        baseFPS = baseFPS * (1 - penalty);

        const stepSize = 1000 / baseFPS;

        this.accumulatedTime += realDelta;
        while (this.accumulatedTime > stepSize) {
            this.update(stepSize, this.timePlayed);
            this.accumulatedTime -= stepSize;
        }

        const alpha = this.accumulatedTime / stepSize;

        const dayProgress = (this.timePlayed % CONFIG.DAY_LENGTH_MS) / CONFIG.DAY_LENGTH_MS;
        if (dayProgress > 0.6) {
            this.audio.playMusic('night');
        } else {
            this.audio.playMusic('day');
        }

        // Dragon Fruit Check called every frame but implements its own timing checks
        this.spawnDragonFruit();

        this.draw(alpha);
        this.updateUI();

        requestAnimationFrame(this.loop.bind(this));
    }

    spawnDragonFruit() {
        if (this.dragonFruitCount >= CONFIG.MAX_FRUITS_PER_GAME) return;

        // Timing Rules (V5 Fix)
        // console.log(`Time: ${Math.floor(this.timePlayed/1000)}s`); // Debug
        if (this.timePlayed < 45000) return;
        if (this.dragonFruitCount > 0 && (this.timePlayed - this.lastDragonFruitTime < 120000)) return;

        // Low chance per frame to make it not instant at 45s
        if (Math.random() > 0.001) return;

        console.log("Dragon Fruit Attempting Spawn at " + Math.floor(this.timePlayed / 1000) + "s");

        let valid = false;
        let attempts = 0;
        const cols = Math.floor(this.canvas.width / this.gridSize);
        const rows = Math.floor(this.canvas.height / this.gridSize);

        while (!valid && attempts < 10) {
            const x = Math.floor(Math.random() * cols);
            const y = Math.floor(Math.random() * rows);
            if (!this.forest.isObstacle(x, y) && !this.snake.checkCollision(x, y)) {
                this.dragonFruit = { active: true, x, y };
                this.dragonFruitCount++;
                this.lastDragonFruitTime = this.timePlayed;
                valid = true;
            }
            attempts++;
        }
    }

    update(dt, gameTime) {
        const day = Math.floor(gameTime / CONFIG.DAY_LENGTH_MS) + 1;
        if (day > this.currentDay) {
            this.nextDay(day);
        }
        if (day > 7) {
            this.winGame();
            return;
        }

        if (this.hungerTimer > 0) {
            this.hungerTimer -= (dt * this.currentTimeScale);
            this.snake.isTired = false;
        } else {
            this.snake.isTired = true;
            this.starvationTimer -= (dt * this.currentTimeScale);
            this.snake.isStarving = (this.starvationTimer < CONFIG.STARVATION_TIME_MS / 2);

            if (this.starvationTimer <= 0) {
                this.handleDeath("STARVED");
                return;
            }
        }

        this.input = this.nextInput;
        const snakeState = this.snake.update(this.input, this.canvas.width, this.canvas.height, gameTime, this.forest);

        if (snakeState === 'dead') {
            let reason = "SELF_HIT";
            if (this.forest.isTree(this.snake.head.x, this.snake.head.y)) reason = "TREE_HIT";
            else if (this.forest.isStone(this.snake.head.x, this.snake.head.y)) reason = "STONE_HIT";

            this.handleDeath(reason);
            return;
        } else if (snakeState === 'wall_hit') {
            if (this.snake.wallHitCooldown <= 0) {
                this.snake.isHurt = 10;
                this.hungerTimer = Math.max(0, this.hungerTimer - CONFIG.WALL_DAMAGE_MS);
                this.snake.wallHitCooldown = 15;
                this.audio.playSFX('hit_stone');
            }
        }

        if (this.snake.isHurt > 0) this.snake.isHurt--;

        if (this.snake.head.x === this.food.x && this.snake.head.y === this.food.y) {
            this.eatFood(gameTime);
        }

        if (this.dragonFruit.active && this.snake.head.x === this.dragonFruit.x && this.snake.head.y === this.dragonFruit.y) {
            this.eatDragonFruit();
        }

        for (const human of this.humans) {
            human.update(this.snake);
            if (this.snake.checkCollision(human.x, human.y)) {
                this.handleDeath("HUMAN_CAUGHT");
                return;
            }
        }
    }

    eatFood(gameTime) {
        this.snake.eat(gameTime);
        this.audio.playSFX('eat');
        this.food.respawn(this.snake, this.forest);

        this.hungerTimer = Math.min(this.hungerTimer + 30000, CONFIG.HUNGER_TIME_MS);
        this.starvationTimer = CONFIG.STARVATION_TIME_MS;
        this.snake.isTired = false;
        this.snake.isStarving = false;

        this.currentSpeed += 0.1;
    }

    eatDragonFruit() {
        if (this.lives < CONFIG.MAX_LIVES) {
            this.lives++;
        }
        this.dragonFruit.active = false;
        this.audio.playSFX('eat');
    }

    nextDay(newDay) {
        this.currentDay = newDay;
        this.snake.permanentGrow();
        this.forest.increaseDensity(newDay);
        this.spawnHumans(newDay);
        this.currentSpeed += 1.5;
    }

    handleDeath(reason) {
        // V5 Fix: If >1 lives, just lose one and respawn. Do NOT end game.
        if (this.lives > 1) {
            this.lives--;
            this.audio.playSFX('hit_stone');

            const cols = Math.floor(this.canvas.width / this.gridSize);
            const rows = Math.floor(this.canvas.height / this.gridSize);

            // Standard reset for snake position
            this.snake.reset(cols, rows);
            this.input = { x: 1, y: 0 };
            this.nextInput = { x: 1, y: 0 };
            this.snake.isHurt = 20;
            return;
        }

        this.lives = 0;
        this.gameOver(reason);
    }

    draw(alpha) {
        const dayProgress = (this.timePlayed % CONFIG.DAY_LENGTH_MS) / CONFIG.DAY_LENGTH_MS;

        let weather = 'normal';
        switch (this.currentDay) {
            case 2: weather = 'rain'; break;
            case 3: weather = 'mist'; break;
            case 4: weather = 'windy'; break;
            case 5: weather = 'snow'; break;
            case 6: weather = 'hail'; break;
            case 7: weather = 'cyclone'; break;
        }

        this.forest.draw(this.ctx, dayProgress, weather);
        this.food.draw(this.ctx);

        if (this.dragonFruit.active) {
            const px = this.dragonFruit.x * this.gridSize;
            const py = this.dragonFruit.y * this.gridSize;
            const cx = px + this.gridSize / 2;
            const cy = py + this.gridSize / 2;

            this.ctx.shadowBlur = 25;
            this.ctx.shadowColor = '#ff00ff';

            this.ctx.fillStyle = '#d500f9';
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 12, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#00e676';
            this.ctx.beginPath();
            this.ctx.arc(cx, cy - 8, 5, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.shadowBlur = 0;
        }

        this.humans.forEach(h => h.draw(this.ctx));

        if (this.snake.isHurt > 0) {
            this.ctx.fillStyle = `rgba(255, 0, 0, ${this.snake.isHurt * 0.05})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.snake.draw(this.ctx, alpha);
    }

    updateUI() {
        const totalSeconds = Math.floor(this.timePlayed / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (n) => n.toString().padStart(2, '0');
        const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

        const timeEl = document.getElementById('time-display');
        if (timeEl) timeEl.innerText = timeStr;

        const dayEl = document.getElementById('day-display');
        if (dayEl) dayEl.innerText = `${this.currentDay}/7`;

        const livesEl = document.getElementById('lives-display');
        if (livesEl) {
            livesEl.innerText = '❤️'.repeat(this.lives);
        }

        const statusEl = document.getElementById('status-display');
        const hungerBar = document.getElementById('hunger-bar');

        if (statusEl && hungerBar) {
            if (this.snake.isTired) {
                const starvePercent = (this.starvationTimer / CONFIG.STARVATION_TIME_MS) * 100;
                statusEl.innerText = "STARVING!";
                statusEl.className = "stat-item status-starving";
                hungerBar.style.width = `${starvePercent}%`;
                hungerBar.style.background = '#ff0000';
            } else {
                const hungerPercent = (this.hungerTimer / CONFIG.HUNGER_TIME_MS) * 100;
                statusEl.innerText = "HEALTHY";
                statusEl.className = "stat-item status-ok";
                hungerBar.style.width = `${hungerPercent}%`;
                hungerBar.style.background = 'linear-gradient(90deg, #ff3333, #ffcc00, #00ff88)';
            }
        }
    }

    gameOver(reason) {
        this.isRunning = false;
        this.audio.stopMusic();
        this.audio.playSFX('game_over');

        let narrative = reason;

        if (reason === 'TREE_HIT') {
            this.audio.playSFX('hit_tree');
            const treeMsgs = [
                "You barked up the wrong tree.",
                "Leaf me alone! Said the tree.",
                "Wood you believe it? You died.",
                "Knot today, friend. Knot today.",
                "Branching out was a bad idea.",
                "That tree has been standing there for 50 years. You had time to move."
            ];
            narrative = treeMsgs[Math.floor(Math.random() * treeMsgs.length)];
        } else if (reason === 'STONE_HIT') {
            this.audio.playSFX('hit_stone');
            const stoneMsgs = [
                "Taken for granite.",
                "That was a rocky start.",
                "Sedimentary, my dear Watson.",
                "You hit a rock. It won.",
                "Stone cold mistake.",
                "Between a rock and a hard face."
            ];
            narrative = stoneMsgs[Math.floor(Math.random() * stoneMsgs.length)];
        } else if (reason === 'HUMAN_CAUGHT') {
            this.audio.playSFX('hit_human');
            const humanMsgs = [
                "New pair of boots incoming.",
                "Snake snacks? No thanks.",
                "Critter control got you.",
                "You fought the lawn mower and the lawn mower won.",
                "Humans: 1, Snake: 0.",
                "Should have stayed in the tall grass."
            ];
            narrative = humanMsgs[Math.floor(Math.random() * humanMsgs.length)];
        } else if (reason === 'STARVED') {
            narrative = "Hangry is a fatal condition. Eat more!";
        } else if (reason === 'SELF_HIT') {
            narrative = "Ouroboros? More like Ouro-bore-us. You ate yourself.";
        }

        if (this.onGameOver) this.onGameOver(narrative, this.timePlayed);
    }

    winGame() {
        this.isRunning = false;
        if (this.onGameOver) this.onGameOver("YOU SURVIVED 7 DAYS!", this.timePlayed);
    }
}
