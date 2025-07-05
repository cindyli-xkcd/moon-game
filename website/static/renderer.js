import { GameState } from "./game_state.js";
import { getPhaseImage } from "./utils.js";






export const Renderer = {
  onSquareClicked: null,
  onCardSelected: null,

  init() {
    // Optional: setup if needed
  },

  drawBoard(graph, claimedCards = {}) {
  for (const nodeId in graph.nodes) {
    const node = graph.nodes[nodeId];
    const el = document.getElementById(nodeId);
    if (!el) continue;

    let img = el.querySelector("img");
    if (node.value === null) {
      // Remove image if exists
      if (img) img.remove();
    } else {
      // Create image if missing
      if (!img) {
        img = document.createElement("img");
        img.width = 32;
        img.height = 32;
        img.alt = "moon phase";
        el.appendChild(img);
      }
      img.src = `/static/images/moon/${getPhaseImage(node.value)}`;
    }

    el.onclick = () => {
      if (Renderer.onSquareClicked) {
        Renderer.onSquareClicked(nodeId);
      }
    };

    // Apply claimed card styling
    el.classList.remove("claimed-by-1", "claimed-by-2");
    if (claimedCards[nodeId] === 1) {
      el.classList.add("claimed-by-1");
    } else if (claimedCards[nodeId] === 2) {
      el.classList.add("claimed-by-2");
    }
  }
},

  
  drawBaseConnections(graph) {
    const canvas = document.getElementById("connections-canvas");
    if (!canvas) return;
  
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
  
    // Match canvas to board size
    const board = document.getElementById("game-board");
    const rect = board.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 4;
  
    for (const nodeId in graph.nodes) {
      const node = graph.nodes[nodeId];
      const elA = document.getElementById(nodeId);
      if (!elA) continue;
  
      const rectA = elA.getBoundingClientRect();
      const posA = {
        x: rectA.left + rectA.width / 2 - rect.left,
        y: rectA.top + rectA.height / 2 - rect.top
      };
  
      for (const neighborId of node.neighbors) {
        if (nodeId < neighborId) {
          const elB = document.getElementById(neighborId);
          if (!elB) continue;
  
          const rectB = elB.getBoundingClientRect();
          const posB = {
            x: rectB.left + rectB.width / 2 - rect.left,
            y: rectB.top + rectB.height / 2 - rect.top
          };
  
          ctx.beginPath();
          ctx.moveTo(posA.x, posA.y);
          ctx.lineTo(posB.x, posB.y);
          ctx.stroke();
        }
      }
    }
  },



  drawPersistentBoldEdge(a, b) {
    const canvas = document.getElementById("bold-connections-canvas");
    const ctx = canvas.getContext("2d");
  
    const [x1, y1] = Renderer.getNodeCenter(a);
    const [x2, y2] = Renderer.getNodeCenter(b);
  
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 6;
    ctx.stroke();
  },

  getNodeCenter(nodeId) {
    const el = document.getElementById(nodeId);
    const board = document.getElementById("game-board");
    if (!el || !board) return [0, 0];
  
    const boardRect = board.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
  
    const x = elRect.left + elRect.width / 2 - boardRect.left;
    const y = elRect.top + elRect.height / 2 - boardRect.top;
  
    return [x, y];
  },

  drawDotAt(pair, color = "green", filled = true, diameter = 12) {
    const canvas = document.getElementById("bold-connections-canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
  
    const [x, y] = pair;
    const radius = diameter / 2;
  
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
  
    if (filled) {
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2; 
      ctx.stroke();
    }
  },
 

  drawOneDot(pair, color = "green") {
    const [x, y] = pair;
    const [x1, y1] = this.getNodeCenter(x);
    const [x2, y2] = this.getNodeCenter(y);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    this.drawDotAt([mx, my], color);
  },

  drawTwoDots(pair, color = "green") {
    const [x, y] = pair;
    const [x1, y1] = this.getNodeCenter(x);
    const [x2, y2] = this.getNodeCenter(y);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const normX = -dy / length;
    const normY = dx / length;

    const offset = 8;

    const dot1 = [mx+ normX * offset, my + normY * offset];
    const dot2 = [mx- normX * offset, my - normY * offset];
    this.drawDotAt(dot1, "green", false, 8); 
    this.drawDotAt(dot2, "green", false, 8);
   },

   
  clearBoldCanvas() {
    const canvas = document.getElementById("bold-connections-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  },





showHand(hand) {
  if (!Array.isArray(hand)) {
    console.warn("⚠️ Invalid or missing hand:", hand);
    return;
  }

  const handContainer = document.getElementById("hand");

  // Always clear any previous selection data
  window.selectedPhase = null;
  handContainer.innerHTML = "";

  // Remove any lingering highlights from DOM
  document.querySelectorAll("#hand .hand-card.selected").forEach(el => el.classList.remove("selected"));

  hand.forEach(phase => {
    if (phase === null) return;
    const btn = document.createElement("button");
    btn.innerHTML = `<img src="/static/images/moon/${getPhaseImage(phase)}" alt="phase" width="32" height="32">`;
    btn.dataset.phase = phase;
    btn.className = "hand-card";

    btn.onclick = () => {
      if (GameState.current.current_player !== GameState.playerNum) return;
      const previous = document.querySelector("#hand .hand-card.selected");
      if (previous) previous.classList.remove("selected");
      btn.classList.add("selected");
      window.selectedPhase = parseInt(btn.dataset.phase);
    };

    handContainer.appendChild(btn);
  });

  // ✅ Always check: if it's your turn, auto-select the first available card
  if (GameState.current.current_player === GameState.playerNum) {
    const firstButton = handContainer.querySelector(".hand-card");
    if (firstButton) {
      firstButton.classList.add("selected");
      window.selectedPhase = parseInt(firstButton.dataset.phase);
    }
  }
},















  updateScores(scores) {
    for (const playerId in scores) {
      const scoreEl = document.getElementById(`player${playerId}-points`);
      if (scoreEl) {
        scoreEl.innerText = scores[playerId];
      }
    }
  },

  showCurrentPlayer(playerNum, myPlayerNum = null, forceMessage = null) {
    const banner = document.getElementById("turn-indicator");
    if (!banner) return;
  
    if (forceMessage) {
      banner.innerText = forceMessage;
    } else if (typeof playerNum === "string" && playerNum.startsWith("New game:")) {
      banner.innerText = playerNum;
    } else if (playerNum === "Game Over" || playerNum === "New Game") {
      banner.innerText = playerNum;
    } else if (myPlayerNum !== null && playerNum === myPlayerNum) {
      banner.innerText = "Your turn";
    } else {
      banner.innerText = `Player ${playerNum}'s turn`;
    }
  },


  

  finalize(state) {
    this.drawBoard(state.graph, state.claimed_cards);
    this.drawBaseConnections(state.graph);

    this.clearBoldCanvas();

    for (const pair of state.connections.phase_pairs) {
      this.drawTwoDots(pair, "green");
    }

    for (const pair of state.connections.full_moon_pairs) {
      this.drawOneDot(pair, "green");
    }

    for (const chain of state.connections.lunar_cycles) {
      for (let i = 0; i < chain.length - 1; i++) {
        this.drawPersistentBoldEdge(chain[i], chain[i+1]);
      }
    }

    if (Array.isArray(state.hand)) {
      this.showHand(state.hand);
    }
    
    if (state.deck_remaining !== undefined) {
      const deckStatus = document.getElementById("deckStatus");
      if (deckStatus) {
        deckStatus.innerText = `Deck remaining: ${state.deck_remaining}`;
      }
    }


    this.showCurrentPlayer(state.current_player);
  },

  

replenishOpponentHand(handSize) {
  const hand = document.getElementById("opponent-hand");
  if (!hand) return;

  hand.innerHTML = ""; // clear old
  for (let i = 0; i < handSize; i++) {
    const card = document.createElement("div");
    card.className = "card-back";
    hand.appendChild(card);
  }
}





};

