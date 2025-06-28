import eventlet
eventlet.monkey_patch()
from flask import Flask, jsonify, request, render_template
from flask_socketio import SocketIO, emit
from graph_logic import Graph
from score_tracker import ScoreTracker
from strategies.phase_pair import PhasePair
from strategies.full_moon_pair import FullMoonPair
from strategies.lunar_cycle import LunarCycle
from deck_manager import DeckManager
from copy import deepcopy

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")  # allow any origin for now

# Set up history tracking
game_history = []
redo_stack = []

# Create the graph
graph = Graph()

# Current player
current_player = 1

# Initialize a 5x5 grid of nodes and connect them
for row in range(5):
    for col in range(5):
        node_id = row * 5 + col
        graph.add_node(f"square-{node_id}", position=(col, row))


# Connect the nodes (adjacent neighbors)
for row in range(5):
    for col in range(5):
        node_id = row * 5 + col
        node_name = f"square-{node_id}"
        if col < 4:  # Connect right neighbor
            right_name = f"square-{row * 5 + (col + 1)}"
            graph.connect_nodes(graph.nodes[node_name], graph.nodes[right_name])
        if row < 4:  # Connect bottom neighbor
            down_name = f"square-{(row + 1) *5 + col}"
            graph.connect_nodes(graph.nodes[node_name], graph.nodes[down_name])

# Initialize the ScoreTracker
score_tracker = ScoreTracker()

# Initialize scoring modules
phase_pair_module = PhasePair()
full_moon_pair_module = FullMoonPair()
lunar_cycle_module = LunarCycle()

# Initialize deck manager 
deck_manager = DeckManager()


