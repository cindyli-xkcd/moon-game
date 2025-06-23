
// =========================
// 0. SOCKET.IO SETUP
// =========================
const socket = io();  // Connects to backend via WebSocket

socket.on("game_state", async (data) => {
  console.log("[WebSocket] Received game state update:", data);
  await loadGameStateFromWebSocket(data.state);
});


socket.on("state_updated", () => {
  if (scoreAnimationInProgress) {
    logWithTime("[DEBUG] Queuing WebSocket update after animation");
    pendingSocketUpdate = true;
    return;
  }

  logWithTime("[DEBUG] State update received via socket");
  loadGameStateFromWebSocket();
});




function logWithTime(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}


// =========================
// 1. GLOBAL STATE & CONSTANTS
// =========================

const moonPhases = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
const DEBUG_MODE = new URLSearchParams(window.location.search).get("debug") === "true";

let selectedPhaseIndex = 0;
let selectedSlot = null;
let selectedPhaseValue = null;

let lastGameState = null;
let previousState = null;


let animationsEnabled = true;
let nodeLabelsVisible = true;

let scoreAnimationInProgress = false;
let pendingSocketUpdate = false;

let lastPollStateKey = null;
let pollingInterval = null;


window.currentBoldEdges = [];
window.animatingLunarCycle = false;

// =========================
// PLAYER ID SETUP
// =========================

if (!localStorage.getItem("player_id")) {
    const assignedPlayer = prompt("Enter player ID (player1 or player2):");
    localStorage.setItem("player_id", assignedPlayer);
}
const playerId = localStorage.getItem("player_id");

async function fetchWithPlayer(url, options = {}) {
    options.headers = {
        ...(options.headers || {}),
        "X-Player-ID": playerId,
        "Content-Type": "application/json"
    };
    return fetch(url, options);
}


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

async function fetchCurrentPlayer() {
  const res = await fetchWithPlayer('/state');
  const state = await res.json();
  return state.current_player;
}


async function updateHandDebugViews(activePlayer) {
  const hand = lastGameState?.hand ?? [];

  const debugElem = document.getElementById(`player${activePlayer}-hand-debug`);
  if (debugElem) debugElem.innerText = JSON.stringify(hand);
  
  console.log("Current Player:", activePlayer);
  console.log("FULL STATE:", lastGameState);

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
      // Remove any previous claimed-by classes
      square.classList.remove("claimed-by-1", "claimed-by-2");

      // Add the correct one
      square.classList.add(`claimed-by-${claimedCards[squareId]}`);
    }
  }
}


function getMidpointWithOffset(aEl, bEl, boardRect, offset) {
  const ax = aEl.getBoundingClientRect().left + aEl.offsetWidth / 2 - boardRect.left;
  const ay = aEl.getBoundingClientRect().top + aEl.offsetHeight / 2 - boardRect.top;
  const bx = bEl.getBoundingClientRect().left + bEl.offsetWidth / 2 - boardRect.left;
  const by = bEl.getBoundingClientRect().top + bEl.offsetHeight / 2 - boardRect.top;

  const midX = (ax + bx) / 2;
  const midY = (ay + by) / 2;

  return { midX, midY };
}






