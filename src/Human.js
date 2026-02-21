export default class Human {
    constructor(cols, rows, gridSize, forest) {
        this.cols = cols;
        this.rows = rows;
        this.gridSize = gridSize;
        this.forest = forest;
        this.spawn();
        this.moveCooldown = 0;
        this.moveSpeed = 6; // Slower than snake
    }

    spawn() {
        let valid = false;
        while (!valid) {
            this.x = Math.floor(Math.random() * this.cols);
            this.y = Math.floor(Math.random() * this.rows);
            if (this.forest.isObstacle(this.x, this.y)) continue; {
                valid = true;
            }
        }
    }

    update(snake) {
        this.moveCooldown++;
        if (this.moveCooldown < this.moveSpeed) return;
        this.moveCooldown = 0;

        const moves = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

        // Filter valid moves (not into trees or walls)
        const validMoves = moves.filter(m => {
            const nx = this.x + m.x;
            const ny = this.y + m.y;
            return nx >= 0 && nx < this.cols &&
                ny >= 0 && ny < this.rows &&
                !this.forest.isObstacle(nx, ny);
        });

        if (validMoves.length > 0) {
            // Sort by distance to snake
            const distToSnake = Math.abs(this.x - snake.head.x) + Math.abs(this.y - snake.head.y);

            // If close, chase. If far, roam.
            const perception = 15;

            if (distToSnake < perception) {
                // Chase: Sort by minimizing distance
                validMoves.sort((a, b) => {
                    const da = Math.abs((this.x + a.x) - snake.head.x) + Math.abs((this.y + a.y) - snake.head.y);
                    const db = Math.abs((this.x + b.x) - snake.head.x) + Math.abs((this.y + b.y) - snake.head.y);
                    return da - db;
                });
                const move = validMoves[0];
                this.x += move.x;
                this.y += move.y;
            } else {
                // Roam: Random
                const move = validMoves[Math.floor(Math.random() * validMoves.length)];
                this.x += move.x;
                this.y += move.y;
            }
        }
    }

    draw(ctx) {
        const px = this.x * this.gridSize;
        const py = this.y * this.gridSize;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffffaa';
        ctx.fillStyle = '#ffffee';

        // Draw Human shape: Triangle with "Lantern" - BIGGER
        ctx.beginPath();
        // Expand relative to grid center
        // GridSize is 25.
        // Old: +2 padding.
        // New: Overlap grid slightly or fill it completely
        ctx.moveTo(px + this.gridSize / 2, py - 5); // Taller top
        ctx.lineTo(px + this.gridSize + 5, py + this.gridSize + 2); // Wider Right
        ctx.lineTo(px - 5, py + this.gridSize + 2); // Wider Left
        ctx.closePath();
        ctx.fill();

        // Lantern Glow Center
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(px + this.gridSize / 2, py + this.gridSize / 2 + 5, 6, 0, Math.PI * 2); // Bigger light
        ctx.fill();

        ctx.shadowBlur = 0;
    }
}
