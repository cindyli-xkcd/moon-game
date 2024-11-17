# phase_pair.py

class PhasePair:

    def score_pair(self, player, node):
        """
        Score a phase pair (same phase) and return the points and claimed cards.

        Args:
        - player: The player making the move.
        - node: The node the player just placed a phase on.

        Returns:
        - points: The total points scored for this move.
        - claimed_cards: The list of claimed cards (nodes).
        """
        points = 0
        claimed_cards = []

        # Look at all adjacent nodes to the current node
        for neighbor in node.neighbors:
            if neighbor.value == node.value:  # Check if the phase matches
                points += 1  # Award 1 point for each matching phase
                claimed_cards.append(neighbor)  # Add the matching node to the claimed cards

        # If no matching adjacent nodes, return 0 points and empty claimed cards
        if points > 0:
            claimed_cards.append(node)  # The played node is also claimed
            return points, claimed_cards

        return 0, []  

