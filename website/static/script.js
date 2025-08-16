import { GameState } from "./game_state.js";
import { Renderer } from "./renderer.js";
import { EventPlayer } from "./event_player.js";
import { SocketSync } from "./socket_sync.js";
import { logWithTime } from "./utils.js";


window.isGameOver = false;
window.isAnimating = false;
window.isDebugMode = false;
window.animationsEnabled = true;
window.selectedPhase = null;


const pathParts = window.location.pathname.split("/");
const roomId = pathParts[2] || "default";
console.log("[DEBUG] Using room ID:", roomId);
window.roomId = roomId;


function isDebugMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("debug") === "true";
}
window.isDebugMode = isDebugMode;


if (isDebugMode()) {
  const debugPanel = document.getElementById("debug-panel");
  if (debugPanel) {
    debugPanel.style.display = "block";
  }
}


// ----- Board Creation -----

function initBoard(graph) {
  const container = document.getElementById("game-board");
  container.innerHTML = "";

  // Create canvases as before
  const boldCanvas = document.createElement("canvas");
  boldCanvas.id = "bold-connections-canvas";
  boldCanvas.width = 800;
  boldCanvas.height = 600;
  container.appendChild(boldCanvas);

  const baseCanvas = document.createElement("canvas");
  baseCanvas.id = "connections-canvas";
  baseCanvas.width = 800;
  baseCanvas.height = 600;
  container.appendChild(baseCanvas);

  for (const id in graph.nodes) {
    const [x, y] = graph.nodes[id].position;
    const square = document.createElement("div");
    square.id = id;
    square.className = "square";
    square.style.left = `${x - 20}px`;  // center based on your rect draw
    square.style.top = `${y - 20}px`;
    container.appendChild(square);
  }
}



function resizeBoldCanvas() {
  const board = document.getElementById("game-board");
  const canvas = document.getElementById("bold-connections-canvas");
  if (!canvas || !board) return;

  const rect = board.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.zIndex = "1"; // higher than base canvas
  canvas.style.pointerEvents = "none";
}


window.initBoard = initBoard;
window.resizeBoldCanvas = resizeBoldCanvas;




// ----- Game Flow -----
async function main() {
  logWithTime("[Main] Starting game...");

  await GameState.init();              // Choose player ID
  await GameState.load();              // Load game state

  if (!GameState.boardPool || GameState.boardPool.length === 0) {
    const randomBtn = document.getElementById("newRandomBoardBtn");
    if (randomBtn) {
      randomBtn.disabled = true;
      randomBtn.title = "Upload boards to use this feature.";
    }
  }


  // HIGHLIGHT YOUR PLAYER'S SCORE BOX
  const myScoreBox = document.getElementById(`player${GameState.playerNum}-score`);
  if (myScoreBox) {
    myScoreBox.classList.add("my-player");
  }

  Renderer.updateScores(GameState.current.scores);

  initBoard(GameState.current.graph);  // Draw board layout
  resizeBoldCanvas();
  Renderer.finalize(GameState.current); // Draw hand, scores, etc.
  SocketSync.connect();                // Listen for real-time updates


  Renderer.onCardSelected = (phase) => {
    selectedPhase = phase;
    logWithTime(`[Main] Selected phase: ${phase}`);
  };

  Renderer.onSquareClicked = async (squareId) => {
    if (window.isAnimating) {
      logWithTime("[Main] Animation in progress - please wait.");
      return;
    }
  
    if (GameState.current.current_player !== GameState.playerNum) {
      logWithTime("[Main] Not your turn!");
      return;
    }


    if (selectedPhase === null) {
      logWithTime("[Main] No phase selected");
      return;
    }
  
    try {
      logWithTime(`[Main] Attempting move: ${squareId} ← ${selectedPhase}`);
  
      // Get the full response from /place
      const result = await GameState.sendMove(squareId, selectedPhase);
  
      // Show the updated board immediately
      Renderer.finalize(result.state);

      // If game over, end game
      if (result.game_over) {
	window.isGameOver = true;
	await window.handleGameOver(result.state);
      }

  
      // Store this as the current state AFTER animation
      GameState.current = result.state;
      selectedPhase = null;

      // Immediately clear any highlighted card
      const prev = document.querySelector("#hand .hand-card.selected");
      if (prev) prev.classList.remove("selected");
  
    } catch (err) {
      console.error("[Main] Error placing move:", err);
    }
  };

}


