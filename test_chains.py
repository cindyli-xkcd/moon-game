import copy
import random
from chains_complete import Graph  # Make sure to import your Graph and Node classes


def create_and_run_test_case(node_names, connections, values):
    graph = Graph()
    
    # Create nodes
    nodes = {name: graph.add_node(name) for name in node_names}

    # Connect nodes
    for node1, node2 in connections:
        graph.connect_nodes(nodes[node1], nodes[node2])

    # Assign values to nodes
    for name, value in values.items():
        nodes[name].add_value(value, graph)

    # Print results
    print("\nTest Case Results:")
    for name in node_names:
        node = nodes[name]
        print(f"Node {name} increasing chains:", node.increasing_chains)
        print(f"Node {name} decreasing chains:", node.decreasing_chains)


def generate_random_grid_graph(size=3):
    graph = Graph()
    nodes = {}
    connections = []
    values = {}
    order_of_assignments = []  # To track the order of value assignments

    # Create node names
    node_names = [f"({i}, {j})" for i in range(size) for j in range(size)]
    
    # Shuffle the node names to create them in random order
    random.shuffle(node_names)

    # Create nodes in random order and assign random values
    for name in node_names:
        nodes[name] = graph.add_node(name)
        value = random.randint(0, 7)  # Random value between 0 and 7
        values[name] = value
        order_of_assignments.append((name, value))  # Track the assignment
     
    # Create horizontal and vertical connections
    for i in range(size):
        for j in range(size):
            if j < size - 1:  # Connect to the right
                connections.append((f"({i}, {j})", f"({i}, {j + 1})"))
            if i < size - 1:  # Connect below
                connections.append((f"({i}, {j})", f"({i + 1}, {j})"))

    return graph, nodes, connections, values, order_of_assignments


def pretty_print_grid(nodes, size):
    print("\nGraph Visualization:")
    for i in range(size):
        # Print each row
        row = []
        for j in range(size):
            name = f"({i}, {j})"
            value = nodes[name].value if nodes[name].value is not None else " "
            row.append(f"{value:2}")  # Format the value with padding
        print(" | ".join(row))  # Join the row values with vertical bars

        # Print the horizontal connections
        if i < size - 1:
            print(" --- " + " --- ".join([""] * (size - 1)))  # Add horizontal connection lines


def run_random_grid_test_case():
    graph, nodes, connections, values, order_of_assignments = generate_random_grid_graph(size=3)
    size = 3
    
    # Connect nodes
    for node1, node2 in connections:
        graph.connect_nodes(nodes[node1], nodes[node2])

    # Assign values to nodes
    for name, value in order_of_assignments:
        nodes[name].add_value(value, graph)

    # Print results
    pretty_print_grid(nodes, size)

    print("\nRandom 3x3 Grid Graph Results:")
    for name in nodes:
        node = nodes[name]
        print(f"Node {name} increasing chains:", node.increasing_chains)
        print(f"Node {name} decreasing chains:", node.decreasing_chains)
    
    print("\nOrder of Values Assigned:")
    for name, value in order_of_assignments:
        print(f"Node {name}: {value}")


def run_test_cases():
    # Example test cases with simplified input

    # Test Case 1: Basic Case
    create_and_run_test_case(
        node_names=["A", "B", "C"],
        connections=[("A", "B"), ("B", "C")],
        values={"A": 1, "B": 2, "C": 3}
    )

    # Test Case 2: Cyclic Adjacency Case
    create_and_run_test_case(
        node_names=["A", "B", "C"],
        connections=[("A", "B"), ("B", "C"), ("C", "A")],
        values={"A": 7, "B": 0, "C": 1}
    )

    # Test Case 3: Random 3x3 Grid
    run_random_grid_test_case()

    # Add other test cases as needed...


if __name__ == "__main__":
    run_test_cases()

