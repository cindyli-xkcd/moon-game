// static/graph_builder.js

// Unique ID for nodes
let nodeId = 0;

// Data structure for the graph
const graph = { nodes: {}, edges: [] };

// Define moon phases
const moonPhases = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

// Get references to DOM elements
const canvas = document.getElementById("canvas");
const edgesSvg = document.getElementById("edges-svg");
const addNodeButton = document.getElementById("add-node");
const clearGraphButton = document.getElementById("clear-graph");
const saveGraphButton = document.getElementById("save-graph");
const loadGraphButton = document.getElementById("load-graph");
const valueAssignmentDiv = document.getElementById("value-assignment");
const assignValueButton = document.getElementById("assign-value");
const nodeValueSelect = document.getElementById("node-value");
const modeIndicator = document.getElementById("mode-indicator"); // Mode display element
const tooltip = document.getElementById("tooltip"); // Tooltip element

// Variables to handle dragging
let isDragging = false;
let currentNode = null;
let offsetX = 0;
let offsetY = 0;

// Variables to handle node selection for connecting
let selectedNode = null;

// Variable to handle value assignment
let selectedNodeForValue = null;

// Variables to handle modes
let currentMode = null; // 'connect', 'delete', or null

// Define key codes
const KEY_CODES = {
    E: 69,
    X: 88
};

/**
 * Updates the mode indicator UI.
 */
function updateModeIndicator() {
    if (currentMode === 'connect') {
        modeIndicator.textContent = "Mode: Connect (Hold 'E')";
        modeIndicator.style.backgroundColor = "#ffe58f"; // Light yellow
        canvas.style.cursor = "crosshair";
    } else if (currentMode === 'delete') {
        modeIndicator.textContent = "Mode: Delete (Hold 'X')";
        modeIndicator.style.backgroundColor = "#ffa39e"; // Light red
        canvas.style.cursor = "not-allowed";
    } else {
        modeIndicator.textContent = "Mode: None";
        modeIndicator.style.backgroundColor = "#d9d9d9"; // Light gray
        canvas.style.cursor = "default";
    }
}

/**
 * Adds a new node to the canvas and graph data.
 */
function addNode() {
    const node = document.createElement("div");
    node.className = "node";
    node.id = `node-${nodeId}`;
    // Position the node randomly within the canvas boundaries
    node.style.top = `${Math.random() * (canvas.clientHeight - 90)}px`;
    node.style.left = `${Math.random() * (canvas.clientWidth - 90)}px`;
    node.innerText = nodeId;

    node.dataset.value = null; // Initially, no value assigned
    canvas.appendChild(node);

    // Add node to graph data with position
    graph.nodes[node.id] = {
        id: node.id,
        value: null,
        neighbors: [],
        position: {
            top: parseInt(node.style.top),
            left: parseInt(node.style.left)
        }
    };

    // Make node draggable and interactive
    node.addEventListener("mousedown", dragStart);
    node.addEventListener("click", handleNodeClick);
    node.addEventListener("dblclick", assignValue);

    nodeId++;
}

/**
 * Clears all nodes and edges from the canvas and graph data.
 */
function clearGraph() {
    if (!confirm("Are you sure you want to clear the entire graph?")) return;

    canvas.innerHTML = "";
    edgesSvg.innerHTML = "";
    nodeId = 0;
    graph.nodes = {};
    graph.edges = [];
}

/**
 * Draws a line (edge) between two nodes using SVG.
 * @param {string} fromNodeId - ID of the first node.
 * @param {string} toNodeId - ID of the second node.
 */
