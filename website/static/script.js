
// =========================
// 1. GLOBAL STATE & CONSTANTS
// =========================

let currentPlayer = 1; // Start with Player 1
let selectedPhaseIndex = 0;
let lastGameState = null;

const moonPhases = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
window.currentBoldEdges = [];
window.animatingLunarCycle = false;

// =========================
// 2. UTILITY FUNCTIONS
// =========================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function pulseNodes(ids, duration = 600) {
    ids.forEach(id => document.getElementById(id)?.classList.add("pulse"));
    setTimeout(() => {
        ids.forEach(id => document.getElementById(id)?.classList.remove("pulse"));
    }, duration);
}


// =========================
// 3. DRAWING LOGIC
// =========================


function rebuildBoldEdgesFromConnections(connections) {
  const edges = [];

  for (const chain of connections.lunar_cycles || []) {
    for (let i = 0; i < chain.length - 1; i++) {
      edges.push([chain[i], chain[i + 1]]);
    }
  }

  return edges;
}


function applyClaimedCardStyles(claimedCards) {
  for (const squareId in claimedCards) {
    const square = document.getElementById(squareId);
    if (square) {
      square.classList.add(`claimed-by-${claimedCards[squareId]}`);
    }
  }
}




function resizeCanvasToBoard(canvas) {
    const gameBoard = document.getElementById("game-board");
    const rect = gameBoard.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    return rect;
}

function getNodeCenters(offsetLeft, offsetTop) {
    const centers = {};
    document.querySelectorAll(".square").forEach(square => {
        const rect = square.getBoundingClientRect();
        centers[square.id] = {
            x: rect.left + rect.width / 2 - offsetLeft,
            y: rect.top + rect.height / 2 - offsetTop
        };
    });
    return centers;
}

function drawBaseConnections(state) {
    const canvas = document.getElementById("base-connections-canvas");
    const ctx = canvas.getContext("2d");
    const boardRect = resizeCanvasToBoard(canvas);
    const nodeCenters = getNodeCenters(boardRect.left, boardRect.top);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 2;

    for (const [id, node] of Object.entries(state.graph.nodes)) {
        for (const neighbor of node.neighbors) {
            const a = nodeCenters[id];
            const b = nodeCenters[neighbor];
            if (a && b && id < neighbor) {
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }
    }
}

function drawBoldConnections(skipDots = false) {
	
    const canvas = document.getElementById("bold-connections-canvas");
    const ctx = canvas.getContext("2d");
    const boardRect = resizeCanvasToBoard(canvas);
    const offsetLeft = boardRect.left;
    const offsetTop = boardRect.top;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const [a, b] of window.currentBoldEdges || []) {
        const aEl = document.getElementById(a);
        const bEl = document.getElementById(b);
        if (!aEl || !bEl) continue;

        const ax = aEl.getBoundingClientRect().left + aEl.offsetWidth / 2 - offsetLeft;
        const ay = aEl.getBoundingClientRect().top + aEl.offsetHeight / 2 - offsetTop;
        const bx = bEl.getBoundingClientRect().left + bEl.offsetWidth / 2 - offsetLeft;
        const by = bEl.getBoundingClientRect().top + bEl.offsetHeight / 2 - offsetTop;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
    }

    if (!skipDots){

        drawDots(ctx, boardRect);
    }
}

