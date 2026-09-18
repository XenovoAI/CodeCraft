# Defuse & Escape

A fast-paced browser puzzle game where you have 60 seconds to defuse the bomb, recover the access code, and escape.

## Play

Open `index.html` in a modern browser, or serve the folder with any local web server.

```powershell
# Optional: run from the project folder
py -m http.server 8000
```

Then visit `http://localhost:8000`.

## How to Play

1. Select **Start Escape**.
2. Complete the four randomly ordered puzzles.
3. Each solved puzzle reveals one digit of the access code.
4. Use the keypad or your keyboard to enter the four-digit code.
5. Unlock the door before the timer reaches zero.

Wrong puzzle answers and invalid door codes reduce the remaining time. Three wrong inputs end the run.

## Puzzle Types

- **Wire cutter:** Follow the instruction and select the correct wire.
- **Pattern memory:** Watch the highlighted cells, then tap the sequence back in order.
- **Math decrypt:** Solve the equation and select the correct answer.
- **Frequency lock:** Tune the slider to the target value within the allowed range.

## Features

- Random puzzle order and generated challenges
- 60-second countdown with danger meter
- Keyboard support for code entry
- Local best-time score using `localStorage`
- Web Audio API sound effects
- Canvas particle effects for success and explosion states
- Responsive layout for desktop and mobile browsers

## Project Structure

- `index.html` - Page structure and game screens
- `styles.css` - Layout, responsive styling, animations, and visual effects
- `game.js` - Game state, puzzles, timer, audio, input handling, and canvas particles
- `Plan.md` - Project planning notes

## Technology

This project uses standard browser APIs with no build step or framework:

- HTML5
- CSS3
- JavaScript
- Canvas 2D
- Web Audio API
- `localStorage`

The interface loads the Orbitron font from Google Fonts when an internet connection is available.
