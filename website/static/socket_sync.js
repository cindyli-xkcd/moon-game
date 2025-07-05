// socket_sync.js

import { GameState } from "./game_state.js";
import { EventPlayer } from "./event_player.js";
import { Renderer } from "./renderer.js";
import { sleep, logWithTime } from "./utils.js";
import { Animator } from "./animator.js";



function opponentJustPlaced(gameState) {
  return gameState.last_move
    && gameState.last_move.player !== GameState.playerNum
    && gameState.last_move.node
    && gameState.last_move.value !== null;
}



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

  const isReset = gameState.events && gameState.events.includes("reset");

  if (isReset) {
    console.log("[SocketSync] Detected reset event — rebuilding board.");
    initBoard(gameState.graph);
    resizeBoldCanvas();
  }

  await GameState.load(gameState);

  if (!window.animationsEnabled || gameState.new_game || gameState.is_undo || gameState.debug_fill) {
    Renderer.updateScores(gameState.scores);
  }


  if (gameState.new_game) {
    Renderer.clearBoldCanvas();
    const finalScoreDiv = document.getElementById("final-scores");
    if (finalScoreDiv) finalScoreDiv.style.display = "none";
  }

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

  if (opponentJustPlaced(gameState)) {
    console.log("[SocketSync] Detected opponent move, animating card to square:", gameState.last_move);
    
    // TEMPORARILY HIDE PHASE ON SQUARE
    const square = document.getElementById(gameState.last_move.node);
    if (square) {
      const img = square.querySelector("img");
      if (img) img.remove(); // remove the moon phase image until flip completes
    }

    // THEN ANIMATE CARD FLYING & FLIPPING
    await Animator.animateOpponentCardToSquare(
      gameState.last_move.node, 
      gameState.last_move.value
    );
  }
  
  await sleep(200)
  Renderer.finalize(gameState);

  const wasMyTurn = GameState.previous && GameState.previous.current_player === GameState.playerNum;
  const isMyTurnNow = GameState.current.current_player === GameState.playerNum;
  
  if (!wasMyTurn && isMyTurnNow) {
    console.log("[SocketSync] It is now my turn — forcing showHand to highlight.");
    Renderer.showHand(GameState.current.hand);
  }
  
  GameState.previous = GameState.current;


  if (Array.isArray(gameState.events) && gameState.events.length > 0 && window.animationsEnabled) {
    window.isAnimating = true;
    await EventPlayer.play(gameState.events);
    window.isAnimating = false;
  }
  
  if (gameState.hand_sizes) {
    const opponentPlayerNum = (GameState.playerNum === 1 ? 2 : 1);
    Renderer.replenishOpponentHand(gameState.hand_sizes[opponentPlayerNum]);
  }




  if (gameState.game_over) {
    window.isGameOver = true;
    await window.handleGameOver(gameState);
  }
});

  }
};

