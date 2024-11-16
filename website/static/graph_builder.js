// Graph_builder script.js

let nodeId = 0; // Unique ID for nodes
const graph = { nodes: {}, edges: [] }; // Data structure for the graph

const canvas = document.getElementById("canvas");
const addNodeButton = document.getElementById("add-node");
const clearGraphButton = document.getElementById("clear-graph");
const saveGraphButton = document.getElementById("save-graph");

// Add a new node
addNodeButton.addEventListener("click", () => {
    const node = document.createElement("div");
    node.className = "node";
    node.id = `node-${nodeId}`;
    node.style.top = `${Math.random() * 500}px`;
    node.style.left = `${Math.random() * 700}px`;
    node.innerText = nodeId;

    node.dataset.value = null; // Initially no value assigned
    canvas.appendChild(node);

    // Add node to graph data
    graph.nodes[node.id] = { id: node.id, value: null, neighbors: [] };

    // Make node draggable
    node.addEventListener("mousedown", dragStart);
    node.addEventListener("mouseup", dragEnd);
    node.addEventListener("click", selectNode);

    nodeId++;
});

// Clear the graph
clearGraphButton.addEventListener("click", () => {
    canvas.innerHTML = "";
    nodeId = 0;
    graph.nodes = {};
    graph.edges = [];
});

// Save the graph
saveGraphButton.addEventListener("click", () => {
    console.log(JSON.stringify(graph, null, 2)); // For debugging
    fetch("/save-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graph),
    })
        .then((response) => response.json())
        .then((data) => {
            alert("Graph saved successfully!");
        })
        .catch((error) => {
            console.error("Error saving graph:", error);
        });
});

// Dragging logic
let isDragging = false;
let currentNode = null;

function dragStart(event) {
    isDragging = true;
    currentNode = event.target;
    document.addEventListener("mousemove", drag);
}

function drag(event) {
    if (isDragging && currentNode) {
        currentNode.style.top = `${event.clientY - 25}px`;
        currentNode.style.left = `${event.clientX - 25}px`;
    }
}

function dragEnd() {
    isDragging = false;
    currentNode = null;
    document.removeEventListener("mousemove", drag);
}

// Select a node to connect or assign value
let selectedNode = null;

function selectNode(event) {
    const node = event.target;
    if (!selectedNode) {
        selectedNode = node;
        node.style.borderColor = "red"; // Highlight selected node
    } else {
        if (selectedNode !== node) {
            // Connect the two nodes
            graph.edges.push({ from: selectedNode.id, to: node.id });
            graph.nodes[selectedNode.id].neighbors.push(node.id);
            graph.nodes[node.id].neighbors.push(selectedNode.id);
            alert(`Connected ${selectedNode.id} to ${node.id}`);
        }
        selectedNode.style.borderColor = "#555"; // Reset selection
        selectedNode = null;
    }
}

