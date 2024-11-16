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
    print("\nGraph:")
    graph.pretty_print()

    print("\nOrder of node assignment:")
    for name, value in values.items():
        print(name)

    print("\nTest Case Results:")
    for name in node_names:
        node = nodes[name]
        # print(f"Node {name} increasing chains:", node.increasing_chains)
        # print(f"Node {name} decreasing chains:", node.decreasing_chains)
        print(f"Node {name} full chains:", node.full_chains)



def run_test_cases():
    # Example test cases with simplified input

    # Test Case 1: Basic Case
    create_and_run_test_case(
        node_names=["A", "B", "C"],
        connections=[("A", "B"), ("B", "C")],
        values={"A": 1, "C": 3, "B": 2}
    )

    # Test Case 2: 3x3
    create_and_run_test_case(
        node_names=["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        connections=[("A", "B"), ("B", "C"), ("A", "D"), ("B", "E"), ("C", "F"), ("D", "E"), ("E", "F"), ("D", "G"), ("E", "H"), ("F", "I"), ("G", "H"), ("H", "I")],
        values={"F": 1, "C": 2, "I": 2, "B": 3, "E": 0, "D": 7, "G": 0, "H": 1}
    )

if __name__ == "__main__":
    run_test_cases()

