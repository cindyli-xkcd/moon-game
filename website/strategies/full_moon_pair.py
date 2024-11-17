# full_moon_pair.py

class FullMoonPair:

    def score_pair(self, player, node):
        """
        Score a full moon pair (two nodes whose phases add up to 7) 
        and return the points and claimed cards.

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
            # Ensure both node and neighbor have valid values
            if node.value is not None and neighbor.value is not None:
                if (neighbor.value + node.value) == 7:  # Check if the sum of phases equals 7
                    points += 1  # Award 1 point for each matching pair
                    claimed_cards.append(neighbor)  # Add the matching node to the claimed cards

        # If there are valid full moon pairs, the played node is also claimed
        if points > 0:
            claimed_cards.append(node)  # Add the played node to the claimed cards
            return points, claimed_cards

        return 0, []  # No full moon pair, no points, no claimed cards

