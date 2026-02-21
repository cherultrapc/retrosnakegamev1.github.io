// PhaseController.js
class PhaseController {
    constructor() {
        this.cycleTime = 0; // 0 to 60000ms
        this.currentPhase = 'day'; // 'day' or 'night'
        this.isTransitioning = false;
        this.audioTriggered = false;
    }

    reset() {
        this.cycleTime = 0;
        this.currentPhase = 'day';
        this.isTransitioning = false;
        this.audioTriggered = false;
        this.phaseCount = 1; // V72: Internal Phase Tracking
    }

    // V72: Manual Day Override
    setDay(day) {
        // Day 1 = Phase 1
        // Day 2 = Phase 3
        // Day 3 = Phase 5
        this.phaseCount = (day * 2) - 1;
        this.cycleTime = 0;
        this.audioTriggered = false;
    }

    update(dt) {
        this.cycleTime += dt;

        // Hard Reset at 60s
        if (this.cycleTime >= 60000) {
            this.cycleTime = 0;
            this.audioTriggered = false;
            return 'NEXT_DAY'; // Signal to Game to increment day
        }

        // 57s: Audio Trigger
        if (this.cycleTime >= 57000 && !this.audioTriggered) {
            this.audioTriggered = true;
            return 'TRIGGER_AUDIO';
        }

        return null;
    }

    getDarkness(phaseCount) {
        // V73: Authoritative Phase Tracking
        // Odd Phase = Day (Light), Even Phase = Night (Dark)
        const isNight = (phaseCount % 2 === 0);

        const t = this.cycleTime / 1000; // seconds

        // 0s - 55s: Stable State
        if (t < 55) {
            return isNight ? 0.88 : 0.0;
        }

        // 55s - 60s: Transition
        const progress = (t - 55) / 5; // 0.0 to 1.0

        if (isNight) {
            // Night -> Day (Fade Out Darkness)
            return 0.88 * (1.0 - progress);
        } else {
            // Day -> Night (Fade In Darkness)
            return 0.88 * progress;
        }
    }

    getAudioState(currentDay) {
        // Returns target audio state based on strict timeline
        // 0-57s: Current Phase Audio
        // 57-60s: Next Phase Audio (Crossfade)

        const t = this.cycleTime / 1000;
        const isNightDay = (currentDay % 2 === 0);

        if (t < 57) {
            return isNightDay ? 'night' : 'day';
        } else {
            // Pre-fade to NEXT phase
            return isNightDay ? 'day' : 'night';
        }
    }

    getWeatherIntensity(isNight) {
        const t = this.cycleTime / 1000;

        // Night: Standard Smooth Fade (Fireflies need this)
        if (isNight) {
            if (t <= 5) return t / 5;
            if (t >= 55) return 1.0 - ((t - 55) / 5);
            return 1.0;
        }

        // Day: Flat 75% Stop at 57s
        // 0s - 57s: Constant 0.75
        if (t <= 57) return 0.75;

        // 57s - 60s: HARD STOP (0.00)
        return 0.0;
    }
}

// AudioSystem.js 
class AudioSystem {
    constructor() {
        this.music = {};
        this.sfx = {};
        try {
            this.music = {
                day: new Audio('assets/music_day.mp3'),
                night: new Audio('assets/music_night.mp3'),
                endgame: new Audio('assets/music_endgame.mp3')
            };
            if (this.music.day) this.music.day.loop = true;
            if (this.music.night) this.music.night.loop = true;
            if (this.music.endgame) this.music.endgame.loop = true;
            this.sfx = {
                eat: new Audio('assets/sfx_eat.mp3'),
                hit_tree: new Audio('assets/sfx_hit_tree.mp3'),
                hit_stone: new Audio('assets/sfx_hit_stone.mp3'),
                hit_human: new Audio('assets/sfx_hit_human.mp3'),
                game_over: new Audio('assets/sfx_game_over.mp3'),
                bounce: new Audio('assets/sfx_hit_stone.mp3')
            };
            if (this.music.day) this.music.day.volume = 0.1;
            if (this.music.night) this.music.night.volume = 0.1;
            if (this.music.endgame) this.music.endgame.volume = 0.1;
        } catch (e) { console.error("Audio init failed:", e); }
        this.currentTrack = null;
        this.isMuted = false;
        this.fadeInterval = null;
        this.volumeMultiplier = 1.0;
        this.duckingInterval = null;
    }

    playMusic(type) {
        if (this.currentTrack === type) return;
        if (this.fadeInterval) clearInterval(this.fadeInterval);

        const oldTrackName = this.currentTrack;
        const newTrackName = type;
        this.currentTrack = type;

        const oldTrack = oldTrackName ? this.music[oldTrackName] : null;
        const newTrack = this.music[newTrackName];

        if (newTrack) {
            newTrack.volume = 0;
            newTrack.play().catch(e => { });
        }

        const targetVol = this.isMuted ? 0 : (0.1 * this.volumeMultiplier);

        // V36: Instant Fade (30ms interval, 0.01 step) -> ~300ms transition
        this.fadeInterval = setInterval(() => {
            let done = true;
            if (oldTrack && oldTrack.volume > 0) {
                oldTrack.volume = Math.max(0, oldTrack.volume - 0.01); // 5x Speed
                done = false;
            } else if (oldTrack) {
                oldTrack.pause();
                oldTrack.currentTime = 0;
            }
            if (newTrack && !this.isMuted && newTrack.volume < targetVol) {
                newTrack.volume = Math.min(targetVol, newTrack.volume + 0.01); // 5x Speed
                done = false;
            }
            if (done) clearInterval(this.fadeInterval);
        }, 30); // 2.5x Speed (was 80)
    }

    setVolumeMultiplier(val) {
        if (this.duckingInterval) clearInterval(this.duckingInterval);
        this.volumeMultiplier = val;

        this.duckingInterval = setInterval(() => {
            let done = true;
            ['day', 'night'].forEach(t => {
                const track = this.music[t];
                if (track && !track.paused) {
                    const target = this.isMuted ? 0 : (0.1 * this.volumeMultiplier);
                    const diff = target - track.volume;
                    if (Math.abs(diff) > 0.005) {
                        track.volume += (diff * 0.1);
                        done = false;
                    } else {
                        track.volume = target;
                    }
                }
            });
            if (done) clearInterval(this.duckingInterval);
        }, 50);
    }

    stopMusic() {
        ['day', 'night', 'endgame'].forEach(t => {
            if (this.music[t]) {
                this.music[t].pause();
                this.music[t].currentTime = 0;
            }
        });
        this.currentTrack = null;
    }

    playSFX(name) { if (!this.isMuted && this.sfx[name]) { const c = this.sfx[name].cloneNode(); c.volume = 0.6; c.play().catch(e => { }); } }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const target = this.isMuted ? 0 : (0.1 * this.volumeMultiplier);
        if (this.currentTrack && this.music[this.currentTrack]) this.music[this.currentTrack].volume = target;
        return this.isMuted;
    }
}

// Snake.js
class Snake {
    constructor(cols, rows, gridSize) { this.gridSize = gridSize; this.reset(cols, rows); }
    reset(cols, rows) {
        const startX = Math.floor(cols / 2); const startY = Math.floor(rows / 2);
        this.baseLength = 3; this.segments = [];
        for (let i = 0; i < this.baseLength; i++) this.segments.push({ x: startX - i, y: startY });
        this.prevSegments = JSON.parse(JSON.stringify(this.segments));
        this.growPending = 0; this.digestionQueue = [];
        this.isTired = false; this.isStarving = false;
        this.wallHitCooldown = 0; this.invincibleTimer = 0;
        this.superFruitGlowTimer = 0; // V63: Glow Timer
        this.superFruitGlowColor = '#fff200'; // V63: Default Yellow
        this.shieldActive = false; // V63: Permanent Shield
        this.phaseThroughTimer = 0; // V76: Litchee Effect
        this.damageGlowTimer = 0; // V77: Localized Damage Glow
        // V79: Max Length Clamp
        this.maxLength = 12;
        this.respawnSafetyTimer = 0; // V87: 3-sec immunity window on respawn. 0 = inactive.
    }
    get head() { return this.segments[0]; }
    getFullnessPenalty() { if (this.digestionQueue.length > 10) return 0.25; if (this.digestionQueue.length > 5) return 0.10; return 0; }

    shrink() {
        if (this.segments.length > 3) {
            this.segments.pop();
            // V46: Safety clear to ensure starvation always wins.
            this.growPending = 0;
            return true;
        }
        return false;
    }

    // V63: Orange Fruit Reset Logic
    resetLength() {
        // Keep head, remove all other segments down to baseLength (3)
        // If current length is < 3, do nothing (or grow to 3? Reset usually implies "back to start")
        // Let's safe set to baseLength.

        const head = this.segments[0];
        this.segments = [head];

        // Re-build initial small body behind head (to avoid visual glitch of 1-segment snake)
        // We'll just stack them at head position, they will unfold as it moves.
        // Or better: try to keep immediate previous segments if available.

        // Simpler: Just cut the array.
        if (this.segments.length > this.baseLength) {
            this.segments.length = this.baseLength;
        }

        // Actually, the request says "reset to base starting size".
        // Base is 3.
        // If we are long, we truncate.
        // We also need to clear digestion to stop immediate regrowth.
        this.digestionQueue = [];
        this.growPending = 0;
        this.baseLength = 3; // Reset permanent growth baseline too? Request says "reset ... to base length". Implies baseline reset.

        // Re-populate segments if we cut too aggressively or just to ensure safety
        // But simply keeping the first 3 segments is safest visually.
        while (this.segments.length < 3) {
            const tail = this.segments[this.segments.length - 1];
            this.segments.push({ x: tail.x, y: tail.y });
        }
        // Truncate to 3
        this.segments.length = 3;

        // Update prevSegments to match to avoid interpolation glitch
        this.prevSegments = JSON.parse(JSON.stringify(this.segments));
    }

    update(input, arenaWidth, arenaHeight, gameTime, forest) {
        if (this.isDead) return 'dead';

        const head = this.segments[0];
        let nextX = head.x + input.x;
        let nextY = head.y + input.y;

        // V38 Strict Border Constraint
        const cols = Math.floor(arenaWidth / this.gridSize);
        const rows = Math.floor(arenaHeight / this.gridSize);

        // ── BORDER CONSTRAINT (always hard boundary, no exceptions) ──────────
        // Litchee and respawn safety apply ONLY to obstacles (trees/logs).
        // Borders are immutable world limits — snake is clamped to last valid cell.
        if (nextX < 0 || nextX >= cols || nextY < 0 || nextY >= rows) {
            if (this.phaseThroughTimer > 0 || this.respawnSafetyTimer > 0) {
                // Clamp: keep snake inside arena, no damage, no death.
                nextX = Math.max(0, Math.min(cols - 1, nextX));
                nextY = Math.max(0, Math.min(rows - 1, nextY));
            } else {
                return 'bounce_wall';
            }
        }

        // Check obstacles
        // V76: Litchee Phase Through logic
        // V87: Respawn safety window also grants obstacle phase-through (independent of Litchee)
        if (forest && forest.isObstacle(nextX, nextY)) {
            if (this.phaseThroughTimer > 0 || this.respawnSafetyTimer > 0) {
                // Pass through obstacle!
            } else {
                return 'bounce_obstacle';
            }
        }
        if (this.invincibleTimer > 0) this.invincibleTimer--;
        if (this.damageGlowTimer > 0) this.damageGlowTimer -= 16.666; // Damage Aura
        if (this.superFruitGlowTimer > 0) this.superFruitGlowTimer -= 16.666; // Approx 60fps decrement
        if (this.phaseThroughTimer > 0) this.phaseThroughTimer -= 16.666; // V76: Decrement Phase Through
        if (this.respawnSafetyTimer > 0) this.respawnSafetyTimer -= 16.666; // V87: Respawn immunity countdown

        // Check self-collision (Body)
        // Skip the very last segment because it will move away (unless we grow, but growth logic handles that)
        // Actually, we should check all segments because if we hit the tail *as it moves away*, we are safe.
        // But if we hit the neck, we are dead.
        for (let i = 0; i < this.segments.length - 1; i++) {
            if (nextX === this.segments[i].x && nextY === this.segments[i].y) {
                // Neck check: if we try to reverse into neck (i=1), usually input prevents this.
                // If it happens, it is fatal.
                if (this.invincibleTimer > 0) return 'alive';
                return 'dead';
            }
        }

        // Move logic
        this.prevSegments = JSON.parse(JSON.stringify(this.segments));

        // Handle Growth / Digestion
        if (this.digestionQueue.length > 0) {
            const peek = this.digestionQueue[0];
            if (gameTime >= peek) {
                this.digestionQueue.shift();
                // V47 (Restored V22 Logic): Digestion shrinks the snake back to baseLength.
                // This prevents infinite growth and mimics "metabolism".
                if (this.segments.length > this.baseLength) {
                    this.segments.pop();
                    if (this.prevSegments.length > this.segments.length) this.prevSegments.pop();
                }
            }
        }

        // Add new head
        this.segments.unshift({ x: nextX, y: nextY });

        // Remove tail unless growing
        if (this.growPending > 0) {
            this.growPending--;
        } else {
            this.segments.pop();
        }

        return 'alive';
    }
    eat(currentTime) {
        // V79: Enforce 12-segment clamp limits
        if (this.baseLength + this.growPending < this.maxLength) {
            this.growPending++;
        }
        this.digestionQueue.push(currentTime + 30000);
    }
    permanentGrow() {
        if (this.baseLength < this.maxLength) {
            this.baseLength++;
            this.growPending++;
        }
    }
    checkCollision(x, y) {
        for (let i = 0; i < this.segments.length; i++) { if (this.segments[i].x === x && this.segments[i].y === y) return true; }
        return false;
    }
    draw(ctx, alpha = 1, goldMode = false) {
        // V76 ENDGAME: Full neon gold body override — bypasses health color entirely
        let h = this.healthFactor !== undefined ? this.healthFactor : 1.0;
        let r, g, b;

        if (goldMode) {
            // Neon gold: #ffc800
            r = 255; g = 200; b = 0;
        } else if (h > 0.5) {
            const t = (1.0 - h) / 0.5;
            r = 0 + (255 - 0) * t;
            g = 255 + (204 - 255) * t;
            b = 136 + (0 - 136) * t;
        } else {
            const t = (0.5 - h) / 0.5;
            r = 255;
            g = 204 + (51 - 204) * t;
            b = 0 + (51 - 0) * t;
        }

        const colorHead = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
        const colorBody = `rgb(${Math.floor(r * 0.8)}, ${Math.floor(g * 0.8)}, ${Math.floor(b * 0.8)})`;

        if (goldMode) {
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 45;
        } else {
            ctx.shadowBlur = (h < 0.2) ? 30 : 20;
            ctx.shadowColor = colorHead;
        }

        // Priority Glow: Damage > Superfruit (only in non-gold mode to avoid override)
        if (!goldMode) {
            if (this.damageGlowTimer > 0) {
                const glowIntensity = Math.min(1, this.damageGlowTimer / 500);
                ctx.shadowColor = `rgba(255, 51, 51, ${glowIntensity})`;
                ctx.shadowBlur = 40 * glowIntensity;
            } else if (this.superFruitGlowTimer > 0) {
                const glowIntensity = this.superFruitGlowTimer / 3000;
                ctx.shadowColor = this.superFruitGlowColor;
                ctx.shadowBlur = 40 * glowIntensity + 20;
            }
        } else {
            // In gold mode: pulsating glow for drama
            const pulse = (Math.sin(performance.now() / 400) + 1) / 2;
            ctx.shadowBlur = 35 + pulse * 25;
        }

        // V76/V82: Litchee Transparency with 3-second pre-expiry flicker warning.
        if (this.phaseThroughTimer > 0) {
            const FLICKER_WINDOW = 3000;
            if (this.phaseThroughTimer <= FLICKER_WINDOW) {
                const progress = this.phaseThroughTimer / FLICKER_WINDOW;
                const freq = 2.0 + (1.0 - progress) * 8.0;
                const wave = (Math.sin(Date.now() / 1000 * freq * Math.PI * 2) + 1) / 2;
                ctx.globalAlpha = 0.3 + wave * 0.7;
            } else {
                ctx.globalAlpha = 0.3;
            }
        }

        // V87: Respawn safety translucency
        if (this.respawnSafetyTimer > 0 && this.phaseThroughTimer <= 0) {
            ctx.globalAlpha = 0.3;
        }

        for (let i = 0; i < this.segments.length; i++) {
            const curr = this.segments[i]; const prev = this.prevSegments[i] || curr;
            const ix = prev.x + (curr.x - prev.x) * alpha; const iy = prev.y + (curr.y - prev.y) * alpha;

            if (goldMode) {
                // Alternating gold shimmer segments
                ctx.fillStyle = (i === 0) ? '#ffd700' : (i % 2 === 0 ? '#ffb800' : '#ffe44d');
            } else {
                ctx.fillStyle = (i === 0) ? colorHead : colorBody;
                if (i > 0 && i % 2 === 0 && h > 0.5) ctx.fillStyle = `rgb(${Math.floor(r * 0.7)}, ${Math.floor(g * 0.9)}, ${Math.floor(b * 0.8)})`;
            }

            const size = this.gridSize - 2;
            ctx.fillRect(ix * this.gridSize + 1, iy * this.gridSize + 1, size, size);
        }
        ctx.globalAlpha = 1.0;
    }
}

