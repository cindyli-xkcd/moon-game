import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))



import pytest
from score_tracker import ScoreTracker
from graph_logic import Node
from strategies.phase_pair import PhasePair


def test_single_phase_pair_scoring():
    tracker = ScoreTracker()
    scorer = PhasePair()

    # Create two connected nodes with matching values
    node1 = Node("A", (0, 0))
    node2 = Node("B", (0, 1))
    node1.add_neighbor(node2)
    node2.add_neighbor(node1)

    node1.add_value(4)
    node2.add_value(4)

    # Player 1 places the second 4
    points, claimed = tracker.update_score_for_pair(1, scorer, node2)

    assert points == 1
    assert tracker.get_scores()[1] == 1
    assert set(tracker.get_claimed_cards(1)) == {"A", "B"}


def test_reclaim_phase_pair_by_other_player():
    tracker = ScoreTracker()
    scorer = PhasePair()

    # Setup initial claim by Player 1
    nodeA = Node("A", (0, 0))
    nodeB = Node("B", (0, 1))
    nodeA.add_neighbor(nodeB)
    nodeB.add_neighbor(nodeA)

    nodeA.add_value(4)
    nodeB.add_value(4)
    tracker.update_score_for_pair(1, scorer, nodeB)

    # Player 2 places a new 4 in a new neighbor of B
    nodeC = Node("C", (0, 2))
    nodeB.add_neighbor(nodeC)
    nodeC.add_neighbor(nodeB)
    nodeC.add_value(4)
    points, claimed = tracker.update_score_for_pair(2, scorer, nodeC)

    assert points == 1
    assert tracker.get_scores()[2] == 1
    # A should still be claimed by Player 1, B and C now claimed by Player 2
    assert set(tracker.get_claimed_cards(2)) == {"B", "C"}
    assert set(tracker.get_claimed_cards(1)) == {"A"}


def test_scoring_multiple_phase_pairs():
    tracker = ScoreTracker()
    scorer = PhasePair()

    # Setup: A—B—C where all have value 4
    nodeA = Node("A", (0, 0))
    nodeB = Node("B", (0, 1))
    nodeC = Node("C", (0, 2))

    nodeA.add_neighbor(nodeB)
    nodeB.add_neighbor(nodeA)
    nodeB.add_neighbor(nodeC)
    nodeC.add_neighbor(nodeB)

    nodeA.add_value(4)
    nodeC.add_value(4)

    # Player 1 places in the middle
    nodeB.add_value(4)
    points, claimed = tracker.update_score_for_pair(1, scorer, nodeB)

    assert points == 2
    assert tracker.get_scores()[1] == 2
    assert set(tracker.get_claimed_cards(1)) == {"A", "B", "C"}

