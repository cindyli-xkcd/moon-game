# lunar_cycle.py

from chain_tracking import find_chains_through_node, extract_connections_from_chains

class LunarCycle:
    def score_cycle(self, player, node, graph):
        chains = find_chains_through_node(node, graph)

        scored_chains = []
        for chain in chains:
            if len(chain) < 3:
                continue  # Skip too-short chains if needed

            chain_names = [n.name for n in chain]
            claimed = list(set(chain))
            connections = extract_connections_from_chains([chain])

            scored_chains.append({
                "chain": chain_names,
                "points": len(chain),  # or any scoring formula
                "claimed": claimed,
                "connections": connections
            })

        return scored_chains

