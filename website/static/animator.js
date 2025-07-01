// animator.js

import { sleep, logWithTime } from "./utils.js";

const PHASE_IMAGES = [
  "new_moon.png",
  "waxing_crescent.png",
  "first_quarter.png",
  "waxing_gibbous.png",
  "full_moon.png",
  "waning_gibbous.png",
  "last_quarter.png",
  "waning_crescent.png"
];


export const Animator = {
  async animatePairConnection(pair) {
    await pulseNodes(pair);
  },

  async animateFullMoonConnection(pair) {
    await pulseNodes(pair);
  },

  async animateLunarCycle(chain, connections) {
    if (!Array.isArray(chain)) return;
  
    console.log("[Animator] 🔁 Animate Lunar Cycle", chain);
  
    // Step 1: Pulse all nodes in the chain
    pulseNodes(chain);
    await sleep(600);
  
    // Step 2: Animate each edge in green, then fade to black
    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i];
      const b = chain[i + 1];
      await drawBoldEdge(a, b, "green");  // temporary green
      await sleep(300);
    }

  },
  




 // ------------------------------
 // Animate star helpers 
 // ------------------------------

  async animateStarsFromPair(pair, player, points) {
    const [a, b] = pair;
    const centerA = getElementCenter(a);
    const centerB = getElementCenter(b);
    if (!centerA || !centerB) return;

    const midX = (centerA.x + centerB.x) / 2;
    const midY = (centerA.y + centerB.y) / 2;

    await this.animateStarsFromPoint(midX, midY, player, points);
  },

  async animateStarsFromCenter(nodeId, player, points) {
    const center = getElementCenter(nodeId);
    if (!center) return;
    await this.animateStarsFromPoint(center.x, center.y, player, points);
  },

  async animateStarsFromPoint(startX, startY, player, numPoints) {
    console.log(`[⭐] Animating ${numPoints} star(s) to Player ${player}`);
    const scoreEl = document.getElementById(`player${player}-points`);
    if (!scoreEl) return;

    let displayed = parseInt(scoreEl.innerText, 10) || 0;
    const target = displayed + numPoints;

    const scoreRect = scoreEl.getBoundingClientRect();
    const endX = scoreRect.left + scoreRect.width / 2;
    const endY = scoreRect.top + scoreRect.height / 2;

    for (let i = 0; i < numPoints; i++) {
      await new Promise(resolve => {
        const star = document.createElement("div");
        star.classList.add("star");
        star.innerText = `⭐`;
        star.style.position = "absolute";
        star.style.left = `${startX}px`;
        star.style.top = `${startY}px`;
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
  },


  async animateStarsFromNodes(nodes, player, totalPoints) {
    console.log("⭐ Animating", totalPoints, "star(s) to Player", player);
    const delay = 200;
  
    for (let i = 0; i < totalPoints; i++) {
      const nodeId = nodes[i % nodes.length];
      const center = getElementCenter(nodeId);
      if (!center) continue;
  
      await this.animateStarsFromPoint(center.x, center.y, player, 1);
      await sleep(delay);
    }
  },

  


// -----------------------------
// Opponent animations
// ----------------------------

async animateOpponentCardToSquare(nodeId, phase) {
  return new Promise(resolve => {
    const hand = document.getElementById("opponent-hand");
    const square = document.getElementById(nodeId);
    if (!hand || !square) {
      console.warn("[Animator] Missing opponent hand or target square:", hand, square);
      resolve();
      return;
    }

    const card = hand.querySelector(".card-back");
    if (!card) {
      console.warn("[Animator] No card in opponent hand to animate.");
      resolve();
      return;
    }

    // Get position BEFORE removing from DOM
    const cardRect = card.getBoundingClientRect();
    const squareRect = square.getBoundingClientRect();

    // Clone the card for animation
    const cardClone = card.cloneNode(true);
    document.body.appendChild(cardClone);

    // Now remove it from the hand so it visually disappears
    hand.removeChild(card);

    // Use position: fixed so it matches viewport like stars
    cardClone.style.position = "fixed";
    cardClone.style.left = `${cardRect.left}px`;
    cardClone.style.top = `${cardRect.top}px`;
    cardClone.style.width = `${cardRect.width}px`;
    cardClone.style.height = `${cardRect.height}px`;
    cardClone.style.transition = "all 0.6s ease-out";
    cardClone.style.zIndex = "1000";

    // Force reflow to ensure initial position registers
    cardClone.offsetHeight;

    // Compute target center relative to viewport
    const targetX = squareRect.left + squareRect.width / 2 - cardRect.width / 2;
    const targetY = squareRect.top + squareRect.height / 2 - cardRect.height / 2;

    console.log("[Animator DEBUG] (fixed)", {
      cardLeft: cardRect.left, cardTop: cardRect.top,
      targetX, targetY
    });

    // Animate to the target
    setTimeout(() => {
      cardClone.style.left = `${targetX}px`;
      cardClone.style.top = `${targetY}px`;
    }, 0);

    // After flight, flip to reveal the phase
    setTimeout(() => {
      const imgFile = PHASE_IMAGES[phase] || "new_moon.png";
      cardClone.style.background = `white url('/static/images/moon/${imgFile}') center/contain no-repeat`;
      cardClone.style.border = "1px solid #888";
      cardClone.style.transform = "rotateY(180deg) scaleX(-1)";
      cardClone.style.transition = "transform 0.4s";

      setTimeout(() => {
        document.body.removeChild(cardClone);

        // Draw the actual phase on the square
        const img = document.createElement("img");
        img.src = `/static/images/moon/${imgFile}`;
        img.width = 32;
        img.height = 32;
        img.alt = "moon phase";
        square.appendChild(img);

        resolve();
      }, 400);
    }, 600);
  });
}



};







// ------------------------------
//  Shared Helpers (not exported)
// ------------------------------

function getElementCenter(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}




function pulseNodes(nodeIds, duration = 1000) {
  if (!window.animationsEnabled) return Promise.resolve();

  if (!Array.isArray(nodeIds)) {
    logWithTime("[Animator] Invalid nodeIds passed to pulseNodes:", nodeIds);
    return;
  }
  return new Promise(resolve => {
    nodeIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add("pulse");
        setTimeout(() => el.classList.remove("pulse"), 1000);
      }
    });
    setTimeout(resolve, duration);
  });
}


function drawBoldEdge(a, b, color = "green") {
  if (!window.animationsEnabled) return Promise.resolve();

  return new Promise(resolve => {
    const canvas = document.getElementById("bold-connections-canvas");
    const ctx = canvas.getContext("2d");
    const boardRect = canvas.getBoundingClientRect();

    const pointA = getElementCenter(a);
    const pointB = getElementCenter(b);
    if (!pointA || !pointB) return resolve();

    const ax = pointA.x - boardRect.left;
    const ay = pointA.y - boardRect.top;
    const bx = pointB.x - boardRect.left;
    const by = pointB.y - boardRect.top;

    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    setTimeout(resolve, 150);
  });
}


