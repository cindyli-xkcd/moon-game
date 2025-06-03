from flask import Flask, jsonify, request, render_template
from graph_logic import Graph
from score_tracker import ScoreTracker
from strategies.phase_pair import PhasePair
from strategies.full_moon_pair import FullMoonPair
from strategies.lunar_cycle import LunarCycle

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

# Initialize the ScoreTracker
score_tracker = ScoreTracker()

# Initialize scoring modules
phase_pair_module = PhasePair()
full_moon_pair_module = FullMoonPair()
lunar_cycle_module = LunarCycle()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/state", methods=["GET"])
def get_state():
    return jsonify({
        "graph": graph.to_dict(),
        "score": score_tracker.get_scores(),
        "claimed_cards": score_tracker.claimed_cards,
        "connections": {
            "phase_pairs": score_tracker.phase_pairs,
            "full_moon_pairs": score_tracker.full_moon_pairs,
            "lunar_cycles": score_tracker.lunar_cycle_connections
            }
    })


@app.route("/place", methods=["POST"])
def place_value():
    """Place a moon phase on a specific node and update the graph."""
    data = request.json
    player = data["player"]
    node_name = data["node_name"]
    value = data["value"]

    # Check if required keys are in the request
    if "player" not in data or "node_name" not in data or "value" not in data:
        return jsonify({"success": False, "error": "Missing required fields in the request."})

    # Check if the game is over (no empty squares left)
    if all(node.value is not None for node in graph.nodes.values()):
        return jsonify({"success": False, "error": "Game over! The board is full."})

    node = graph.nodes.get(node_name)
    if node:
        if node.value is not None:
            return jsonify({"success": False, "error": "Node already occupied"})  # Prevent placing on an occupied node

        node.add_value(value)  # Set the value of the node

        # Check for Phase Pairs and Full Moon Pairs
        points_from_phase, claimed_cards_from_phase = score_tracker.update_score_for_pair(player, phase_pair_module, node)
        points_from_full_moon, claimed_cards_from_full_moon = score_tracker.update_score_for_pair(player, full_moon_pair_module, node)
        points_from_cycle, claimed_cards_from_cycle = score_tracker.update_score_for_cycle(player, lunar_cycle_module, node, graph)

        # Return the points scored and the claimed cards
        return jsonify({
            "success": True,
            "points": points_from_phase + points_from_full_moon,
            "claimed_cards": [card.name for card in claimed_cards_from_phase + claimed_cards_from_full_moon]
        })

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

    score_tracker.reset()

    return jsonify({"success": True})


@app.route("/scores", methods=["GET"])
def get_scores():
    """Fetch and return the current scores of the players."""
    return jsonify(score_tracker.get_scores())  # Get scores from ScoreTracker


@app.route("/final_scores", methods=["GET"])
def get_final_scores():
    return jsonify(score_tracker.finalize_scores())


@app.route("/debug", methods=["GET"])
def debug_state():
    return jsonify({
        "scores": score_tracker.get_scores(),
        "claimed_cards": {
            "1": score_tracker.get_claimed_cards("1"),
            "2": score_tracker.get_claimed_cards("2")
        },
        "graph": graph.to_dict()
    })





if __name__ == "__main__":
    app.run(debug=True)

