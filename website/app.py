import eventlet
eventlet.monkey_patch()
from flask import Flask, jsonify, request, render_template, redirect, url_for
from flask_socketio import SocketIO, emit, join_room

from copy import deepcopy
import random
import string

from graph_logic import Graph
from score_tracker import ScoreTracker
from strategies.phase_pair import PhasePair
from strategies.full_moon_pair import FullMoonPair
from strategies.lunar_cycle import LunarCycle
from deck_manager import DeckManager

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")  # allow any origin for now

games = {}

# Initialize scoring modules
phase_pair_module = PhasePair()
full_moon_pair_module = FullMoonPair()
lunar_cycle_module = LunarCycle()






def get_or_create_game(room_id):
    if room_id not in games:
        raise ValueError(f"No game exists for room {room_id}")
    return games[room_id]




@app.route("/game/<room_id>")
def game_room(room_id):
    return render_template("game.html")

@app.route("/")
def landing():
    return render_template("landing.html")



@app.route("/new-game-id")
def new_game_id():
    suffix = ''.join(random.choices(string.ascii_letters + string.digits, k=6))
    room_id = f"moon-{suffix}"
    return jsonify({"room_id": room_id})

@app.route("/new_random_board/<room_id>", methods=["POST"])
def new_random_board(room_id):
    player = request.headers.get("X-Player-ID", "")
    if player not in ("player1", "player2"):
        return "Missing player", 400

    room = games.get(room_id)
    if not room or not room["settings"].get("boards"):
        return "No boards available", 400

    previous = room["settings"].get("board")
    options = [b for b in room["settings"]["boards"] if b != previous]
    board = random.choice(options) if options else previous

    # Update settings with the new board
    room["settings"]["board"] = board

    # Rebuild game state
    graph = Graph.from_dict(board)
    score_tracker = ScoreTracker()
    board_settings = board.get("deckSettings", {})
    deck_manager = DeckManager(
        deck_type=board_settings.get("deckType", room["settings"].get("deckType", "infinite")),
        copies_per_phase=board_settings.get("copiesPerPhase", room["settings"].get("copiesPerPhase"))
    )
    
    current_player = 1

    room["graph"] = graph
    room["score_tracker"] = score_tracker
    room["deck_manager"] = deck_manager
    room["starting_player"] = current_player
    room["current_player"] = current_player
    room["game_history"] = []
    room["redo_stack"] = []

    deck_remaining = len(deck_manager.deck) if deck_manager.deck_type == "finite" else "∞"
    hand_sizes = {
        "1": len([c for c in deck_manager.get_hand(1) if c is not None]),
        "2": len([c for c in deck_manager.get_hand(2) if c is not None])
    }

    # Emit state to both players
    socketio.emit("state_updated", {
        "graph": graph.to_dict(),
        "scores": score_tracker.get_scores(),
        "claimed_cards": score_tracker.get_all_claimed_cards(),
        "connections": {
            "phase_pairs": [],
            "full_moon_pairs": [],
            "lunar_cycles": []
        },
        "current_player": current_player,
        "events": ["reset", "random_board"],
        "game_over": False,
        "new_game": True,
        "deck_remaining": deck_remaining,
        "hand_sizes": hand_sizes
    }, to=room_id)

    return jsonify(success=True)