function drawDot(ctx, x, y, color = "green", radius = 5) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawDots(ctx, boardRect) {

    if (!lastGameState || !lastGameState.connections) {
	console.log("hmmmm")
        return;
    }

    const connections = lastGameState?.connections;
    if (!connections) {
	    console.log("huh")
	    return;
    }




    const drawCenteredDot = ([a, b], offset = null) => {
        const aEl = document.getElementById(a);
        const bEl = document.getElementById(b);
        if (!aEl || !bEl) return;

        const ax = aEl.getBoundingClientRect().left + aEl.offsetWidth / 2 - boardRect.left;
        const ay = aEl.getBoundingClientRect().top + aEl.offsetHeight / 2 - boardRect.top;
        const bx = bEl.getBoundingClientRect().left + bEl.offsetWidth / 2 - boardRect.left;
        const by = bEl.getBoundingClientRect().top + bEl.offsetHeight / 2 - boardRect.top;

        const midX = (ax + bx) / 2;
        const midY = (ay + by) / 2;

        if (offset) {
            drawDot(ctx, midX + offset.x, midY + offset.y);
            drawDot(ctx, midX - offset.x, midY - offset.y);
        } else {
            drawDot(ctx, midX, midY);
        }
    };

    for (const pair of connections.full_moon_pairs || []) {
        drawCenteredDot(pair);
    }

    for (const pair of connections.phase_pairs || []) {
        const [a, b] = pair;
        const aEl = document.getElementById(a);
        const bEl = document.getElementById(b);
        if (!aEl || !bEl) continue;

        const ax = aEl.getBoundingClientRect().left + aEl.offsetWidth / 2 - boardRect.left;
        const ay = aEl.getBoundingClientRect().top + aEl.offsetHeight / 2 - boardRect.top;
        const bx = bEl.getBoundingClientRect().left + bEl.offsetWidth / 2 - boardRect.left;
        const by = bEl.getBoundingClientRect().top + bEl.offsetHeight / 2 - boardRect.top;

        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy);
        const offset = { x: (-dy / len) * 10, y: (dx / len) * 10 };

        drawCenteredDot(pair, offset);
    }
}


function drawNewDot(pair, isFullMoon = false) {
  const canvas = document.getElementById("bold-connections-canvas");
  const ctx = canvas.getContext("2d");
  const boardRect = canvas.getBoundingClientRect();

  const [a, b] = pair;
  const aEl = document.getElementById(a);
  const bEl = document.getElementById(b);
  if (!aEl || !bEl) return;

  const ax = aEl.getBoundingClientRect().left + aEl.offsetWidth / 2 - boardRect.left;
  const ay = aEl.getBoundingClientRect().top + aEl.offsetHeight / 2 - boardRect.top;
  const bx = bEl.getBoundingClientRect().left + bEl.offsetWidth / 2 - boardRect.left;
  const by = bEl.getBoundingClientRect().top + bEl.offsetHeight / 2 - boardRect.top;

  const midX = (ax + bx) / 2;
  const midY = (ay + by) / 2;

  if (isFullMoon) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy);
    const offset = { x: (-dy / len) * 10, y: (dx / len) * 10 };
    drawDot(ctx, midX + offset.x, midY + offset.y);
    drawDot(ctx, midX - offset.x, midY - offset.y);
  } else {
    drawDot(ctx, midX, midY);
  }
}

function drawDotsForCurrentConnections() {
  const canvas = document.getElementById("bold-connections-canvas");
  const ctx = canvas.getContext("2d");
  const boardRect = canvas.getBoundingClientRect();

  // Just draw dots — don't clear!
  drawDots(ctx, boardRect);
}




function drawConnections(state, skipDots = false) {

    drawBaseConnections(state);
    drawBoldConnections(skipDots);
}

function drawConnectionsCached() {
    if (lastGameState) drawConnections(lastGameState);
}






// =========================
// 4. ANIMATION LOGIC
// =========================

async function animateLunarCycle(chain) {
    // Step 1: Pulse nodes
    pulseNodes(chain);
    await sleep(600);

    // Step 2: Temporarily remove the cycle's edges from bold list
    const chainEdges = [];
    for (let i = 0; i < chain.length - 1; i++) {
        chainEdges.push([chain[i], chain[i + 1]]);
    }

    window.currentBoldEdges = window.currentBoldEdges.filter(
        ([x, y]) =>
            !chainEdges.some(([a, b]) =>
                (x === a && y === b) || (x === b && y === a))
    );

    // Step 3: Animate adding each edge back in
    for (const [a, b] of chainEdges) {
        await drawBoldEdge(a, b);
        await sleep(300);
    }
}

