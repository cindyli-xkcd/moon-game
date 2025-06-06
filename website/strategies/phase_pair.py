# phase_pair.py

class PhasePair:

    def score_pair(self, player, node):
        """
        Score a phase pair and return a list of dicts with:
        - 'pair': the (a, b) tuple of node names
        - 'points': points earned
        - 'claimed': list of Node objects
        Also return a list of unique claimed nodes
        """
        scored_pairs = []
        claimed_set = {}

        for neighbor in node.neighbors:
            if neighbor.value == node.value:
                pair = tuple(sorted([node.name, neighbor.name]))

                scored_pairs.append({
                    "pair": pair,
                    "points": 1,
                    "claimed": [node, neighbor]  
                })

                claimed_set[neighbor.name] = neighbor

        if scored_pairs:
            claimed_set[node.name] = node  

        return scored_pairs, list(claimed_set.values())