@app.route("/undo", methods=["POST"])
def undo():
    global graph, score_tracker, current_player

    if not game_history:
        return jsonify({"success": False, "error": "No moves to undo"})

    redo_stack.append({
        "graph": deepcopy(graph),
        "score_tracker": deepcopy(score_tracker),
        "player": current_player
    })

    prev_state = game_history.pop()
    graph = prev_state["graph"]
    score_tracker = prev_state["score_tracker"]
    current_player = prev_state["player"]

    state = {
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

    socketio.emit("state_updated", { **state, "is_undo": True })

    return jsonify({"success": True, "state": state})


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

    state = {
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

    socketio.emit("state_updated", { **state, "is_undo": True })

    return jsonify({"success": True, "state": state})

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/state", methods=["GET"])
def get_state():
    player_id = request.headers.get("X-Player-ID")
    debug = request.args.get("debug", "false").lower() == "true"

    if player_id not in {"player1", "player2"}:
        return jsonify({"error": "Invalid or missing player ID"}), 400

    player_num = int(player_id[-1])
    hand = deck_manager.get_hand(player_num)

    if debug:
        hand = [0,1,2,3,4,5,6,7]

    return {
        "graph": graph.to_dict(),
        "scores": score_tracker.get_scores(),
        "claimed_cards": score_tracker.get_all_claimed_cards(),
        "connections": {
            "phase_pairs": score_tracker.phase_pairs,
            "full_moon_pairs": score_tracker.full_moon_pairs,
            "lunar_cycles": score_tracker.lunar_cycle_connections
        },
        "current_player": current_player,
        "hand": hand,
        "events": []
    }



@app.route("/place", methods=["POST"])
def place_value():
    global current_player
    data = request.json
    player = data["player"]
    node_name = data["node_name"]
    value = data["value"]

    if "player" not in data or "node_name" not in data or "value" not in data:
        return jsonify({"success": False, "error": "Missing required fields in the request."})

    debug = request.args.get("debug", "false").lower() == "true"

    node = graph.nodes.get(node_name)
    if not node:
        return jsonify({"success": False, "error": "Node not found"})

    if node.value is not None:
        return jsonify({"success": False, "error": "Node already occupied"})

    # Save snapshot
    game_history.append({
        "graph": deepcopy(graph),
        "score_tracker": deepcopy(score_tracker),
        "player": current_player
    })
    redo_stack.clear()

    try:
        print(f"[DEBUG] Player {player} trying to play {value}")
        print(f"[DEBUG] Current hand:", deck_manager.get_hand(player))
        if debug:
            slot_index = -1
        else:
            slot_index = deck_manager.play(player, value)
    except ValueError:
        return jsonify({"success": False, "error": "Card not in hand"})

    # Place value and score
    node.add_value(value)
    phase_events = score_tracker.update_score_for_pair(player, phase_pair_module, node)
    full_moon_events = score_tracker.update_score_for_pair(player, full_moon_pair_module, node)
    cycle_events = score_tracker.update_score_for_cycle(player, lunar_cycle_module, node, graph)
    all_events = phase_events + full_moon_events + cycle_events

    current_player = 3 - current_player

    # Check if game over
    board_full = all(n.value is not None for n in graph.nodes.values())
    final_scores = score_tracker.finalize_scores() if board_full else {}

    print(f"[DEBUG] Scores after move: {score_tracker.get_scores()}")

    # Emit to all
    socketio.emit("state_updated", {
        "graph": graph.to_dict(),
        "scores": score_tracker.get_scores(),
        "claimed_cards": score_tracker.get_all_claimed_cards(),
        "connections": {
            "phase_pairs": score_tracker.phase_pairs,
            "full_moon_pairs": score_tracker.full_moon_pairs,
            "lunar_cycles": score_tracker.lunar_cycle_connections
        },
        "current_player": current_player,
        "events": all_events,
        "game_over": board_full,
        "final_scores": final_scores
    })

    return jsonify({
        "success": True,
        "events": all_events,
        "game_over": board_full,
        "replaced_slot": slot_index,
        "state": {
            "graph": graph.to_dict(),
            "scores": score_tracker.get_scores(),
            "claimed_cards": score_tracker.get_all_claimed_cards(),
            "connections": {
                "phase_pairs": score_tracker.phase_pairs,
                "full_moon_pairs": score_tracker.full_moon_pairs,
                "lunar_cycles": score_tracker.lunar_cycle_connections
            },
            "current_player": current_player,
            "hand": deck_manager.get_hand(player) if not debug else [0,1,2,3,4,5,6,7]
        }
    })





@app.route("/reset", methods=["POST"])
def reset_game():
    global graph, current_player

    graph.clear_all_values()
    current_player = 1

    score_tracker.reset()
    game_history.clear()
    redo_stack.clear()
    deck_manager.reset()

    # Identify which player is making the request
    player_id = request.headers.get("X-Player-ID")
    debug = request.args.get("debug", "false").lower() == "true"

    player_num = int(player_id[-1]) if player_id and player_id.startswith("player") else 1
    hand = deck_manager.get_hand(player_num)
    if debug:
        hand = [0,1,2,3,4,5,6,7]

    # Broadcast to both players (no hand info)
    public_state = {
        "graph": graph.to_dict(),
        "scores": score_tracker.get_scores(),
        "claimed_cards": score_tracker.get_all_claimed_cards(),
        "connections": {
            "phase_pairs": [],
            "full_moon_pairs": [],
            "lunar_cycles": []
        },
        "current_player": current_player,
        "events": [],
        "game_over": False,
        "new_game": True
    }

    socketio.emit("state_updated", public_state)

    # Return personal state including hand
    return jsonify({
        "success": True,
        "state": {
            **public_state,
            "hand": hand  
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


@app.route("/hand/<int:player_id>", methods=["GET"])
def get_hand(player_id):
    hand = deck_manager.get_hand(player_id)
    print(f"Returned hand for player {player_id}:", hand)  
    return jsonify(hand)





@app.route("/debug", methods=["GET"])
def debug_state():
    return jsonify({
        "scores": score_tracker.get_scores(),
        "claimed_cards": score_tracker.get_all_claimed_cards(),
        "graph": graph.to_dict()
    })



@app.route("/debug/fill_board", methods=["POST"])
def debug_fill_board():
    from random import randint, shuffle

    player = 1
    node_names = list(graph.nodes.keys())
    shuffle(node_names)  # random order

    # Fill all but exactly 2 nodes
    fill_count = max(0, len(node_names) - 2)

    for i in range(fill_count):
        node_name = node_names[i]
        node = graph.nodes[node_name]
        if node.value is None:
            phase_value = randint(0, 7)
            node.add_value(phase_value)

            # simulate scoring for this placement
            score_tracker.update_score_for_pair(player, phase_pair_module, node)
            score_tracker.update_score_for_pair(player, full_moon_pair_module, node)
            score_tracker.update_score_for_cycle(player, lunar_cycle_module, node, graph)

            player = 3 - player  # alternate players

    # Emit to all clients
    state = {
        "graph": graph.to_dict(),
        "scores": score_tracker.get_scores(),
        "claimed_cards": score_tracker.get_all_claimed_cards(),
        "connections": {
            "phase_pairs": score_tracker.phase_pairs,
            "full_moon_pairs": score_tracker.full_moon_pairs,
            "lunar_cycles": score_tracker.lunar_cycle_connections
        },
        "current_player": current_player,
        "events": []
    }

    socketio.emit("state_updated", {
        **state,
        "debug_fill": True
    })


    return jsonify({
        "success": True,
        "filled": fill_count,
        "scores": score_tracker.get_scores(),
        "claimed": score_tracker.get_all_claimed_cards()
    })






if __name__ == "__main__":
    socketio.run(app, debug=True)