@app.route("/start_game", methods=["POST"])
def start_game():
    data = request.get_json()
    boards = data.get("boards")
    room_id = data.get("room_id")

    deck_type = data.get("deckType", "infinite")
    copies_per_phase = data.get("copiesPerPhase")

    # If null or missing, force to None to avoid confusion
    if deck_type != "finite":
        copies_per_phase = None
    
    # Build the graph: choose from custom boards or use default
    if boards and isinstance(boards, list) and all("nodes" in b for b in boards):
        chosen_board = random.choice(boards)
        graph = Graph.from_dict(chosen_board)

        deck_settings = chosen_board.get("deckSettings") if chosen_board else None
        if deck_settings and deck_settings.get("deckType") == "finite":
            deck_type = "finite"
            copies_per_phase = deck_settings.get("copiesPerPhase")
        elif deck_settings and deck_settings.get("deckType") == "infinite":
            deck_type = "infinite"
            copies_per_phase = None
        else:
            # fall back to global
            deck_type = data.get("deckType", "infinite")
            copies_per_phase = data.get("copiesPerPhase")
            if deck_type != "finite":
                copies_per_phase = None
        
    else:
        graph = Graph()
        scale = 100
        offset_x = 200
        offset_y = 60
        for row in range(5):
            for col in range(5):
                node_id = row * 5 + col
                graph.add_node(f"square-{node_id}", position=(col * scale + offset_x, row * scale + offset_y))
        for row in range(5):
            for col in range(5):
                node_id = row * 5 + col
                node_name = f"square-{node_id}"
                if col < 4:
                    right_name = f"square-{row * 5 + (col + 1)}"
                    graph.connect_nodes(graph.nodes[node_name], graph.nodes[right_name])
                if row < 4:
                    down_name = f"square-{(row + 1) *5 + col}"
                    graph.connect_nodes(graph.nodes[node_name], graph.nodes[down_name])
    
     
    # Either reuse existing room or create a new one
    if room_id and room_id in games:
        games[room_id]["graph"] = graph
        games[room_id]["score_tracker"] = ScoreTracker()
        games[room_id]["deck_manager"] = DeckManager(
            deck_type=deck_type,
            copies_per_phase=copies_per_phase
        )
        games[room_id]["starting_player"] = 1
        games[room_id]["current_player"] = 1
        games[room_id]["game_history"] = []
        games[room_id]["redo_stack"] = []
    
        # keep both settings + last_settings aligned 
        games[room_id]["settings"] = {
            "board": chosen_board if boards else None,
            "boards": boards if boards else [],
            "deckType": deck_type,
            "copiesPerPhase": copies_per_phase
        }
        games[room_id]["last_settings"] = dict(games[room_id]["settings"])
    
    else:
        room_id = "moon-" + ''.join(random.choices(string.ascii_letters + string.digits, k=6))
        games[room_id] = {
            "graph": graph,
            "score_tracker": ScoreTracker(),
            "deck_manager": DeckManager(
                deck_type=deck_type,
                copies_per_phase=copies_per_phase
            ),
            "starting_player": 1,
            "current_player": 1,
            "game_history": [],
            "redo_stack": [],
            "settings": {
                "board": chosen_board if boards else None,
                "boards": boards if boards else [],
                "deckType": deck_type,
                "copiesPerPhase": copies_per_phase
            },
            "last_settings": {
                "board": chosen_board if boards else None,
                "boards": boards if boards else [],
                "deckType": deck_type,
                "copiesPerPhase": copies_per_phase
            }
        }


    # emit state_updated with a clear reset event
    socketio.emit("state_updated", {
        "graph": graph.to_dict(),
        "scores": games[room_id]["score_tracker"].get_scores(),
        "claimed_cards": games[room_id]["score_tracker"].get_all_claimed_cards(),
        "connections": {
            "phase_pairs": [],
            "full_moon_pairs": [],
            "lunar_cycles": []
        },
        "current_player": games[room_id]["current_player"],
        "events": ["reset"],
        "new_game": True,
        "game_over": False
    }, to=room_id)

    return jsonify({"success": True, "room_id": room_id})




@app.route("/game_settings_data")
def game_settings_data():
    room_id = request.args.get("room")
    if room_id and room_id in games:
        return jsonify({"last_settings": games[room_id].get("last_settings", {})})
    return jsonify({})


@app.route("/game_settings")
def game_settings():
    return render_template("game_settings.html")



@app.route("/state/<room_id>", methods=["GET"])
def get_state(room_id):
    game = get_or_create_game(room_id)
    graph = game["graph"]
    score_tracker = game["score_tracker"]
    deck_manager = game["deck_manager"]
    current_player = game["current_player"]

    deck_remaining = len(deck_manager.deck) if deck_manager.deck_type == "finite" else "∞"


    player_id = request.headers.get("X-Player-ID")
    debug = request.args.get("debug", "false").lower() == "true"

    if player_id not in {"player1", "player2"}:
        return jsonify({"error": "Invalid or missing player ID"}), 400

    player_num = int(player_id[-1])
    hand = deck_manager.get_hand(player_num)

    if debug:
        hand = [0,1,2,3,4,5,6,7]

    hand_sizes = {
        "1": len([c for c in deck_manager.get_hand(1) if c is not None]),
        "2": len([c for c in deck_manager.get_hand(2) if c is not None])
    }


    return jsonify({
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
        "hand_sizes": hand_sizes,
        "events": [],
        "deck_remaining": deck_remaining
    })



