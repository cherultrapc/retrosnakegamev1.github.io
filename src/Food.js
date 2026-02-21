export default class Food {
    constructor(cols, rows, gridSize, forest, snake) {
        this.cols = cols;
        this.rows = rows;
        this.gridSize = gridSize;

        this.x = 0;
        this.y = 0;

        this.respawn(snake, forest);
    }

    respawn(snake, forest) {
        let valid = false;
        while (!valid) {
            this.x = Math.floor(Math.random() * this.cols);
            this.y = Math.floor(Math.random() * this.rows);

            // Check collision with Snake
            if (snake.checkCollision(this.x, this.y)) continue;

            // Check collision with Forest
            if (forest.isObstacle(this.x, this.y)) continue;

            valid = true;
        }
    }

    draw(ctx) {
        const px = this.x * this.gridSize;
        const py = this.y * this.gridSize;
        const center = this.gridSize / 2;
        const cx = px + center;
        const cy = py + center;

        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff5555';

        // Berry Cluster (Raspberry/Blackberry style)
        ctx.fillStyle = '#e53935';

        // Cluster of 3 circles
        ctx.beginPath();
        ctx.arc(cx - 3, cy + 2, 4, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy + 2, 4, 0, Math.PI * 2);
        ctx.arc(cx, cy - 3, 4, 0, Math.PI * 2);
        ctx.fill();

        // Leaf
        ctx.fillStyle = '#76ff03';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 6, 4, 2, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
    }
}
