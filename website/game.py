# game.py
from graph_logic import Graph
from chain_logic import ChainLogic

class Game:
    def __init__(self):
        self.graph = Graph()
        self.chain_logic = ChainLogic(self.graph)
        self.current_player = 1

    def place_value(self, node_name, value):
        node = self.graph.nodes[node_name]
        if node.value is not None:
            raise ValueError(f"Node {node_name} already has a value.")
        node.value = value
        self.chain_logic.update_chains(node, value)

    def switch_player(self):
        self.current_player = 2 if self.current_player == 1 else 1

    def calculate_player_score(self, player):
        # Calculate score for the current player (e.g., based on node chains)
        score = 0
        for node in self.graph.nodes.values():
            if node.value == player:
                score += self.chain_logic.calculate_points(node)
        return score

    def reset_game(self):
        self.graph = Graph()  # Reset the graph (clear all nodes and connections)
        self.chain_logic = ChainLogic(self.graph)  # Re-initialize chain logic
        self.current_player = 1