function drawBoldEdge(a, b) {
    return new Promise(resolve => {
        const alreadyDrawn = window.currentBoldEdges.some(([x, y]) =>
            (x === a && y === b) || (x === b && y === a));

        if (!alreadyDrawn) {
            window.currentBoldEdges.push([a, b]);
        }

	requestAnimationFrame(() => {
    const canvas = document.getElementById("bold-connections-canvas");
    const ctx = canvas.getContext("2d");
    const boardRect = canvas.getBoundingClientRect();

    // Draw only the new edge (no clearing)
    const aEl = document.getElementById(a);
    const bEl = document.getElementById(b);
    if (aEl && bEl) {
        const ax = aEl.getBoundingClientRect().left + aEl.offsetWidth / 2 - boardRect.left;
        const ay = aEl.getBoundingClientRect().top + aEl.offsetHeight / 2 - boardRect.top;
        const bx = bEl.getBoundingClientRect().left + bEl.offsetWidth / 2 - boardRect.left;
        const by = bEl.getBoundingClientRect().top + bEl.offsetHeight / 2 - boardRect.top;

        ctx.strokeStyle = "green";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
    }

    setTimeout(resolve, 150);
});


            });
}


async function animatePhasePair(pair) {
    pulseNodes(pair);
    await sleep(600);

    // Draw dot only for this one pair
    const [a, b] = pair;
    lastGameState.connections = lastGameState.connections || {};
    lastGameState.connections.phase_pairs = (lastGameState.connections.phase_pairs || []).concat([pair]);

    await sleep(400); // brief pause after dot appears
}


async function animateFullMoonPair(pair) {
    pulseNodes(pair);
    await sleep(600);

    const [a, b] = pair;
    lastGameState.connections = lastGameState.connections || {};
    lastGameState.connections.full_moon_pairs = (lastGameState.connections.full_moon_pairs || []).concat([pair]);

    await sleep(400);
}

async function animateScoreStars(startX, startY, player, numPoints) {
  const scoreEl = document.getElementById(`player${player}-points`);
  const scoreRect = scoreEl.getBoundingClientRect();
  const endX = scoreRect.left + scoreRect.width / 2;
  const endY = scoreRect.top + scoreRect.height / 2;

  for (let i = 0; i < numPoints; i++) {
    await new Promise(resolve => {
      const star = document.createElement("div");
      star.classList.add("star");
      star.style.position = "absolute";
      star.style.left = `${startX}px`;
      star.style.top = `${startY}px`;
      star.innerText = "⭐";
      star.style.transition = "all 0.6s ease-out";

      document.body.appendChild(star);

      requestAnimationFrame(() => {
        star.style.left = `${endX}px`;
        star.style.top = `${endY}px`;
      });

      setTimeout(() => {
        star.style.opacity = "0";  
      }, 1000);  

      setTimeout(() => {
        document.body.removeChild(star);
        const scoreVal = parseInt(scoreEl.innerText, 10);
        scoreEl.innerText = scoreVal + 1;
        resolve();
      }, 700);
    });
  }
}







// =========================
// 5. GAME STATE MANAGEMENT
// =========================

async function loadGameState() {
    try {
        const response = await fetch("/state");
        const state = await response.json();

        lastGameState = state;
        renderGameBoard(state, true);
        applyClaimedCardStyles(state.claimed_cards);


        if (isBoardFull(state)) {
            await handleGameOver();
        }

        loadScores();
    } catch (error) {
        console.error("Error fetching game state:", error);
    }
}

function isBoardFull(state) {
    return Object.values(state.graph.nodes).every(node => node.value !== null);
}

async function handleGameOver() {
    // disableBoard();

    try {
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
    } catch (error) {
        console.error("Error fetching final scores:", error);
    }
}