function drawEdge(fromNodeId, toNodeId) {
    const fromNode = document.getElementById(fromNodeId);
    const toNode = document.getElementById(toNodeId);

    if (!fromNode || !toNode) return;

    // Calculate positions based on node positions
    const fromLeft = graph.nodes[fromNodeId].position.left;
    const fromTop = graph.nodes[fromNodeId].position.top;
    const toLeft = graph.nodes[toNodeId].position.left;
    const toTop = graph.nodes[toNodeId].position.top;

    // Assuming node size is 50px x 50px, so center is +25px
    const x1 = fromLeft + 25;
    const y1 = fromTop + 25;
    const x2 = toLeft + 25;
    const y2 = toTop + 25;

    // Create a unique identifier for the edge
    const edgeId = `edge-${fromNodeId}-${toNodeId}`;

    // Check if the edge already exists in the DOM to prevent duplicates
    if (document.getElementById(edgeId)) return;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("id", edgeId);
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.classList.add("edge"); // Add class for edge styling

    // Enable pointer events for the line
    line.style.pointerEvents = "stroke";

    // Make edges clickable for deletion in delete mode
    line.addEventListener("click", (event) => {
        if (currentMode === 'delete') {
            event.stopPropagation(); // Prevent canvas click from triggering
            deleteEdge(fromNodeId, toNodeId);
        }
    });

    edgesSvg.appendChild(line);
}

/**
 * Updates all edges by redrawing them.
 */
function updateEdges() {
    edgesSvg.innerHTML = ""; // Clear existing edges
    graph.edges.forEach((edge) => {
        drawEdge(edge.from, edge.to);
    });
}

/**
 * Connects two nodes by adding an edge to the graph and drawing it.
 * @param {string} fromNodeId - ID of the first node.
 * @param {string} toNodeId - ID of the second node.
 */
function connectNodes(fromNodeId, toNodeId) {
    // Prevent connecting a node to itself
    if (fromNodeId === toNodeId) {
        alert("Cannot connect a node to itself.");
        return;
    }

    // Sort node IDs to maintain consistency
    const sortedIds = [fromNodeId, toNodeId].sort();
    const [sortedFrom, sortedTo] = sortedIds;

    // Check if the edge already exists
    if (graph.edges.some(edge =>
        (edge.from === sortedFrom && edge.to === sortedTo)
    )) {
        alert("These nodes are already connected.");
        return;
    }

    graph.edges.push({ from: sortedFrom, to: sortedTo });
    graph.nodes[sortedFrom].neighbors.push(sortedTo);
    graph.nodes[sortedTo].neighbors.push(sortedFrom);

    drawEdge(sortedFrom, sortedTo);
}

/**
 * Starts the drag operation for a node.
 * @param {MouseEvent} event
 */
function dragStart(event) {
    // Only initiate drag if left mouse button is pressed
    if (event.button !== 0) return;

    isDragging = true;
    currentNode = event.target;

    const nodeRect = currentNode.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    // Calculate the offset between the mouse position and the node's top-left corner
    offsetX = event.clientX - nodeRect.left;
    offsetY = event.clientY - nodeRect.top;

    // Add event listeners for mousemove and mouseup to the document
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", dragEnd);

    // Prevent text selection while dragging
    event.preventDefault();
}

/**
 * Handles the dragging movement.
 * @param {MouseEvent} event
 */
function drag(event) {
    if (!isDragging || !currentNode) return;

    const canvasRect = canvas.getBoundingClientRect();
    let newLeft = event.clientX - canvasRect.left - offsetX;
    let newTop = event.clientY - canvasRect.top - offsetY;

    // Constrain the node within the canvas boundaries
    newLeft = Math.max(0, Math.min(newLeft, canvas.clientWidth - currentNode.clientWidth));
    newTop = Math.max(0, Math.min(newTop, canvas.clientHeight - currentNode.clientHeight));

    // Update the node's position
    currentNode.style.left = `${newLeft}px`;
    currentNode.style.top = `${newTop}px`;

    // Update the graph data with new position
    graph.nodes[currentNode.id].position.left = newLeft;
    graph.nodes[currentNode.id].position.top = newTop;

    // Update edges to reflect new node positions
    updateEdges();
}

/**
 * Ends the drag operation.
 */
function dragEnd() {
    if (!isDragging) return;

    isDragging = false;
    currentNode = null;

    // Remove the event listeners from the document
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("mouseup", dragEnd);
}

/**
 * Handles node clicks based on the current mode.
 * @param {MouseEvent} event
 */
