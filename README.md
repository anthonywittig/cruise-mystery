# Aliens on Deck! 🛳️👾

A retro top-down 2D arcade game. Aliens are taking over the **S.S. Starlight**
mid-cruise, and the only weapons on board are the finest cruise ship amenities:
bingo cards, buffet plates, and free jewelry charms.

## How to play

Just open `index.html` in a browser — no build step, no dependencies.

```sh
# or serve it locally:
npx serve .
```

### Controls

| Input | Action |
| --- | --- |
| WASD / Arrow keys | Move |
| Mouse + click (hold) | Aim & throw |
| 1 / 2 / 3, Q, or scroll | Switch item |
| Space | Throw toward mouse |
| P | Pause |
| M | Mute |

### Arsenal

- **Bingo cards** — fast flicking fire, you'll never run out at the bingo hall
- **Buffet plates** — heavy damage, pierces through multiple aliens
- **Free jewelry charms** — a glittering shotgun spread

Ammo runs out! Stand near the **BUFFET**, the **BINGO** hall, or the gift
**SHOP** to restock. Fallen aliens sometimes drop sodas and ammo boxes.

### Your health is the passenger list — and you're on it

Ten souls are aboard: nine passengers strolling the decks, plus **you**. They
ARE your hit points. Every hit you take, the aliens tractor-beam the passenger
nearest the fight up into their **UFO**, which swoops in to hover over the ship
with its hostages (a live count rides along beside it).

- **Shoot the UFO down** for a **MASS RESCUE** — everyone aboard beams back
  down at the crash site, plus a fat score bonus. It fights back with goo
  bombs, and a fresh saucer arrives for future abductions.
- **Sodas** bribe one or two passengers back down beside you.
- When only you remain, the roster flashes **LAST PASSENGER: YOU** — you run
  faster on adrenaline, but one more hit and the beam comes for *you*.
  Game over.

### The enemy

Green **drifters**, pink **sprinters**, purple **bruisers**, and teal
**spitters** pour out of teleport portals in escalating waves. Survive nine
waves and the **Broodmother** herself boards on wave 10. Sink her to save the
midnight buffet.

## Tech

Vanilla JavaScript + HTML5 Canvas. All pixel-art sprites are generated at
runtime from ASCII art maps, sounds are synthesized with WebAudio, and aliens
navigate the ship's rooms and doors using a BFS flow field. Rendered at
480×320 and upscaled with crisp pixels for that old-school feel.