function renderGameBoard(state, skipDots = false) {

    lastGameState = state;

    if (!state.graph || !state.graph.nodes) {
        alert("Graph data is malformed");
        return;
    }

    const gameBoard = document.getElementById("game-board");
    gameBoard.innerHTML = "";

    // Add base and bold canvas layers
    const baseCanvas = document.createElement("canvas");
    baseCanvas.id = "base-connections-canvas";
    baseCanvas.style.position = "absolute";
    baseCanvas.style.zIndex = "1";
    gameBoard.appendChild(baseCanvas);

    const topCanvas = document.createElement("canvas");
    topCanvas.id = "bold-connections-canvas";
    topCanvas.style.position = "absolute";
    topCanvas.style.zIndex = "2";
    gameBoard.appendChild(topCanvas);


    
	

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
            <div style="font-size: 10px; color: gray;">${squareId}</div>
        `;
        square.addEventListener("click", () => handleSquareClick(squareId));

           gameBoard.appendChild(square);
    });

    drawConnections(state, skipDots);
    applyClaimedCardStyles(state.claimed_cards);
}

async function resetGame() {
    try {
        const response = await fetch("/reset", { method: "POST" });
        const data = await response.json();

        if (data.success) {
            currentPlayer = 1;
            selectedPhaseIndex = null;
            window.currentBoldEdges = [];
            unhighlightPhases();
            document.getElementById("turn-indicator").innerText = `Player ${currentPlayer}'s turn`;
            document.getElementById("final-scores").style.display = "none";
            document.getElementById("final-scores").innerHTML = "";
            loadGameState();
        } else {
            alert("Error resetting the game: " + data.error);
        }
    } catch (error) {
        console.error("Error resetting the game:", error);
    }
}





// =========================
// 6. EVENT HANDLERS
// =========================

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
        value: selectedPhaseIndex,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      alert(data.error || "Invalid move");
      return;
    }

    const events = data.events || [];

    // Step 1: Apply the placed phase
    if (lastGameState?.graph?.nodes?.[squareId]) {
      lastGameState.graph.nodes[squareId].value = selectedPhaseIndex;
    }


    // Step 3: Ensure connection memory exists
    if (!lastGameState.connections) {
      lastGameState.connections = {
        phase_pairs: [],
        full_moon_pairs: [],
        lunar_cycles: []
      };
    }

    // Step 4: Render board without dots, then restore dots after reflow
    renderGameBoard(lastGameState, false);
    applyClaimedCardStyles(lastGameState.claimed_cards);


    // Step 5: Animate each event and update connections/scores
    for (const event of events) {
      const { type, structure, points, player } = event;

      if (type === "phase_pair") {
        lastGameState.connections.phase_pairs.push(structure.pair);
        await animatePhasePair(structure.pair);
	drawDotsForCurrentConnections();

	const [a, b] = structure.pair;
        const aEl = document.getElementById(a);
        const bEl = document.getElementById(b);
        const midX = (aEl.getBoundingClientRect().left + bEl.getBoundingClientRect().left) / 2;
        const midY = (aEl.getBoundingClientRect().top + bEl.getBoundingClientRect().top) / 2;

        await animateScoreStars(midX, midY, player, points);

      } else if (type === "full_moon_pair") {
        lastGameState.connections.full_moon_pairs.push(structure.pair);
        await animateFullMoonPair(structure.pair);
	drawDotsForCurrentConnections();

	const [a, b] = structure.pair;
        const aEl = document.getElementById(a);
        const bEl = document.getElementById(b);
        const midX = (aEl.getBoundingClientRect().left + bEl.getBoundingClientRect().left) / 2;
        const midY = (aEl.getBoundingClientRect().top + bEl.getBoundingClientRect().top) / 2;

        await animateScoreStars(midX, midY, player, points);

      } else if (type === "lunar_cycle") {
        lastGameState.connections.lunar_cycles.push(...event.connections);
        await animateLunarCycle(structure.chain);

	  for (let nodeId of structure.chain) {
             const el = document.getElementById(nodeId);
             if (!el) continue;
             const rect = el.getBoundingClientRect();
             const startX = rect.left + rect.width / 2;
             const startY = rect.top + rect.height / 2;
             await animateScoreStars(startX, startY, player, 1);
        }
      }


    }

    // Step 6: Cleanup
    if (!lastGameState.scores) lastGameState.scores = { 1: 0, 2: 0 };
    for (const { player, points } of events) {
      lastGameState.scores[player] = (lastGameState.scores[player] ?? 0) + points;
    }

    requestAnimationFrame(() => drawConnectionsCached());
    unhighlightPhases();

    if (data.game_over) {
      try {
        await handleGameOver();
      } catch (e) {
        console.error("Error during game over handling:", e);
        alert("There was a problem finalizing the game.");
      }
      return;
    }

    switchPlayer();

  } catch (error) {
    console.error("Error placing phase:", error);
    alert("There was a problem placing the card.");
  }
}