// Food.js 
class Food {
    constructor(cols, rows, gridSize, forest, snake) { this.cols = cols; this.rows = rows; this.gridSize = gridSize; this.x = 0; this.y = 0; this.respawn(snake, forest); }
    respawn(snake, forest) {
        let valid = false; let attempts = 0;
        while (!valid && attempts < 100) {
            attempts++;
            this.x = 1 + Math.floor(Math.random() * (this.cols - 2));
            this.y = 1 + Math.floor(Math.random() * (this.rows - 2));
            if (this.x < 1 || this.y < 1) continue; // Safety
            if (snake.checkCollision(this.x, this.y)) continue;
            if (forest.isObstacle(this.x, this.y)) continue;
            valid = true;
        }
        if (!valid) { this.x = 1; this.y = 1; }
    }
    draw(ctx) {
        const px = this.x * this.gridSize; const py = this.y * this.gridSize;
        const cx = px + this.gridSize / 2; const cy = py + this.gridSize / 2;
        ctx.shadowBlur = 10; ctx.shadowColor = '#ff5555'; ctx.fillStyle = '#e53935';
        ctx.beginPath(); ctx.arc(cx - 5, cy + 3, 7, 0, Math.PI * 2); ctx.arc(cx + 5, cy + 3, 7, 0, Math.PI * 2); ctx.arc(cx, cy - 5, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#76ff03'; ctx.shadowBlur = 0; ctx.beginPath(); ctx.ellipse(cx, cy - 10, 8, 4, Math.PI / 4, 0, Math.PI * 2); ctx.fill();
    }
}

// Human.js
class Human {
    constructor(cols, rows, gridSize, forest, perception, startX, startY) {
        this.cols = cols; this.rows = rows; this.gridSize = gridSize;
        this.forest = forest;
        this.perception = perception !== undefined ? perception : 15; // default

        if (startX !== undefined && startY !== undefined) {
            this.x = startX; this.y = startY;
            this.prevX = this.x; this.prevY = this.y;
        } else {
            this.spawn();
        }
        this.moveCooldown = Math.floor(Math.random() * 8); // V88: Decouple spawn groups
        this.moveSpeed = 6;
    }
    spawn() {
        let valid = false; let attempts = 0;
        while (!valid && attempts < 100) {
            this.x = 1 + Math.floor(Math.random() * (this.cols - 2));
            this.y = 1 + Math.floor(Math.random() * (this.rows - 2));
            if (this.forest.isObstacle(this.x, this.y)) { attempts++; continue; }
            valid = true;
        }
        if (!valid) { this.x = 1; this.y = 1; } // Fallback
        this.prevX = this.x; this.prevY = this.y;
    }
    update(snake, currentDay, isNight, isEndgameHunt = false) { // V76: endgame flag
        this.prevX = this.x; this.prevY = this.y;
        this.moveCooldown++;

        // V64: Variable Speed based on Aggression/Night
        // Night = Slower (12 frames), Day 1-2 = 8 frames, Day 3-4 = 6 frames, Day 5+ = 5 frames
        let currentSpeed = 8;
        if (isNight) currentSpeed = 12; // Very slow/careful at night
        else if (currentDay >= 5) currentSpeed = 5; // Fast hunters
        else if (currentDay >= 3) currentSpeed = 6; // Normal
        else currentSpeed = 8; // Slow wanderers

        // V88: Add +/- 1 frame temporal jitter to break uniform cadence
        const jitter = (this.perception % 3 === 0) ? -1 : (this.perception % 4 === 0 ? 1 : 0);
        if (this.moveCooldown < (currentSpeed + jitter)) return;
        this.moveCooldown = Math.floor(Math.random() * 2); // Reset with tiny drift

        const moves = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
        const validMoves = moves.filter(m => {
            const nx = this.x + m.x; const ny = this.y + m.y;
            return nx >= 1 && nx < this.cols - 1 && ny >= 1 && ny < this.rows - 1 && !this.forest.isObstacle(nx, ny);
        });

        if (validMoves.length === 0) return;

        // V64: Adaptive AI Behavior Tree
        // V72: Check Perception
        const distToSnake = Math.abs(this.x - snake.head.x) + Math.abs(this.y - snake.head.y);
        let chosenMove = null;

        // V74: Night Vision Nerf
        let effectivePerception = this.perception;
        if (isNight) effectivePerception = Math.floor(this.perception * 0.5);

        if (distToSnake <= effectivePerception) {
            // Chase (Normal) or Flee (Endgame)
            if (isEndgameHunt) {
                // Flee: Sort by FURTHEST distance
                validMoves.sort((a, b) => {
                    const da = Math.abs((this.x + a.x) - snake.head.x) + Math.abs((this.y + a.y) - snake.head.y);
                    const db = Math.abs((this.x + b.x) - snake.head.x) + Math.abs((this.y + b.y) - snake.head.y);
                    return db - da; // Descending order (Furthest first)
                });
                chosenMove = validMoves[0];
            } else {
                // Chase
                validMoves.sort((a, b) => {
                    const da = Math.abs((this.x + a.x) - snake.head.x) + Math.abs((this.y + a.y) - snake.head.y);
                    const db = Math.abs((this.x + b.x) - snake.head.x) + Math.abs((this.y + b.y) - snake.head.y);
                    return da - db;
                });
                chosenMove = validMoves[0];
            }
        } else {
            // Roam
            chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        }

        this.x += chosenMove.x; this.y += chosenMove.y;
    }
    draw(ctx, alpha = 1.0) {
        const ix = this.prevX + (this.x - this.prevX) * alpha;
        const iy = this.prevY + (this.y - this.prevY) * alpha;
        const px = ix * this.gridSize; const py = iy * this.gridSize;
        const cx = px + this.gridSize / 2; const cy = py + this.gridSize / 2;

        ctx.shadowBlur = 0; // Ensure no bleed from previous draws

        // Innate Human Glow (Halo)
        ctx.save();
        ctx.shadowColor = '#ff2233'; // Subtly saturated neon red
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(255, 34, 51, 0.15)'; // Faint filling to support the halo
        ctx.beginPath(); ctx.arc(cx, cy, this.gridSize * 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#220000';
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, this.gridSize * 0.8, 0, Math.PI * 2); ctx.stroke();

        ctx.beginPath(); ctx.moveTo(cx, cy - 12); ctx.lineTo(cx + 9, cy + 10); ctx.lineTo(cx, cy + 6); ctx.lineTo(cx - 9, cy + 10); ctx.closePath(); ctx.fill();

        ctx.fillStyle = '#ff3333';
        ctx.beginPath(); ctx.arc(cx, cy - 3, 3, 0, Math.PI * 2); ctx.fill();
    }
}

// Forest.js
class Forest {
    constructor(canvasWidth, canvasHeight, arenaWidth, arenaHeight, gridSize, borderX, borderY, borderTop = 0, borderBottom = 0) {
        this.gridSize = gridSize;
        this.canvasWidth = canvasWidth; this.canvasHeight = canvasHeight;
        this.width = arenaWidth; this.height = arenaHeight;
        this.borderX = borderX; this.borderY = borderY;

        // V63: Explicit Border Support
        this.borderTop = borderTop || borderY;
        this.borderBottom = borderBottom || borderY;

        this.cols = Math.floor(this.width / gridSize); this.rows = Math.floor(this.height / gridSize);
        this.trees = new Map(); this.logs = new Map(); this.stars = []; this.weatherParticles = [];
        this.currentWeather = null;
        this.borderFlashes = [];

        this.generateStars();

        this.groundCanvas = document.createElement('canvas'); this.groundCanvas.width = this.width; this.groundCanvas.height = this.height;
        this.renderGroundTexture();

        this.borderCanvas = document.createElement('canvas'); this.borderCanvas.width = this.canvasWidth; this.borderCanvas.height = this.canvasHeight;
        this.renderBorderTexture();

        // V72: Initial generation with dummy values, will be overwritten by Game.startDay
        // V73: Initial generation with dummy values, will be overwritten by Game.startDay
        this.populate(0, 0, 0);
    }

    reset() {
        this.trees.clear(); this.logs.clear(); this.generateStars(); this.weatherParticles = [];
        this.currentWeather = null;
        this.borderFlashes = [];
        // V72: Initial generation with dummy values, will be overwritten by Game.startDay
        // V73: Initial generation with dummy values, will be overwritten by Game.startDay
        this.populate(0, 0, 0);
    }

    triggerFlash(side) {
        this.borderFlashes.push({ side: side, time: 250, maxTime: 250 });
    }

    triggerObstacleFlash(x, y) {
        if (this.trees.has(`${x},${y}`)) {
            const tree = this.trees.get(`${x},${y}`);
            tree.flashTimer = 500;
        } else if (this.logs.has(`${x},${y}`)) {
            const log = this.logs.get(`${x},${y}`);
            const originLog = log.isOrigin ? log : this.logs.get(log.parentId);
            if (originLog) originLog.flashTimer = 500;
        }
    }

    generateStars() {
        // V84: 10% Star Reduction (180 → 162) for improved visual clarity
        this.stars = []; for (let i = 0; i < 162; i++) this.stars.push({ x: Math.random() * this.width, y: Math.random() * this.height, size: Math.random() * 1.5, alpha: 0.3 + Math.random() * 0.7 });
    }

    renderGroundTexture() {
        const ctx = this.groundCanvas.getContext('2d');
        // V49: Greenish-Brown (Moss/Olive) Background
        // Base: Dark Moss (#3a4032)
        ctx.fillStyle = '#3a4032';
        ctx.fillRect(0, 0, this.width, this.height);

        for (let i = 0; i < 200; i++) {
            const x = Math.random() * this.width; const y = Math.random() * this.height;
            const r = 1 + Math.random() * 3;
            // V49: Olive Texture (#4e5741)
            ctx.fillStyle = Math.random() > 0.8 ? '#4e5741' : '#2a3022';
            ctx.globalAlpha = 0.15;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        const g = ctx.createRadialGradient(this.width / 2, this.height / 2, this.width / 3, this.width / 2, this.height / 2, this.width);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.2)'); // Slight vignette
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.globalAlpha = 1.0;
    }

    renderBorderTexture() {
        const ctx = this.borderCanvas.getContext('2d');
        const w = this.canvasWidth; const h = this.canvasHeight;
        const bx = this.borderX;

        // Use asymmetric borders if defined, else fallback to borderY or 0
        const bTop = this.borderTop || this.borderY || 0;
        const bBot = this.borderBottom || this.borderY || 0;

        ctx.clearRect(0, 0, w, h);

        ctx.fillStyle = '#1a120d';
        ctx.beginPath();
        if (bTop > 0 || bBot > 0) {
            ctx.rect(0, 0, w, bTop);          // Top
            ctx.rect(0, h - bBot, w, bBot);     // Bottom
            ctx.rect(0, bTop, bx, h - bTop - bBot);          // Left
            ctx.rect(w - bx, bTop, bx, h - bTop - bBot);     // Right
            ctx.fill();
        }

        ctx.save();
        ctx.clip(); // Clips to the border regions we just drew

        const brickW = 40; const brickH = 20;
        for (let y = 0; y < h; y += brickH) {
            for (let x = 0; x < w; x += brickW) {
                const off = (Math.floor(y / brickH) % 2 === 0) ? 0 : brickW / 2;
                // V63: Strong Dark Brick Constrast for Neon HUD
                ctx.fillStyle = (Math.random() > 0.5) ? '#2a1f1a' : '#1a100a';
                ctx.fillRect(x + off, y, brickW - 2, brickH - 2);
            }
        }
        ctx.restore();

        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        // Stroke the inner edge using Asymmetric limits
        ctx.strokeRect(bx, bTop, w - bx * 2, h - bTop - bBot);
    }

    // V73: Incremental Population
    populate(targetTrees, targetLongLogs, targetShortLogs) {
        // Do NOT clear existing maps. Just add to them.

        const cx = Math.floor(this.cols / 2); const cy = Math.floor(this.rows / 2);
        const safeZone = 5;

        // Helper to count specific types
        const countType = (type) => {
            let count = 0;
            // Iterate map values (expensive? map size is small ~100 items)
            for (const [key, val] of this.logs) {
                // Actually, our previous logic stored 'log' type for both?
                // V71 code: `type: 'long'` for both.
                // We need to differentiate based on length.
                if (val.isOrigin) {
                    if (type === 'log_long' && val.length >= 4) count++;
                    if (type === 'log_short' && val.length <= 3) count++;
                }
            }
            if (type === 'tree') return this.trees.size;
            return count;
        };

        // 1. Calculate Needs
        const neededTrees = Math.max(0, targetTrees - countType('tree'));
        const neededLong = Math.max(0, targetLongLogs - countType('log_long'));
        const neededShort = Math.max(0, targetShortLogs - countType('log_short'));

        // 2. Create Spawn Queue (Mixed Bag)
        let spawnQueue = [];
        for (let i = 0; i < neededTrees; i++) spawnQueue.push('tree');
        for (let i = 0; i < neededLong; i++) spawnQueue.push('log_long');
        for (let i = 0; i < neededShort; i++) spawnQueue.push('log_short');

        // 3. Shuffle Queue (Fisher-Yates)
        for (let i = spawnQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [spawnQueue[i], spawnQueue[j]] = [spawnQueue[j], spawnQueue[i]];
        }

        // 4. Process Queue
        for (const type of spawnQueue) {
            let placed = false;
            let attempts = 0;
            // Logs need more attempts as they are harder to fit
            const maxAttempts = (type === 'tree') ? 100 : 200;

            // V74: Spacing Constraint
            const minDist = 4; // Minimum distance between major obstacles

            while (!placed && attempts < maxAttempts) {
                attempts++;
                const x = Math.floor(Math.random() * this.cols);
                const y = Math.floor(Math.random() * this.rows);

                // Safe Zone & Borders
                if (x < 2 || x >= this.cols - 2 || y < this.borderTop / this.gridSize + 1 || y >= this.rows - 2) continue;
                if (Math.abs(x - cx) < safeZone && Math.abs(y - cy) < safeZone) continue;

                // V74: Check Distance to existing obstacles
                let tooClose = false;
                // Check trees
                for (const [k, v] of this.trees) {
                    const [tx, ty] = k.split(',').map(Number);
                    if (Math.abs(x - tx) + Math.abs(y - ty) < minDist) { tooClose = true; break; }
                }
                if (tooClose) continue;
                // Check logs (roots only for speed)
                for (const [k, v] of this.logs) {
                    if (v.isOrigin) {
                        const [lx, ly] = k.split(',').map(Number);
                        if (Math.abs(x - lx) + Math.abs(y - ly) < minDist) { tooClose = true; break; }
                    }
                }
                if (tooClose) continue;

                if (this.isObstacle(x, y)) continue;

                if (type === 'tree') {
                    this.trees.set(`${x},${y}`, { scale: 1.2 + Math.random() * 0.4 });
                    placed = true;
                } else if (type === 'log_long' || type === 'log_short') {
                    const isLong = (type === 'log_long');
                    const length = isLong ? (4 + Math.floor(Math.random() * 2)) : (2 + Math.floor(Math.random() * 2));
                    const horizontal = Math.random() > 0.5;

                    let fit = true;
                    // Check full length
                    for (let k = 0; k < length; k++) {
                        const checkX = horizontal ? x + k : x;
                        const checkY = horizontal ? y : y + k;
                        if (checkX >= this.cols - 1 || checkY >= this.rows - 1 || this.isObstacle(checkX, checkY)) {
                            fit = false; break;
                        }
                        if (Math.abs(checkX - cx) < safeZone && Math.abs(checkY - cy) < safeZone) { fit = false; break; }
                    }

                    if (fit) {
                        const id = `${x},${y}`;
                        for (let k = 0; k < length; k++) {
                            const lx = horizontal ? x + k : x;
                            const ly = horizontal ? y : y + k;
                            this.logs.set(`${lx},${ly}`, {
                                parentId: id,
                                type: 'long',
                                horizontal,
                                length,
                                isOrigin: (k === 0)
                            });
                        }
                        placed = true;
                    }
                }
            }
        }
    }

