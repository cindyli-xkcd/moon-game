/* game_settings.js */


// Parse ?room=... and pre-fill from server memory
const urlParams = new URLSearchParams(window.location.search);
let roomId = null;
let boardPool = []; // keep your existing global

if (urlParams.has("room")) {
  roomId = urlParams.get("room");
  fetch(`/game_settings_data?room=${roomId}`)
    .then(res => res.json())
    .then((data) => {
      // Prefer last_settings; fall back to previous_settings if server still sends it
      const prev = data.last_settings || data.previous_settings || {};

      // 1) Boards pool
      if (Array.isArray(prev.boards)) {
        boardPool = prev.boards.map((b, i) => ({ ...b, name: b.name || `Board ${i + 1}` }));
      } else {
        boardPool = [];
      }

      // 2) Global deck controls (room-level remembered values)
      const rememberedDeckType =
        prev.deckType ??
        (prev.board && prev.board.deckSettings && prev.board.deckSettings.deckType) ??
        "infinite";

      const rememberedCopies =
        (typeof prev.copiesPerPhase === "number" ? prev.copiesPerPhase : null) ??
        (prev.board && prev.board.deckSettings && typeof prev.board.deckSettings.copiesPerPhase === "number"
          ? prev.board.deckSettings.copiesPerPhase
          : null) ?? 2;

      const deckRadio = document.querySelector(`input[name="deckType"][value="${rememberedDeckType}"]`);
      if (deckRadio) deckRadio.checked = true;

      const finiteOptions = document.getElementById("finite-options");
      if (finiteOptions) finiteOptions.style.display = rememberedDeckType === "finite" ? "block" : "none";

      const copiesInput = document.getElementById("copiesPerPhase");
      if (copiesInput && rememberedDeckType === "finite") copiesInput.value = rememberedCopies;

      // 3) Draw previews + recompute info/warnings
      if (typeof renderBoardPreviews === "function") renderBoardPreviews();
      if (typeof updateInfo === "function") updateInfo();
    })
    .catch(err => console.warn("No last settings found for this room:", err));
}



function handleBoardUpload(event) {
  const files = event.target.files;
  if (!files.length) return;

  const errors = [];
  let loadedCount = 0;

  for (const file of files) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const board = JSON.parse(e.target.result);
        board.name = file.name.replace(/\.json$/i, "");
        if (isValidBoard(board)) {
          boardPool.push(board);
        } else {
          errors.push(`⚠️ ${file.name} is not a valid board format.`);
        }
      } catch (err) {
        errors.push(`❌ ${file.name} is not valid JSON.`);
      } finally {
        loadedCount++;
        if (loadedCount === files.length) {
          renderBoardPreviews();
          document.getElementById("warning").innerHTML = errors.join("<br>");
          updateInfo();
          markSettingsChanged();
        }
      }
    };
    reader.readAsText(file);
  }
}




function isValidBoard(board) {
  if (!board || typeof board !== "object") return false;
  if (!board.nodes || typeof board.nodes !== "object") return false;

  for (const [name, node] of Object.entries(board.nodes)) {
    if (
      typeof name !== "string" ||
      !node ||
      typeof node !== "object" ||
      !Array.isArray(node.neighbors) ||
      !Array.isArray(node.position) ||
      node.position.length !== 2 ||
      typeof node.position[0] !== "number" ||
      typeof node.position[1] !== "number"
    ) {
      return false;
    }
  }
  return true;
}


document.getElementById("boardUpload").addEventListener("change", handleBoardUpload);




document.getElementById("addBoardTile").addEventListener("click", () => {
  document.getElementById("boardUpload").click();
});