window.handleGameOver = 
  async function handleGameOver(state) {
    Renderer.finalize(state);
    Renderer.showCurrentPlayer("Game Over");

    try {

	  const data = state.final_scores;
          if (!data) {
            console.error("No final scores sent from backend!");
            return;
          }

	let winnerText = "";
        const score1 = data.final_scores["1"];
        const score2 = data.final_scores["2"];
        
        if (score1 > score2) {
          winnerText = `<p><strong>🎉 Player 1 wins!</strong></p>`;
        } else if (score2 > score1) {
          winnerText = `<p><strong>🎉 Player 2 wins!</strong></p>`;
        } else {
          winnerText = `<p><strong>🤝 It's a tie!</strong></p>`;
        }

        

        const finalScoreDiv = document.getElementById("final-scores");
        finalScoreDiv.style.display = "block";
        finalScoreDiv.innerHTML = `
            <h3>Game Over</h3>
            <p><strong>Player 1</strong><br>
            Base: ${data.base_scores["1"]} &nbsp;&nbsp;
            Bonus: ${data.bonus_scores["1"]} &nbsp;&nbsp;
            Total: ${data.final_scores["1"]}</p>

            <p><strong>Player 2</strong><br>
            Base: ${data.base_scores["2"]} &nbsp;&nbsp;
            Bonus: ${data.bonus_scores["2"]} &nbsp;&nbsp;
            Total: ${data.final_scores["2"]}</p>

	    ${winnerText}
        `;
    } catch (error) {
        console.error("Error fetching final scores:", error);
    }
}




// Start the game
document.addEventListener("DOMContentLoaded", () => {
  main();
});

























// ---------------------
// DEBUG BUTTONS
// --------------------

dragElement(document.getElementById("debug-panel"), document.getElementById("debug-header"));

function dragElement(elmnt, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}


document.getElementById("debug-header").addEventListener("click", () => {
  const content = document.getElementById("debug-content");
  if (content.style.display === "none") {
    content.style.display = "block";
  } else {
    content.style.display = "none";
  }
});



// Reset button logic
const resetBtn = document.getElementById("reset-button");
if (resetBtn) {
  resetBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to restart the game?")) return;

    try {
      let resetUrl = `/reset/${roomId}`;
      if (window.isDebugMode && window.isDebugMode()) {
        resetUrl += "?debug=true";
      }
      const res = await fetch(resetUrl, {
        method: "POST",
        headers: { "X-Player-ID": `player${GameState.playerNum}` }
      });

      const result = await res.json();

      if (result.success) {
        window.isGameOver = false;
 
        // Clear selected card state
        window.isGameOver = false;
        selectedPhase = null;
        
        const prev = document.querySelector("#hand .hand-card.selected");
        if (prev) prev.classList.remove("selected");
        
        console.log("[UI] Reset sent — waiting for socket update");
        
        
        console.log("[UI] Reset sent — waiting for socket update");
        

	console.log("New game")
        console.log("Hand after reset:", GameState.current.hand);

        const finalScoreDiv = document.getElementById("final-scores");
        if (finalScoreDiv) finalScoreDiv.style.display = "none";

        logWithTime("[Main] Game has been reset.");
      } else {
        alert("Failed to reset game.");
      }
    } catch (err) {
      console.error("Error during reset:", err);
      alert("An error occurred during reset.");
    }
  });
}