    isObstacle(x, y) { return this.trees.has(`${x},${y}`) || this.logs.has(`${x},${y}`); }

    // V63: draw() now takes explicit weather intensity and phase info
    draw(ctx, darkness = 0.0, weatherType = 'normal', weatherIntensity = 1.0, isNightPhase = false) {
        ctx.drawImage(this.groundCanvas, 0, 0);

        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, this.width, this.height);

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, this.width - 4, this.height - 4);
        ctx.restore();

        let r = 5, g = 10, b = 25;
        let a = darkness;

        if (a > 0) { ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`; ctx.fillRect(0, 0, this.width, this.height); }

        if (a > 0.20) {
            ctx.fillStyle = '#ffffff';
            for (const star of this.stars) {
                const twinkle = Math.random() * 0.2;
                const starVisibility = (a - 0.20) * 3;
                ctx.globalAlpha = Math.min(1, starVisibility * star.alpha + twinkle);
                ctx.beginPath(); ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        }

        // Initialize weather if changed
        if (this.currentWeather !== weatherType) {
            this.initWeather(weatherType);
        }

        // V74: Weather is now drawn externally in Game.draw or here?
        // Let's draw it here to ensure it's on top of ground but below UI.
        this.drawWeather(ctx, weatherType, weatherIntensity, isNightPhase);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        // V67: Draw Logs instead of Stones
        // Iterate and draw unique logs (marked by isOrigin)
        for (const [key, data] of this.logs) {
            if (data.isOrigin) {
                const [x, y] = key.split(',').map(Number);
                this.drawLog(ctx, x, y, data);
            }
        }
        for (const [key, data] of this.trees) { const [x, y] = key.split(',').map(Number); this.drawTree(ctx, x, y, data); }
    }

    drawLog(ctx, x, y, data) {
        const size = this.gridSize;
        const cx = x * size + size / 2;
        const cy = y * size + size / 2;

        if (data.flashTimer > 0) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = `rgba(255, 51, 51, ${data.flashTimer / 500})`;
        } else {
            ctx.shadowBlur = 0;
        }

        // Wood Colors
        const barkColor = '#5d4037';
        const innerColor = '#8d6e63';
        const darkBark = '#3e2723';

        // V71: Orientation Support
        const len = data.length * size;
        const w = data.horizontal ? len : size * 0.8;
        const h = data.horizontal ? size * 0.8 : len;
        const radius = size * 0.3;

        // Main Log Body
        ctx.fillStyle = barkColor;
        ctx.strokeStyle = darkBark;
        ctx.lineWidth = 2;

        // Offset to center
        const dx = data.horizontal ? (len / 2) - (size / 2) : 0;
        const dy = data.horizontal ? 0 : (len / 2) - (size / 2);

        ctx.beginPath();
        // Manual Round Rect for compatibility
        ctx.moveTo(cx - w / 2 + dx + radius, cy - h / 2 + dy);
        ctx.lineTo(cx + w / 2 + dx - radius, cy - h / 2 + dy);
        ctx.quadraticCurveTo(cx + w / 2 + dx, cy - h / 2 + dy, cx + w / 2 + dx, cy - h / 2 + dy + radius);
        ctx.lineTo(cx + w / 2 + dx, cy + h / 2 + dy - radius);
        ctx.quadraticCurveTo(cx + w / 2 + dx, cy + h / 2 + dy, cx + w / 2 + dx - radius, cy + h / 2 + dy);
        ctx.lineTo(cx - w / 2 + dx + radius, cy + h / 2 + dy);
        ctx.quadraticCurveTo(cx - w / 2 + dx, cy + h / 2 + dy, cx - w / 2 + dx, cy + h / 2 + dy - radius);
        ctx.lineTo(cx - w / 2 + dx, cy - h / 2 + dy + radius);
        ctx.quadraticCurveTo(cx - w / 2 + dx, cy - h / 2 + dy, cx - w / 2 + dx + radius, cy - h / 2 + dy);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        // Texture lines
        ctx.strokeStyle = darkBark;
        ctx.lineWidth = 1;
        ctx.beginPath();

        if (data.horizontal) {
            ctx.moveTo(cx - w / 2 + dx + 5, cy + dy - 2); ctx.lineTo(cx + w / 2 + dx - 5, cy + dy - 2);
            ctx.moveTo(cx - w / 2 + dx + 10, cy + dy + 2); ctx.lineTo(cx + w / 2 + dx - 10, cy + dy + 2);
        } else {
            // Vertical Texture
            ctx.moveTo(cx + dx - 2, cy - h / 2 + dy + 5); ctx.lineTo(cx + dx - 2, cy + h / 2 + dy - 5);
            ctx.moveTo(cx + dx + 2, cy - h / 2 + dy + 10); ctx.lineTo(cx + dx + 2, cy + h / 2 + dy - 10);
        }
        ctx.stroke();
    }

    drawTree(ctx, x, y, data) {
        const scale = data.scale;
        const px = x * this.gridSize; const py = y * this.gridSize; const size = this.gridSize * scale; const cx = px + this.gridSize / 2; const by = py + this.gridSize;

        if (data.flashTimer > 0) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = `rgba(255, 51, 51, ${data.flashTimer / 500})`;
        } else {
            ctx.shadowBlur = 0;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(cx, by - 5, size / 2, size / 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5d4037'; ctx.fillRect(cx - size * 0.1, by - size * 0.3, size * 0.2, size * 0.3);

        ctx.fillStyle = '#2e7d32'; ctx.strokeStyle = '#1b5e20'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, by - size * 0.9); ctx.lineTo(cx + size * 0.4, by - size * 0.3); ctx.lineTo(cx - size * 0.4, by - size * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    drawBorder(ctx) {
        ctx.drawImage(this.borderCanvas, 0, 0);

        if (this.borderFlashes.length > 0) {
            ctx.save();
            const w = this.canvasWidth; const h = this.canvasHeight;
            const bx = this.borderX;
            const by = this.borderY;

            for (let i = this.borderFlashes.length - 1; i >= 0; i--) {
                const f = this.borderFlashes[i];
                const alpha = (f.time / f.maxTime) * 0.8;

                // V77: Crack-Based Internal Glow instead of flat colored box
                ctx.save();
                ctx.beginPath();
                if (f.side === 'top') ctx.rect(0, 0, w, by);
                else if (f.side === 'bottom') ctx.rect(0, h - by, w, by);
                else if (f.side === 'left') ctx.rect(0, 0, bx, h);
                else if (f.side === 'right') ctx.rect(w - bx, 0, bx, h);
                ctx.clip(); // Restrict to the impacted side

                ctx.strokeStyle = `rgba(255, 60, 0, ${alpha})`;
                ctx.shadowBlur = 15 * (f.time / f.maxTime);
                ctx.shadowColor = '#ff3c00';
                ctx.lineWidth = 2;
                ctx.beginPath();

                const brickW = 40; const brickH = 20;
                for (let y = 0; y <= h; y += brickH) {
                    // Horizontal gaps
                    ctx.moveTo(0, y - 1); ctx.lineTo(w, y - 1);
                    const off = (Math.floor(y / brickH) % 2 === 0) ? 0 : brickW / 2;
                    for (let x = 0; x <= w; x += brickW) {
                        // Vertical gaps
                        ctx.moveTo(x + off - 1, y); ctx.lineTo(x + off - 1, y + brickH);
                    }
                }
                ctx.stroke();
                ctx.restore();

                f.time -= 16;
                if (f.time <= 0) this.borderFlashes.splice(i, 1);
            }
            ctx.restore();
        }
    }

    // V67: Cleaned up for Fireflies Only
    initWeather(type) {
        this.weatherParticles = [];
        this.currentWeather = type;
        if (type !== 'fireflies') return;

        const w = this.width; const h = this.height;
        const count = 50; // Firefly count

        // Instant populate
        for (let i = 0; i < count; i++) {
            this.weatherParticles.push({
                x: Math.random() * w, y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
                alpha: 0.5 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2
            });
        }
    }

    update(dt, type, intensity, isNightPhase, currentDay) {
        // Update local object flashes
        for (const [key, data] of this.trees) { if (data.flashTimer > 0) data.flashTimer -= dt; }
        for (const [key, data] of this.logs) { if (data.isOrigin && data.flashTimer > 0) data.flashTimer -= dt; }

        // Hard Stop
        if (intensity <= 0.01) {
            this.weatherParticles = [];
            return;
        }

        // Allow ONLY fireflies
        if (type !== 'fireflies') {
            this.weatherParticles = [];
            return;
        }

        const w = this.width; const h = this.height;
        const timeScale = dt / 16.666;

        // Fireflies Logic
        // V74: Scale with Day | V84: 10% density reduction
        const day = currentDay || 1;
        const targetCount = Math.round((30 + (day * 15)) * 0.9); // -10% proportional
        if (this.weatherParticles.length < targetCount) {
            this.weatherParticles.push({
                x: Math.random() * w, y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
                // V84: Organic drift target for smooth steering
                targetVx: (Math.random() - 0.5) * 0.3, targetVy: (Math.random() - 0.5) * 0.3,
                driftTimer: 0, driftInterval: 2000 + Math.random() * 3000,
                alpha: 0.5 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2
            });
        }
        for (let i = this.weatherParticles.length - 1; i >= 0; i--) {
            let p = this.weatherParticles[i];

            // V84: Smooth organic drift — periodically pick a calm new target velocity,
            // then lerp toward it each frame instead of random velocity spikes.
            p.driftTimer = (p.driftTimer || 0) + dt;
            if (p.driftTimer >= (p.driftInterval || 3000)) {
                p.driftTimer = 0;
                p.driftInterval = 2000 + Math.random() * 3000;
                p.targetVx = (Math.random() - 0.5) * 0.35;
                p.targetVy = (Math.random() - 0.5) * 0.35;
            }
            // Exponential lerp toward target velocity (eliminates jitter)
            p.vx += (p.targetVx - p.vx) * 0.015 * timeScale;
            p.vy += (p.targetVy - p.vy) * 0.015 * timeScale;

            p.x += p.vx * timeScale; p.y += p.vy * timeScale;
            if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        }
    }

    // Weather Rendering
    // Pure Rendering - No Physics
    drawWeather(ctx, type, intensity, isNightPhase = false) {
        if (this.weatherParticles.length === 0) return;

        // Allow ONLY fireflies
        if (type !== 'fireflies') return;

        ctx.save();
        ctx.globalAlpha = intensity;

        const time = performance.now() / 500;
        for (let p of this.weatherParticles) {
            const pulse = (Math.sin(time + p.phase) + 1) / 2;
            const flicker = 0.5 + (pulse * 0.5);
            const hue = 50 + (pulse * 15);
            ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${p.alpha})`;
            ctx.globalAlpha = intensity * p.alpha * flicker;
            ctx.beginPath(); ctx.arc(p.x, p.y, 2 + pulse, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    }
}

// V79: Incremental Health Tuning (50s strictly)
const CONFIG = { TIME_SCALE: 1, DAY_LENGTH_MS: 60000, HUNGER_TIME_MS: 25000, STARVATION_TIME_MS: 25000, BASE_SPEED_FPS: 12.18, TIRED_SPEED_FPS: 8, MAX_LIVES: 1 };

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width; this.height = canvas.height;
        this.cols = 40; this.rows = 25; this.gridSize = 25;

        // V72: Daily Configurations
        // V74: Tuned Daily Configurations (Higher Perception)
        this.LEVEL_CONFIG = {
            1: { trees: 8, logsShort: 4, logsLong: 4, humans: 2, humanPerception: 0 },   // Unaware
            2: { trees: 10, logsShort: 6, logsLong: 6, humans: 4, humanPerception: 15 }, // Low -> Medium
            3: { trees: 12, logsShort: 7, logsLong: 7, humans: 6, humanPerception: 30 }, // Medium -> High
            4: { trees: 13, logsShort: 8, logsLong: 8, humans: 6, humanPerception: 45 }, // High -> Very High
            5: { trees: 15, logsShort: 10, logsLong: 10, humans: 8, humanPerception: Infinity } // Chase
        };

        this.borderSize = 16;
        this.resizeArena(); // This sets arenaWidth, arenaHeight, borderX, borderY, borderTop, borderBottom

        this.audio = new AudioSystem();

        this.day = 1; this.maxDays = 5;
        this.score = 0; this.lives = 1;
        this.state = 'MENU';
        this.timePlayed = 0;
        this.lastSuperfruitSpawnTime = -30000; // Allow immediate spawn if time met

        // V55: Engine Core
        this.phaseController = new PhaseController();
        this.phaseCount = 1; // Starts at Phase 1 (Day 1 Day)
        this.currentDay = 1; // Calculated from phaseCount

        this.hungerTimer = 0; this.starvationTimer = 0;
        this.dragonFruit = { active: false, x: 0, y: 0 }; this.dragonFruitCount = 0; this.lastDragonFruitTime = 0;
        this.spawnCooldown = 0; // V68: Cooldown between spawns
        this.countdownValue = 0; this.countdownTimer = 0;
        this.shakeTimer = 0; this.inputCooldown = 0; this.currentMusicPhase = 'day';

        // V79: Mega Apple Stats
        this.megaAppleSpawnCount = 0;
        this.megaApple = { active: false, x: 0, y: 0 };

        // V55: Load Meta Stats
        this.metaStats = { bestTime: 0, maxDay: 1, totalRuns: 0 };
        try {
            const stored = localStorage.getItem('snake_forest_stats');
            if (stored) this.metaStats = JSON.parse(stored);
        } catch (e) { }

        this.bindInput();
        window.addEventListener('resize', this.resizeArena.bind(this));