function renderBoardPreviews() {
  const container = document.getElementById("boardPreviewContainer");
  container.innerHTML = ""; // Clear old previews
  const fallbackMsg = document.getElementById("boardFallbackNotice");
  fallbackMsg.style.display = boardPool.length === 0 ? "block" : "none";


  boardPool.forEach((board, index) => {
    // Container for one preview
    const wrapper = document.createElement("div");
    wrapper.className = "board-preview";
    wrapper.style.border = "1px solid #ccc";
    wrapper.style.margin = "10px";
    wrapper.style.padding = "5px";
    wrapper.style.display = "inline-block";
    wrapper.style.textAlign = "center";
    wrapper.style.verticalAlign = "top";
    wrapper.style.background = "#f8f8f8";
    wrapper.style.borderRadius = "6px";
    wrapper.style.width = "220px";

    // Optional board name (if stored under board.name)
    const header = document.createElement("div");
    header.innerText = board.name ? board.name : `Board ${index + 1}`;
    header.style.fontWeight = "bold";
    header.style.marginBottom = "4px";
    
    wrapper.appendChild(header);

    // Canvas
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    canvas.style.cursor = "pointer";
    const ctx = canvas.getContext("2d");
    canvas.addEventListener("click", () => showBoardModal(board));
    wrapper.appendChild(canvas);

    // Footer: info + delete button
    const footer = document.createElement("div");
    footer.style.marginTop = "6px";

    const info = document.createElement("span");
    info.innerText = `${Object.keys(board.nodes).length} nodes`;
    info.style.fontSize = "12px";

    const delBtn = document.createElement("button");
    delBtn.innerText = "Remove";
    delBtn.style.marginLeft = "10px";
    delBtn.onclick = () => {
      boardPool.splice(index, 1);
      renderBoardPreviews();
      updateInfo();
      markSettingsChanged();
    };

    footer.appendChild(info);
    const deckUI = createDeckSettingsUI(board, index);
    
    wrapper.appendChild(deckUI); 
    appendDeckInfoSummary(board, footer);

    footer.appendChild(delBtn);
    wrapper.appendChild(footer);
    container.appendChild(wrapper);

    // --- Draw board preview on canvas ---
    const positions = Object.values(board.nodes).map(n => n.position);
    const xs = positions.map(p => p[0]);
    const ys = positions.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const padding = 10;
    const scaleX = (canvas.width - 2 * padding) / (maxX - minX || 1);
    const scaleY = (canvas.height - 2 * padding) / (maxY - minY || 1);

    const nodeCoords = {};
    for (const [name, node] of Object.entries(board.nodes)) {
      const [x, y] = node.position;
      const px = padding + (x - minX) * scaleX;
      const py = padding + (y - minY) * scaleY;
      nodeCoords[name] = { x: px, y: py };
    }

    // Edges
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    for (const [name, node] of Object.entries(board.nodes)) {
      const { x: x1, y: y1 } = nodeCoords[name];
      for (const neighborName of node.neighbors) {
        if (neighborName in nodeCoords) {
          const { x: x2, y: y2 } = nodeCoords[neighborName];
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    }

    // Squares
    for (const { x, y } of Object.values(nodeCoords)) {
      ctx.fillStyle = "#444";
      ctx.fillRect(x - 5, y - 5, 10, 10);
    }
  });
}

function createDeckSettingsUI(board, index) {
  const container = document.createElement("div");
  container.className = "per-board-settings";

  // === Checkbox to enable/disable custom deck ===
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = !!board.deckSettings;

  const label = document.createElement("label");
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode(" Use custom deck"));
  container.appendChild(label);

  // === Custom deck options ===
  const options = document.createElement("div");
  options.className = "custom-deck-options";
  options.style.display = checkbox.checked ? "block" : "none";

  // Unique name for this board's radio group
  const groupName = `deckType-${index}`;

  // === Infinite radio ===
  const infiniteId = `infinite-${index}`;
  const infiniteRadio = document.createElement("input");
  infiniteRadio.type = "radio";
  infiniteRadio.name = groupName;
  infiniteRadio.id = infiniteId;
  infiniteRadio.value = "infinite";

  const infiniteLabel = document.createElement("label");
  infiniteLabel.htmlFor = infiniteId;
  infiniteLabel.textContent = "Infinite deck";

  // === Finite radio ===
  const finiteId = `finite-${index}`;
  const finiteRadio = document.createElement("input");
  finiteRadio.type = "radio";
  finiteRadio.name = groupName;
  finiteRadio.id = finiteId;
  finiteRadio.value = "finite";

  const finiteLabel = document.createElement("label");
  finiteLabel.htmlFor = finiteId;
  finiteLabel.textContent = "Finite deck";

  // === Radio container ===
  const radioContainer = document.createElement("div");
  const infiniteWrap = document.createElement("div");
  infiniteWrap.appendChild(infiniteRadio);
  infiniteWrap.appendChild(infiniteLabel);
  
  const finiteWrap = document.createElement("div");
  finiteWrap.appendChild(finiteRadio);
  finiteWrap.appendChild(finiteLabel);
  
  radioContainer.appendChild(infiniteWrap);
  radioContainer.appendChild(finiteWrap);
  
  options.appendChild(radioContainer);

  // === Copies input (shown only if finite selected) ===
  const copiesWrapper = document.createElement("div");
  copiesWrapper.style.marginTop = "4px";

  const copiesLabel = document.createElement("label");
  copiesLabel.textContent = "Copies of each phase: ";

  const copiesInput = document.createElement("input");
  copiesInput.type = "number";
  copiesInput.min = "1";
  copiesInput.value = board.deckSettings?.copiesPerPhase || 2;

  copiesLabel.appendChild(copiesInput);
  copiesWrapper.appendChild(copiesLabel);
  options.appendChild(copiesWrapper);

  // === Sync to board object ===
  function updateBoardSettings() {
    board.deckSettings = {
      deckType: infiniteRadio.checked ? "infinite" : "finite",
      copiesPerPhase: parseInt(copiesInput.value)
    };
    copiesWrapper.style.display = infiniteRadio.checked ? "none" : "block";
    markSettingsChanged();
    updateInfo();
    renderBoardPreviews();
  }

  // === Event listeners ===
  checkbox.addEventListener("change", () => {
    const enabled = checkbox.checked;
    options.style.display = enabled ? "block" : "none";

    if (!enabled) {
      delete board.deckSettings;
    } else {
      updateBoardSettings();
    }

    markSettingsChanged();
    updateInfo();
  });

  infiniteRadio.addEventListener("change", updateBoardSettings);
  finiteRadio.addEventListener("change", updateBoardSettings);
  copiesInput.addEventListener("input", updateBoardSettings);

  // === Set initial state ===
  if (board.deckSettings) {
    if (board.deckSettings.deckType === "finite") {
      finiteRadio.checked = true;
      copiesWrapper.style.display = "block";
    } else {
      infiniteRadio.checked = true;
      copiesWrapper.style.display = "none";
    }
  } else {
    infiniteRadio.checked = true;
    copiesWrapper.style.display = "none";
  }

  container.appendChild(options);
  return container;
}









function showBoardModal(board) {
  const modal = document.getElementById("boardModal");
  const canvas = document.getElementById("modalBoardCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Find bounding box
  const positions = Object.values(board.nodes).map(n => n.position);
  const xs = positions.map(p => p[0]);
  const ys = positions.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const padding = 20;
  const scaleX = (canvas.width - 2 * padding) / (maxX - minX || 1);
  const scaleY = (canvas.height - 2 * padding) / (maxY - minY || 1);

  // Draw nodes
  for (const node of Object.values(board.nodes)) {
    const [x, y] = node.position;
    const px = padding + (x - minX) * scaleX;
    const py = padding + (y - minY) * scaleY;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, 2 * Math.PI);
    ctx.fillStyle = "#222";
    ctx.fill();
  }

  modal.style.display = "flex";
}

function closeBoardModal() {
  document.getElementById("boardModal").style.display = "none";
}


function startGame() {
  const urlParams = new URLSearchParams(window.location.search);
  const currentPlayer = urlParams.get("player") || "1";

  const deckType = document.querySelector('input[name="deckType"]:checked').value;
  const copiesPerPhase = deckType === "finite" ? parseInt(document.getElementById("copiesPerPhase").value) : null;

  document.getElementById("startWarning").innerText = "";


  fetch("/start_game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      boards: boardPool,
      room_id: roomId,
      deckType: deckType,
      copiesPerPhase: copiesPerPhase
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.room_id) {
      if (roomId) {
        window.location.href = `/game/${roomId}?player=${currentPlayer}`;
      } else {
        document.getElementById("links").innerHTML = `
          ✅ Game created!<br>
          <a href="/game/${data.room_id}?player=1">Player 1 Link</a><br>
          <a href="/game/${data.room_id}?player=2">Player 2 Link</a>
        `;
      }
    } else {
      alert("Failed to create game.");
    }
  })
  .catch(() => alert("Server error starting game."));
}