function handleNodeClick(event) {
    // Prevent default behavior
    event.stopPropagation();

    const node = event.target;

    if (currentMode === 'connect') {
        if (!selectedNode) {
            selectedNode = node;
            node.classList.add("selected"); // Highlight selected node
        } else if (selectedNode !== node) {
            connectNodes(selectedNode.id, node.id);
            selectedNode.classList.remove("selected"); // Reset selection
            selectedNode = null;
        }
    } else if (currentMode === 'delete') {
        deleteNode(node.id);
    }
}

/**
 * Assigns a value to the selected node.
 * @param {MouseEvent} event
 */
function assignValue(event) {
    const node = event.target;
    selectedNodeForValue = node;
    valueAssignmentDiv.style.display = "block";
    nodeValueSelect.value = graph.nodes[node.id].value !== null ? graph.nodes[node.id].value : "";
}

/**
 * Assigns the selected value to the chosen node.
 */
function assignValueToNode() {
    const value = nodeValueSelect.value;
    if (selectedNodeForValue && value !== "") {
        graph.nodes[selectedNodeForValue.id].value = parseInt(value, 10);
        selectedNodeForValue.innerText = moonPhases[value];
        selectedNodeForValue.style.backgroundColor = "lightgreen"; // Indicate value assigned
        valueAssignmentDiv.style.display = "none";
        selectedNodeForValue = null;
    } else {
        alert("Please select a node and choose a value.");
    }
}

/**
 * Deselects any selected node when clicking on the canvas.
 */
function deselectNode() {
    if (selectedNode) {
        selectedNode.classList.remove("selected");
        selectedNode = null;
    }
}

/**
 * Hides the value assignment UI when clicking outside.
 * @param {MouseEvent} event
 */
function hideValueAssignment(event) {
    if (
        !valueAssignmentDiv.contains(event.target) &&
        event.target.id !== "node-value" &&
        event.target.id !== "assign-value"
    ) {
        valueAssignmentDiv.style.display = "none";
        selectedNodeForValue = null;
    }
}

/**
 * Saves the current graph to the backend.
 */
function saveGraph() {
    // Update node positions in graph data before saving
    for (const nodeIdKey in graph.nodes) {
        const nodeElement = document.getElementById(nodeIdKey);
        if (nodeElement) {
            graph.nodes[nodeIdKey].position = {
                top: parseInt(nodeElement.style.top),
                left: parseInt(nodeElement.style.left)
            };
        }
    }

    fetch("/save-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graph),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                alert("Graph saved successfully!");
            } else {
                alert("Error saving graph: " + data.error);
            }
        })
        .catch((error) => {
            console.error("Error saving graph:", error);
        });
}

/**
 * Loads a saved graph from the backend.
 */
function loadGraph() {
    fetch("/load-graph")
        .then((response) => response.json())
        .then((data) => {
            if (data.success) {
                // Clear existing graph
                canvas.innerHTML = "";
                edgesSvg.innerHTML = "";
                nodeId = 0;
                graph.nodes = {};
                graph.edges = [];

                // Load nodes with positions and values
                for (const [nodeIdKey, nodeInfo] of Object.entries(data.graph.nodes)) {
                    const node = document.createElement("div");
                    node.className = "node";
                    node.id = nodeIdKey;
                    node.style.top = `${nodeInfo.position.top}px`;
                    node.style.left = `${nodeInfo.position.left}px`;
                    node.innerText = nodeInfo.value !== null ? moonPhases[nodeInfo.value] : nodeIdKey.split('-')[1];

                    node.dataset.value = nodeInfo.value;
                    node.style.backgroundColor = nodeInfo.value !== null ? "lightgreen" : "lightblue";

                    canvas.appendChild(node);

                    // Update graph data
                    graph.nodes[node.id] = {
                        id: node.id,
                        value: nodeInfo.value,
                        neighbors: nodeInfo.neighbors,
                        position: {
                            top: nodeInfo.position.top,
                            left: nodeInfo.position.left
                        }
                    };

                    // Make node draggable and interactive
                    node.addEventListener("mousedown", dragStart);
                    node.addEventListener("click", handleNodeClick);
                    node.addEventListener("dblclick", assignValue);

                    nodeId++;
                }

                // Load edges
                graph.edges = data.graph.edges;
                updateEdges();

                alert("Graph loaded successfully!");
            } else {
                alert("Error loading graph: " + data.error);
            }
        })
        .catch((error) => {
            console.error("Error loading graph:", error);
        });
}