function resizeCanvasToBoard(canvas) {
    const gameBoard = document.getElementById("game-board");
    const rect = gameBoard.getBoundingClientRect();

    const padding = 20; // Adjust as needed for safe edge space
    canvas.width = rect.width + 2 * padding;
    canvas.height = rect.height + 2 * padding;
    canvas.style.width = canvas.width + "px";
    canvas.style.height = canvas.height + "px";

    canvas.style.left = -padding + "px";
    canvas.style.top = -padding + "px";

    return {
        left: rect.left - padding,
        top: rect.top - padding
    };
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
  const chainEdges = [];
  for (let i = 0; i < chain.length - 1; i++) {
    chainEdges.push([chain[i], chain[i + 1]]);
  }

  if (animationsEnabled) {
    pulseNodes(chain);
    await sleep(600);

    window.currentBoldEdges = window.currentBoldEdges.filter(
      ([x, y]) => !chainEdges.some(([a, b]) =>
        (x === a && y === b) || (x === b && y === a)
      )
    );

    for (const [a, b] of chainEdges) {
      await drawBoldEdge(a, b);
      await sleep(300);
    }
  } else {
    window.currentBoldEdges.push(...chainEdges);
    requestAnimationFrame(drawConnectionsCached);
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
    if (!animationsEnabled) return;
    pulseNodes(pair);
    await sleep(600);

    // Draw dot only for this one pair
    const [a, b] = pair;
    lastGameState.connections = lastGameState.connections || {};
    lastGameState.connections.phase_pairs = (lastGameState.connections.phase_pairs || []).concat([pair]);

    await sleep(400); // brief pause after dot appears
}


async function animateFullMoonPair(pair) {
    if (!animationsEnabled) return;
    pulseNodes(pair);
    await sleep(600);

    const [a, b] = pair;
    lastGameState.connections = lastGameState.connections || {};
    lastGameState.connections.full_moon_pairs = (lastGameState.connections.full_moon_pairs || []).concat([pair]);

    await sleep(400);
}



async function animateScoreStars(startX, startY, player, numPoints) {
  await sleep(0);

  scoreAnimationInProgress = true;
  logWithTime("[DEBUG] Score animation started");

  const scoreEl = document.getElementById(`player${player}-points`);
  let displayed = parseInt(scoreEl.innerText, 10) || 0;
  const target = displayed + numPoints;


  if (!animationsEnabled) {
    scoreEl.innerText = target;
    scoreAnimationInProgress = false;
    return;
  }

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
        displayed += 1;
        scoreEl.innerText = displayed;
        resolve();
      }, 700);
    });
  }

  scoreAnimationInProgress = false;
  logWithTime("[DEBUG] Score animation ended");
  
  if (pendingSocketUpdate) {
    logWithTime("[DEBUG] Running queued WebSocket update");
    pendingSocketUpdate = false;
    loadGameStateFromWebSocket();
  }
  
}






// =========================
// 5. GAME STATE MANAGEMENT
// =========================

async function loadGameState(options = {}) {
    const { drawDots = false } = options;
    try {
        const response = await fetchWithPlayer("/state");
        const state = await response.json();

        lastGameState = state;

	lastGameState.scores = state.scores;
	
	loadScores({skipAnimation: true});

	console.log("[DEBUG] Scores from backend:", state.scores);


	if (state?.connections) {
          window.currentBoldEdges = rebuildBoldEdgesFromConnections(state.connections);
        }


        renderGameBoard(state, !drawDots);
        applyClaimedCardStyles(state.claimed_cards);

	


        if (isBoardFull(state)) {
            await handleGameOver();
        }


        



	previousState = JSON.parse(JSON.stringify(state));


	activePlayer = state.current_player;

        await createPhaseButtons(activePlayer);  
        await updateHandDebugViews(activePlayer);
        
       document.getElementById("turn-indicator").innerText = `Player ${activePlayer}'s turn`;


    } catch (error) {
        console.error("Error fetching game state:", error);
    }
}



async function loadGameStateFromWebSocket(state) {
    if (scoreAnimationInProgress) {
      if (DEBUG_MODE) console.log("[DEBUG] Skipping WebSocket update during animation");
      return;
    }
  lastGameState = state;
  lastGameState.scores = state.scores;

  if (state?.connections) {
    window.currentBoldEdges = rebuildBoldEdgesFromConnections(state.connections);
  }

  renderGameBoard(state);
  applyClaimedCardStyles(state.claimed_cards);
  // requestAnimationFrame(() => loadScores({ skipAnimation: true }));

  const activePlayer = state.current_player;
  await createPhaseButtons(activePlayer);
  await updateHandDebugViews(activePlayer);
  document.getElementById("turn-indicator").innerText = `Player ${activePlayer}'s turn`;
}








function isBoardFull(state) {
    return Object.values(state.graph.nodes).every(node => node.value !== null);
}

async function handleGameOver() {
    // disableBoard();

    try {
        const res = await fetchWithPlayer("/final_scores");
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
   if (DEBUG_MODE) baseCanvas.style.backgroundColor = "rgba(0,255,0,0.05)";
   gameBoard.appendChild(baseCanvas);
   
   const topCanvas = document.createElement("canvas");
   topCanvas.id = "bold-connections-canvas";
   topCanvas.style.position = "absolute";
   topCanvas.style.zIndex = "2";
   if (DEBUG_MODE) topCanvas.style.backgroundColor = "rgba(255,0,0,0.05)";
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

        const label = DEBUG_MODE ? squareId : "&nbsp;";
        square.innerHTML = `
            <div style="font-size: 24px;">${data.value !== null ? moonPhases[data.value] : ""}</div>
            <div class="node-label">${label}</div>
        `;

        square.addEventListener("click", () => handleSquareClick(squareId));
        gameBoard.appendChild(square);
    });

    drawConnections(state, skipDots);
}