@app.route("/place/<room_id>", methods=["POST"])
def place_value(room_id):
    game = get_or_create_game(room_id)
    graph = game["graph"]
    score_tracker = game["score_tracker"]
    deck_manager = game["deck_manager"]
    current_player = game["current_player"]
    game_history = game["game_history"]
    redo_stack = game["redo_stack"]

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

    # Save snapshot for undo
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
            slot_index, _ = deck_manager.play(player, value)
    except ValueError:
        return jsonify({"success": False, "error": "Card not in hand"})


    deck_remaining = len(deck_manager.deck) if deck_manager.deck_type == "finite" else "∞"



    # Place the value and update scores
    node.add_value(value)
    phase_events = score_tracker.update_score_for_pair(player, phase_pair_module, node)
    full_moon_events = score_tracker.update_score_for_pair(player, full_moon_pair_module, node)
    cycle_events = score_tracker.update_score_for_cycle(player, lunar_cycle_module, node, graph)
    all_events = phase_events + full_moon_events + cycle_events

    # Switch player
    game["current_player"] = 3 - current_player

    # Check for game over: board full or both hands empty
    board_full = all(n.value is not None for n in graph.nodes.values())
    hands_empty = all(card is None for card in deck_manager.get_hand(1)) and \
                  all(card is None for card in deck_manager.get_hand(2))
    game_over = board_full or hands_empty
    final_scores = score_tracker.finalize_scores() if game_over else {}

    hand_sizes = {
        "1": len([c for c in deck_manager.get_hand(1) if c is not None]),
        "2": len([c for c in deck_manager.get_hand(2) if c is not None])
    }


    # Emit to this room only
    socketio.emit("state_updated", {
        "graph": graph.to_dict(),
        "scores": score_tracker.get_scores(),
        "claimed_cards": score_tracker.get_all_claimed_cards(),
        "connections": {
            "phase_pairs": score_tracker.phase_pairs,
            "full_moon_pairs": score_tracker.full_moon_pairs,
            "lunar_cycles": score_tracker.lunar_cycle_connections
        },
        "current_player": game["current_player"],
        "events": all_events,
        "game_over": game_over,
        "final_scores": final_scores,
        "deck_remaining": deck_remaining,
        "hand_sizes": hand_sizes,
        "last_move": {
            "player": player,
            "node": node_name,
            "value": value
            }
    }, to=room_id)

    return jsonify({
        "success": True,
        "events": all_events,
        "game_over": game_over,
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
            "current_player": game["current_player"],
            "hand": deck_manager.get_hand(player) if not debug else [0,1,2,3,4,5,6,7],
            "hand_sizes": hand_sizes,
            "deck_remaining": deck_remaining
        }
    })




@app.route("/reset/<room_id>", methods=["POST"])
def reset_game(room_id):
    game = get_or_create_game(room_id)
    graph = game["graph"]
    score_tracker = game["score_tracker"]
    deck_manager = game["deck_manager"]
    game_history = game["game_history"]
    redo_stack = game["redo_stack"]

    # Reset game state
    graph.clear_all_values()
    game["starting_player"] = 3 - game["starting_player"]
    game["current_player"] = game["starting_player"]
    score_tracker.reset()
    game_history.clear()
    redo_stack.clear()
    deck_manager.reset()

    # Figure out which player's hand to return
    player_id = request.headers.get("X-Player-ID")
    debug = request.args.get("debug", "false").lower() == "true"
    player_num = int(player_id[-1]) if player_id and player_id.startswith("player") else 1
    hand = deck_manager.get_hand(player_num)
    if debug:
        hand = [0,1,2,3,4,5,6,7]

    deck_remaining = len(deck_manager.deck) if deck_manager.deck_type == "finite" else "∞"

    hand_sizes = {
        "1": len([c for c in deck_manager.get_hand(1) if c is not None]),
        "2": len([c for c in deck_manager.get_hand(2) if c is not None])
    }



    # Public state for broadcast (no hand)
    public_state = {
        "graph": graph.to_dict(),
        "scores": score_tracker.get_scores(),
        "claimed_cards": score_tracker.get_all_claimed_cards(),
        "connections": {
            "phase_pairs": [],
            "full_moon_pairs": [],
            "lunar_cycles": []
        },
        "current_player": game["current_player"],
        "events": [],
        "game_over": False,
        "new_game": True,
        "deck_remaining": deck_remaining

    }

    # Emit to this room only
    public_state["hand_sizes"] = hand_sizes
    socketio.emit("state_updated", public_state, to=room_id)


    # Return personal state with hand
    return jsonify({
        "success": True,
        "state": {
            **public_state,
            "hand": hand
        }
    })


