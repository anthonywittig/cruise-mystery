#!/usr/bin/env node
/* MCP server that lets an AI play player 2 of Aliens on Deck.
   Speaks the Model Context Protocol over stdio, and bridges to the running
   game page over a local WebSocket (the page connects to ws://localhost:8322
   whenever this server is up). Register it with e.g.:
     claude mcp add aliens-p2 -- node /path/to/mcp-server.mjs
*/
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketServer } from "ws";
import { z } from "zod";

const WS_PORT = 8322;

let game = null; // most recently connected game page
let nextId = 1;
const pending = new Map();

const wss = new WebSocketServer({ port: WS_PORT });
wss.on("connection", (ws) => {
  game = ws;
  ws.on("message", (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString()); } catch { return; }
    const cb = pending.get(msg.id);
    if (cb) { pending.delete(msg.id); cb(msg); }
  });
  ws.on("close", () => { if (game === ws) game = null; });
  ws.on("error", () => {});
});
wss.on("error", (e) => console.error("[aliens-p2] websocket error:", e.message));

function ask(payload) {
  return new Promise((resolve, reject) => {
    if (!game || game.readyState !== 1) {
      return reject(new Error(
        "No game connected. Serve the repo (npm run serve) and open " +
        "http://localhost:8321 in a browser; the game attaches within ~3s."));
    }
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Game did not respond"));
    }, 2000);
    pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
    game.send(JSON.stringify(Object.assign({ id }, payload)));
  });
}

const asText = (obj) => ({
  content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj) }],
});

const server = new McpServer({ name: "aliens-on-deck-p2", version: "1.0.0" });

server.tool(
  "game_state",
  "Snapshot of the running Aliens on Deck game: state (title/wavebreak/playing/paused/gameover/victory), wave, score, shared passenger HP, both players (position, weapon, ammo), the 30 nearest aliens (with distance to player 2), pickups, ammo stations, and player 2's current AI intent. Poll every second or two while playing.",
  async () => asText((await ask({ type: "state" })).data)
);

server.tool(
  "player2_command",
  "Take control of player 2 by setting a standing intent; the game executes it every frame (pathfinding, aiming and firing included) until you set a new one, so only issue a command when the situation changes. Actions: 'attack' engages the nearest alien (or nearest to x,y if given); 'move_to' walks to world coords x,y; 'collect' grabs the nearest pickup; 'restock' stands at the ammo station for `weapon`; 'follow' sticks near player 1; 'select_weapon' switches to `weapon` (keeps the current intent); 'stop' stands still; 'release' hands player 2 back to the human.",
  {
    action: z.enum(["attack", "move_to", "collect", "restock", "follow", "select_weapon", "stop", "release"]),
    x: z.number().optional().describe("world x, for move_to or attack"),
    y: z.number().optional().describe("world y, for move_to or attack"),
    weapon: z.enum(["cards", "plates", "charms"]).optional().describe("for restock or select_weapon"),
  },
  async (args) => {
    const r = await ask({ type: "command", command: args });
    return asText({ note: r.note, state: r.data });
  }
);

server.tool(
  "press_key",
  "Press a menu key in the game: Enter starts or restarts a run, p toggles pause, m toggles mute.",
  { key: z.enum(["Enter", "p", "m"]) },
  async ({ key }) => asText({ pressed: key, state: (await ask({ type: "press", key })).data })
);

await server.connect(new StdioServerTransport());
console.error("[aliens-p2] ready; websocket bridge on ws://localhost:" + WS_PORT);
