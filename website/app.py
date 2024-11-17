from flask import Flask, jsonify, request, render_template
from graph_logic import Graph

app = Flask(__name__)

# Create the graph
graph = Graph()

# Initialize a 5x5 grid of nodes and connect them
for i in range(25):
    graph.add_node(f"square-{i}", position=(i // 5, i % 5))  # Position as (row, col)

# Connect the nodes (adjacent neighbors)
for i in range(5):
    for j in range(5):
        node_name = f"square-{i * 5 + j}"
        if j < 4:  # Connect right neighbor
            graph.connect_nodes(graph.nodes[node_name], graph.nodes[f"square-{i * 5 + j + 1}"])
        if i < 4:  # Connect bottom neighbor
            graph.connect_nodes(graph.nodes[node_name], graph.nodes[f"square-{(i + 1) * 5 + j}"])


# Serve the main game page (index.html)
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/state", methods=["GET"])
def get_state():
    """Fetch and return the current state of the graph (nodes and their values)."""
    return jsonify(graph.to_dict())

@app.route("/place", methods=["POST"])
def place_value():
    """Place a moon phase on a specific node and update the graph."""
    data = request.json
    node_name = data["node_name"]
    value = data["value"]

    # Check if the game is over (no empty squares left)
    if all(node.value is not None for node in graph.nodes.values()):
        return jsonify({"success": False, "error": "Game over! The board is full."})

    node = graph.nodes.get(node_name)
    if node:
        if node.value is not None:
            return jsonify({"success": False, "error": "Node already occupied"})  # Prevent placing on an occupied node

        node.add_value(value)  # Set the value of the node
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "error": "Node not found"})



@app.route("/reset", methods=["POST"])
def reset_game():
    """Reset the game state by reinitializing the graph."""
    global graph
    graph = Graph()  # Reinitialize the graph
    
    for i in range(25):
        graph.add_node(f"square-{i}", position=(i // 5, i % 5))  # Reset positions as well
    
    # Reconnect the nodes
    for i in range(5):
        for j in range(5):
            node_name = f"square-{i * 5 + j}"
            if j < 4:
                graph.connect_nodes(graph.nodes[node_name], graph.nodes[f"square-{i * 5 + j + 1}"])
            if i < 4:
                graph.connect_nodes(graph.nodes[node_name], graph.nodes[f"square-{(i + 1) * 5 + j}"])

    return jsonify({"success": True})














if __name__ == "__main__":
    app.run(debug=True)

