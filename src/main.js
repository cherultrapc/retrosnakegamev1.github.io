import Game from './Game.js';

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');

    // Set canvas to full screen minus some padding or just full window
    // For a game, explicit logic often helps. Let's start with a fixed logical size tailored to the window.
    function resize() {
        // We might want a fixed aspect ratio or full flexible. 
        // For snake, a grid is best. Let's adhere to the window size but snap to grid multiples.
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    const game = new Game(canvas);

    // UI Buttons
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const soundBtn = document.getElementById('sound-btn');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');

    startBtn.addEventListener('click', () => {
        startScreen.classList.add('w-hidden');
        game.start();
    });

    restartBtn.addEventListener('click', () => {
        gameOverScreen.classList.add('w-hidden');
        game.restart();
    });

    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const quitBtn = document.getElementById('quit-btn');
    const pauseScreen = document.getElementById('pause-screen');

    // UI Update Helper
    function updatePauseButton() {
        if (game.isPaused) {
            pauseBtn.innerHTML = "▶️"; // Plain Play Icon
            pauseBtn.classList.remove('btn-green');
            pauseBtn.classList.add('btn-red');
        } else {
            pauseBtn.innerHTML = "⏸️"; // Plain Pause Icon
            pauseBtn.classList.remove('btn-red');
            pauseBtn.classList.add('btn-green');
        }
    }

    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            game.togglePause();
            updatePauseButton();
            pauseBtn.blur();
        });
    }

    // Hook into togglePause to update UI if triggered by key
    const originalTogglePause = game.togglePause.bind(game);
    game.togglePause = () => {
        originalTogglePause();
        updatePauseButton();
    };


    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            game.togglePause();
            // updatePauseButton handled by wrapper
        });
    }

    if (quitBtn) {
        quitBtn.addEventListener('click', () => {
            location.reload();
        });
    }

    if (soundBtn) {
        soundBtn.innerHTML = "🔊"; // Initial state
        soundBtn.addEventListener('click', () => {
            const isMuted = game.audio.toggleMute();
            if (isMuted) {
                soundBtn.innerHTML = "🔇"; // Muted speaker
                soundBtn.classList.remove('btn-green');
                soundBtn.classList.add('btn-red');
            } else {
                soundBtn.innerHTML = "🔊"; // Sound on
                soundBtn.classList.remove('btn-red');
                soundBtn.classList.add('btn-green');

                if (game.isRunning && game.audio.currentTrack) {
                    game.audio.music[game.audio.currentTrack].play().catch(e => console.log("Resume failed", e));
                    game.audio.music[game.audio.currentTrack].volume = 0.4;
                }
            }
        });
    }

    // Game Over Integration
    game.onGameOver = (finalScore) => {
        document.getElementById('final-score').innerText = finalScore;
        gameOverScreen.classList.remove('w-hidden');
    };

    game.onScoreUpdate = (score) => {
        document.getElementById('score').innerText = score;
    };
});
