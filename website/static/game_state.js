// game_state.js

import { logWithTime } from "./utils.js";

export const GameState = {
  playerNum: null,
  current: null,  // stores the full game state after load()

  async init() {
    const playerStr = localStorage.getItem("playerNum");
    if (!playerStr) {
      const chosen = prompt("Enter player number (1 or 2):");
      if (!["1", "2"].includes(chosen)) {
        alert("Invalid player number");
        throw new Error("Invalid player number");
      }
      localStorage.setItem("playerNum", chosen);
      this.playerNum = parseInt(chosen);
    } else {
      this.playerNum = parseInt(playerStr);
    }

    logWithTime(`[GameState] Initialized as Player ${this.playerNum}`);
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