async function resetGame() {
  try {
    const response = await fetchWithPlayer("/reset", { method: "POST" });
    const data = await response.json();

    if (data.success) {
      lastGameState = null; // clear old state

      selectedPhaseIndex = null;
      selectedPhaseValue = null;
      selectedSlot = null;

      unhighlightPhases();
      window.currentBoldEdges = [];

      document.getElementById("final-scores").style.display = "none";
      document.getElementById("final-scores").innerHTML = "";

      await initializeGame();
      loadScores(); // refresh visible score
      requestAnimationFrame(drawConnectionsCached); // refresh canvas
    } else {
      alert("Error resetting the game: " + data.error);
    }
  } catch (error) {
    console.error("Error resetting the game:", error);
    alert("There was a problem resetting the game.");
  }
}





// =========================
// 6. EVENT HANDLERS
// =========================

function updateSquareOnBoard(squareId, phaseValue) {
  const el = document.getElementById(squareId);
  if (el) {
    el.innerText = moonPhases[phaseValue];
    el.classList.add("placed");
  }
}


async function handleSquareClick(squareId) {
  // 0. Check for valid selection
  if (selectedPhaseValue === null || selectedSlot === null) {
    alert("Please select a card.");
    return;
  }

  // 1. Send move to backend
  const value = selectedPhaseValue;
  const activePlayer = await fetchCurrentPlayer();

  const response = await fetchWithPlayer("/place", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      player: activePlayer,
      node_name: squareId,
      value: selectedPhaseValue,
    }),
  });

  const data = await response.json();
  if (!data.success) {
    alert(data.error || "Invalid move");
    return;
  }

  // 2. Clear selection
  selectedPhaseValue = null;
  selectedSlot = null;
  unhighlightPhases();

  // 3. Prep local state (minimally) for animation
  const events = data.events || [];
  lastGameState.graph.nodes[squareId].value = value;
  lastGameState.claimed_cards = data.state.claimed_cards;
  lastGameState.connections ??= { phase_pairs: [], full_moon_pairs: [], lunar_cycles: [] };
  updateSquareOnBoard(squareId, value);
  applyClaimedCardStyles(lastGameState.claimed_cards);
  await new Promise(requestAnimationFrame);

  // 4. Animate scoring events
  for (const event of events) {
    const { type, structure, points, player } = event;
    const currentScore = parseInt(document.getElementById(`player${player}-points`).innerText, 10) || 0;

    if (type === "phase_pair") {
      lastGameState.connections.phase_pairs.push(structure.pair);
      await animatePhasePair(structure.pair);
      const [a, b] = structure.pair;
      const midX = (aEl = document.getElementById(a)).getBoundingClientRect().left / 2 +
                   (bEl = document.getElementById(b)).getBoundingClientRect().left / 2;
      const midY = aEl.getBoundingClientRect().top / 2 +
                   bEl.getBoundingClientRect().top / 2;
      await sleep(0);
      await animateScoreStars(midX, midY, player, points);
    }

    else if (type === "full_moon_pair") {
      lastGameState.connections.full_moon_pairs.push(structure.pair);
      await animateFullMoonPair(structure.pair);
      const [a, b] = structure.pair;
      const midX = (aEl = document.getElementById(a)).getBoundingClientRect().left / 2 +
                   (bEl = document.getElementById(b)).getBoundingClientRect().left / 2;
      const midY = aEl.getBoundingClientRect().top / 2 +
                   bEl.getBoundingClientRect().top / 2;
      await sleep(0);
      await animateScoreStars(midX, midY, player, points);
    }

    else if (type === "lunar_cycle") {
      lastGameState.connections.lunar_cycles.push(...event.connections);
      await animateLunarCycle(structure.chain);
      for (let nodeId of structure.chain) {
        const el = document.getElementById(nodeId);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        await sleep(0);
        await animateScoreStars(rect.left + rect.width / 2, rect.top + rect.height / 2, player, 1);
      }
    }
  }

  // 5. Update local state and board visuals
  window.currentBoldEdges = rebuildBoldEdgesFromConnections(data.state.connections);
  requestAnimationFrame(() => drawConnectionsCached());

  if (data.game_over) {
    await handleGameOver();
    return;
  }

  // 6. Reload state fully (hand, scores, turn, etc)
  const animationDelay = 700 * 5 + 100;
  setTimeout(() => {
    if (!scoreAnimationInProgress) loadGameState({ drawDots: true });
  }, animationDelay);
  
   

  const newActivePlayer = data.state.current_player;
  await createPhaseButtons(newActivePlayer);
  document.getElementById("turn-indicator").innerText = `Player ${newActivePlayer}'s turn`;


 
}




