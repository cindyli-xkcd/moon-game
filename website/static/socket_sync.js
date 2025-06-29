// socket_sync.js

import { GameState } from "./game_state.js";
import { EventPlayer } from "./event_player.js";
import { Renderer } from "./renderer.js";
import { logWithTime } from "./utils.js";


export const SocketSync = {
  socket: null,

  connect() {
    this.socket = io();  // assumes socket.io is available globally


    this.socket.on("connect", () => {
      logWithTime("[SocketSync] Connected to server");
      console.log("[SocketSync] Emitting join_room with room_id:", window.roomId);
      this.socket.emit("join_room", { room_id: window.roomId });
    });

    this.socket.on("disconnect", () => {
      logWithTime("[SocketSync] Disconnected from server");
    });

    this.socket.on("state_updated", async (gameState) => {
      logWithTime("[SocketSync] Received 'state_updated' event");

      await GameState.load(gameState);

      // Explicitly update scores based on conditions
      if (!window.animationsEnabled || gameState.new_game || gameState.is_undo || gameState.debug_fill) {
        Renderer.updateScores(gameState.scores);
      }

      Renderer.finalize(gameState);

      if (gameState.new_game) {
        Renderer.clearBoldCanvas();
        const finalScoreDiv = document.getElementById("final-scores");
        if (finalScoreDiv) finalScoreDiv.style.display = "none";
      }

      // Re-fetch hand on new game or after resets
      if (gameState.new_game) {
        try {
          let url = `/state/${window.roomId}`;
          if (window.isDebugMode && window.isDebugMode()) {
            url += "?debug=true";
          }
          const res = await fetch(url, {
            headers: { "X-Player-ID": `player${GameState.playerNum}` }
          });
          const data = await res.json();
          GameState.current.hand = data.hand;
          Renderer.showHand(data.hand);
        } catch (e) {
          console.error("Failed to fetch hand after reset:", e);
        }
      }

      // Play animations if appropriate
      if (Array.isArray(gameState.events) && gameState.events.length > 0 && window.animationsEnabled) {
        window.isAnimating = true;
        await EventPlayer.play(gameState.events);
        window.isAnimating = false;
      }

      // Handle game over
      if (gameState.game_over) {
        window.isGameOver = true;
        await window.handleGameOver(gameState);
      }
    });
  }
};

