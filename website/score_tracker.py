# scoring.py


class ScoreTracker:

    def __init__(self):
        self.scores = {1: 0, 2: 0}  # Initialize player scores
        self.claimed_cards = {1: [], 2: []}  # Initialize claimed cards for each player

    def update_score_for_pair(self, player, pair_scoring_module, node):
        """Update score when a pair is formed (Phase Pair or Full Moon Pair)."""
        points, claimed_cards = pair_scoring_module.score_pair(player, node)  # Get points and claimed cards from the pair-scoring module
        self.scores[player] += points  # Update player score
        self.claimed_cards[player].extend(claimed_cards)  # Update claimed cards
        return points, claimed_cards  # Return the points and the claimed cards

    def get_scores(self):
        """Return the current scores of both players."""
        return self.scores

    def get_claimed_cards(self, player):
        """Return the cards claimed by the player."""
        return self.claimed_cards[player]

