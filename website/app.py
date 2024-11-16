# app.py (Main Flask app)

import json  # Import the json module
from flask import Flask, send_from_directory, jsonify, request, render_template
from graph_logic import Graph  # Import your existing game logic

app = Flask(__name__)

# Initialize the graph
def initialize_graph():
    new_graph = Graph()
    for i in range(25):  # Create a 5x5 grid of nodes
        new_graph.add_node(f"square-{i}")
    
    # Connect the nodes in a grid pattern
    for i in range(5):  # Rows
        for j in range(5):  # Columns
            if j < 4:  # Connect horizontally
                new_graph.connect_nodes(new_graph.nodes[f"square-{i*5+j}"], new_graph.nodes[f"square-{i*5+j+1}"])
            if i < 4:  # Connect vertically
                new_graph.connect_nodes(new_graph.nodes[f"square-{i*5+j}"], new_graph.nodes[f"square-{(i+1)*5+j}"])
    
    return new_graph

graph = initialize_graph()

# Serve the main page
@app.route("/")
def index():
    return render_template("index.html")

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
    data = request.get_json()
    node_name = data.get("node_name")
    value = data.get("value")

    if not node_name or value is None:
        return jsonify({"success": False, "error": "Invalid data provided."}), 400

    try:
        node = graph.nodes[node_name]
        node.add_value(value, graph)
        return jsonify({"success": True})
    except KeyError:
        return jsonify({"success": False, "error": f"Node '{node_name}' does not exist."}), 404
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# Serve static files
@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)

# API endpoint to reset the game
@app.route("/reset", methods=["POST"])
def reset_game():
    global graph
    try:
        graph = initialize_graph()  # Reinitialize the graph
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# Serve the graph builder page
@app.route("/graph-builder")
def graph_builder():
    return render_template("graph_builder.html")

# API endpoint to save the graph
@app.route("/save-graph", methods=["POST"])
def save_graph():
    data = request.get_json()
    try:
        # Save graph to a JSON file
        with open("graph_data.json", "w") as f:
            json.dump(data, f, indent=2)
        return jsonify({"success": True, "message": "Graph saved successfully!"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)

