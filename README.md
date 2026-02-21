# 🐍 Snake Forest Escape

![Snake Forest Escape](https://img.shields.io/badge/Status-Beta-brightgreen)
![Tech](https://img.shields.io/badge/Tech-JavaScript%20%7C%20HTML5%20%7C%20CSS3-blue)

**Snake Forest Escape** is a premium, high-stakes survival game built with Vanilla JavaScript and HTML5 Canvas. Unlike traditional snake games, this is a race against time, hunger, and a hostile forest environment. Your goal? Survive for 7 days in the deep woods.

## 🌲 The Challenge

You are a snake trapped in a dense forest. To survive, you must manage your hunger, avoid deadly obstacles, and outsmart the human "critter control" teams that roam the woods. Each day brings new weather conditions and increasing difficulty.

### Key Features

- **Survival Mechanics**: Manage your **Hunger Bar**. If it reaches zero, you enter a starvation state, slowing down and eventually dying.
- **Dynamic Digestive System**: Eating too much too fast induces a "fullness penalty," temporarily slowing your movement as you digest.
- **7-Day Cycle**: Each day is a new level with changing weather:
  - **Day 2**: Rain
  - **Day 3**: Mist (Reduced visibility)
  - **Day 4**: Windy
  - **Day 5**: Snow
  - **Day 6**: Hail
  - **Day 7**: Cyclone (The ultimate test)
- **Hostile Environment**: Navigate around trees and stones. Be careful—hitting them is fatal!
- **Critter Control**: Avoid the humans! They move independently and will catch you if you get too close.
- **Power-Ups**: Look for the rare **Dragon Fruit** to gain extra lives.
- **Premium Aesthetics**: Features a dynamic day/night cycle, smooth micro-animations, glow effects, and a rich, atmospheric audio system.

## 🎮 Controls

| Action | Control |
| :--- | :--- |
| **Move** | `WASD` or `Arrow Keys` |
| **Start / Restart** | `Space` |
| **Pause** | `P` or `Space` |
| **Mute / Unmute** | `M` |
| **Exit** | `Esc` (Double tap to quit to menu) |

## 🚀 Getting Started

Since this is a client-side web application, no installation is required!

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/snake-forest-escape.git
   ```
2. Open `index.html` in any modern web browser (Chrome, Firefox, Safari, Edge).
3. Press **Space** to enter the forest!

## 📂 Project Structure

```text
snake_escape/
├── assets/             # Game assets (images, audio)
├── src/                # Soul of the game
│   ├── Game.js         # Main engine and game loop
│   ├── Snake.js        # Snake logic and physics
│   ├── Forest.js       # Environment and weather systems
│   ├── Human.js        # Human AI behavior
│   ├── Food.js         # Food spawning mechanics
│   ├── AudioSystem.js  # SFX and Background Music management
│   └── main.js         # Entry point
├── style.css           # Premium UI styling and animations
└── index.html          # Main entry point
```

## 🛠️ Built With

- **HTML5 Canvas**: High-performance rendering.
- **Vanilla JavaScript (ES6+)**: Clean, modular code without external dependencies.
- **CSS3**: For the sleek, neon-forest UI and responsive layouts.
- **Web Audio API**: For immersive spatial sound effects.

---

*Navigate carefully, eat well, and survive the forest.* 🐍✨
