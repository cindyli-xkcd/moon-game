# full_moon_pair.py

class FullMoonPair:

    def score_pair(self, player, node):
        """
        Score full moon pairs (two phases that add to a full moon) and return:
        - A list of dicts: each with 'pair', 'points', and 'claimed' nodes
        - A list of unique claimed nodes (as Node objects)
        """
        scored_pairs = []
        claimed_set = {}

        for neighbor in node.neighbors:
            if node.value is not None and neighbor.value is not None:
                if abs(neighbor.value - node.value) == 4:
                    pair = tuple(sorted([node.name, neighbor.name]))
                    scored_pairs.append({
                        "pair": pair,
                        "points": 2, 
                        "claimed": [node, neighbor]
                    })
                    claimed_set[neighbor.name] = neighbor
                    print(f"[DEBUG] Full moon pair found: {pair}")


        if scored_pairs:
            claimed_set[node.name] = node  

        return scored_pairs, list(claimed_set.values())

