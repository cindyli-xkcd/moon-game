# lunar_cycle.py

from chain_tracking import find_chains_through_node

class LunarCycle:
    def score_cycle(self, player, node, graph):
        chains = find_chains_through_node(node, graph)
        points = sum(len(chain) for chain in chains)
        claimed = list({n for chain in chains for n in chain})
        if points > 0:
            return points, claimed
        else:
            return 0, []