// =========================
// 6.5. KEYBOARD HANDLER (moved before initializeGame)
// =========================

function handleKeydown(event) {
    const phaseIndex = parseInt(event.key, 10) - 1;
    if (phaseIndex >= 0 && phaseIndex < moonPhases.length) {
        selectPhase(phaseIndex);
        console.log(`Selected phase: ${moonPhases[phaseIndex]} (via keyboard)`);
    }
}


document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    undoMove();
  }
  if (e.ctrlKey && e.key === "y") {
    e.preventDefault();
    redoMove();
  }
});


// =========================
// 7. UI SETUP
// =========================

function createPhaseButtons() {
    const phaseButtons = document.getElementById("phase-buttons");
    phaseButtons.innerHTML = "";

    moonPhases.forEach((phase, index) => {
        const button = document.createElement("button");
        button.innerText = phase;
        button.className = "phase-button";
        if (index === selectedPhaseIndex) button.classList.add("selected");

        button.addEventListener("click", () => selectPhase(index));
        phaseButtons.appendChild(button);
    });
}

function selectPhase(index) {
    selectedPhaseIndex = index;
    document.querySelectorAll(".phase-button").forEach((button, idx) => {
        button.classList.toggle("selected", idx === index);
    });
}

function unhighlightPhases() {
    selectedPhaseIndex = null;
    document.querySelectorAll(".phase-button").forEach(button => {
        button.classList.remove("selected");
    });
}

function switchPlayer() {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    const turnIndicator = document.getElementById("turn-indicator");
    turnIndicator.innerText = `Player ${currentPlayer}'s turn`;
}

async function undoMove() {
  try {
    const res = await fetch("/undo", { method: "POST" });
    const data = await res.json();

    if (!data.success) {
      alert(data.error || "Unable to undo move.");
      return;
    }

    lastGameState = data.state;
    currentPlayer = data.state.current_player;
    document.getElementById("turn-indicator").innerText = `Player ${currentPlayer}'s turn`;
    window.currentBoldEdges = rebuildBoldEdgesFromConnections(data.state.connections);
    renderGameBoard(lastGameState);
    applyClaimedCardStyles(data.state.claimed_cards);
    loadScores();

  } catch (error) {
    console.error("Undo failed:", error);
    alert("There was a problem undoing the move.");
  }
}


async function redoMove() {
  try {
    const res = await fetch("/redo", { method: "POST" });
    const data = await res.json();

    if (!data.success) {
      alert(data.error || "Unable to redo move.");
      return;
    }

    lastGameState = data.state;
    currentPlayer = data.state.current_player;
    document.getElementById("turn-indicator").innerText = `Player ${currentPlayer}'s turn`;
    window.currentBoldEdges = rebuildBoldEdgesFromConnections(data.state.connections);
    renderGameBoard(lastGameState);
    applyClaimedCardStyles(data.state.claimed_cards);
    loadScores();

  } catch (error) {
    console.error("Redo failed:", error);
    alert("There was a problem redoing the move.");
  }
}



// =========================
// 8. INITIALIZATION
// =========================

function loadScores() {
  if (!lastGameState || !lastGameState.scores) return;
  document.getElementById("player1-points").innerText = lastGameState.scores[1] ?? 0;
  document.getElementById("player2-points").innerText = lastGameState.scores[2] ?? 0;
}


function initializeGame() {
    createPhaseButtons();
    loadGameState();
    document.addEventListener("keydown", handleKeydown);

    const turnIndicator = document.getElementById("turn-indicator");
    turnIndicator.innerText = `Player ${currentPlayer}'s turn`;

    const resetButton = document.getElementById("reset-button");
    resetButton.addEventListener("click", resetGame);
}

document.addEventListener("DOMContentLoaded", initializeGame);


