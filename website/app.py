# app.py (Main Flask app)

from flask import Flask, send_from_directory, jsonify
from graph_logic import Graph  # Import your existing game logic

app = Flask(__name__, static_folder="static")

# Initialize the graph
graph = Graph()
for i in range(25):  # Create a 5x5 grid of nodes
    graph.add_node(f"square-{i}")

# Connect the nodes in a grid pattern
for i in range(5):  # Rows
    for j in range(5):  # Columns
        if j < 4:  # Connect horizontally
            graph.connect_nodes(graph.nodes[f"square-{i*5+j}"], graph.nodes[f"square-{i*5+j+1}"])
        if i < 4:  # Connect vertically
            graph.connect_nodes(graph.nodes[f"square-{i*5+j}"], graph.nodes[f"square-{(i+1)*5+j}"])


# Serve the main page
@app.route("/")
def index():
    return send_from_directory("static", "index.html")

# API endpoint to fetch the game state
@app.route("/state", methods=["GET"])
def get_state():
    state = {
        name: {
            "value": node.value,
            "neighbors": [neighbor.name for neighbor in node.neighbors],
        }
        for name, node in graph.nodes.items()
    }
    return jsonify(state)

# API endpoint to handle player moves
@app.route("/place", methods=["POST"])
def place_value():
    from flask import request
    data = request.json
    node_name = data["node_name"]
    value = data["value"]

    try:
        node = graph.nodes[node_name]
        node.add_value(value, graph)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route("/<path:filename>")
def static_files(filename):
           return send_from_directory("static", filename)

if __name__ == "__main__":
    app.run(debug=True)
