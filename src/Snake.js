export default class Snake {
    constructor(cols, rows, gridSize) {
        this.gridSize = gridSize;
        this.reset(cols, rows);
    }

    reset(cols, rows) {
        const startX = Math.floor(cols / 2);
        const startY = Math.floor(rows / 2);

        this.baseLength = 3;

        this.segments = [];
        for (let i = 0; i < this.baseLength; i++) {
            this.segments.push({ x: startX - i, y: startY });
        }
        // For interpolation
        this.prevSegments = JSON.parse(JSON.stringify(this.segments));

        this.growPending = 0;
        this.digestionQueue = [];
        this.isTired = false;
        this.isStarving = false;
        this.wallHitCooldown = 0;
        this.isHurt = 0;
    }

    get head() {
        return this.segments[0];
    }

    getFullnessPenalty() {
        if (this.digestionQueue.length > 10) return 0.25;
        if (this.digestionQueue.length > 5) return 0.10;
        return 0;
    }

    update(input, width, height, currentTime, forest) {
        if (this.wallHitCooldown > 0) this.wallHitCooldown--;
        if (this.isHurt > 0) return 'alive'; // Pure Invincibility

        if (this.digestionQueue.length > 0) {
            const peek = this.digestionQueue[0];
            if (currentTime >= peek) {
                this.digestionQueue.shift();
                if (this.segments.length > this.baseLength) {
                    this.segments.pop();
                    if (this.prevSegments.length > this.segments.length) {
                        this.prevSegments.pop();
                    }
                }
            }
        }

        const nextHead = {
            x: this.head.x + input.x,
            y: this.head.y + input.y
        };

        const cols = width / this.gridSize;
        const rows = height / this.gridSize;

        // Wall Collision
        if (nextHead.x < 0 || nextHead.x >= cols || nextHead.y < 0 || nextHead.y >= rows) {
            return 'wall_hit';
        }

        // Forest Collision
        if (forest && forest.isObstacle(nextHead.x, nextHead.y)) {
            return 'dead';
        }

        // Self Collision
        if (this.checkCollision(nextHead.x, nextHead.y)) {
            return 'dead';
        }

        this.prevSegments = JSON.parse(JSON.stringify(this.segments));

        // Move
        this.segments.unshift(nextHead);

        if (this.growPending > 0) {
            this.growPending--;
        } else {
            this.segments.pop();
        }

        return 'alive';
    }

    eat(currentTime) {
        this.growPending++;
        this.digestionQueue.push(currentTime + 30000); // hardcoded for sync or import CONFIG
    }

    permanentGrow() {
        this.baseLength++;
        this.growPending++;
    }

    checkCollision(x, y) {
        for (let i = 0; i < this.segments.length; i++) {
            if (this.segments[i].x === x && this.segments[i].y === y) {
                return true;
            }
        }
        return false;
    }

    draw(ctx, alpha = 1) {
        ctx.shadowBlur = this.isTired ? 5 : 15;
        ctx.shadowColor = this.isTired ? '#ffcc00' : '#00ff88';

        for (let i = 0; i < this.segments.length; i++) {
            const curr = this.segments[i];
            const prev = this.prevSegments[i] || curr;

            // Lerp
            const ix = prev.x + (curr.x - prev.x) * alpha;
            const iy = prev.y + (curr.y - prev.y) * alpha;

            if (i === 0) {
                ctx.fillStyle = this.isStarving ? '#ff3333' : '#ccffdd';
            } else {
                ctx.fillStyle = this.isTired ? '#aaaa55' : '#00ff88';

                if (this.digestionQueue.length > 5 && i % 2 === 0) {
                    ctx.fillStyle = '#00bb66';
                }
            }

            const px = ix * this.gridSize;
            const py = iy * this.gridSize;

            ctx.fillRect(px + 1, py + 1, this.gridSize - 2, this.gridSize - 2);
        }

        ctx.shadowBlur = 0;
    }
}