// =========================
// 6.5. KEYBOARD HANDLER 
// =========================




document.addEventListener("keydown", (e) => {
  if (!DEBUG_MODE) return;

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


function disableHandButtons(player) {
  const buttons = document.querySelectorAll(`#phase-buttons-player${player} .phase-button`);
  buttons.forEach(btn => btn.disabled = true);
}


async function createPhaseButtons(activePlayer, selectedSlot = null) {
    const thisPlayer = parseInt(playerId.slice(-1));

    // Only draw the current player's own hand
    await createButtonsForPlayer(thisPlayer, activePlayer, selectedSlot);

    // Disable the buttons if it's not their turn
    if (thisPlayer !== activePlayer) {
        disableHandButtons(thisPlayer);
    }

    // Clear the other player's buttons entirely (hide them)
    const otherPlayer = thisPlayer === 1 ? 2 : 1;
    const container = document.getElementById(`player${otherPlayer}-hand`);
    if (container) container.innerHTML = "";
}





async function createButtonsForPlayer(player, activePlayer, selectedSlot = null) {
  const container = document.getElementById(`phase-buttons-player${player}`);
  container.innerHTML = "";

  const thisPlayer = parseInt(playerId.slice(-1));
  const isSelf = player === thisPlayer;
  const isTurn = player === activePlayer;

  const phasesToShow = isSelf && lastGameState?.hand ? lastGameState.hand : [];

  for (let slot = 0; slot < phasesToShow.length; slot++) {
    const phase = phasesToShow[slot];
    const button = document.createElement("button");
    button.innerText = moonPhases[phase];
    button.className = "phase-button";

    // Only allow clicking if it's this player’s turn
    if (isTurn && isSelf) {
      button.addEventListener("click", () => {
        console.log(`Player ${player} clicked slot`, slot, "phase", phase);
        selectPhase(phase, slot, activePlayer);
      });
    }

    if (isTurn && isSelf && slot === selectedSlot) {
      button.classList.add("selected");
    }

    container.appendChild(button);
  }

  console.log("Drawing buttons for", player, "visible to", activePlayer);
}




function selectPhase(phase, slot, activePlayer) {
   selectedPhaseValue = phase;
   selectedSlot = slot;
   
   // Clear existing selections
   document.querySelectorAll(`#phase-buttons-player${activePlayer} .phase-button`)
     .forEach(btn => btn.classList.remove("selected"));
   
   // Re-select the clicked one
   const buttons = document.querySelectorAll(`#phase-buttons-player${activePlayer} .phase-button`);
   if (buttons[slot]) {
     buttons[slot].classList.add("selected");
   }


}




function unhighlightPhases() {
    selectedPhaseIndex = null;
    document.querySelectorAll(".phase-button").forEach(button => {
        button.classList.remove("selected");
    });
}



async function undoMove() {
  try {
    const res = await fetchWithPlayer("/undo", { method: "POST" });
    const data = await res.json();

    if (!data.success) {
      alert(data.error || "Unable to undo move.");
      return;
    }

    lastGameState = data.state;
    const activePlayer = data.state.current_player;
    document.getElementById("turn-indicator").innerText = `Player ${activePlayer}'s turn`;
    window.currentBoldEdges = rebuildBoldEdgesFromConnections(data.state.connections);
    renderGameBoard(lastGameState);
    applyClaimedCardStyles(data.state.claimed_cards);
    loadScores();

    document.getElementById("final-scores").style.display = "none";
    document.getElementById("final-scores").innerHTML = "";

  } catch (error) {
    console.error("Undo failed:", error);
    alert("There was a problem undoing the move.");
  }
}


async function redoMove() {
  try {
    const res = await fetchWithPlayer("/redo", { method: "POST" });
    const data = await res.json();

    if (!data.success) {
      alert(data.error || "Unable to redo move.");
      return;
    }

    lastGameState = data.state;
    const activePlayer = data.state.current_player;
    document.getElementById("turn-indicator").innerText = `Player ${activePlayer}'s turn`;
    window.currentBoldEdges = rebuildBoldEdgesFromConnections(data.state.connections);
    renderGameBoard(lastGameState);
    applyClaimedCardStyles(data.state.claimed_cards);
    loadScores();

    if (isBoardFull(lastGameState)) {
      await handleGameOver();
    }

  } catch (error) {
    console.error("Redo failed:", error);
    alert("There was a problem redoing the move.");
  }
}



// =========================
// 8. INITIALIZATION
// =========================


function loadScores({ skipAnimation = false } = {}) {
  if (scoreAnimationInProgress) {
    if (DEBUG_MODE) console.log("[DEBUG] loadScores skipped (animation in progress)");
    return;
  }

  if (!lastGameState || !lastGameState.scores) return;

  logWithTime("[DEBUG] loadScores called", { skipAnimation });

  if (skipAnimation) {
    document.getElementById("player1-points").innerText = lastGameState.scores[1] ?? 0;
    document.getElementById("player2-points").innerText = lastGameState.scores[2] ?? 0;
  }
}




async function initializeGame() {
    const activePlayer = await fetchCurrentPlayer();
    await loadGameState( { drawDots: true });
    await createPhaseButtons(activePlayer);
    
    await updateHandDebugViews(activePlayer);

    // document.addEventListener("keydown", handleKeydown);

    const turnIndicator = document.getElementById("turn-indicator");
    turnIndicator.innerText = `Player ${activePlayer}'s turn`;

    const resetButton = document.getElementById("reset-button");
    resetButton.addEventListener("click", resetGame);

    // startPolling();

    if (DEBUG_MODE) {
      document.getElementById("debug-panel").style.display = "block";

      // Handle Undo/Redo
      document.getElementById("debug-undo").addEventListener("click", undoMove);
      document.getElementById("debug-redo").addEventListener("click", redoMove);
      
      // Toggle Animations
      document.getElementById("toggle-animations-button").addEventListener("click", () =>
     {
        animationsEnabled = !animationsEnabled;
        const label = animationsEnabled ? "Disable Animations" : "Enable Animations";
        document.getElementById("toggle-animations-button").innerText = label;
      });
      
      // Toggle Node Labels
      document.getElementById("toggle-labels-button").addEventListener("click", () => {
        nodeLabelsVisible = !nodeLabelsVisible;
        document.getElementById("toggle-labels-button").innerText =
          nodeLabelsVisible ? "Hide Node Labels" : "Show Node Labels";
      
        document.querySelectorAll(".node-label").forEach(label => {
          label.style.display = nodeLabelsVisible ? "block" : "none";
        });
      });
      
      // Log Game State
      document.getElementById("log-state-button").addEventListener("click", () => {
        console.log("Current Game State:", lastGameState);
      });

      document.getElementById("toggle-base-canvas").addEventListener("change", (e) => {
      const canvas = document.getElementById("base-connections-canvas");
      canvas.style.display = e.target.checked ? "block" : "none";
      });

      document.getElementById("toggle-bold-canvas").addEventListener("change", (e) => {
        const canvas = document.getElementById("bold-connections-canvas");
        canvas.style.display = e.target.checked ? "block" : "none";
      });

    }
 
}

// =========================
// 8. POLLING
// =========================

function startPolling() {
  if (pollingInterval) return; // already polling

  pollingInterval = setInterval(async () => {
    try {
      const response = await fetchWithPlayer("/state");
      const state = await response.json();

      const stateKey = JSON.stringify({
        current_player: state.current_player,
        graph: state.graph
      });

      if (stateKey !== lastPollStateKey) {
        lastPollStateKey = stateKey;
        await loadGameState({ drawDots: true });
        console.log("[POLL] Change detected — state reloaded.");
      }
    } catch (err) {
      console.warn("[POLL] Error polling:", err);
    }
  }, 1000); // every second
}






document.addEventListener("DOMContentLoaded", () => {
  initializeGame();
});


