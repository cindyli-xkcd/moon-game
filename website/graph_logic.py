import copy

class Node:
    def __init__(self, name):
        self.name = name
        self.value = None
        self.neighbors = []
        self.increasing_chains = [[self.name]]
        self.decreasing_chains = [[self.name]]
        self.full_chains = None

    def add_neighbor(self, neighbor):
        self.neighbors.append(neighbor)

 
    def update_chains(self, v, graph):
        for neighbor in self.neighbors:
            if neighbor.value is None:
                continue  # Skip if neighbor has no value

            v_neighbor = neighbor.value

            # Check for cyclic adjacency
            if abs(v_neighbor - v) > 1 and not ((v_neighbor == 0 and v == 7) or (v_neighbor == 7 and v == 0)):
                continue  # Skip if neighbor's value is not cyclically adjacent

            if (v_neighbor == (v + 1) % 8):
                # Update increasing chains of this node
                for c in neighbor.increasing_chains:
                    # Deep copy to avoid modifying existing chains
                    new_chain = [self.name] + copy.deepcopy(c)  
                    self.increasing_chains.append(new_chain)
                    # Add the reverse to the corresponding node's decreasing chains
                    self.get_node(c[-1], graph).decreasing_chains.append(
                            list(reversed(new_chain)))

            elif (v_neighbor == (v - 1) % 8):
                # Update decreasing chains of this node
                for c in neighbor.decreasing_chains:
                    # Deep copy to avoid modifying existing chains
                    new_chain = [self.name] + copy.deepcopy(c)  
                    self.decreasing_chains.append(new_chain)
                    # Add the reverse to the corresponding node's increasing chains
                    self.get_node(c[-1], graph).increasing_chains.append(list(reversed(new_chain)))

    def squish_lists(self, list):
        # Initialize the result list
        result = []

        # Iterate over the original list
        for sublist in list:
            # Create a flag to check if we are replacing a sublist
            replaced = False

            # Check if the current sublist is a superset of any existing sublist in result
            for i in range(len(result)):
                if set(sublist).issuperset(result[i]):
                    result[i] = sublist  # Replace the sublist in the result
                    replaced = True
                    break  # No need to check further once we have replaced

            # If it wasn't a superset of any existing sublist, add it to the result
            if not replaced:
                result.append(sublist)

        return result



    def fullChains(self, increasing, decreasing):
        # Initialize a new list to hold the combined results
        result = []

        # Iterate through each sublist in the first list
        for sublist1 in increasing:
            # Iterate through each sublist in the second list
            for sublist2 in decreasing:
                # Remove the first element, then reverse the sublist
                new_combination = list(reversed(sublist1[1:])) + sublist2
                result.append(new_combination)

        return result


    def add_value(self, v, graph):
        """Add a value to this node and update chains."""
        if self.value is not None:
            raise ValueError("Node already has a value.")

        self.value = v
        self.update_chains(v, graph)
        increasing = self.squish_lists(self.increasing_chains)
        decreasing = self.squish_lists(self.decreasing_chains)
        self.full_chains = self.fullChains(increasing, decreasing)

        



    def get_node(self, name, graph):
        return graph.nodes[name]

class Graph:
    def __init__(self):
        self.nodes = {}

    def add_node(self, name):
        new_node = Node(name)
        self.nodes[name] = new_node
        return new_node

    def connect_nodes(self, node_a, node_b):
        node_a.add_neighbor(node_b)
        node_b.add_neighbor(node_a)  # Assuming it's an undirected graph

    def pretty_print(self):
        """Print each node's name, value, and neighbors in a readable format."""
        for name, node in self.nodes.items():
            neighbor_names = [neighbor.name for neighbor in node.neighbors]
            print(f"Node {name} (value: {node.value}) -> Neighbors: {neighbor_names}")

    def to_dict(self):
        return {
            "nodes": {
                name: {
                    "value": node.value,
                    "neighbors": node.neighbors,
                    "position": node.position
                }
                for name, node in self.nodes.items()
            },
            "edges": self.edges  # Assuming edges are stored as list of dicts with 'from' and 'to'
        }
