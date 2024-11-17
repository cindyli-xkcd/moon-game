# chain_logic.py
# mostly filler for now, will need to edit 



import copy

class ChainLogic:
    def __init__(self, graph):
        self.graph = graph

    def update_chains(self, node, value):
        """Update the increasing and decreasing chains of a node."""
        for neighbor in node.neighbors:
            if neighbor.value is None:
                continue  # Skip if neighbor has no value

            v_neighbor = neighbor.value
            if abs(v_neighbor - value) > 1 and not ((v_neighbor == 0 and value == 7) or (v_neighbor == 7 and value == 0)):
                continue  # Skip if neighbor's value is not cyclically adjacent

            if v_neighbor == (value + 1) % 8:
                # Update increasing chains of this node
                for chain in neighbor.increasing_chains:
                    new_chain = [node.name] + copy.deepcopy(chain)
                    node.increasing_chains.append(new_chain)
            elif v_neighbor == (value - 1) % 8:
                # Update decreasing chains of this node
                for chain in neighbor.decreasing_chains:
                    new_chain = [node.name] + copy.deepcopy(chain)
                    node.decreasing_chains.append(new_chain)

    def calculate_points(self, node):
        """Calculate points based on chains."""
        points = 0
        # Example logic: Points could be based on the number of complete chains
        for chain in node.increasing_chains:
            points += len(chain)
        for chain in node.decreasing_chains:
            points += len(chain)
        return points

