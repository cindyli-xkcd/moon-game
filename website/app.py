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
            },
    })



@app.route("/place", methods=["POST"])
def place_value():
    data = request.json
    player = data["player"]
    node_name = data["node_name"]
    value = data["value"]

    if "player" not in data or "node_name" not in data or "value" not in data:
        return jsonify({"success": False, "error": "Missing required fields in the request."})

    node = graph.nodes.get(node_name)
    if not node:
        return jsonify({"success": False, "error": "Node not found"})

    if node.value is not None:
        return jsonify({"success": False, "error": "Node already occupied"})

    # ✅ Step 1: Place the value
    node.add_value(value)

    # ✅ Step 2: Score the move
    phase_events = score_tracker.update_score_for_pair(player, phase_pair_module, node)
    full_moon_events = score_tracker.update_score_for_pair(player, full_moon_pair_module, node)
    cycle_events = score_tracker.update_score_for_cycle(player, lunar_cycle_module, node, graph)

    all_events = phase_events + full_moon_events + cycle_events

    # ✅ Step 3: Check if the board is now full
    board_full = all(n.value is not None for n in graph.nodes.values())

    return jsonify({
        "success": True,
        "events": all_events,
        "game_over": board_full,
    })













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
def final_scores():
    try:
        result = score_tracker.finalize_scores()
        return jsonify(result)
    except Exception as e:
        print("Error in /final_scores:", e)
        return jsonify({"error": str(e)}), 500





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

