export default class AudioSystem {
    constructor() {
        this.music = {};
        this.sfx = {};

        try {
            this.music = {
                day: new Audio('assets/music_day.mp3'),
                night: new Audio('assets/music_night.mp3'),
                endgame: new Audio('assets/music_endgame.mp3')
            };

            // Configure music loops
            if (this.music.day) this.music.day.loop = true;
            if (this.music.night) this.music.night.loop = true;
            if (this.music.endgame) this.music.endgame.loop = true;

            this.sfx = {
                eat: new Audio('assets/sfx_eat.mp3'),
                hit_tree: new Audio('assets/sfx_hit_tree.mp3'),
                hit_stone: new Audio('assets/sfx_hit_stone.mp3'),
                hit_human: new Audio('assets/sfx_hit_human.mp3'),
                game_over: new Audio('assets/sfx_game_over.mp3')
            };

            // Volume adjustments
            if (this.music.day) this.music.day.volume = 0.1;
            if (this.music.night) this.music.night.volume = 0.1;
            if (this.music.endgame) this.music.endgame.volume = 0.1;
        } catch (e) {
            console.error("Audio initialization failed:", e);
        }

        this.currentTrack = null;
        this.isMuted = false;
    }

    playMusic(type) { // 'day' or 'night'
        if (this.currentTrack === type) return;

        // Force stop ANY currently playing track to prevent overlap
        ['day', 'night', 'endgame'].forEach(t => {
            if (t !== type && this.music[t]) {
                this.music[t].pause();
                this.music[t].currentTime = 0;
            }
        });

        this.currentTrack = type;
        const newTrack = this.music[type];

        if (newTrack) {
            newTrack.volume = this.isMuted ? 0 : 0.1;
            newTrack.currentTime = 0;
            // Catch promise return to avoid processing
            const playPromise = newTrack.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    // Auto-play might be blocked
                    console.warn("Audio Play Blocked", e);
                });
            }
        }
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

    playSFX(name) {
        if (this.isMuted) return; // Don't play if muted

        const sound = this.sfx[name];
        if (sound) {
            // Clone node to allow overlapping sounds
            const clone = sound.cloneNode();
            clone.volume = 0.6;
            clone.play().catch(e => console.log("SFX play failed:", e));
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.clearFadeIntervals(); // Stop any fades that might override mute

        // Handle Music
        if (this.currentTrack && this.music[this.currentTrack]) {
            const track = this.music[this.currentTrack];
            if (this.isMuted) {
                track.volume = 0;
            } else {
                track.volume = 0.1; // Restore volume
            }
        }

        return this.isMuted;
    }

    clearFadeIntervals() {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        if (this.fadeOutInterval) clearInterval(this.fadeOutInterval);
    }

    fadeIn(audio) {
        if (this.fadeInterval) clearInterval(this.fadeInterval);

        let vol = 0;
        this.fadeInterval = setInterval(() => {
            if (this.isMuted) {
                audio.volume = 0;
                clearInterval(this.fadeInterval);
                return;
            }

            if (vol < 0.1) {
                vol += 0.01;
                audio.volume = Math.min(vol, 0.1);
            } else {
                clearInterval(this.fadeInterval);
            }
        }, 200);
    }

    fadeOut(audio) {
        if (this.fadeOutInterval) clearInterval(this.fadeOutInterval);

        let vol = audio.volume;
        this.fadeOutInterval = setInterval(() => {
            if (vol > 0) {
                vol -= 0.01;
                audio.volume = Math.max(0, vol);
            } else {
                audio.pause();
                clearInterval(this.fadeOutInterval);
            }
        }, 200);
    }
}
