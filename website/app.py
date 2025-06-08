from flask import Flask, jsonify, request, render_template
from graph_logic import Graph
from score_tracker import ScoreTracker
from strategies.phase_pair import PhasePair
from strategies.full_moon_pair import FullMoonPair
from strategies.lunar_cycle import LunarCycle
from copy import deepcopy

app = Flask(__name__)

# Set up history tracking
game_history = []
redo_stack = []

# Create the graph
graph = Graph()

# Current player
current_player = 1

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


@app.route("/undo", methods=["POST"])
def undo():
    global graph, score_tracker, current_player

    if not game_history:
        return jsonify({"success": False, "error": "No moves to undo"})

    # Save current state to redo stack
    redo_stack.append({
        "graph": deepcopy(graph),
        "score_tracker": deepcopy(score_tracker),
        "player": current_player
    })

    # Restore previous state
    prev_state = game_history.pop()
    graph = prev_state["graph"]
    score_tracker = prev_state["score_tracker"]
    current_player = prev_state["player"]


    return jsonify({
        "success": True,
        "state": {
            "graph": graph.to_dict(),
            "scores": score_tracker.get_scores(),
            "claimed_cards": score_tracker.get_all_claimed_cards(),
            "connections": {
                "phase_pairs": score_tracker.phase_pairs,
                "full_moon_pairs": score_tracker.full_moon_pairs,
                "lunar_cycles": score_tracker.lunar_cycle_connections
            },
            "current_player": current_player
        }
    })

@app.route("/redo", methods=["POST"])
def redo():
    global graph, score_tracker, current_player

    if not redo_stack:
        return jsonify({"success": False, "error": "No moves to redo"})

    # Save current state to undo history
    game_history.append({
        "graph": deepcopy(graph),
        "score_tracker": deepcopy(score_tracker),
        "player": current_player
    })

    # Restore the next state
    next_state = redo_stack.pop()
    graph = next_state["graph"]
    score_tracker = next_state["score_tracker"]
    current_player = next_state["player"]


    return jsonify({
        "success": True,
        "state": {
            "graph": graph.to_dict(),
            "scores": score_tracker.get_scores(),
            "claimed_cards": score_tracker.get_all_claimed_cards(),
            "connections": {
                "phase_pairs": score_tracker.phase_pairs,
                "full_moon_pairs": score_tracker.full_moon_pairs,
                "lunar_cycles": score_tracker.lunar_cycle_connections
            },
            "current_player": current_player
        }
    })



@app.route("/")
def index():
    return render_template("index.html")

@app.route("/state", methods=["GET"])
def get_state():
    return jsonify({
        "graph": graph.to_dict(),
        "score": score_tracker.get_scores(),
        "claimed_cards": score_tracker.get_all_claimed_cards(),
        "connections": {
            "phase_pairs": score_tracker.phase_pairs,
            "full_moon_pairs": score_tracker.full_moon_pairs,
            "lunar_cycles": score_tracker.lunar_cycle_connections
            },
    })



@app.route("/place", methods=["POST"])
def place_value():
    global current_player
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

    # Save a snapshot before modifying the game state
    game_history.append({
        "graph": deepcopy(graph),
        "score_tracker": deepcopy(score_tracker),
        "player": current_player
    })
    redo_stack.clear()  # Clear redo stack after new move

    #  Step 1: Place the value
    node.add_value(value)

    #  Step 2: Score the move
    phase_events = score_tracker.update_score_for_pair(player, phase_pair_module, node)
    full_moon_events = score_tracker.update_score_for_pair(player, full_moon_pair_module, node)
    cycle_events = score_tracker.update_score_for_cycle(player, lunar_cycle_module, node, graph)

    all_events = phase_events + full_moon_events + cycle_events

    current_player = 3 - current_player

    #  Step 3: Check if the board is now full
    board_full = all(n.value is not None for n in graph.nodes.values())

    return jsonify({
    "success": True,
    "events": all_events,
    "game_over": board_full,
    "state": {
        "graph": graph.to_dict(),
        "scores": score_tracker.get_scores(),
        "claimed_cards": score_tracker.get_all_claimed_cards(),
        "connections": {
            "phase_pairs": score_tracker.phase_pairs,
            "full_moon_pairs": score_tracker.full_moon_pairs,
            "lunar_cycles": score_tracker.lunar_cycle_connections
        },
        "current_player": current_player
    }
})














@app.route("/reset", methods=["POST"])
def reset_game():
    global graph, current_player

    graph.clear_all_values()
    current_player = 1  # reset player turn here

    # ... reinitialize graph nodes and connections

    score_tracker.reset()
    game_history.clear()
    redo_stack.clear()

    return jsonify({
        "success": True,
        "state": {
            "graph": graph.to_dict(),
            "scores": score_tracker.get_scores(),
            "claimed_cards": score_tracker.get_all_claimed_cards(),
            "connections": {
                "phase_pairs": [],
                "full_moon_pairs": [],
                "lunar_cycles": []
            },
            "current_player": current_player
        }
    })



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
        "claimed_cards": score_tracker.get_all_claimed_cards(),
        "graph": graph.to_dict()
    })





if __name__ == "__main__":
    app.run(debug=True)