@app.route("/hand/<room_id>/<int:player_id>", methods=["GET"])
def get_hand(room_id, player_id):
    game = get_or_create_game(room_id)
    deck_manager = game["deck_manager"]
    hand = deck_manager.get_hand(player_id)
    print(f"[DEBUG] Returned hand for player {player_id} in room {room_id}: {hand}")
    return jsonify(hand)





@app.route("/scores/<room_id>", methods=["GET"])
def get_scores(room_id):
    game = get_or_create_game(room_id)
    score_tracker = game["score_tracker"]
    return jsonify(score_tracker.get_scores())



@app.route("/final_scores/<room_id>", methods=["GET"])
def final_scores(room_id):
    game = get_or_create_game(room_id)
    score_tracker = game["score_tracker"]
    try:
        result = score_tracker.finalize_scores()
        return jsonify(result)
    except Exception as e:
        print(f"Error in /final_scores for room {room_id}:", e)
        return jsonify({"error": str(e)}), 500




@app.route("/debug/<room_id>", methods=["GET"])
def debug_state(room_id):
    game = get_or_create_game(room_id)
    graph = game["graph"]
    score_tracker = game["score_tracker"]

    return jsonify({
        "scores": score_tracker.get_scores(),
        "claimed_cards": score_tracker.get_all_claimed_cards(),
        "graph": graph.to_dict()
    })






@app.route("/undo/<room_id>", methods=["POST"])
def undo(room_id):
    game = get_or_create_game(room_id)
    graph = game["graph"]
    score_tracker = game["score_tracker"]
    game_history = game["game_history"]
    redo_stack = game["redo_stack"]
    current_player = game["current_player"]

    if not game_history:
        return jsonify({"success": False, "error": "No moves to undo"})

    # Save current state to redo stack
    redo_stack.append({
        "graph": deepcopy(graph),
        "score_tracker": deepcopy(score_tracker),
        "player": current_player
    })

    # Restore last state
    prev_state = game_history.pop()
    game["graph"] = prev_state["graph"]
    game["score_tracker"] = prev_state["score_tracker"]
    game["current_player"] = prev_state["player"]

    # Compute deck remaining
    deck_manager = game["deck_manager"]
    deck_remaining = len(deck_manager.deck) if deck_manager.deck_type == "finite" else "∞"

    hand_sizes = {
        "1": len([c for c in deck_manager.get_hand(1) if c is not None]),
        "2": len([c for c in deck_manager.get_hand(2) if c is not None])
    }
    

    # Emit updated state
    socketio.emit("state_updated", {
        "graph": game["graph"].to_dict(),
        "scores": game["score_tracker"].get_scores(),
        "claimed_cards": game["score_tracker"].get_all_claimed_cards(),
        "connections": {
            "phase_pairs": game["score_tracker"].phase_pairs,
            "full_moon_pairs": game["score_tracker"].full_moon_pairs,
            "lunar_cycles": game["score_tracker"].lunar_cycle_connections
        },
        "current_player": game["current_player"],
        "events": [],
        "is_undo": True,
        "deck_remaining": deck_remaining,
        "hand_sizes": hand_sizes
    }, to=room_id)

    return jsonify({"success": True})




