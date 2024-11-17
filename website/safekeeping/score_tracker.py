from collections import Counter

class ScoreTracker:
    def __init__(self, graph):
        self.player_scores = {1: 0, 2: 0}
        self.highlight_pairs = []
        self.highlight_chains = []
        self.claimed_cards = {1: [], 2: []}


