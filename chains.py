import copy

class Node:
    def __init__(self, name):
        self.name = name
        self.value = None
        self.neighbors = []
        self.increasing_chains = []
        self.decreasing_chains = []

    def add_neighbor(self, neighbor):
        self.neighbors.append(neighbor)

    def add_value(self, v, graph):
        """Add a value to this node and update chains."""
        if self.value is not None:
            raise ValueError("Node already has a value.")

        self.value = v
        # Initialize chains with the node's name
        self.increasing_chains = [[self.name]]
        self.decreasing_chains = [[self.name]]

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
                    new_chain = [self.name] + copy.deepcopy(c)  # Deep copy to avoid modifying existing chains
                    self.increasing_chains.append(new_chain)
                    # Add the reverse to the corresponding node's decreasing chains
                    self.get_node(c[-1], graph).decreasing_chains.append(list(reversed(new_chain)))

            elif (v_neighbor == (v - 1) % 8):
                # Update decreasing chains of this node
                for c in neighbor.decreasing_chains:
                    new_chain = [self.name] + copy.deepcopy(c)  # Deep copy to avoid modifying existing chains
                    self.decreasing_chains.append(new_chain)
                    # Add the reverse to the corresponding node's increasing chains
                    self.get_node(c[-1], graph).increasing_chains.append(list(reversed(new_chain)))

    def get_node(self, name, graph):
        """Retrieve a node by its name from the graph."""
        for node in graph.nodes:
            if node.name == name:
                return node
        return None

class Graph:
    def __init__(self):
        self.nodes = []

    def add_node(self, name):
        new_node = Node(name)
        self.nodes.append(new_node)
        return new_node

    def connect_nodes(self, node_a, node_b):
        node_a.add_neighbor(node_b)
        node_b.add_neighbor(node_a)  # Assuming it's an undirected graph

    def get_node(self, name):
        """Retrieve a node by its name from the graph."""
        for node in self.nodes:
            if node.name == name:
                return node
        return None
