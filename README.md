# Aliens on Deck! 🛳️👾

A retro top-down 2D arcade game for **two players in co-op**. Aliens are taking
over the **S.S. Starlight** mid-cruise, and the only weapons on board are the
finest cruise ship amenities: bingo cards, buffet plates, and free jewelry
charms.

## How to play

Just open `index.html` in a browser — no build step, no dependencies.

```sh
# or serve it locally:
npx serve .
```

### Controls

Designed for two players sharing one keyboard — each player needs only one
half of a split keyboard (e.g. a Glove80). You throw in the direction you
last walked, so no mouse is needed.

| Action | Player 1 (left hand) | Player 2 (right hand) |
| --- | --- | --- |
| Move | W A S D | I J K L (or arrows) |
| Throw | Backspace, F, G, or Tab | Space, H, N, or `;` |
| Switch item | Q / E | U / O |
| Pick item | 1 / 2 / 3 | 8 / 9 / 0 |

Shared: **P** or **Esc** pauses, **M** mutes, **Enter** starts.

The screen is split down the middle — each player gets their own camera
centered on their tourist. P1 wears the red hawaiian shirt, P2 the blue one.

### Let an AI play player 2 (MCP)

The repo ships a Model Context Protocol server ([mcp-server.mjs](mcp-server.mjs))
so an AI — e.g. Claude Code — can play player 2. Because an LLM can't react
frame-by-frame, the AI issues **standing intents** (attack, move_to, collect,
restock, follow, stop) and the game executes them every frame with BFS
pathfinding, line-of-fire checks, and auto-aim. The AI just polls `game_state`
every second or two and changes the intent when the situation changes.

```sh
npm install
claude mcp add aliens-p2 -- node "$PWD/mcp-server.mjs"
```

Then serve and open the game (`npm run serve` → http://localhost:8321). The
page attaches to the bridge on `ws://localhost:8322` within a few seconds,
and P2 shows a `·AI` tag while under AI control. In a Claude session, try:
*"Look at game_state and play player 2 — keep the passengers alive."*

Tools: `game_state`, `player2_command`, `press_key`. Sending
`{action: "release"}` (or the MCP server disconnecting) hands player 2 back
to the human. The game keeps simulating in a hidden tab, so the AI can play
in the background.

### Arsenal

- **Bingo cards** — fast flicking fire, you'll never run out at the bingo hall
- **Buffet plates** — heavy damage, pierces through multiple aliens
- **Free jewelry charms** — a glittering shotgun spread

Ammo runs out! Stand near the **BUFFET**, the **BINGO** hall, or the gift
**SHOP** to restock. Fallen aliens sometimes drop sodas and ammo boxes.

### Your health is the passenger list

Ten passengers stroll the decks — and they are the **shared** hit points for
both players. Every hit either of you takes, the aliens tractor-beam a
passenger (the nearest ones to the fight) up into the sky. Grab a soda and
abducted passengers beam back down beside whoever drank it. When the last
passenger is taken, the cruise is over for both of you.

### The enemy

Green **drifters**, pink **sprinters**, purple **bruisers**, and teal
**spitters** pour out of teleport portals in escalating waves. Survive nine
waves and the **Broodmother** herself boards on wave 10. Sink her to save the
midnight buffet.

## Tech

Vanilla JavaScript + HTML5 Canvas. All pixel-art sprites are generated at
runtime from ASCII art maps, sounds are synthesized with WebAudio, and aliens
navigate the ship's rooms and doors using a multi-source BFS flow field
(they chase whichever player is closer). Each player's view is a 480×320
viewport rendered side by side and upscaled with crisp pixels for that
old-school feel.