@app.route("/redo/<room_id>", methods=["POST"])
def redo(room_id):
    game = get_or_create_game(room_id)
    graph = game["graph"]
    score_tracker = game["score_tracker"]
    game_history = game["game_history"]
    redo_stack = game["redo_stack"]
    current_player = game["current_player"]

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
    game["graph"] = next_state["graph"]
    game["score_tracker"] = next_state["score_tracker"]
    game["current_player"] = next_state["player"]

    # Compute deck remaining
    deck_manager = game["deck_manager"]
    deck_remaining = len(deck_manager.deck) if deck_manager.deck_type == "finite" else "∞"

    hand_sizes = {
        "1": len([c for c in deck_manager.get_hand(1) if c is not None]),
        "2": len([c for c in deck_manager.get_hand(2) if c is not None])
    }
    

    # Emit updated state
    socketio.emit("state_updated", {
        "graph": game["graph"].to_dict(),
        "scores": game["score_tracker"].get_scores(),
        "claimed_cards": game["score_tracker"].get_all_claimed_cards(),
        "connections": {
            "phase_pairs": game["score_tracker"].phase_pairs,
            "full_moon_pairs": game["score_tracker"].full_moon_pairs,
            "lunar_cycles": game["score_tracker"].lunar_cycle_connections
        },
        "current_player": game["current_player"],
        "events": [],
        "is_undo": True,
        "deck_remaining": deck_remaining,
        "hand_sizes": hand_sizes
    }, to=room_id)

    return jsonify({"success": True})





@app.route("/debug/fill_board/<room_id>", methods=["POST"])
def debug_fill_board(room_id):
    from random import randint, shuffle

    game = get_or_create_game(room_id)
    graph = game["graph"]
    score_tracker = game["score_tracker"]
    current_player = game["current_player"]

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

    # Emit to this room only
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
    }, to=room_id)

    return jsonify({
        "success": True,
        "filled": fill_count,
        "scores": score_tracker.get_scores(),
        "claimed": score_tracker.get_all_claimed_cards()
    })






@socketio.on("join_room")
def handle_join(data):
    room_id = data["room_id"]
    join_room(room_id)
    get_or_create_game(room_id)
    print(f"[DEBUG] Client joined room {room_id}")

    game = games[room_id]
    deck_manager = game["deck_manager"]
    deck_remaining = len(deck_manager.deck) if deck_manager.deck_type == "finite" else "∞"

    hand_sizes = {
        "1": len([c for c in deck_manager.get_hand(1) if c is not None]),
        "2": len([c for c in deck_manager.get_hand(2) if c is not None])
    }

    emit("state_updated", {
        "graph": game["graph"].to_dict(),
        "scores": game["score_tracker"].get_scores(),
        "claimed_cards": game["score_tracker"].get_all_claimed_cards(),
        "connections": {
            "phase_pairs": game["score_tracker"].phase_pairs,
            "full_moon_pairs": game["score_tracker"].full_moon_pairs,
            "lunar_cycles": game["score_tracker"].lunar_cycle_connections
        },
        "current_player": game["current_player"],
        "events": [],
        "deck_remaining": deck_remaining,
        "hand_sizes": hand_sizes
    }, to=room_id)


@socketio.on("new_random_board")
def handle_new_random_board(data):
    room_id = data.get("room_id")
    player = data.get("player")

    if not room_id or room_id not in games:
        emit("error", {"message": "Invalid room ID"})
        return

    if player not in ("player1", "player2"):
        emit("error", {"message": "Missing or invalid player"})
        return

    room = games[room_id]
    previous = room["settings"].get("board")
    options = [b for b in room["settings"].get("boards", []) if b != previous]
    board = random.choice(options) if options else previous

    room["settings"]["board"] = board
    new_state = create_new_game_state(room_id, board)
    room["state"] = new_state

    # Broadcast updated state to all clients in the room
    emit("state_updated", {
        "graph": new_state["graph"].to_dict(),
        "scores": new_state["score_tracker"].get_scores(),
        "claimed_cards": new_state["score_tracker"].get_all_claimed_cards(),
        "connections": {
            "phase_pairs": [],
            "full_moon_pairs": [],
            "lunar_cycles": []
        },
        "current_player": new_state["current_player"],
        "events": ["reset", "random_board"],
        "game_over": False,
        "new_game": True,
        "deck_remaining": new_state["deck_remaining"],
        "hand_sizes": new_state["hand_sizes"]
    }, to=room_id)




@app.route("/graph_builder")
def graph_builder():
    return render_template("graph_builder.html")

@app.route("/robots.txt")
def robots_txt():
    return app.send_static_file("robots.txt")


@app.route("/google1fe9a4da69c1cfc8.html")
def google_site_verification():
    return "google-site-verification: google1fe9a4da69c1cfc8.html"




if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    socketio.run(app, host="0.0.0.0", port=port, debug=debug_mode)

