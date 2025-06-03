let currentPlayer = 1; // Start with Player 1
const moonPhases = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
let selectedPhaseIndex = 0;

// Fetch and render the game state
async function loadGameState() {
    try {
        const response = await fetch("/state");
        const state = await response.json();
        renderGameBoard(state);

        // Check if the game is over (board is full)
        const isBoardFull = Object.values(state.graph.nodes).every(node => node.value !== null);

	if (isBoardFull) {
            disableBoard();
        
            const res = await fetch("/final_scores");
            const data = await res.json();
        
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
            `;
            
}


        loadScores();  
    } catch (error) {
        console.error("Error fetching game state:", error);
    }
}



// New function for adding lines and dots
function drawConnections(state) {

    const canvas = document.getElementById("connections-canvas");
    const ctx = canvas.getContext("2d");
    const gameBoard = document.getElementById("game-board");

    // Match canvas size to board
    const boardRect = gameBoard.getBoundingClientRect();
    canvas.width = boardRect.width;
    canvas.height = boardRect.height;
    canvas.style.width = boardRect.width + "px";
    canvas.style.height = boardRect.height + "px";
    

    const gameBoardRect = gameBoard.getBoundingClientRect();
    const gameBoardOffsetLeft = gameBoardRect.left;
    const gameBoardOffsetTop = gameBoardRect.top;


    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 2;

    const nodeCenters = {};
    document.querySelectorAll(".square").forEach(square => {
        const rect = square.getBoundingClientRect();
        const x = rect.left + rect.width / 2 - gameBoardOffsetLeft;
        const y = rect.top + rect.height / 2 - gameBoardOffsetTop;
        nodeCenters[square.id] = { x, y };
    });

    // Draw adjacent connections
    for (const [id, node] of Object.entries(state.graph.nodes)) {
        for (const neighbor of node.neighbors) {
            if (!nodeCenters[neighbor]) continue;
            const a = nodeCenters[id];
            const b = nodeCenters[neighbor];
            if (id < neighbor) {
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }
    }

    function drawDot(x, y, color = "black", radius = 5) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }

    if (state.connections) {
	console.log("Phase pairs:", state.connections.phase_pairs);
        console.log("Full moon pairs:", state.connections.full_moon_pairs);
        for (const [a, b] of state.connections.full_moon_pairs || []) {
            if (nodeCenters[a] && nodeCenters[b]) {
                const midX = (nodeCenters[a].x + nodeCenters[b].x) / 2;
                const midY = (nodeCenters[a].y + nodeCenters[b].y) / 2;
                drawDot(midX, midY, "green");
            }
        }

        for (const [a, b] of state.connections.phase_pairs || []) {
            if (nodeCenters[a] && nodeCenters[b]) {
                const ax = nodeCenters[a].x;
                const ay = nodeCenters[a].y;
                const bx = nodeCenters[b].x;
                const by = nodeCenters[b].y;

		// Midpoint of the line
                const midX = (ax + bx) / 2;
                const midY = (ay + by) / 2;
                
                // Direction vector (normalized)
                const dx = bx - ax;
                const dy = by - ay;
                const length = Math.sqrt(dx * dx + dy * dy);
                
                // Perpendicular offset (orthogonal vector)
                const offset = 10; // tweak this value to control spacing
                const offsetX = -dy / length * offset;
                const offsetY = dx / length * offset;
                
                // Draw the two dots above and below the midpoint
                drawDot(midX + offsetX, midY + offsetY, "green");
                drawDot(midX - offsetX, midY - offsetY, "green");

            }
        }
    }


}





// Render the game board
function renderGameBoard(state) {
    console.log("GRAPH NODES", state.graph.nodes);
    if (!state.graph || !state.graph.nodes) {
        alert("Graph data is malformed");
        return;
    }
    console.log("FULL STATE", state);

    const gameBoard = document.getElementById("game-board");
    gameBoard.innerHTML = "";

    const canvas = document.createElement("canvas");
    canvas.id = "connections-canvas";
    gameBoard.appendChild(canvas);
    
    const claimedCards = state.claimed_cards;

    const sortedSquares = Object.entries(state.graph.nodes).sort((a, b) => {
      const [rowA, colA] = a[1].position;
      const [rowB, colB] = b[1].position;
      return rowA - rowB || colA - colB;
    });
    
    sortedSquares.forEach(([squareId, data]) => {
      const square = document.createElement("div");
      square.id = squareId;
      square.className = "square";
      square.innerHTML = `
        <div style="font-size: 24px;">${data.value !== null ? moonPhases[data.value] : ""}</div>
        <div style="font-size: 10px; color: gray;">${squareId}</div>`;
      square.addEventListener("click", () => handleSquareClick(squareId));

      // Add claimed visual indicator
      if (claimedCards[squareId] === 1) {
	      square.classList.add("claimed-by-1");
      } else if (claimedCards[squareId] === 2) {
	      square.classList.add("claimed-by-2");
      }

      gameBoard.appendChild(square);
    });
      drawConnections(state);

}

// Handle square clicks
async function handleSquareClick(squareId) {
    if (selectedPhaseIndex === null) {
        alert("Please select a phase first!");
        return;
    }

    try {
        const response = await fetch("/place", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
		    player: currentPlayer,
		    node_name: squareId, 
		    value: selectedPhaseIndex }),
        });

        const data = await response.json();

        if (data.success) {
            loadGameState();
            unhighlightPhases(); // Unhighlight phase buttons after a move
            switchPlayer(); // Switch the player's turn
        } else {
            if (data.error === "Game over! The board is full.") {
                alert("Game Over! The board is full.");
                // Optionally, disable further clicks or display a reset button
                disableBoard();
            } else {
                alert("Error placing phase: " + data.error);
            }
        }
    } catch (error) {
        console.error("Error placing phase:", error);
    }
}

// Disable further actions when the game is over
function disableBoard() {
    // Disable further clicks on squares
    document.querySelectorAll(".square").forEach(square => {
        square.removeEventListener("click", handleSquareClick);
    });

    // Optionally, show the reset button to restart the game
    const resetButton = document.getElementById("reset-button");
    resetButton.style.display = "block"; // Show reset button after game ends
}




// Create phase selection buttons
function createPhaseButtons() {
    const phaseButtons = document.getElementById("phase-buttons");
    phaseButtons.innerHTML = ""; // Clear existing buttons

    moonPhases.forEach((phase, index) => {
        const button = document.createElement("button");
        button.innerText = phase;
        button.className = "phase-button";
        if (index === selectedPhaseIndex) button.classList.add("selected");
        button.addEventListener("click", () => selectPhase(index));
        phaseButtons.appendChild(button);
    });
}

// Select a phase by clicking a button
function selectPhase(index) {
    selectedPhaseIndex = index;
    document.querySelectorAll(".phase-button").forEach((button, idx) => {
        button.classList.toggle("selected", idx === index);
    });
}

// Unhighlight all phase buttons
function unhighlightPhases() {
    selectedPhaseIndex = null; // Reset the selected phase index
    document.querySelectorAll(".phase-button").forEach((button) => {
        button.classList.remove("selected");
    });
}

// Switch the player's turn
function switchPlayer() {
    currentPlayer = currentPlayer === 1 ? 2 : 1; // Toggle between Player 1 and Player 2
    const turnIndicator = document.getElementById("turn-indicator");
    turnIndicator.innerText = `Player ${currentPlayer}'s turn`;
}

// Handle keyboard shortcuts
function handleKeydown(event) {
    const key = event.key; // Get the key pressed
    const phaseIndex = parseInt(key, 10) - 1; // Convert key (1-8) to index (0-7)

    if (phaseIndex >= 0 && phaseIndex < moonPhases.length) {
        selectPhase(phaseIndex);
        console.log(`Selected phase: ${moonPhases[phaseIndex]} (via keyboard)`);
    }
}


// Function to fetch and display the current scores
async function loadScores() {
    try {
        const response = await fetch("/scores");
        const scores = await response.json();
        document.getElementById("player1-points").innerText = scores["1"]; // Update Player 1 score
        document.getElementById("player2-points").innerText = scores["2"]; // Update Player 2 score
    } catch (error) {
        console.error("Error fetching scores:", error);
    }
}



// Call loadScores when the page first loads
document.addEventListener("DOMContentLoaded", loadScores);


// Initialize the game
function initializeGame() {
    createPhaseButtons();
    loadGameState();
    document.addEventListener("keydown", handleKeydown); // Listen for keyboard events
    const turnIndicator = document.getElementById("turn-indicator");
    turnIndicator.innerText = `Player ${currentPlayer}'s turn`;

    // Add event listener for reset button
    const resetButton = document.getElementById("reset-button");
    resetButton.addEventListener("click", resetGame);
}

async function resetGame() {
    try {
        const response = await fetch("/reset", { method: "POST" });
        const data = await response.json();
        if (data.success) {
            currentPlayer = 1; // Reset to Player 1
            selectedPhaseIndex = null; // Clear phase selection
            document.getElementById("turn-indicator").innerText = `Player ${currentPlayer}'s turn`;
            loadGameState(); // Reload the game board
            unhighlightPhases(); // Clear highlighted buttons
        } else {
            alert("Error resetting the game: " + data.error);
        }
	document.getElementById("final-scores").style.display = "none";
        document.getElementById("final-scores").innerHTML = "";

    } catch (error) {
        console.error("Error resetting the game:", error);
    }
}

initializeGame();

