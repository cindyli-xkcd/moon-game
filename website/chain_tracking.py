# chain_tracking.py

def deduplicate_chain(chain):
    seen = set()
    deduped = []
    for node in chain:
        if node.name not in seen:
            deduped.append(node)
            seen.add(node.name)
    return deduped


def find_chains_from_node(node, graph):
    """
    Return all maximal increasing and decreasing chains starting from a node.
    """
    visited = set([node.name])
    inc_chains = dfs_all_max_chains(node, visited, [], +1)
    dec_chains = dfs_all_max_chains(node, visited, [], -1)

    return {
        "increasing": [c for c in inc_chains if len(c) > 1],
        "decreasing": [c for c in dec_chains if len(c) > 1],
    }


def dfs_all_max_chains(current, visited, path, direction):
    path = path + [current]
    results = []

    next_phase = (current.value + direction) % 8
    extended = False

    for neighbor in current.neighbors:
        if neighbor.name not in visited and neighbor.value == next_phase:
            extended = True
            new_visited = visited.copy()
            new_visited.add(neighbor.name)
            results += dfs_all_max_chains(neighbor, new_visited, path, direction)

    if not extended:
        results.append(path)

    return results


def stitch_chains(center_node, decreasing, increasing):
    stitched = []

    for dec in decreasing:
        dec_reversed = list(reversed(dec))  # [A, B, X]

        for inc in increasing:
            # Exclude center node from inc side to avoid duplicate
            inc_tail = inc[1:] if len(inc) > 1 and inc[0] == center_node else inc
            stitched.append(dec_reversed + inc_tail)

    return stitched



def collect_stitched_and_leftover(center_node, decreasing, increasing):
    stitched = []
    used_decreasing = set()
    used_increasing = set()

    for i, dec in enumerate(decreasing):
        dec_rev = list(reversed(dec))

        for j, inc in enumerate(increasing):
            inc_tail = inc[1:] if len(inc) > 1 and inc[0] == center_node else inc
            stitched.append(dec_rev + inc_tail)
            used_decreasing.add(i)
            used_increasing.add(j)

    # Leftovers = valid (len ≥ 3) chains that weren't stitched
    leftover = []
    for i, dec in enumerate(decreasing):
        if i not in used_decreasing and len(dec) >= 3:
            leftover.append(dec)

    for j, inc in enumerate(increasing):
        if j not in used_increasing and len(inc) >= 3:
            leftover.append(inc)

    deduped_stitched = [deduplicate_chain(chain) for chain in stitched]
    return {
        "stitched": deduped_stitched,
        "leftover": leftover
    }


def find_chains_through_node(node, graph):
    """
    Return all stitched and leftover chains that go through `node`,
    as a single flat list of chains (each is a list of Node objects).
    """
    all_chains = find_chains_from_node(node, graph)
    result = collect_stitched_and_leftover(
        center_node=node,
        decreasing=all_chains["decreasing"],
        increasing=all_chains["increasing"]
    )
    return result["stitched"] + result["leftover"]


def extract_connections_from_chains(chains):
    """
    Given a list of chains (each a list of Node objects),
    return sorted (a, b) tuples for all adjacent neighbors in each chain.
    """
    connections = set()
    for chain in chains:
        for i in range(len(chain) - 1):
            a, b = chain[i], chain[i + 1]
            if b in a.neighbors:
                pair = tuple(sorted([a.name, b.name]))
                connections.add(pair)
    return list(connections)

