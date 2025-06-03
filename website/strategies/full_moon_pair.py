# full_moon_pair.py

class FullMoonPair:

    def score_pair(self, player, node):
        """
        Score a full moon pair (two phases add up to a full moon)
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
                if abs(neighbor.value - node.value) == 4:  
                    points += 2  
                    claimed_cards.append(neighbor)  

        # If there are valid full moon pairs, the played node is also claimed
        if points > 0:
            claimed_cards.append(node)  
            return points, claimed_cards

        return 0, []  

