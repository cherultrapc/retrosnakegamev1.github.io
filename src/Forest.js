export default class Forest {
    constructor(width, height, gridSize) {
        this.gridSize = gridSize;
        this.width = width;
        this.height = height;
        this.cols = Math.floor(width / gridSize);
        this.rows = Math.floor(height / gridSize);

        this.trees = new Map();
        this.stones = new Map();
        this.density = 0.005;

        this.stars = [];
        this.weatherParticles = []; // For rain, snow, etc.
        this.currentWeather = 'normal'; // Track current weather type

        this.generateObstacles(); // Combined generation for spacing
        this.generateStars();

        // Pre-render ground texture
        this.groundCanvas = document.createElement('canvas');
        this.groundCanvas.width = this.width;
        this.groundCanvas.height = this.height;
        this.renderGroundTexture();
    }

    reset() {
        this.trees.clear();
        this.stones.clear();
        this.density = 0.005;
        this.generateObstacles();
        this.generateStars();
        this.renderGroundTexture();
        this.weatherParticles = [];
        this.currentWeather = 'normal';
    }

    generateStars() {
        this.stars = [];
        const starCount = 200;
        for (let i = 0; i < starCount; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 1.5,
                alpha: 0.3 + Math.random() * 0.7
            });
        }
    }

    renderGroundTexture() {
        const ctx = this.groundCanvas.getContext('2d');

        // 1. Base Layer (Wet Mud)
        ctx.fillStyle = '#4e342e'; // Darker Brown
        ctx.fillRect(0, 0, this.width, this.height);

        // 2. Wet Puddles / Dark Patches
        for (let i = 0; i < 400; i++) {
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            const r = 20 + Math.random() * 60;
            ctx.fillStyle = '#3e2723'; // Very Dark Brown
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Noise / Texture
        for (let i = 0; i < 10000; i++) {
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            const size = 1 + Math.random() * 2;

            ctx.fillStyle = Math.random() > 0.5 ? '#5d4037' : '#271c19';
            ctx.globalAlpha = 0.3;
            ctx.fillRect(x, y, size, size);
        }
        ctx.globalAlpha = 1.0;
    }

    generateObstacles() {
        const safeZone = 5;
        const cx = Math.floor(this.cols / 2);
        const cy = Math.floor(this.rows / 2);

        const totalCells = this.cols * this.rows;
        const targetTrees = Math.floor(totalCells * this.density);
        const targetStones = Math.floor(totalCells * (this.density * 0.3));

        const occupied = new Set();
        const isTooClose = (tx, ty, minDist) => {
            const r = minDist;
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    if (occupied.has(`${tx + dx},${ty + dy}`)) return true;
                }
            }
            return false;
        };

        // 1. Trees - BIGGER
        let attempts = 0;
        let placed = 0;
        while (placed < targetTrees && attempts < targetTrees * 10) {
            attempts++;
            const x = Math.floor(Math.random() * this.cols);
            const y = Math.floor(Math.random() * this.rows);

            if (Math.abs(x - cx) < safeZone && Math.abs(y - cy) < safeZone) continue;
            if (occupied.has(`${x},${y}`)) continue;
            if (isTooClose(x, y, 2)) continue;

            // Increased Scale: 1.2 to 1.6 (was 0.9 to 1.3)
            const scale = 1.2 + Math.random() * 0.4;
            this.trees.set(`${x},${y}`, { scale });
            occupied.add(`${x},${y}`);
            placed++;
        }

        // 2. Stones - BIGGER
        attempts = 0;
        placed = 0;
        while (placed < targetStones && attempts < targetStones * 10) {
            attempts++;
            const x = Math.floor(Math.random() * this.cols);
            const y = Math.floor(Math.random() * this.rows);

            if (Math.abs(x - cx) < safeZone && Math.abs(y - cy) < safeZone) continue;
            if (occupied.has(`${x},${y}`)) continue;
            if (isTooClose(x, y, 3)) continue;

            // Increased Size: 0.9 to 1.3 (was 0.6 to 1.0)
            const size = 0.9 + Math.random() * 0.4;
            this.stones.set(`${x},${y}`, {
                type: Math.random() > 0.5 ? 'round' : 'irregular',
                size: size
            });
            occupied.add(`${x},${y}`);
            placed++;
        }
    }

    increaseDensity(day) {
        // ... same logic ...
        const newDensity = 0.005 + (day * 0.003);
        if (newDensity > this.density) {
            this.density = newDensity;
            this.addMoreObstacles((this.cols * this.rows) * 0.003);
        }
    }

    addMoreObstacles(count) {
        // ... same logic, just updated sizes ...
        const occupied = new Set([...this.trees.keys(), ...this.stones.keys()]);

        // Helper re-definition needed or scope it? 
        // Just re-copy logic for safety in replace
        const isTooClose = (tx, ty, minDist) => {
            const r = minDist;
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (occupied.has(`${tx + dx},${ty + dy}`)) return true;
                }
            }
            return false;
        };

        let added = 0;
        let attempts = 0;
        while (added < count && attempts < count * 20) {
            attempts++;
            const x = Math.floor(Math.random() * this.cols);
            const y = Math.floor(Math.random() * this.rows);

            if (occupied.has(`${x},${y}`)) continue;
            if (isTooClose(x, y, 2)) continue;

            if (Math.random() > 0.2) {
                const scale = 1.2 + Math.random() * 0.4; // BIGGER
                this.trees.set(`${x},${y}`, { scale });
            } else {
                const size = 0.9 + Math.random() * 0.4; // BIGGER
                this.stones.set(`${x},${y}`, {
                    type: Math.random() > 0.5 ? 'round' : 'irregular',
                    size: size
                });
            }
            occupied.add(`${x},${y}`);
            added++;
        }
    }

    // ... isTree, isStone, isObstacle remain same ...
    isTree(x, y) { return this.trees.has(`${x},${y}`); }
    isStone(x, y) { return this.stones.has(`${x},${y}`); }
    isObstacle(x, y) { return this.trees.has(`${x},${y}`) || this.stones.has(`${x},${y}`); }

    draw(ctx, dayProgress = 0, weatherType = 'normal') {
        const width = this.width;
        const height = this.height;

        // 1. Ground
        ctx.drawImage(this.groundCanvas, 0, 0);

        // 2. Smooth Night Cycle
        // 0.0 - 0.5: Day
        // 0.5 - 0.6: Sunset
        // 0.6 - 0.9: Night
        // 0.9 - 1.0: Sunrise
        let darkness = 0;
        if (dayProgress >= 0.5 && dayProgress < 0.6) {
            darkness = (dayProgress - 0.5) * 7; // Fade in to 0.7
        } else if (dayProgress >= 0.6 && dayProgress < 0.9) {
            darkness = 0.7;
        } else if (dayProgress >= 0.9) {
            darkness = 0.7 - ((dayProgress - 0.9) * 7); // Fade out
        }

        if (darkness > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
            ctx.fillRect(0, 0, width, height);
        }

        // 3. Static Stars at Night
        if (darkness > 0.3) {
            ctx.fillStyle = '#ffffff';
            for (const star of this.stars) {
                ctx.globalAlpha = Math.min(1, (darkness - 0.3) * 2 * star.alpha);
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        }

        // 4. Shadows (Under objects)
        ctx.fillStyle = 'rgba(0,0,0,0.4)';

        // Stones
        for (const [key, data] of this.stones) {
            const [x, y] = key.split(',').map(Number);
            this.drawStone(ctx, x, y, data);
        }

        // Trees
        for (const [key, data] of this.trees) {
            const [x, y] = key.split(',').map(Number);
            this.drawTree(ctx, x, y, data.scale);
        }

        // 5. Weather Effects
        this.drawWeather(ctx, weatherType);
    }

    drawWeather(ctx, type) {
        const w = this.width;
        const h = this.height;

        // Reset particles if switching types (naive approach, mostly fine)
        if (this.currentWeather !== type) {
            this.weatherParticles = [];
            this.currentWeather = type;
        }

        if (type === 'rain') {
            // Fill particles
            if (this.weatherParticles.length < 200) {
                this.weatherParticles.push({
                    x: Math.random() * w,
                    y: -10,
                    speed: 15 + Math.random() * 10,
                    len: 10 + Math.random() * 10
                });
            }
            ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < this.weatherParticles.length; i++) {
                const p = this.weatherParticles[i];
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x, p.y + p.len);
                p.y += p.speed;
                if (p.y > h) {
                    p.y = -10;
                    p.x = Math.random() * w;
                }
            }
            ctx.stroke();

        } else if (type === 'mist') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; // Foggy overlay
            ctx.fillRect(0, 0, w, h);

            // Moving mist clouds
            if (this.weatherParticles.length < 20) {
                this.weatherParticles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 50 + Math.random() * 100,
                    speed: 0.5 + Math.random()
                });
            }

            for (let p of this.weatherParticles) {
                const grad = ctx.createRadialGradient(p.x, p.y, p.r * 0.2, p.x, p.y, p.r);
                grad.addColorStop(0, 'rgba(255,255,255,0.3)');
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();

                p.x += p.speed;
                if (p.x > w + p.r) p.x = -p.r;
            }

        } else if (type === 'windy') {
            // Blowing dust/debris
            if (this.weatherParticles.length < 100) {
                this.weatherParticles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    speed: 20 + Math.random() * 15,
                    size: 2 + Math.random() * 3
                });
            }
            ctx.fillStyle = 'rgba(93, 64, 55, 0.6)'; // Brown dust
            for (let p of this.weatherParticles) {
                ctx.fillRect(p.x, p.y, p.size * 2, p.size); // Horizontal streak
                p.x += p.speed;
                if (p.x > w) {
                    p.x = -10;
                    p.y = Math.random() * h;
                }
            }

        } else if (type === 'snow') {
            if (this.weatherParticles.length < 150) {
                this.weatherParticles.push({
                    x: Math.random() * w,
                    y: -10,
                    speed: 2 + Math.random() * 2,
                    swing: Math.random() * Math.PI,
                    r: 2 + Math.random() * 2
                });
            }
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            for (let p of this.weatherParticles) {
                ctx.beginPath();
                ctx.arc(p.x + Math.sin(p.swing) * 2, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
                p.y += p.speed;
                p.swing += 0.05;
                if (p.y > h) {
                    p.y = -10;
                    p.x = Math.random() * w;
                }
            }

        } else if (type === 'hail') {
            if (this.weatherParticles.length < 200) {
                this.weatherParticles.push({
                    x: Math.random() * w,
                    y: -20,
                    speed: 25 + Math.random() * 10,
                    r: 3 + Math.random() * 2
                });
            }
            ctx.fillStyle = 'rgba(220, 240, 255, 0.9)';
            for (let p of this.weatherParticles) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
                p.y += p.speed;
                p.x += 1; // Slight angle
                if (p.y > h) {
                    p.y = -20;
                    p.x = Math.random() * w;
                }
            }

        } else if (type === 'cyclone') {
            // Swirling particles
            if (this.weatherParticles.length < 400) {
                this.weatherParticles.push({
                    angle: Math.random() * Math.PI * 2,
                    radius: 50 + Math.random() * (Math.min(w, h) / 2),
                    speed: 0.05 + Math.random() * 0.05
                });
            }

            const cx = w / 2;
            const cy = h / 2;

            ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';

            for (let p of this.weatherParticles) {
                const px = cx + Math.cos(p.angle) * p.radius;
                const py = cy + Math.sin(p.angle) * p.radius;

                ctx.fillRect(px, py, 4, 4);

                p.angle += p.speed;
                p.radius -= 0.5; // Suck in
                if (p.radius < 10) {
                    p.radius = 50 + Math.random() * (Math.min(w, h) / 2);
                }
            }

            // Dark Overlay
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(0, 0, w, h);
        }
    }

    drawStone(ctx, x, y, data) {
        const px = x * this.gridSize;
        const py = y * this.gridSize;
        const size = this.gridSize * data.size;
        const cx = px + this.gridSize / 2;
        const cy = py + this.gridSize / 2 + 5;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(px + this.gridSize / 2, py + this.gridSize, size / 1.5, size / 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Stone Body - Grey Rock
        const grad = ctx.createLinearGradient(px, py, px + size, py + size);
        grad.addColorStop(0, '#888888'); // Light Grey
        grad.addColorStop(1, '#444444'); // Dark Grey

        ctx.fillStyle = grad;
        ctx.beginPath();

        // Jagged simplified shape
        if (data.type === 'round') {
            // Boulder
            ctx.moveTo(cx - size / 2, cy);
            ctx.lineTo(cx - size / 3, cy - size / 2);
            ctx.lineTo(cx + size / 3, cy - size / 2);
            ctx.lineTo(cx + size / 2, cy);
            ctx.lineTo(cx + size / 3, cy + size / 3);
            ctx.lineTo(cx - size / 3, cy + size / 3);
        } else {
            // Sharp Rock
            ctx.moveTo(cx - size / 2, cy + size / 3);
            ctx.lineTo(cx - size / 4, cy - size / 2);
            ctx.lineTo(cx, cy);
            ctx.lineTo(cx + size / 4, cy - size / 1.5);
            ctx.lineTo(cx + size / 2, cy + size / 3);
        }
        ctx.closePath();
        ctx.fill();

        // Highlight/Cracks
        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawTree(ctx, x, y, scale) {
        const px = x * this.gridSize;
        const py = y * this.gridSize;
        const size = this.gridSize * scale;
        // Align bottom center
        const centerX = px + this.gridSize / 2;
        const bottomY = py + this.gridSize;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(centerX, bottomY - 5, size / 2, size / 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(centerX - size * 0.1, bottomY - size * 0.3, size * 0.2, size * 0.3);

        // Layers of Pine
        ctx.fillStyle = '#1b5e20'; // Dark Green
        // Bottom Layer
        this.fillTriangle(ctx, centerX, bottomY - size * 0.2, size * 0.8, size * 0.5);
        // Middle Layer
        ctx.fillStyle = '#2e7d32'; // Med Green
        this.fillTriangle(ctx, centerX, bottomY - size * 0.5, size * 0.6, size * 0.4);
        // Top Layer
        ctx.fillStyle = '#4caf50'; // Light Green
        this.fillTriangle(ctx, centerX, bottomY - size * 0.7, size * 0.4, size * 0.3);
    }

    fillTriangle(ctx, x, y, width, height) {
        ctx.beginPath();
        ctx.moveTo(x, y - height);
        ctx.lineTo(x + width / 2, y);
        ctx.lineTo(x - width / 2, y);
        ctx.closePath();
        ctx.fill();
    }
}
