/* script.js (game logic) */

const moonPhases = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
let selectedPhaseIndex = 0;

// Fetch and render the game state
async function loadGameState() {
    try {
        const response = await fetch("/state");
        const state = await response.json();
        renderGameBoard(state);
    } catch (error) {
        console.error("Error fetching game state:", error);
    }
}

// Render the game board
function renderGameBoard(state) {
    const gameBoard = document.getElementById("game-board");
    gameBoard.innerHTML = "";

    Object.entries(state).forEach(([squareId, data]) => {
        const square = document.createElement("div");
        square.id = squareId;
        square.className = "square";
        square.innerText = data.value !== null ? moonPhases[data.value] : "";
        square.addEventListener("click", () => handleSquareClick(squareId));
        gameBoard.appendChild(square);
    });
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
            body: JSON.stringify({ node_name: squareId, value: selectedPhaseIndex }),
        });
        const data = await response.json();
        if (data.success) {
            loadGameState();
            unhighlightPhases(); // Unhighlight phase buttons after a move
        } else {
            alert("Error placing phase: " + data.error);
        }
    } catch (error) {
        console.error("Error placing phase:", error);
    }
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

// Handle keyboard shortcuts
function handleKeydown(event) {
    const key = event.key; // Get the key pressed
    const phaseIndex = parseInt(key, 10) - 1; // Convert key (1-8) to index (0-7)

    if (phaseIndex >= 0 && phaseIndex < moonPhases.length) {
        selectPhase(phaseIndex);
        console.log(`Selected phase: ${moonPhases[phaseIndex]} (via keyboard)`);
    }
}

// Initialize the game
function initializeGame() {
    createPhaseButtons();
    loadGameState();
    document.addEventListener("keydown", handleKeydown); // Listen for keyboard events
}

initializeGame();