function markSettingsChanged() {
  document.getElementById("startWarning").innerText = "You changed settings. Press 'Start Game' again to apply changes.";
}




document.addEventListener("DOMContentLoaded", () => {
  const finiteOptions = document.getElementById("finite-options");
  const deckRadios = document.getElementsByName("deckType");

  deckRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      if (document.querySelector('input[name="deckType"]:checked').value === "finite") {
        finiteOptions.style.display = "block";
      } else {
        finiteOptions.style.display = "none";
      }
    });
  });
});

document.querySelectorAll("input[name='deckType'], #copiesPerPhase").forEach(el => {
  el.addEventListener("change", () => {
    updateInfo();
    markSettingsChanged();
  });
});
document.getElementById("copiesPerPhase").addEventListener("input", () => {
  updateInfo();
  markSettingsChanged();
});



function updateInfo() {
  let nodeCount = 0;
  if (boardPool.length === 0) {
  nodeCount = 25; // default 5x5
} else {
  const largestBoard = Math.max(...boardPool.map(b => Object.keys(b.nodes).length));
  nodeCount = largestBoard;
}

  document.getElementById("boardInfo").innerText = `Number of nodes on (largest) board: ${nodeCount}`;

  // Compute deck
  const deckType = document.querySelector('input[name="deckType"]:checked').value;
  let deckText = "";
  let deckSize = Infinity;
  if (deckType === "infinite") {
    deckText = "Deck is infinite.";
  } else {
    const copies = parseInt(document.getElementById("copiesPerPhase").value);
    deckSize = copies * 8; // 8 moon phases
    deckText = `Deck has ${deckSize} cards.`;
  }
  document.getElementById("deckInfo").innerText = deckText;

  // Show warning
  const warningEl = document.getElementById("warning");
  if (deckType === "finite" && boardPool.length > 0) {
    const largestBoard = Math.max(...boardPool.map(b => Object.keys(b.nodes).length));
    if (deckSize < largestBoard) {
      warningEl.innerText = `Warning: Deck has fewer cards than the largest board (${largestBoard} nodes). Game will end when both players run out of cards.`;
    } else {
      warningEl.innerText = "";
    }
  } else {
    warningEl.innerText = "";
  }
}