// Undo Button
const undoBtn = document.getElementById("debug-undo");
if (undoBtn) {
  undoBtn.addEventListener("click", async () => {
    try {
      const res = await fetch(`/undo/${roomId}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        GameState.current = data.state;
        Renderer.finalize(GameState.current);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error("Error during undo:", err);
    }
  });
}

// Redo Button
const redoBtn = document.getElementById("debug-redo");
if (redoBtn) {
  redoBtn.addEventListener("click", async () => {
    try {
      const res = await fetch(`/redo/${roomId}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        GameState.current = data.state;
        Renderer.finalize(GameState.current);
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error("Error during redo:", err);
    }
  });
}

// Animations Checkbox
const toggleAnimationsCheckbox = document.getElementById("toggle-animations-checkbox");
if (toggleAnimationsCheckbox) {
  toggleAnimationsCheckbox.checked = window.animationsEnabled;
  toggleAnimationsCheckbox.addEventListener("change", () => {
    window.animationsEnabled = toggleAnimationsCheckbox.checked;
    console.log("Animations enabled:", window.animationsEnabled);
  });
}



// Node Labels Checkbox
const toggleLabelsCheckbox = document.getElementById("toggle-labels-checkbox");
if (toggleLabelsCheckbox) {
  toggleLabelsCheckbox.addEventListener("change", () => {
    const board = document.getElementById("game-board");
    if (toggleLabelsCheckbox.checked) {
      board.classList.remove("hide-labels");
    } else {
      board.classList.add("hide-labels");
    }
  });
}




// Log Game State in Console
const logStateBtn = document.getElementById("log-state-button");
if (logStateBtn) {
  logStateBtn.addEventListener("click", () => {
    console.log("[DEBUG] Current GameState:", GameState.current);
  });
}



// Show/hide base connections canvas
const toggleBaseCheckbox = document.getElementById("toggle-base-canvas");
if (toggleBaseCheckbox) {
  toggleBaseCheckbox.addEventListener("change", () => {
    const canvas = document.getElementById("connections-canvas");
    if (canvas) {
      canvas.style.display = toggleBaseCheckbox.checked ? "block" : "none";
    }
  });
}

// Show/hide bold connections canvas
const toggleBoldCheckbox = document.getElementById("toggle-bold-canvas");
if (toggleBoldCheckbox) {
  toggleBoldCheckbox.addEventListener("change", () => {
    const canvas = document.getElementById("bold-connections-canvas");
    if (canvas) {
      canvas.style.display = toggleBoldCheckbox.checked ? "block" : "none";
    }
  });
}

// Fill Board
const fillBoardBtn = document.getElementById("fill-board-button");
if (fillBoardBtn) {
  fillBoardBtn.addEventListener("click", async () => {
    try {
      const res = await fetch(`/debug/fill_board/${roomId}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        console.log("Board filled with random moves. Current scores:", data.scores);
        // Force reload state from server
        await GameState.load();
        Renderer.finalize(GameState.current);
      } else {
        alert("Failed to fill board.");
      }
    } catch (err) {
      console.error("Error filling board:", err);
    }
  });
}

// New Game Button
const newGameBtn = document.getElementById("new-game-button");
if (newGameBtn) {
  newGameBtn.addEventListener("click", () => {
    if (!confirm("Are you sure you want to start a new game?")) return;

    const params = new URLSearchParams(window.location.search);
    let room = params.get("room");
    let player = params.get("player");

    // Fallback: get room from path like /game/moon-abc123
    if (!room) {
      const parts = window.location.pathname.split("/");
      if (parts.length >= 3 && parts[1] === "game") {
        room = parts[2];
      }
    }

    if (!player) {
      player = params.get("player") || GameState.playerNum;  // fallback to GameState.playerNum if you track it there
    }

    let target = "/game_settings";
    if (room && player) {
      target += `?room=${room}&player=${player}`;
    } else if (room) {
      target += `?room=${room}`;
    }
    window.location.href = target;
  });
}

const changeSettingsBtn = document.getElementById("new-settings-button");
if (changeSettingsBtn) {
  changeSettingsBtn.addEventListener("click", () => {
    const qs = new URLSearchParams(location.search);
    const player = qs.get("player") || (typeof GameState !== "undefined" && GameState.playerNum) || "1";
    window.location.href = `/game_settings?room=${window.roomId}&player=${player}`;
  });
}


document.getElementById("random-board-button").onclick = async () => {
  if (!confirm("Randomize board for both players?")) return;

  try {
    const res = await fetch(`/new_random_board/${window.roomId}`, {
      method: "POST",
      headers: {
        "X-Player-ID": `player${GameState.playerNum}`
      }
    });

    if (!res.ok) {
      const err = await res.text();
      alert("Failed to select random board:\n" + err);
      return;
    }

    console.log("[UI] Random board request sent via HTTP");
    // You don’t need to call GameState.load(); SocketSync will catch the update.

  } catch (err) {
    console.error("Random board error:", err);
    alert("Something went wrong selecting a new board.");
  }
};