        // V56: Initialize Forest early for Live Background
        // Create dummy forest/snake for background rendering
        this.forest = new Forest(this.canvas.width, this.canvas.height, this.arenaWidth, this.arenaHeight, this.gridSize, this.borderX, this.borderY, this.borderTop, this.borderBottom);
        // We need a dummy snake/food just so draw() doesn't crash if it tries to access them,
        // OR we can update draw() to be safer. But safer is resetGameData() logic.
        // Let's just do a partial init here similar to resetGameData but without starting the game.
        this.snake = new Snake(this.cols, this.rows, this.gridSize);
        this.food = new Food(this.cols, this.rows, this.gridSize, this.forest, this.snake);
        this.humans = [];
        this.spawnHumans(3, 0); // Background ambience, unaware humans
        // Music? Maybe play ambient wind or silence until start.

        this.setState('MENU');
        requestAnimationFrame(this.loop.bind(this));
    }

    setState(newState) {
        this.state = newState;
        if (newState === 'PLAYING') {
            this.audio.setVolumeMultiplier(1.0);
        } else if (newState === 'PAUSED' || newState === 'MENU') {
            // No volume change needed
        } else if (newState === 'DEATH_EVENT') {
            this.audio.setVolumeMultiplier(0.1);
        }

        document.getElementById('start-screen').classList.add('w-hidden');
        document.getElementById('pause-screen').classList.add('w-hidden');
        document.getElementById('game-over-screen').classList.add('w-hidden');

        switch (newState) {
            case 'MENU':
                document.getElementById('start-screen').classList.remove('w-hidden');
                this.updatePauseButton(false);
                // V51: Show Stats
                const tBest = Math.floor(this.metaStats.bestTime / 1000);
                const tBestStr = `${Math.floor(tBest / 60).toString().padStart(2, '0')}:${(tBest % 60).toString().padStart(2, '0')}`;
                const statsDiv = document.getElementById('meta-stats');
                if (statsDiv) {
                    statsDiv.innerHTML = `
                        <div><span class="stat-label">BEST:</span><span class="stat-best">${tBestStr}</span></div>
                        <div><span class="stat-label">MAX DAY:</span><span class="stat-day">${this.metaStats.maxDay}</span></div>
                        <div><span class="stat-label">RUNS:</span><span class="stat-runs">${this.metaStats.totalRuns}</span></div>
                    `;
                }
                break;
            case 'COUNTDOWN':
                this.updatePauseButton(false);
                // V55: Music handled by PhaseController/Reset, but ensure it plays
                if (this.currentMusicPhase === 'day') this.audio.playMusic('day');
                break;
            case 'PLAYING':
                this.updatePauseButton(false);
                break;
            case 'PAUSED':
                document.getElementById('pause-screen').classList.remove('w-hidden');
                this.audio.setVolumeMultiplier(0.2);
                this.updatePauseButton(true);
                // V80: Snapshot authoritative visual phase state for frozen countdown rendering
                this.pausedVisualState = {
                    darkness: this.phaseController.getDarkness(this.phaseCount),
                    weather: this.getWeatherForPhase(this.currentDay, this.phaseCount),
                    isNightPhase: (this.phaseCount % 2 === 0),
                    weatherIntensity: this.phaseController.getWeatherIntensity(this.phaseCount % 2 === 0)
                };
                break;
            case 'DEATH_EVENT':
                this.updatePauseButton(false);
                break;
            case 'GAME_OVER':
                document.getElementById('game-over-screen').classList.remove('w-hidden');
                this.audio.stopMusic();
                this.updatePauseButton(false);
                break;
        }
        this.updateUI();
    }

    resetGameData() {
        this.timePlayed = 0;

        // V55: Reset Core Engine
        this.phaseController.reset();
        this.phaseCount = 1;
        this.currentDay = 1; // This is for phase controller, not game day

        this.lives = CONFIG.MAX_LIVES;
        this.currentSpeed = CONFIG.BASE_SPEED_FPS;
        this.hungerTimer = CONFIG.HUNGER_TIME_MS; this.starvationTimer = CONFIG.STARVATION_TIME_MS;
        this.dragonFruitCount = 0; // Total active fruits
        this.lastDragonFruitTime = 0;
        this.lastSuperfruitSpawnTime = -30000; // Allow immediate spawn if time met

        // V67: Superfruit Specific Counters
        this.bananaSpawnCount = 0;
        this.blueBerrySpawnCount = 0;
        this.orangeSpawnCount = 0;
        // V76: Litchee Tracking
        this.litcheeSpawnCount = 0;
        this.litcheeActive = false; // Run-specific flag
        this.endgameHumansEaten = 0;
        this.confetti = null;
        this.endgamePhase = undefined;
        // Endgame cleanup
        this.spawnQueue = undefined;
        this.spawnQueueReset = false;
        this.spawnIntervalTimer = 0;
        this.endgameLiveWeatherIntensity = undefined;
        this.endgameWeatherType = 'normal';
        this.endgameHudAlpha = 1.0;
        this.endgameSuppressDraw = false;
        this.dissolveList = [];
        this.endgameCountdownValue = 0;
        if (this.snake) { this.snake.goldMode = false; }

        // V79: Mega Apple Tracking
        this.megaAppleSpawnCount = 0;

        this.snake = new Snake(this.cols, this.rows, this.gridSize); // To reset shield status
        this.dragonFruit = { active: false, x: 0, y: 0, type: 'LIFE' };
        this.megaApple = { active: false, x: 0, y: 0 };
        this.resizeArena();

        // V63 Fix: Explicitly pass calculated borders to Forest constructor
        // This ensures the visual border matches the logical border from the start.
        // Was: new Forest(cols, rows...) -> INCORRECT signature
        // Must be: new Forest(canvasW, canvasH, arenaW, arenaH, gridSize, borderX, borderY, borderTop, borderBottom)
        this.forest = new Forest(this.canvas.width, this.canvas.height, this.arenaWidth, this.arenaHeight, this.gridSize, this.borderX, this.borderY, this.borderTop, this.borderBottom);

        // FIX: Re-render with correct values
        this.forest.renderBorderTexture();

        this.input = { x: 1, y: 0 }; this.nextInput = { x: 1, y: 0 };
        this.inputCooldown = 0;

        this.currentMusicPhase = 'day';
        this.audio.playMusic('day');
        this.audio.setVolumeMultiplier(1.0);

        this.day = 1;
        this.currentDay = 1;
        this.startDay(); // Start at Day 1
    }

    startDay() {
        const config = this.LEVEL_CONFIG[this.day] || this.LEVEL_CONFIG[5];

        this.forest.currentWeather = 'clear';
        // V73: Initial Population (Clear first, then populate)
        this.forest.trees.clear(); this.forest.logs.clear();
        this.forest.populate(config.trees, config.logsLong, config.logsShort);

        this.snake.reset(this.cols, this.rows); // Reset snake position and length
        this.food.respawn(this.snake, this.forest); // Respawn food after obstacles and snake are set

        this.humans = [];
        this.spawnHumans(config.humans, config.humanPerception);

        this.phaseController.setDay(this.day); // Set phase controller to current game day
        this.currentMusicPhase = 'day';
        this.currentSpeed = CONFIG.BASE_SPEED_FPS; // Reset speed for new day
        this.hungerTimer = CONFIG.HUNGER_TIME_MS; // Full hunger
        this.starvationTimer = CONFIG.STARVATION_TIME_MS; // Full starvation buffer
        this.spawnCooldown = 0; // Reset spawn cooldown for superfruits
    }

    spawnHumans(count, perception, minDistOverride = null) {
        // V81: Incremental spawn — only adds `count` new humans into valid empty spaces.
        // Existing humans are preserved; new ones are kept well apart from all others.
        const safeZone = 6;  // Chebyshev-distance safe zone around snake head
        const minDist = minDistOverride !== null ? minDistOverride : 14; // Manhattan-distance minimum between any two humans (prevents clustering)

        for (let i = 0; i < count; i++) {
            let valid = false; let attempts = 0;
            let hx = 1, hy = 1;

            while (!valid && attempts < 150) {
                attempts++;
                hx = 1 + Math.floor(Math.random() * (this.cols - 2));
                hy = 1 + Math.floor(Math.random() * (this.rows - 2));

                // 1. Forest obstacle check (trees / logs)
                if (this.forest.isObstacle(hx, hy)) continue;

                // 2. Anti-clustering: minimum distance from ALL existing humans
                if (this.humans.some(h => Math.abs(h.x - hx) + Math.abs(h.y - hy) < minDist)) continue;

                // 3. Snake safe zone (Chebyshev — keeps humans off the snake's immediate area)
                if (Math.abs(hx - this.snake.head.x) < safeZone &&
                    Math.abs(hy - this.snake.head.y) < safeZone) continue;

                // 4. Snake body occupancy
                if (this.snake.checkCollision(hx, hy)) continue;

                valid = true;
            }

            // Fallback: if no valid spot found after exhaustive search, skip this human
            if (!valid) continue;

            this.humans.push(new Human(this.cols, this.rows, this.gridSize, this.forest, perception, hx, hy));
        }
    }

    // V53 Compat
    getCycleIntensity(p) { return 1.0; }

    loop(currentTime) {
        try {
            requestAnimationFrame(this.loop.bind(this));

            // V56: Live Background for Menu
            if (this.state === 'MENU') {
                const realDelta = currentTime - (this.lastTime || currentTime);
                this.lastTime = currentTime;
                const darkness = 0.6; // Slightly dark for menu
                // V67: Fix for potential crash if internal state is not ready
                if (this.forest) {
                    this.forest.update(realDelta, 'fireflies', 0.5, true); // Update fireflies for menu background
                    this.draw(1.0, darkness, 'fireflies', 0.5, true); // Draw with fireflies
                }
                return;
            }

            if (this.state === 'PAUSED') return;
            if (this.state === 'GAME_OVER') return;

            let realDelta = currentTime - this.lastTime;
            this.lastTime = currentTime;
            if (realDelta > 100) realDelta = 100;

            if (this.state === 'DEATH_EVENT' || this.state === 'COUNTDOWN') {
                // V80: Use frozen phase snapshot if resuming from pause, else derive live values.
                // This prevents the COUNTDOWN from flashing the wrong day/night background.
                const pvs = this.pausedVisualState;
                const darkness = pvs ? pvs.darkness : this.phaseController.getDarkness(this.phaseCount);
                const weather = pvs ? pvs.weather : this.getWeatherForPhase(this.currentDay, this.phaseCount);
                const isNightPhase = pvs ? pvs.isNightPhase : (this.phaseCount % 2 === 0);
                const weatherIntensity = pvs ? pvs.weatherIntensity : this.phaseController.getWeatherIntensity(isNightPhase);

                // Keep forest alive (particles, fireflies etc.) during COUNTDOWN.
                this.forest.update(realDelta, weather, weatherIntensity, isNightPhase);

                if (this.state === 'DEATH_EVENT') {
                    this.deathMessageTimer -= realDelta;
                    this.draw(1, darkness, weather, weatherIntensity, isNightPhase);

                    this.ctx.save();
                    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
                    this.ctx.fillStyle = '#ff2233'; this.ctx.font = 'bold 100px Outfit, sans-serif';
                    this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
                    this.ctx.shadowColor = '#ff2233'; this.ctx.shadowBlur = 40;

                    let alpha = 1;
                    if (this.deathMessageTimer > 1300) alpha = (1500 - this.deathMessageTimer) / 200;
                    if (this.deathMessageTimer < 200) alpha = Math.max(0, this.deathMessageTimer / 200);
                    this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

                    this.ctx.fillText(this.deathMessage, 0, 0);
                    this.ctx.restore();

                    if (this.deathMessageTimer <= 0) {
                        this.startCountdown(3);
                    }
                } else {
                    this.countdownTimer -= realDelta;
                    this.draw(1, darkness, weather, weatherIntensity, isNightPhase);
                    this.drawCountdown();
                    if (this.countdownTimer <= 0) {
                        this.countdownValue--; this.countdownTimer = 1000;
                        if (this.countdownValue <= 0) {
                            // V80: Clear pause snapshot so live phase takes over immediately.
                            this.pausedVisualState = null;
                            this.setState('PLAYING');
                            this.lastTime = performance.now(); this.accumulatedTime = 0; this.inputCooldown = 0;
                        }
                    }
                }
                return;
            }

            // Game Logic Update
            if (this.state === 'PLAYING' || this.state === 'ENDGAME_HUNT' || this.state === 'VICTORY') {
                const dt = realDelta * CONFIG.TIME_SCALE;
                this.timePlayed += dt;

                // V55: Master Clock Update (only during normal play, not endgame)
                if (this.state === 'PLAYING') {
                    const signal = this.phaseController.update(dt);

                    if (signal === 'TRIGGER_AUDIO') {
                        // 56s Mark: Start Crossfade to NEXT phase
                        const isCurrentPhaseOdd = (this.phaseCount % 2 !== 0);
                        const nextTrack = isCurrentPhaseOdd ? 'night' : 'day';
                        this.audio.playMusic(nextTrack);
                        this.currentMusicPhase = nextTrack;
                    }
                    else if (signal === 'NEXT_DAY' || signal === 'PHASE_SWITCH') {
                        // 60s Mark: Hard Switch
                        this.phaseCount++;
                        // Check if we need to increment Day (Every 2 phases)
                        // Phase 1 (Day 1 Day) -> Phase 2 (Day 1 Night) -> Phase 3 (Day 2 Day)
                        const newDay = Math.ceil(this.phaseCount / 2);

                        if (newDay > this.day) { // Use this.day for game logic
                            this.nextDay(newDay);
                        }
                    }
                }

                if (this.shakeTimer > 0) this.shakeTimer--;
                if (this.inputCooldown > 0) this.inputCooldown -= realDelta;

                let baseFPS = this.currentSpeed;
                // V86: Health-vitality speed: 0.6x at critical, 1.0x at full health.
                // At critical health (<0.3), suppress fullness penalty — dying snake shouldn't be
                // double-penalized with slow speed AND near-death state simultaneously.
                const hf = this.snake.healthFactor !== undefined ? this.snake.healthFactor : 1.0;
                const vitalityMult = 0.6 + 0.4 * hf;
                const fullnessPenalty = hf < 0.3 ? 0 : this.snake.getFullnessPenalty();
                baseFPS = baseFPS * vitalityMult * (1 - fullnessPenalty);

                const stepSize = 1000 / baseFPS;
                this.accumulatedTime += realDelta;
                while (this.accumulatedTime > stepSize) { this.update(stepSize, this.timePlayed); this.accumulatedTime -= stepSize; }

                // Only spawn fruits during normal play
                if (this.state === 'PLAYING') {
                    this.spawnDragonFruit(dt); // Pass dt for cooldown
                    this.spawnMegaApple(dt); // V79: Mega Apple Night Spawner
                }

                // V73: Get Authoritative Darkness using Phase Count
                // During endgame, smoothly interpolated overrides take precedence (RCA 6)
                const isEndgameActive = (this.state === 'ENDGAME_HUNT');
                const darkness = isEndgameActive
                    ? (this.endgameDarkness || 0)
                    : this.phaseController.getDarkness(this.phaseCount);

                // During endgame: decouple weather from PhaseController entirely (RCA 6)
                // Use the snapshotted + lerped weather values instead of live phase calculation.
                const isNightPhase = isEndgameActive ? false : (this.phaseCount % 2 === 0);
                const weather = isEndgameActive
                    ? (this.endgameWeatherType || 'normal')
                    : this.getWeatherForPhase(this.day, this.phaseCount);
                const weatherIntensity = isEndgameActive
                    ? (this.endgameLiveWeatherIntensity !== undefined ? this.endgameLiveWeatherIntensity : 0)
                    : this.phaseController.getWeatherIntensity(isNightPhase);

                this.forest.update(dt, weather, weatherIntensity, isNightPhase, this.day);

                this.draw(this.accumulatedTime / stepSize, darkness, weather, weatherIntensity, isNightPhase);

                // V63: Version Tag
                this.ctx.save();
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.font = '12px sans-serif';
                this.ctx.fillText('v76', 5, this.canvas.height - 5);
                this.ctx.restore();

                this.updateUI();
            }
        } catch (e) {
            console.error(e);
            alert("Game Error (Loop): " + e.message + "\n\n" + e.stack);
            this.state = 'ERROR';
        }
    }

    getWeatherForPhase(day, phase) {
        // V59: Night Weather Redesign - STRICTLY Fireflies only
        const isNight = (phase % 2 === 0);
        if (isNight) return 'fireflies';

        // Day Weather Schedule (Always Clear in v67)
        return 'normal';
    }

    drawCountdown() {
        this.ctx.save(); this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 150px Outfit, sans-serif'; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
        this.ctx.shadowColor = '#00ff88'; this.ctx.shadowBlur = 30;
        this.ctx.fillText(this.countdownValue > 0 ? this.countdownValue : "GO!", 0, 0);
        this.ctx.restore();
    }

    spawnMegaApple(dt) {
        if (this.megaApple.active) return;

        // V79: Mega Apple Constraints
        // 1. Must be Night Phase (Even phaseCount)
        const isNight = (this.phaseCount % 2 === 0);
        if (!isNight) return;

        // 2. Max 5 allowed times per total game
        if (this.megaAppleSpawnCount >= 5) return;

        // 3. Spawns exactly once per Night Phase. We can track this using the current phase array.
        // Or simply checking if timePlayed exceeds a certain boundary per night, but since we are bounded
        // to max 5 over 5 nights, we can just allow a single random chance roll per night phase that it exists.
        // Actually, just a simple 0.05% chance per frame during any night phase while active is false.

        // Limit to 1 spawn per night (we use phaseCount. If a mega apple was already spawned this phase, wait for next night)
        if (this.lastMegaApplePhase === this.phaseCount) return;

        if (Math.random() > 0.005) return; // Very low chance per frame to feel organic

        let valid = false; let attempts = 0;
        while (!valid && attempts < 10) {
            const x = 1 + Math.floor(Math.random() * (this.cols - 2));
            const y = 1 + Math.floor(Math.random() * (this.rows - 2));

            if (!this.forest.isObstacle(x, y) && !this.snake.checkCollision(x, y)) {
                this.megaApple = { active: true, x, y };
                this.megaAppleSpawnCount++;
                this.lastMegaApplePhase = this.phaseCount; // Lock out further spawns this night
                valid = true;
            }
            attempts++;
        }
    }

    spawnDragonFruit(dt) {
        // V72: Strict Superfruit Tuning
        if (this.dragonFruit.active) return;

        // 1. Global Cooldown (Wait 30s after ANY spawn)
        // We use lastSuperfruitSpawnTime which records the TIME of the last spawn.
        if (this.timePlayed < this.lastSuperfruitSpawnTime + 30000) return;

        // 2. Local Cooldown (random delay)
        if (this.spawnCooldown > 0) {
            this.spawnCooldown -= dt;
            return;
        }

        const timeMs = this.timePlayed;

        // Check availability strictly
        const canSpawnBanana = (timeMs > 45000 && this.bananaSpawnCount < 2);
        const canSpawnBerry = (timeMs > 90000 && this.blueBerrySpawnCount < 1);
        const canSpawnOrange = (timeMs > 150000 && this.orangeSpawnCount < 3);

        // V76: Litchee Logic (4 mins = 240000ms)
        // V82: Litchee — 5-min eligibility gate (300,000ms), 100% guaranteed spawn once eligible.
        const canSpawnLitchee = (!this.litcheeActive && this.litcheeSpawnCount === 0 && timeMs > 300000);

        const availableTypes = [];
        if (canSpawnBanana) availableTypes.push('LIFE');

        // 90% Probability Logic (other superfruits unchanged)
        if (canSpawnBerry && Math.random() < 0.90) availableTypes.push('SHIELD');
        if (canSpawnOrange && Math.random() < 0.90) availableTypes.push('RESET');

        // V82: Litchee — 100% spawn when eligible (no random gate)
        if (canSpawnLitchee) availableTypes.push('LITCHEE');

        if (availableTypes.length === 0) return;

        // 3. Random Chance to start spawn process (don't spawn every frame immediately)
        if (Math.random() > 0.01) return;

        const selectedType = availableTypes[Math.floor(Math.random() * availableTypes.length)];

        let valid = false; let attempts = 0;
        while (!valid && attempts < 10) {
            const x = 1 + Math.floor(Math.random() * (this.cols - 2));
            const y = 1 + Math.floor(Math.random() * (this.rows - 2));

            if (!this.forest.isObstacle(x, y) && !this.snake.checkCollision(x, y)) {
                this.dragonFruit = { active: true, x, y, type: selectedType };
                valid = true;

                // V72: Record Spawn Time for global interval
                this.lastSuperfruitSpawnTime = this.timePlayed;
                this.spawnCooldown = 10000 + Math.random() * 10000; // Add a local cooldown for next fruit

                if (selectedType === 'LIFE') {
                    this.bananaSpawnCount++;
                }
                else if (selectedType === 'SHIELD') this.blueBerrySpawnCount++;
                else if (selectedType === 'RESET') this.orangeSpawnCount++;
                else if (selectedType === 'LITCHEE') {
                    this.litcheeSpawnCount++;
                    this.litcheeActive = true;
                }
            }
            attempts++;
        }
    }

    update(dt, gameTime) {
        if (this.currentDay > 5 && this.phaseCount > 10 && this.state === 'PLAYING') {
            // V76: End of Day 5 Night -> Trigger Endgame Hunt
            this.startEndgameHunt();
            return;
        }

        if (this.state === 'ENDGAME_HUNT' || this.state === 'VICTORY') {
            this.updateEndgame(dt, gameTime);
            return;
        }

        // V86: Health Calculation (master attribute)
        const totalHealth = CONFIG.HUNGER_TIME_MS + CONFIG.STARVATION_TIME_MS;
        let currentHealth = 0;
        if (this.hungerTimer > 0) currentHealth = CONFIG.STARVATION_TIME_MS + this.hungerTimer;
        else currentHealth = this.starvationTimer;

        this.snake.healthFactor = Math.max(0, currentHealth / totalHealth);

        // V86: Continuous health-to-length sync every tick — 1 segment shed per tick max (organic feel)
        this.enforceHealthLength(false);

        if (this.hungerTimer > 0) {
            this.hungerTimer -= (dt * 1);
        } else {
            this.starvationTimer -= (dt * 1);
            if (this.starvationTimer <= 0) { this.handleDeath("STARVED"); return; }
        }

        this.input = this.nextInput;
        const snakeState = this.snake.update(this.input, this.arenaWidth, this.arenaHeight, gameTime, this.forest);

        // Weather Physics Update
        // Calculate parameters here (same as used in draw)
        const isNightPhase = (this.phaseCount % 2 === 0);
        const weather = this.getWeatherForPhase(this.currentDay, this.phaseCount);
        const intensity = this.phaseController.getWeatherIntensity(isNightPhase);

        // V88: Restore forest update logic if needed, currently handled in loop
        // (Removing redundant comment)

        if (snakeState === 'dead') { this.handleDeath("SELF_HIT"); return; }
        else if (snakeState === 'bounce_wall' || snakeState === 'bounce_obstacle') {
            this.audio.playSFX('bounce');
            this.snake.invincibleTimer = 15;
            this.snake.damageGlowTimer = 500; // Localized Neon Red Glow Length

            if (this.snake.respawnSafetyTimer > 0) {
                // V87: Immunity window — bounce is visual-only, no health/shrink penalty.
                const head = this.snake.head;
                const nextX = head.x + this.input.x;
                const nextY = head.y + this.input.y;
                if (snakeState === 'bounce_wall') {
                    if (nextX < 0) this.forest.triggerFlash('left');
                    else if (nextX >= this.cols) this.forest.triggerFlash('right');
                    else if (nextY < 0) this.forest.triggerFlash('top');
                    else if (nextY >= this.rows) this.forest.triggerFlash('bottom');
                } else if (snakeState === 'bounce_obstacle') {
                    this.forest.triggerObstacleFlash(nextX, nextY);
                }
                this.input = { x: -this.input.x, y: -this.input.y };
                this.nextInput = this.input;
                this.inputCooldown = 250;
                this.shakeTimer = 0;
            } else {
                // V78: Progressive Damage and Shrink Implementation
                // A brutal 15,000ms penalty (1/4 of default hunger pool). Shield reduces it to 3,000.
                const penalty = this.snake.shieldActive ? 3000 : 15000;

                // Apply damage to hunger pool first, then spill over to starvation pool.
                if (this.hungerTimer >= penalty) {
                    this.hungerTimer -= penalty;
                } else {
                    const overflow = penalty - this.hungerTimer;
                    this.hungerTimer = 0;
                    this.starvationTimer -= overflow;
                }

                // V86: Force recalculate healthFactor immediately after damage, then sync length.
                const totalHealthD = CONFIG.HUNGER_TIME_MS + CONFIG.STARVATION_TIME_MS;
                const currentHealthD = this.hungerTimer > 0
                    ? CONFIG.STARVATION_TIME_MS + this.hungerTimer
                    : this.starvationTimer;
                this.snake.healthFactor = Math.max(0, currentHealthD / totalHealthD);

                // V86: Immediate proportional shrink on collision (up to 2 segments to feel impact).
                const preLength = this.snake.segments.length;
                this.enforceHealthLength(false);
                if (this.snake.segments.length === preLength && preLength > this.snake.baseLength) {
                    this.snake.shrink();
                }

                // Death only when health fully drained.
                if (this.starvationTimer <= 0) {
                    this.handleDeath(snakeState === 'bounce_wall' ? "WALL_HIT" : "LOG_HIT");
                    return;
                }

                const head = this.snake.head;
                const nextX = head.x + this.input.x;
                const nextY = head.y + this.input.y;

                if (snakeState === 'bounce_wall') {
                    if (nextX < 0) this.forest.triggerFlash('left');
                    else if (nextX >= this.cols) this.forest.triggerFlash('right');
                    else if (nextY < 0) this.forest.triggerFlash('top');
                    else if (nextY >= this.rows) this.forest.triggerFlash('bottom');
                } else if (snakeState === 'bounce_obstacle') {
                    this.forest.triggerObstacleFlash(nextX, nextY);
                }

                this.input = { x: -this.input.x, y: -this.input.y };
                this.nextInput = this.input;
                this.inputCooldown = 250;
                this.shakeTimer = 0;
            }
        }

        if (this.snake.invincibleTimer > 0) this.snake.invincibleTimer--;
        if (this.snake.superFruitGlowTimer > 0) this.snake.superFruitGlowTimer -= dt;
        if (this.snake.phaseThroughTimer > 0) this.snake.phaseThroughTimer -= dt; // V76: Litchee Timer
        if (this.snake.respawnSafetyTimer > 0) this.snake.respawnSafetyTimer -= dt; // V87: Respawn immunity

        if (this.snake.head.x === this.food.x && this.snake.head.y === this.food.y) this.eatFood(gameTime);
        if (this.megaApple.active && this.snake.head.x === this.megaApple.x && this.snake.head.y === this.megaApple.y) this.eatMegaApple();
        if (this.dragonFruit.active && this.snake.head.x === this.dragonFruit.x && this.snake.head.y === this.dragonFruit.y) this.eatDragonFruit();

        for (const human of this.humans) {
            // V64: Pass Day/Night Context for Adaptive AI
            human.update(this.snake, this.currentDay, isNightPhase);
            // V87: Human kill suppressed during respawn safety window
            if (this.snake.checkCollision(human.x, human.y) && this.snake.respawnSafetyTimer <= 0) {
                this.handleDeath("HUMAN_CAUGHT"); return;
            }
        }
    }
    updateEndgame(dt, gameTime) {
        const cw = this.canvas.width, ch = this.canvas.height;
        const CLEANUP_DURATION = 13000; // Reduced from 15s to remove gap
        const FADE_TIME = 1500;
        const BG_TRANS_DURATION = 2000;
        const ANNOUNCE_DURATION = 3000;
        const COUNTDOWN_DURATION = 3000;
        const VGLOW_DURATION = 1500;
        const VTEXT_DURATION = 3000;
        const SURVIVOR_DURATION = 3000;
        const CONFETTI_DURATION = 8000;

        this.endgameTimer = (this.endgameTimer || 0) + dt;

        // Jitter Fix: force sync segments during stationary transition phases
        const stationaryPhases = ['CLEANUP', 'BG_TRANSITION'];
        if (stationaryPhases.includes(this.endgamePhase)) {
            this.snake.prevSegments = JSON.parse(JSON.stringify(this.snake.segments));
        }

        // ── Phase 1: CLEANUP (Dissolve Entities) ────────────────────────────────────
        if (this.endgamePhase === 'CLEANUP') {
            const progress = Math.min(1, this.endgameTimer / CLEANUP_DURATION);
            this.endgameLiveWeatherIntensity = this.endgameWeatherIntensity * (1 - progress);
            this.endgameHudAlpha = Math.max(0, 1.0 - progress);

            if (this.dissolveList) {
                for (const obs of this.dissolveList) {
                    if (this.endgameTimer >= obs.startTime) {
                        obs.alpha = Math.max(0, 1.0 - (this.endgameTimer - obs.startTime) / FADE_TIME);
                    }
                    if (obs.type === 'human' && obs.data && obs.data.humanRef) {
                        obs.x = obs.data.humanRef.x; obs.y = obs.data.humanRef.y;
                    }
                }
            }

            if (this.endgameTimer >= CLEANUP_DURATION) {
                this.dissolveList = [];
                this.humans = [];
                this.endgamePhase = 'BG_TRANSITION';
                this.endgameTimer = 0;
            }
            return;
        }

        // ── Phase 2: BG_TRANSITION (Smooth Darkness Lerp) ───────────────────────────
        if (this.endgamePhase === 'BG_TRANSITION') {
            const progress = Math.min(1, this.endgameTimer / BG_TRANS_DURATION);
            this.endgameDarkness = (this.endgameStartDarkness || 0) * (1 - progress);
            if (this.endgameTimer >= BG_TRANS_DURATION) {
                this.endgameDarkness = 0;
                this.endgamePhase = 'HUMAN_SPAWN'; // Skip to staged spawn
                this.endgameTimer = 0;
                this.spawnQueueReset = true;
                this.audio.playMusic('endgame'); // V78: Start Victory Theme
            }
            return;
        }

        // ── Phase 3: HUMAN_SPAWN (Staged 20 humans) ─────────────────────────────────
        if (this.endgamePhase === 'HUMAN_SPAWN') {
            if (this.spawnQueueReset) {
                this.humans = [];
                this.spawnQueue = 20;
                this.spawnIntervalTimer = 0;
                this.spawnQueueReset = false;
                this.endgameSuppressDraw = false; // Enable entities draw
            }
            this.spawnIntervalTimer += dt;
            if (this.spawnIntervalTimer >= 400 && this.spawnQueue > 0) {
                this.spawnHumans(1, 50, 6);
                this.spawnIntervalTimer = 0;
                this.spawnQueue--;
            }
            if (this.spawnQueue <= 0) {
                this.endgamePhase = 'SNAKE_SPAWN';
                this.endgameTimer = 0;
            }
            return;
        }

        // ── Phase 4: SNAKE_SPAWN (Center Re-introduction) ───────────────────────────
        if (this.endgamePhase === 'SNAKE_SPAWN') {
            this.snake.reset(this.cols, this.rows);
            this.snake.goldMode = true;
            this.snake.healthFactor = 1.0;
            this.hungerTimer = CONFIG.HUNGER_TIME_MS;
            this.starvationTimer = CONFIG.STARVATION_TIME_MS;
            this.enforceHealthLength(true);
            this.input = { x: 1, y: 0 }; this.nextInput = { x: 1, y: 0 };

            this.endgamePhase = 'ANNOUNCE';
            this.endgameTimer = 0;
            return;
        }

        // ── Phase 5: ANNOUNCE & COUNTDOWN ───────────────────────────────────────────
        if (this.endgamePhase === 'ANNOUNCE') {
            if (this.endgameTimer < 500) this.announceAlpha = this.endgameTimer / 500;
            else if (this.endgameTimer < 2500) this.announceAlpha = 1.0;
            else this.announceAlpha = Math.max(0, 1.0 - (this.endgameTimer - 2500) / 500);

            if (this.endgameTimer >= ANNOUNCE_DURATION) {
                this.announceAlpha = 0;
                this.endgamePhase = 'HUNT_COUNTDOWN';
                this.endgameTimer = 0;
            }
            return;
        }
        if (this.endgamePhase === 'HUNT_COUNTDOWN') {
            this.endgameCountdownValue = Math.max(0, 3 - Math.floor(this.endgameTimer / 1000));
            if (this.endgameTimer >= COUNTDOWN_DURATION) {
                this.endgameCountdownValue = 0;
                this.endgamePhase = 'HUNT';
                this.endgameTimer = 0;
            }
            return;
        }

        // ── HUNT ────────────────────────────────────────────────────────────────────
        if (this.endgamePhase === 'HUNT') {
            this.input = this.nextInput;
            this.snake.invincibleTimer = 1;
            const snakeState = this.snake.update(this.input, this.arenaWidth, this.arenaHeight, gameTime, this.forest);

            for (let i = this.humans.length - 1; i >= 0; i--) {
                const h = this.humans[i];
                h.update(this.snake, 5, false, true);
                if (this.snake.checkCollision(h.x, h.y)) {
                    this.humans.splice(i, 1);
                    this.audio.playSFX('eat');
                    this.endgameHumansEaten++;
                }
            }
            if (this.humans.length === 0) {
                this.endgamePhase = 'VICTORY_GLOW';
                this.endgameTimer = 0;
                // Transition snake to gold dust: convert segments to dissolve objects
                this.dissolveList = this.snake.segments.map(s => ({
                    type: 'snake_segment', x: s.x, y: s.y, alpha: 1.0,
                    vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2,
                    startTime: 0
                }));
            }
            return;
        }

        // ── Phase 6: VICTORY SEQUENCE ───────────────────────────────────────────────
        if (this.endgamePhase === 'VICTORY_GLOW') {
            this.endgameGlowAlpha = Math.min(0.75, (this.endgameTimer / VGLOW_DURATION) * 0.75);
            // Update snake segments (gold dust)
            for (const s of this.dissolveList) {
                s.x += s.vx * (dt / 16); s.y += s.vy * (dt / 16);
                s.alpha = Math.max(0, 1.0 - this.endgameTimer / VGLOW_DURATION);
            }
            if (this.endgameTimer >= VGLOW_DURATION) {
                this.endgamePhase = 'VICTORY_TEXT';
                this.endgameTimer = 0;
            }
            return;
        }
        if (this.endgamePhase === 'VICTORY_TEXT') {
            if (this.endgameTimer >= VTEXT_DURATION) {
                this.endgamePhase = 'SURVIVOR_MSG';
                this.endgameTimer = 0;
                // Init Golden Sparkler Shower
                this.confetti = [];
                const colors = ['#ffe600', '#ffd700', '#ffffff', '#fff200'];
                for (let i = 0; i < 150; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 2 + Math.random() * 8;
                    this.confetti.push({
                        x: cw / 2, y: ch / 2,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed - 2,
                        radius: 2 + Math.random() * 3,
                        alpha: 1.0,
                        shimmer: Math.random() * 10,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        gravity: 0.15,
                        type: 'burst'
                    });
                }
                for (let i = 0; i < 100; i++) {
                    this.confetti.push({
                        x: Math.random() * cw, y: -20 - Math.random() * ch,
                        vx: (Math.random() - 0.5) * 2,
                        vy: 2 + Math.random() * 3,
                        radius: 1.5 + Math.random() * 2,
                        alpha: 0.5 + Math.random() * 0.5,
                        shimmer: Math.random() * 10,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        gravity: 0.05,
                        type: 'rain'
                    });
                }
            }
            return;
        }
        if (this.endgamePhase === 'SURVIVOR_MSG' || this.endgamePhase === 'CONFETTI') {
            // Smooth Golden Sparkler Physics
            if (this.confetti) {
                for (const c of this.confetti) {
                    c.x += c.vx * (dt / 16);
                    c.y += c.vy * (dt / 16);
                    c.vy += c.gravity * (dt / 16);
                    c.shimmer += 0.1 * (dt / 16);

                    if (c.type === 'rain' && c.y > this.canvas.height) {
                        c.y = -20; c.x = Math.random() * this.canvas.width;
                    }
                }
            }
            if (this.endgamePhase === 'SURVIVOR_MSG' && this.endgameTimer >= SURVIVOR_DURATION) {
                this.endgamePhase = 'CONFETTI';
                this.endgameTimer = 0;
            } else if (this.endgamePhase === 'CONFETTI' && this.endgameTimer >= CONFETTI_DURATION) {
                this.quitToMenu();
            }
            return;
        }
        // ── THE_END: hold briefly then return to menu ─────────────────────────────────
        if (this.endgamePhase === 'THE_END') {
            if (this.endgameTimer >= 1500) {
                this.quitToMenu();
            }
        }
    }

    startEndgameHunt() {
        this.state = 'ENDGAME_HUNT';
        this.endgamePhase = 'CLEANUP';
        this.endgameTimer = 0;
        this.endgameGlowAlpha = 0;
        this.announceAlpha = 0;
        this.endgameHumansEaten = 0;
        this.confetti = [];
        this.endgameCountdownValue = 0;
        this.spawnQueueReset = true;
        this.spawnQueue = undefined;
        this.endgameHudAlpha = 1.0;
        this.snake.goldMode = false;

        // Sync segments to prevent jitter during locked phase
        this.snake.prevSegments = JSON.parse(JSON.stringify(this.snake.segments));

        // Night BG Lock: hold darkness at snapshot, NO lerp during CLEANUP (RCA 3)
        this.endgameStartDarkness = this.phaseController.getDarkness(this.phaseCount);
        this.endgameDarkness = this.endgameStartDarkness;

        // Weather snapshot
        const isNightPhase = (this.phaseCount % 2 === 0);
        this.endgameWeatherIntensity = this.phaseController.getWeatherIntensity(isNightPhase);
        this.endgameLiveWeatherIntensity = this.endgameWeatherIntensity;
        this.endgameWeatherType = isNightPhase ? 'fireflies' : 'normal';

        // UNIFIED DISSOLVE LIST (Deterministic Sequence): Trees -> Logs -> Humans -> Fruits -> Snake
        const CLEANUP_DURATION = 13000; // Reduced from 15s to remove gap
        const FADE_TIME = 1500;
        this.dissolveList = [];

        // 1. Trees
        for (const [key, data] of this.forest.trees) {
            const [x, y] = key.split(',').map(Number);
            this.dissolveList.push({ type: 'tree', x, y, alpha: 1.0, data: { scale: data.scale || 1.4 }, delay: 0 });
        }
        // 2. Logs (Short then Long)
        const allLogs = Array.from(this.forest.logs.entries())
            .filter(([k, v]) => v.isOrigin)
            .sort((a, b) => (a[1].length || 1) - (b[1].length || 1));
        for (const [key, data] of allLogs) {
            const [x, y] = key.split(',').map(Number);
            this.dissolveList.push({ type: 'log', x, y, alpha: 1.0, data: { ...data }, delay: 1 });
        }
        // 3. Humans
        for (const h of this.humans) {
            this.dissolveList.push({ type: 'human', x: h.x, y: h.y, alpha: 1.0, data: { humanRef: h }, delay: 2 });
        }
        // 4. All Fruits
        if (this.food && this.food.x !== undefined) {
            this.dissolveList.push({ type: 'food', x: this.food.x, y: this.food.y, alpha: 1.0, data: {}, delay: 3 });
        }
        if (this.dragonFruit && this.dragonFruit.active) {
            this.dissolveList.push({ type: 'superfruit', x: this.dragonFruit.x, y: this.dragonFruit.y, alpha: 1.0, data: { fruitType: this.dragonFruit.type || 'LIFE' }, delay: 3 });
        }
        if (this.megaApple && this.megaApple.active) {
            this.dissolveList.push({ type: 'megaapple', x: this.megaApple.x, y: this.megaApple.y, alpha: 1.0, data: {}, delay: 3 });
        }
        // 5. Snake (Last to dissolve)
        this.dissolveList.push({ type: 'snake', x: 0, y: 0, alpha: 1.0, data: {}, delay: 4 });

        // Calculate StartTimes based on groups to ensure overlap but priority
        const groupDelay = 1800; // Slightly faster group sequence
        const n = this.dissolveList.length;
        const SPREAD_TIME = CLEANUP_DURATION - FADE_TIME;

        // Better: stagger individually within groups
        this.dissolveList.forEach((item, i) => {
            // Priority: item.delay * groupDelay + (i % someFactor) for spread
            item.startTime = (item.delay * groupDelay) + (Math.random() * 1000);
            // Ensure no item starts later than SPREAD_TIME
            item.startTime = Math.min(item.startTime, SPREAD_TIME);
        });

        this.endgameSuppressDraw = true;
        this.forest.trees.clear();
        this.forest.logs.clear();
        this.dragonFruit.active = false;
        this.megaApple.active = false;
        if (this.food) this.food.x = undefined; // Disable regular food without destroying instance
        this.spawnCooldown = 999999; // Disable fruit spawners

        this.hungerTimer = CONFIG.HUNGER_TIME_MS;
        this.starvationTimer = CONFIG.STARVATION_TIME_MS;
        this.snake.healthFactor = 1.0;
        this.accumulatedTime = 0;
        this.inputCooldown = 0;
        this.lastTime = performance.now();
    }

    eatFood(gameTime) {
        this.snake.eat(gameTime); this.audio.playSFX('eat'); this.food.respawn(this.snake, this.forest);

        // V79: Incremental Health Math (+20% or essentially +10,000ms given 50,000ms max scale, allowable to 60,000ms cap)
        // Check current health pool. It fills starvation first, then hunger.
        let toHeal = 10000;

        if (this.starvationTimer < CONFIG.STARVATION_TIME_MS) {
            const starvNeeds = CONFIG.STARVATION_TIME_MS - this.starvationTimer;
            if (toHeal > starvNeeds) {
                this.starvationTimer = CONFIG.STARVATION_TIME_MS;
                toHeal -= starvNeeds;
            } else {
                this.starvationTimer += toHeal;
                toHeal = 0;
            }
        }

        if (toHeal > 0) {
            // Cap at 120% (or +10000 on top of config hunger time if pushing it, but let's cap at CONFIG.HUNGER_TIME_MS explicitly or slightly above. Rule says cap 120%.)
            // 100% = 50,000. 120% = 60,000. So max hungerTimer can be CONFIG.HUNGER_TIME_MS + 10000.
            this.hungerTimer = Math.min(this.hungerTimer + toHeal, CONFIG.HUNGER_TIME_MS + 10000);
        }
    }

    eatMegaApple() {
        this.megaApple.active = false;
        this.audio.playSFX('eat');

        // V79: Full 100% Recovery (Fills exactly to 50,000ms max allowed)
        this.hungerTimer = CONFIG.HUNGER_TIME_MS;
        this.starvationTimer = CONFIG.STARVATION_TIME_MS;
        this.snake.healthFactor = 1.0;

        // V79: Stronger glow effect for Mega Apple consumption
        this.snake.superFruitGlowColor = '#ff2255'; // Vibrant Crimson
        this.snake.superFruitGlowTimer = 4000;

        this.snake.eat(performance.now());
    }

    eatDragonFruit() {
        // V67: Dynamic Effect based on Type
        const type = this.dragonFruit.type || 'LIFE'; // Fallback

        if (type === 'LIFE') {
            // Cap at 3 Lives
            if (this.lives < 3) this.lives++;
            this.snake.superFruitGlowColor = '#fff200'; // Yellow
        } else if (type === 'SHIELD') {
            this.snake.shieldActive = true;
            // V86: Blueberry now ALSO restores full health on consumption
            this.hungerTimer = CONFIG.HUNGER_TIME_MS;
            this.starvationTimer = CONFIG.STARVATION_TIME_MS;
            this.snake.healthFactor = 1.0;
            // Immediately snap length to match restored health (instant recovery feel)
            this.enforceHealthLength(true);
            this.snake.superFruitGlowColor = '#0088ff'; // Deep Neon Blue
        } else if (type === 'RESET') {
            // V67: Reset Length to 3 + Full Health
            this.snake.resetLength(3);
            this.snake.superFruitGlowColor = '#ff6600'; // Neon Deep Orange
            // Full Health Restore
            this.hungerTimer = CONFIG.HUNGER_TIME_MS;
            this.starvationTimer = CONFIG.STARVATION_TIME_MS;
            this.snake.healthFactor = 1.0;
        } else if (type === 'LITCHEE') {
            // V82: 90-second phase-through duration (was 45s)
            this.snake.phaseThroughTimer = 90000;
            this.snake.superFruitGlowColor = '#c0c0c0'; // Neon Silver
        }
        // Each type manages healthFactor explicitly above.
        // Do NOT set healthFactor=1.0 here — LITCHEE must NOT get a free heal.

        this.dragonFruit.active = false;  // MUST deactivate fruit after eating
        this.audio.playSFX('eat');        // MUST play eat sound for all types

        // V63: Trigger Glow Effect
        this.snake.superFruitGlowTimer = 3000;
    }

    // V86: enforceHealthLength — unified health-to-size synchronizer.
    // targetLength = baseLength + round(healthFactor * (maxLength - baseLength))
    // e.g. hf=1.0 → 12, hf=0.5 → 7-8, hf=0.0 → base(3)
    // Shielded snakes: effective hf floors at 0.5 to reflect 80% damage reduction benefit.
    enforceHealthLength(immediate = false) {
        const hf = this.snake.healthFactor !== undefined ? this.snake.healthFactor : 1.0;
        const base = this.snake.baseLength;
        const max = this.snake.maxLength;

        // Shield benefit: length drain is halved (80% dmg reduction → slower health loss)
        const effectiveHF = this.snake.shieldActive ? Math.max(hf, 0.5) : hf;
        const targetLength = base + Math.round(effectiveHF * (max - base));
        const clampedTarget = Math.max(base, Math.min(max, targetLength));

        if (immediate) {
            // Snap: used after a full heal (blueberry, mega apple)
            while (this.snake.segments.length > clampedTarget && this.snake.segments.length > base) {
                this.snake.shrink();
            }
        } else {
            // Gradual: proportional shedding — more segments when deficit is large.
            // Shed up to 3 per tick to keep size visually synced with health drops.
            const deficit = this.snake.segments.length - clampedTarget;
            const shedsAllowed = deficit >= 4 ? 3 : deficit >= 2 ? 2 : 1;
            let shedCount = 0;
            while (
                shedCount < shedsAllowed &&
                this.snake.segments.length > clampedTarget &&
                this.snake.segments.length > base
            ) {
                this.snake.shrink();
                if (this.snake.prevSegments && this.snake.prevSegments.length > this.snake.segments.length) {
                    this.snake.prevSegments.length = this.snake.segments.length;
                }
                shedCount++;
            }
        }
    }

    nextDay(newDay) {
        this.day = newDay; // V73: Sync 'day' prop
        this.currentDay = newDay; // Sync legacy prop

        const config = this.LEVEL_CONFIG[newDay] || this.LEVEL_CONFIG[5];

        this.snake.permanentGrow();
        // V73: Use populate for incremental growth
        this.forest.populate(config.trees, config.logsLong, config.logsShort);

        // V81: Incremental Human Spawning — mirrors obstacle persistence logic.
        //  - Existing humans stay exactly where they are.
        //  - Only the additional headcount required for this day is spawned.
        //  - Existing humans get their perception upgraded to the new day level.
        const delta = config.humans - this.humans.length;
        if (delta > 0) {
            this.spawnHumans(delta, config.humanPerception);
        }
        // Upgrade perception of all previously-spawned humans to match the new day.
        for (const h of this.humans) {
            h.perception = config.humanPerception;
        }

        this.currentSpeed = Math.min(22, CONFIG.BASE_SPEED_FPS + (newDay * 0.5));
    }

    handleDeath(reason) {
        if (this.lives > 1) {
            this.lives--; this.audio.playSFX('hit_stone');
            // V87: Safe respawn placement + 3-second immunity window
            this.safeRespawnSnake();
            this.snake.respawnSafetyTimer = 3000;
            this.hungerTimer = CONFIG.HUNGER_TIME_MS;
            this.starvationTimer = CONFIG.STARVATION_TIME_MS;
            this.input = { x: 1, y: 0 }; this.nextInput = { x: 1, y: 0 };
            this.snake.invincibleTimer = 30;
            this.inputCooldown = 0; this.accumulatedTime = 0; this.lastTime = performance.now();

            // V77: Contextual Death Message before 3,2,1
            this.deathMessage = (reason === "HUMAN_CAUGHT") ? "HUNTED!" : "CRASHED!";
            this.deathMessageTimer = 1500;
            this.setState('DEATH_EVENT');

            return;
        }
        this.lives = 0;
        this.gameOver(reason);
    }

    // V87: Finds a safe spawn tile away from obstacles and humans.
    // Falls back to center (original snake.reset behavior) if no valid spot found.
    safeRespawnSnake() {
        const MIN_HUMAN_DIST = 8; // Manhattan distance clearance from any human
        let placed = false;

        for (let attempt = 0; attempt < 150; attempt++) {
            // Exclude border rows/cols (1 cell margin) and far edges
            const sx = 2 + Math.floor(Math.random() * (this.cols - 4));
            const sy = 2 + Math.floor(Math.random() * (this.rows - 4));

            // Check obstacle at head and 2 body cells to the left (starting direction = right)
            if (this.forest.isObstacle(sx, sy)) continue;
            if (this.forest.isObstacle(sx - 1, sy)) continue;
            if (this.forest.isObstacle(sx - 2, sy)) continue;

            // Ensure no human is within the safe zone
            const tooCloseToHuman = this.humans.some(h =>
                Math.abs(h.x - sx) + Math.abs(h.y - sy) < MIN_HUMAN_DIST
            );
            if (tooCloseToHuman) continue;

            // Valid position found — reset to defaults then reposition segments
            this.snake.reset(this.cols, this.rows);
            const baseLen = this.snake.segments.length;
            for (let i = 0; i < baseLen; i++) {
                this.snake.segments[i] = { x: sx - i, y: sy };
            }
            this.snake.prevSegments = this.snake.segments.map(s => ({ ...s }));
            placed = true;
            break;
        }

        if (!placed) {
            // Fallback: center of arena (original behavior)
            this.snake.reset(this.cols, this.rows);
        }
    }

    draw(alpha, darkness = 0.0, weather = 'normal', weatherIntensity = 1.0, isNightPhase = false) {
        this.ctx.fillStyle = '#2f2521';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const dx = this.shakeTimer > 0 ? (Math.random() - 0.5) * 10 : 0;
        const dy = this.shakeTimer > 0 ? (Math.random() - 0.5) * 10 : 0;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(this.borderX, this.borderY, this.arenaWidth, this.arenaHeight);
        this.ctx.clip();
        this.ctx.translate(this.borderX + dx, this.borderY + dy);

        // V59: Pass currentDay for Firefly Progression
        this.forest.draw(this.ctx, darkness, weather, weatherIntensity, isNightPhase, this.currentDay);

        // ENDGAME DISSOLVE LIST: render all fading objects (trees, logs, humans, fruits) (RCA 1+2)
        if (this.state === 'ENDGAME_HUNT' && this.dissolveList && this.dissolveList.length > 0) {
            for (const obs of this.dissolveList) {
                if (obs.alpha <= 0) continue;
                this.ctx.save();
                this.ctx.globalAlpha = obs.alpha;

                if (obs.type === 'tree') {
                    if (typeof this.forest.drawTree === 'function') {
                        // FIX: Forest.drawTree in v76 expects an object {scale: number}
                        this.forest.drawTree(this.ctx, obs.x, obs.y, { scale: obs.data.scale || 1.4 });
                    } else {
                        const gs = this.gridSize;
                        const cx2 = obs.x * gs + gs / 2; const by = obs.y * gs + gs;
                        const sz = gs * (obs.data.scale || 1.4);
                        this.ctx.fillStyle = '#3e2723';
                        this.ctx.fillRect(cx2 - sz * 0.1, by - sz * 0.3, sz * 0.2, sz * 0.3);
                        this.ctx.fillStyle = '#1b5e20';
                        this.ctx.beginPath(); this.ctx.moveTo(cx2, by - sz * 0.9);
                        this.ctx.lineTo(cx2 + sz * 0.4, by - sz * 0.2);
                        this.ctx.lineTo(cx2 - sz * 0.4, by - sz * 0.2);
                        this.ctx.closePath(); this.ctx.fill();
                    }
                } else if (obs.type === 'log') {
                    const gs = this.gridSize;
                    const lx = obs.x * gs; const ly = obs.y * gs;
                    const len = (obs.data.length || 3) * gs;
                    this.ctx.fillStyle = '#5d3a1a';
                    this.ctx.shadowColor = '#3e2723'; this.ctx.shadowBlur = 4;
                    if (obs.data.horizontal) {
                        this.ctx.fillRect(lx, ly + gs * 0.2, len, gs * 0.6);
                    } else {
                        this.ctx.fillRect(lx + gs * 0.2, ly, gs * 0.6, len);
                    }
                    this.ctx.shadowBlur = 0;
                } else if (obs.type === 'human') {
                    // Draw human at live position (humanRef tracks movement)
                    const hRef = obs.data && obs.data.humanRef;
                    if (hRef) hRef.draw(this.ctx, alpha);
                } else if (obs.type === 'food') {
                    // Simple food circle
                    const gs = this.gridSize;
                    const cx2 = obs.x * gs + gs / 2; const cy = obs.y * gs + gs / 2;
                    this.ctx.fillStyle = '#ff3333';
                    this.ctx.shadowColor = '#ff3333'; this.ctx.shadowBlur = 12;
                    this.ctx.beginPath(); this.ctx.arc(cx2, cy, gs * 0.35, 0, Math.PI * 2); this.ctx.fill();
                    this.ctx.shadowBlur = 0;
                } else if (obs.type === 'superfruit') {
                    // Glow dot for superfruit
                    const gs = this.gridSize;
                    const cx2 = obs.x * gs + gs / 2; const cy = obs.y * gs + gs / 2;
                    const colors = { LIFE: '#ffe600', SHIELD: '#0088ff', RESET: '#ff6600', LITCHEE: '#e0e0e0' };
                    const col = colors[obs.data.fruitType] || '#ffffff';
                    this.ctx.fillStyle = col;
                    this.ctx.shadowColor = col; this.ctx.shadowBlur = 20;
                    this.ctx.beginPath(); this.ctx.arc(cx2, cy, gs * 0.42, 0, Math.PI * 2); this.ctx.fill();
                    this.ctx.shadowBlur = 0;
                } else if (obs.type === 'megaapple') {
                    const gs = this.gridSize;
                    const cx2 = obs.x * gs + gs / 2; const cy = obs.y * gs + gs / 2;
                    this.ctx.fillStyle = '#cc0022';
                    this.ctx.shadowColor = '#ff1133'; this.ctx.shadowBlur = 24;
                    this.ctx.beginPath(); this.ctx.arc(cx2, cy, gs * 0.48, 0, Math.PI * 2); this.ctx.fill();
                    this.ctx.shadowBlur = 0;
                } else if (obs.type === 'snake') {
                    this.snake.draw(this.ctx, obs.alpha, false);
                } else if (obs.type === 'snake_segment') {
                    const gs = this.gridSize;
                    const cx = obs.x * gs + gs / 2;
                    const cy = obs.y * gs + gs / 2;
                    this.ctx.fillStyle = '#ffd700';
                    this.ctx.shadowColor = '#ffd700';
                    this.ctx.shadowBlur = 15;
                    this.ctx.beginPath();
                    this.ctx.arc(cx, cy, gs * 0.3 * obs.alpha, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.shadowBlur = 0;
                }

                this.ctx.restore();
            }
        }

        // Only draw food/humans/fruits when NOT in endgame suppression mode (RCA 2)
        if (!this.endgameSuppressDraw) {
            this.food.draw(this.ctx);

            // V79: Mega Apple Rendering
            if (this.megaApple.active) {
                const px = this.megaApple.x * this.gridSize; const py = this.megaApple.y * this.gridSize;
                const cx = px + this.gridSize / 2; const cy = py + this.gridSize / 2;
                const pulse = (Math.sin(performance.now() / 150) + 1) / 2;
                this.ctx.save(); this.ctx.translate(cx, cy);
                this.ctx.shadowBlur = 40 + (pulse * 30); this.ctx.shadowColor = '#ff1133';
                const scale = 1.3 + (pulse * 0.2);
                this.ctx.scale(scale, scale);
                this.ctx.fillStyle = '#cc0022';
                this.ctx.beginPath();
                this.ctx.arc(-5, +3, 8, 0, Math.PI * 2);
                this.ctx.arc(+5, +3, 8, 0, Math.PI * 2);
                this.ctx.arc(0, -5, 8, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillStyle = '#ffd700';
                this.ctx.beginPath(); this.ctx.arc(0, 0, 4, 0, Math.PI * 2); this.ctx.fill();
                this.ctx.fillStyle = '#76ff03'; this.ctx.shadowBlur = 0;
                this.ctx.beginPath(); this.ctx.ellipse(0, -12, 10, 4, Math.PI / 4, 0, Math.PI * 2); this.ctx.fill();
                this.ctx.restore();
            }

            // Dragon Fruit / Superfruits
            if (this.dragonFruit.active) {
                const px = this.dragonFruit.x * this.gridSize; const py = this.dragonFruit.y * this.gridSize;
                const pulse = (Math.sin(performance.now() / 150) + 1) / 2;
                const cx = px + this.gridSize / 2; const cy = py + this.gridSize / 2;
                const type = this.dragonFruit.type || 'LIFE';
                this.ctx.save(); this.ctx.translate(cx, cy);
                if (type === 'SHIELD') {
                    this.ctx.shadowBlur = 30 + (pulse * 20); this.ctx.shadowColor = '#0088ff';
                    const scale = 0.8 + (pulse * 0.2); this.ctx.scale(scale, scale);
                    this.ctx.fillStyle = '#0088ff';
                    this.ctx.beginPath(); this.ctx.arc(0, 0, 10, 0, Math.PI * 2); this.ctx.fill();
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.beginPath(); this.ctx.arc(-3, -3, 3, 0, Math.PI * 2); this.ctx.fill();
                } else if (type === 'RESET') {
                    this.ctx.shadowBlur = 30 + (pulse * 20); this.ctx.shadowColor = '#ff6600';
                    const size = 18 * (0.9 + pulse * 0.2);
                    this.ctx.fillStyle = '#ff6600'; this.ctx.fillRect(-size / 2, -size / 2, size, size);
                    this.ctx.strokeStyle = '#ffffff'; this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(-size / 2 + 3, -size / 2 + 3, size - 6, size - 6);
                } else if (type === 'LITCHEE') {
                    this.ctx.shadowBlur = 30 + (pulse * 20); this.ctx.shadowColor = '#c0c0c0';
                    const scale = 1.0 + (pulse * 0.2); this.ctx.scale(scale, scale);
                    this.ctx.fillStyle = '#e0e0e0';
                    this.ctx.beginPath(); this.ctx.arc(0, 0, 9, 0, Math.PI * 2); this.ctx.fill();
                    this.ctx.strokeStyle = '#c0c0c0'; this.ctx.lineWidth = 3;
                    this.ctx.beginPath(); this.ctx.arc(0, 0, 14, 0, Math.PI * 2); this.ctx.stroke();
                } else {
                    this.ctx.shadowBlur = 30 + (pulse * 20); this.ctx.shadowColor = '#ffe600';
                    this.ctx.rotate(Math.sin(performance.now() / 500) * 0.2);
                    const scale = 1.2 + (pulse * 0.3); this.ctx.scale(scale, scale);
                    this.ctx.lineWidth = 6; this.ctx.strokeStyle = '#fff200'; this.ctx.lineCap = 'round';
                    this.ctx.beginPath(); this.ctx.moveTo(-8, -8); this.ctx.quadraticCurveTo(0, 5, 8, -8); this.ctx.stroke();
                }
                this.ctx.restore(); this.ctx.shadowBlur = 0;
            }

            this.humans.forEach(h => h.draw(this.ctx, alpha));
        }

        // Snake rendering overhaul for endgame cinematic
        let shouldDrawSnake = (this.state !== 'GAME_OVER' && !this.endgameSuppressDraw);
        if (this.state === 'ENDGAME_HUNT') {
            const visiblePhases = ['ANNOUNCE', 'HUNT_COUNTDOWN', 'HUNT'];
            shouldDrawSnake = visiblePhases.includes(this.endgamePhase);
        }
        if (shouldDrawSnake) {
            this.snake.draw(this.ctx, alpha, this.snake.goldMode || false);
        }
        this.ctx.restore(); // Restore from Clip

        // V63: Border Rendering (Pre-rendered)
        this.forest.drawBorder(this.ctx);

        // V63: Weather Overlay (Unclipped, starts from Screen Top)
        this.ctx.save();
        this.ctx.translate(this.borderX, 0); // Align X with Arena, Y with Screen Top
        this.forest.drawWeather(this.ctx, weather, weatherIntensity, isNightPhase, this.currentDay);
        this.ctx.restore();

        // Endgame overlays — HUNT_COUNTDOWN, ANNOUNCE, VICTORY_GLOW, VICTORY_TEXT, SURVIVOR_MSG, confetti, THE_END
        if (this.state === 'ENDGAME_HUNT') {
            const cw = this.canvas.width;
            const ch = this.canvas.height;

            // HUNT_COUNTDOWN: 3…2…1 before player control restores
            if (this.endgamePhase === 'HUNT_COUNTDOWN' && this.endgameCountdownValue > 0) {
                this.ctx.save();
                this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
                this.ctx.shadowColor = '#00ff88'; this.ctx.shadowBlur = 50;
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 160px Outfit, sans-serif';
                this.ctx.fillText(String(this.endgameCountdownValue), cw / 2, ch / 2);
                this.ctx.restore();
            }

            // ANNOUNCE: "IT'S YOUR TIME TO HUNT!" neon red
            if (this.announceAlpha > 0) {
                this.ctx.save();
                this.ctx.globalAlpha = this.announceAlpha;
                this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
                this.ctx.font = 'bold 68px Outfit, sans-serif';
                this.ctx.shadowColor = '#ff2233'; this.ctx.shadowBlur = 50;
                this.ctx.fillStyle = '#ff2233';
                this.ctx.fillText("IT'S YOUR TIME TO HUNT!", cw / 2, ch / 2);
                this.ctx.restore();
            }

            // Golden glow overlay (VICTORY_GLOW → THE_END)
            const glowPhases = ['VICTORY_GLOW', 'VICTORY_TEXT', 'SURVIVOR_MSG', 'CONFETTI', 'THE_END'];
            if (glowPhases.includes(this.endgamePhase) && this.endgameGlowAlpha > 0) {
                this.ctx.save();
                this.ctx.fillStyle = `rgba(255, 180, 0, ${this.endgameGlowAlpha * 0.45})`;
                this.ctx.fillRect(0, 0, cw, ch);
                this.ctx.restore();
            }

            // Sequential Authoritative Text Rendering
            if (this.endgamePhase === 'VICTORY_TEXT') {
                this.ctx.save();
                this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
                this.ctx.shadowColor = '#00ff88'; this.ctx.shadowBlur = 60;
                this.ctx.fillStyle = '#00ff88';
                this.ctx.font = 'bold 52px Outfit, sans-serif';
                this.ctx.fillText('YOU SURVIVED!', cw / 2, ch / 2 - 44);
                this.ctx.font = 'bold 34px Outfit, sans-serif';
                this.ctx.fillText('YOU ARE NOW OFFICIALLY A SURVIVOR', cw / 2, ch / 2 + 24);
                this.ctx.restore();
            } else if (this.endgamePhase === 'SURVIVOR_MSG' || this.endgamePhase === 'CONFETTI') {
                this.ctx.save();
                this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
                this.ctx.shadowColor = '#ffffff'; this.ctx.shadowBlur = 60;
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 64px Outfit, sans-serif';
                this.ctx.fillText('THANK YOU FOR PLAYING!', cw / 2, ch / 2);
                this.ctx.restore();
            }

            // Golden Sparkler Shower
            if (['VICTORY_TEXT', 'SURVIVOR_MSG', 'CONFETTI'].includes(this.endgamePhase) && this.confetti && this.confetti.length > 0) {
                this.ctx.save();
                for (const c of this.confetti) {
                    const opacity = c.alpha * (0.6 + Math.sin(c.shimmer) * 0.4);
                    this.ctx.globalAlpha = opacity;
                    this.ctx.fillStyle = c.color;
                    this.ctx.shadowColor = c.color;
                    this.ctx.shadowBlur = 10;
                    this.ctx.beginPath();
                    this.ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                this.ctx.restore();
            }

            // THE_END: brief hold before menu
            if (this.endgamePhase === 'THE_END') {
                const endAlpha = Math.min(1.0, (this.endgameTimer || 0) / 800);
                this.ctx.save();
                this.ctx.globalAlpha = endAlpha;
                this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
                this.ctx.shadowColor = '#ffffff'; this.ctx.shadowBlur = 80;
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 96px Outfit, sans-serif';
                this.ctx.fillText('THE END.', cw / 2, ch / 2 + 100);
                this.ctx.restore();
            }
        }
    }

    updateUI() {
        const hudLeft = document.getElementById('hud-left');
        const hudCenter = document.getElementById('hud-center');
        const hudRight = document.getElementById('hud-right');
        if (!hudCenter) return;

        const isActive = (this.state === 'PLAYING' || this.state === 'COUNTDOWN' || this.state === 'PAUSED');
        const isEndgame = (this.state === 'ENDGAME_HUNT');

        // Toggle all three HUD panels together
        [hudLeft, hudCenter, hudRight].forEach(el => {
            if (!el) return;
            if (isActive) {
                el.style.display = 'flex';
                el.style.opacity = '1';
                el.style.pointerEvents = '';
            } else if (isEndgame) {
                // Keep HUD visible during endgame but fade it out via endgameHudAlpha
                el.style.display = 'flex';
                const a = (this.endgameHudAlpha !== undefined) ? Math.max(0, this.endgameHudAlpha) : 1;
                el.style.opacity = String(a);
                el.style.pointerEvents = a < 0.05 ? 'none' : '';
            } else {
                el.style.display = 'none';
                el.style.opacity = '1';
                el.style.pointerEvents = '';
            }
        });

        // Pause/sound control buttons — fade with HUD during endgame
        const pauseBtn = document.getElementById('pause-btn');
        const soundBtn = document.getElementById('sound-btn');
        if (isEndgame) {
            const a = (this.endgameHudAlpha !== undefined) ? Math.max(0, this.endgameHudAlpha) : 1;
            if (pauseBtn) { pauseBtn.style.display = ''; pauseBtn.style.opacity = String(a); pauseBtn.style.pointerEvents = a < 0.05 ? 'none' : ''; }
            if (soundBtn) { soundBtn.style.display = ''; soundBtn.style.opacity = String(a); soundBtn.style.pointerEvents = a < 0.05 ? 'none' : ''; }
        } else {
            if (pauseBtn) { pauseBtn.style.display = isActive ? '' : 'none'; pauseBtn.style.opacity = '1'; pauseBtn.style.pointerEvents = ''; }
            if (soundBtn) { soundBtn.style.display = isActive ? '' : 'none'; soundBtn.style.opacity = '1'; soundBtn.style.pointerEvents = ''; }
        }

        if (!isActive && !isEndgame) return;

        const t = Math.floor(this.timePlayed / 1000);
        const timeStr = `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;

        const isNight = (this.phaseCount % 2 === 0);
        let cycleText, cycleColor, cycleShadow;

        if (isNight) {
            cycleText = 'NIGHT';
            cycleColor = '#b388ff';
            cycleShadow = '0 0 10px #b388ff, 0 0 20px #b388ff';
        } else {
            cycleText = 'DAY';
            cycleColor = '#ffe066';
            cycleShadow = '0 0 10px #ffe066, 0 0 20px #ffe066';
        }

        // Center: Day/Night label + Time
        hudCenter.innerHTML = `
            <div class="stat-item" style="color:${cycleColor}; text-shadow: ${cycleShadow}; font-weight: bold;">${cycleText} ${this.currentDay}/5</div>
            <div class="stat-item neon-red-text">TIME SURVIVED: ${timeStr}</div>
        `;

        // Left: Heart icons — one per remaining life
        // No stat-item class — that class hardlocks font-size to 1.1rem
        if (hudLeft) {
            const hearts = Array.from({ length: Math.max(0, this.lives) })
                .map(() => `<span style="font-size:1.4rem;font-weight:700;color:#ff00de;text-shadow:0 0 10px #ff00de,0 0 20px #ff00de,0 0 30px #c000c0;">❤️</span>`)
                .join('');
            hudLeft.innerHTML = hearts || '';
        }

        // Right: Control hints (M / P / ESC)
        if (hudRight) {
            const hint = (key, label) =>
                `<span style="color:var(--accent-color);text-shadow:0 0 6px var(--accent-color);">
                    <span style="color:#fff;font-weight:bold;border:1px solid rgba(255,255,255,0.4);padding:1px 5px;border-radius:3px;background:rgba(255,255,255,0.08);text-shadow:0 0 4px #fff;">${key}</span>&nbsp;${label}
                </span>`;
            hudRight.innerHTML = hint('M', 'SOUND') + hint('P', 'PAUSE') + hint('ESC', 'EXIT');
        }
    }

    updatePauseButton(isPaused) {
        const btn = document.getElementById('pause-btn');
        if (!btn) return;
        const svgPlay = `<svg viewBox="0 0 24 24" class="neon-icon"><path d="M8 5v14l11-7z"/></svg>`;
        const svgPause = `<svg viewBox="0 0 24 24" class="neon-icon"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        if (isPaused) { btn.innerHTML = svgPlay; btn.classList.add('btn-red'); btn.classList.remove('btn-green'); }
        else { btn.innerHTML = svgPause; btn.classList.add('btn-green'); btn.classList.remove('btn-red'); }
    }

    resizeArena() {
        this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
        const minBorder = 16;
        const topUIBuffer = 20; // Fixed 36px Top (20+16) for HUD alignment

        // 1. Calculate Horizontal Geometry first
        const availableW = this.canvas.width - (minBorder * 2);
        this.cols = Math.floor(availableW / this.gridSize);
        this.arenaWidth = this.cols * this.gridSize;

        // This is the reference size for the Side Borders
        this.borderX = (this.canvas.width - this.arenaWidth) / 2;

        // 2. Calculate Vertical Geometry
        // Goal: Bottom Border should match Side Border (borderX) for symmetry
        // We use borderX as the "Minimum Bottom Border" (instead of minBorder)
        const targetBottom = Math.max(minBorder, this.borderX);

        // Calculate available height allowing for fixed Top and target Bottom
        const topBorderTotal = topUIBuffer + minBorder;
        const availableH = this.canvas.height - topBorderTotal - targetBottom;

        this.rows = Math.floor(availableH / this.gridSize);
        this.arenaHeight = this.rows * this.gridSize;

        // 3. Finalize
        this.borderTop = topBorderTotal; // Fixed 36px

        // Bottom takes the exact remainder. 
        // Since we calculated rows based on (Height - Top - SideWidth),
        // The remainder (borderBottom) will be >= SideWidth.
        this.borderBottom = this.canvas.height - this.arenaHeight - this.borderTop;

        this.borderY = this.borderTop;
        this.borderSize = minBorder;
    }

    bindInput() {
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase(); const code = e.code;
            if (key === 'm') document.getElementById('sound-btn')?.click();
            if (this.state === 'MENU') {
                if (code === 'Space') { this.start(); e.preventDefault(); }
                return;
            }
            if (this.state === 'GAME_OVER') {
                if (code === 'Space') { this.restart(); e.preventDefault(); }
                return;
            }
            if (this.state === 'PAUSED') {
                if (code === 'Space' || key === 'p') { this.togglePause(); e.preventDefault(); }
                if (code === 'Escape') { this.quitToMenu(); e.preventDefault(); }
                return;
            }
            if (this.state === 'PLAYING' || this.state === 'COUNTDOWN') {
                if (code === 'Escape' || key === 'p') { this.togglePause(); e.preventDefault(); return; }
            }

            // Allow directional input during ENDGAME_HUNT (snake must remain controllable)
            if (this.state !== 'PLAYING' && this.state !== 'ENDGAME_HUNT') return;
            if (this.inputCooldown > 0) return;
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d"].indexOf(key) > -1) {
                if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(code) > -1) e.preventDefault();
            }
            switch (key) {
                case 'arrowup': case 'w': if (this.input.y === 0) this.nextInput = { x: 0, y: -1 }; break;
                case 'arrowdown': case 's': if (this.input.y === 0) this.nextInput = { x: 0, y: 1 }; break;
                case 'arrowleft': case 'a': if (this.input.x === 0) this.nextInput = { x: -1, y: 0 }; break;
                case 'arrowright': case 'd': if (this.input.x === 0) this.nextInput = { x: 1, y: 0 }; break;
            }
        });
    }

    start() {
        console.log("Starting game...");
        try {
            this.resetGameData();
            this.startCountdown(3);
        } catch (e) {
            console.error("Game Start Failed:", e);
            alert("Game failed to start: " + e.message);
        }
    }

    restart() {
        this.start();
    }

    togglePause() {
        if (this.state === 'PLAYING' || this.state === 'COUNTDOWN') {
            this.setState('PAUSED');
        } else if (this.state === 'PAUSED') {
            // V74: Resume with Countdown
            this.startCountdown(3);
        }
    }

    quitToMenu() {
        this.audio.stopMusic();
        this.setState('MENU');
    }

    startCountdown(seconds) {
        this.countdownValue = seconds;
        this.countdownTimer = 1000;
        this.setState('COUNTDOWN');
        this.lastTime = performance.now();
        this.accumulatedTime = 0;
    }

    gameOver(reason) {
        this.saveStats();
        this.setState('GAME_OVER');
        if (this.onGameOver) this.onGameOver(reason, this.timePlayed);
    }

    winGame() {
        this.saveStats();
        this.setState('GAME_OVER');
        if (this.onGameOver) this.onGameOver("YOU SURVIVED!", this.timePlayed);
    }

    saveStats() {
        this.metaStats.totalRuns = (this.metaStats.totalRuns || 0) + 1;
        if (this.timePlayed > (this.metaStats.bestTime || 0)) {
            this.metaStats.bestTime = this.timePlayed;
        }
        if (this.currentDay > (this.metaStats.maxDay || 1)) {
            this.metaStats.maxDay = this.currentDay;
        }
        try {
            localStorage.setItem('snake_forest_stats', JSON.stringify(this.metaStats));
        } catch (e) {
            console.error("Failed to save stats:", e);
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resize); resize();
    try {
        const game = new Game(canvas);

        document.getElementById('start-btn').addEventListener('click', () => game.start());
        document.getElementById('restart-btn').addEventListener('click', () => game.restart());
        document.getElementById('resume-btn').addEventListener('click', () => game.togglePause()); // Resume
        document.getElementById('quit-btn').addEventListener('click', () => game.quitToMenu());
        document.getElementById('pause-btn').addEventListener('click', () => game.togglePause());

        // Sound Button
        const sndBtn = document.getElementById('sound-btn');
        const svgSoundOn = `<svg viewBox="0 0 24 24" class="neon-icon"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
        const svgSoundOff = `<svg viewBox="0 0 24 24" class="neon-icon"><path d="M4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;

        sndBtn.innerHTML = svgSoundOn;
        sndBtn.addEventListener('click', function () {
            const isMuted = game.audio.toggleMute();
            this.innerHTML = isMuted ? svgSoundOff : svgSoundOn;
            this.classList.toggle('btn-red', isMuted); this.classList.toggle('btn-green', !isMuted);
        });

        const DEATH_MESSAGES = {
            "HUMAN_CAUGHT": ["Humans 1, Snakes 0.", "We don't take kindly to your kind.", "Step on snek? No, snek captured.", "Captured for science!"],
            "LOG_HIT": ["Bark is worse than your bite.", "Logs are hard. You are soft.", "Splinters... ouch.", "Not a walkway."],
            "TREE_HIT": ["Tree 1, Snake 0. Nature wins.", "Bark is worse than your bite.", "Hugged the tree too hard.", "Timber!"],
            "SELF_HIT": ["Stop hitting yourself!", "Ouroboros exceeded.", "Tangled up in blue.", "You are your own worst enemy."],
            "WALL_HIT": ["Bricks don't negotiate.", "Claustrophobia setting in.", "Bonk!", "No exit that way."],
            "YOU SURVIVED!": ["Legendary Snake!", "Forest Master!", "You escaped!", "Nature bows to you."]
        };

        game.onGameOver = (reason) => {
            const messages = DEATH_MESSAGES[reason] || ["Game Over."];
            // V52: Strip quotes from the message itself ("") if they exist in the array (they don't in definition, but cleaning just in case)
            let msg = messages[Math.floor(Math.random() * messages.length)];
            msg = msg.replace(/"/g, ''); // Strip quotes

            const t = Math.floor(game.timePlayed / 1000);
            const timeStr = `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toString().padStart(2, '0')}`;

            // V52: Clean UI - Removed "reason" enum display and removed surrounding quotes from HTML
            document.getElementById('final-score').innerHTML = `${msg}<br><span style="color:#fff; font-size:0.8em; opacity:0.7">Time: ${timeStr}</span>`;
        };
        window.game = game;
    } catch (e) {
        console.error("Initialization Error:", e);
        alert("Game Init Error: " + e.message + "\n" + e.stack);
    }
});
