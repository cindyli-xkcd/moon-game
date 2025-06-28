// game_state.js

import { logWithTime } from "./utils.js";

export const GameState = {
  playerNum: null,
  current: null,  // stores the full game state after load()

async init() {
  const params = new URLSearchParams(window.location.search);
  const player = params.get("player");

  if (player === "1" || player === "2") {
    this.playerNum = parseInt(player);
    logWithTime(`[GameState] Initialized from URL as Player ${this.playerNum}`);
  } else {
    this.playerNum = 1; // default
    logWithTime(`[GameState] No ?player= found, defaulting to Player ${this.playerNum}`);
  }
},


async load() {
  let url = "/state";
  if (window.isDebugMode && window.isDebugMode()) {
    url += "?debug=true";
  }

  const res = await fetch(url, {
    headers: { "X-Player-ID": `player${this.playerNum}` }
  });

  if (!res.ok) {
    console.error("Failed to load state from backend:", res.statusText);
    return;
  }

  const state = await res.json();
  this.current = state;

  logWithTime("[GameState] Loaded state:", state);
},




async sendMove(squareId, selectedPhase) {
  let url = "/place";
  if (window.isDebugMode && window.isDebugMode()) {
    url += "?debug=true";
  }
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Player-ID": `player${this.playerNum}`
    },
    body: JSON.stringify({
      player: this.playerNum,
      node_name: squareId,
      value: selectedPhase
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Failed to place move:", err);
    throw new Error(err);
  }

  const result = await res.json();
  logWithTime("[GameState] Move placed:", result);
  return result;
}

}