document.getElementById("clearBoardsBtn").addEventListener("click", () => {
  if (boardPool.length === 0) {
    alert("No boards to clear.");
    return;
  }

  const confirmed = confirm("Are you sure you want to remove ALL uploaded boards?");
  if (!confirmed) return;

  boardPool = [];
  renderBoardPreviews();
  updateInfo();
  markSettingsChanged();
});







function appendDeckInfoSummary(board, container) {
  if (!board.deckSettings) return;

  const nodeCount = Object.keys(board.nodes).length;

  if (board.deckSettings.deckType === "finite") {
    const cardCount = board.deckSettings.copiesPerPhase * 8;

    const deckInfo = document.createElement("div");
    deckInfo.className = "deck-info-condensed";
    deckInfo.textContent = `Deck: ${cardCount} cards`;
    container.appendChild(deckInfo);

    if (cardCount < nodeCount) {
      const warning = document.createElement("div");
      warning.className = "deck-warning-condensed";
      warning.textContent = `⚠️  Cards < nodes - game ends early`;
      container.appendChild(warning);
      console.log(`[Debug] ${board.name}:`, board.deckSettings, nodeCount);

    }
  } else if (board.deckSettings.deckType === "infinite") {
    const deckInfo = document.createElement("div");
    deckInfo.className = "deck-info-condensed";
    deckInfo.textContent = `Deck: Infinite`;
    container.appendChild(deckInfo);
  }
}