/**
 * Deletes a node and its connected edges.
 * @param {string} nodeId - ID of the node to delete.
 */
function deleteNode(nodeId) {
    const connectedEdges = graph.edges.filter(edge => edge.from === nodeId || edge.to === nodeId).length;
    
	// **Conditional Confirmation Prompt**
    if (connectedEdges >= 3) {
	    // Show confirmation prompt
	    const confirmDeletion = confirm(`Are you sure you want to delete ${nodeId} and all its connected edges?`);

            // Cancel the deletion, reset the mode to normal
            currentMode = null; // Reset to normal mode
            updateModeIndicator(); // Update the mode indicator to reflect the normal mode
	if(!confirmDeletion) {
            currentMode = null; // Reset to normal mode
            updateModeIndicator(); // Update the mode indicator to reflect the normal mode
            return; // Exit the function early without deleting anything
	}
        
    }

    // Remove the node from the DOM
    const nodeElement = document.getElementById(nodeId);
    if (nodeElement) {
        canvas.removeChild(nodeElement);
    }

    // Find all edges connected to this node
    const edgesToRemove = graph.edges.filter(edge => edge.from === nodeId || edge.to === nodeId);

    // Remove each connected edge
    edgesToRemove.forEach(edge => {
        deleteEdge(edge.from, edge.to);
    });

    // Remove the node from the graph data
    delete graph.nodes[nodeId];
}

/**
 * Deletes an edge between two nodes.
 * @param {string} fromNodeId - ID of the first node.
 * @param {string} toNodeId - ID of the second node.
 */
function deleteEdge(fromNodeId, toNodeId) {
    // Sort node IDs to match the edgeId format
    const sortedIds = [fromNodeId, toNodeId].sort();
    const [sortedFrom, sortedTo] = sortedIds;

    const edgeId = `edge-${sortedFrom}-${sortedTo}`;

    // **Optional Confirmation Prompt for Edge Deletion**
    // Uncomment the lines below if you want to add confirmation prompts for edge deletions:
    /*
    if (!confirm(`Are you sure you want to delete the edge between ${sortedFrom} and ${sortedTo}?`)) {
        return;
    }
    */

    // Remove the edge from the graph data
    graph.edges = graph.edges.filter(edge =>
        !(
            (edge.from === sortedFrom && edge.to === sortedTo) ||
            (edge.from === sortedTo && edge.to === sortedFrom)
        )
    );

    // Remove the edge from the DOM
    const line = document.getElementById(edgeId);
    if (line) {
        edgesSvg.removeChild(line);
    }

    // Remove the neighbor references
    if (graph.nodes[sortedFrom]) {
        graph.nodes[sortedFrom].neighbors = graph.nodes[sortedFrom].neighbors.filter(neighborId => neighborId !== sortedTo);
    }
    if (graph.nodes[sortedTo]) {
        graph.nodes[sortedTo].neighbors = graph.nodes[sortedTo].neighbors.filter(neighborId => neighborId !== sortedFrom);
    }
}

// Event listeners for buttons
addNodeButton.addEventListener("click", addNode);
clearGraphButton.addEventListener("click", clearGraph);
saveGraphButton.addEventListener("click", saveGraph);
loadGraphButton.addEventListener("click", loadGraph);
assignValueButton.addEventListener("click", assignValueToNode);

// Event listeners for canvas and document
canvas.addEventListener("click", deselectNode);
document.addEventListener("click", hideValueAssignment);

// Event listeners for mode key presses
document.addEventListener("keydown", (event) => {
    if (event.keyCode === KEY_CODES.E && currentMode !== 'connect') {
        currentMode = 'connect';
        updateModeIndicator();
    } else if (event.keyCode === KEY_CODES.X && currentMode !== 'delete') {
        currentMode = 'delete';
        updateModeIndicator();
    }
});

document.addEventListener("keyup", (event) => {
    if ((event.keyCode === KEY_CODES.E && currentMode === 'connect') ||
        (event.keyCode === KEY_CODES.X && currentMode === 'delete')) {
        currentMode = null;
        updateModeIndicator();
    }
});

