# graph_logic.py
class Node:
    def __init__(self, name, position):
        self.name = name
        self.value = None
        self.neighbors = []
        self.position = position  # Position on the grid (e.g., x, y)

    def add_neighbor(self, neighbor):
        self.neighbors.append(neighbor)

    def add_value(self, value):
        self.value = value

    def to_dict(self):
        return {
            'name': self.name,
            'value': self.value,
            'neighbors': [neighbor.name for neighbor in self.neighbors],
            'position': self.position,
        }

class Graph:
    def __init__(self):
        self.nodes = {}

    def add_node(self, name, position):
        new_node = Node(name, position)
        self.nodes[name] = new_node
        return new_node

    def connect_nodes(self, node_a, node_b):
        node_a.add_neighbor(node_b)
        node_b.add_neighbor(node_a)

    def to_dict(self):
        return {
            'nodes': {name: node.to_dict() for name, node in self.nodes.items()},
        }

    def clear_all_values(self):
        for node in self.nodes.values():
            node.value = None


    @staticmethod
    def from_dict(data):
        new_graph = Graph()
        for node_id, node_info in data['nodes'].items():
            new_graph.add_node(node_id, node_info['position'])
            new_graph.nodes[node_id].value = node_info['value']
        return new_graph


    @classmethod
    def from_dict(cls, data):
        g = cls()
        for name, node_data in data["nodes"].items():
            g.add_node(name, position=tuple(node_data.get("position", (0,0))))
        for name, node_data in data["nodes"].items():
            node = g.nodes[name]
            for neighbor_name in node_data.get("neighbors", []):
                if neighbor_name in g.nodes and g.nodes[neighbor_name] not in node.neighbors:
                    g.connect_nodes(node, g.nodes[neighbor_name])
        return g

