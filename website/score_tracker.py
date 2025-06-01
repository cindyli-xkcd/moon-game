# scoring.py


class ScoreTracker:

    def __init__(self):
        self.scores = {1: 0, 2: 0}  # Initialize player scores
        self.claimed_cards = {}

    def update_score_for_pair(self, player, pair_scoring_module, node):
        """Update score when a pair is formed (Phase Pair or Full Moon Pair)."""
        points, claimed_cards = pair_scoring_module.score_pair(player, node)  
        self.scores[player] += points 
        for square in claimed_cards:
            self.claimed_cards[square.name] = player
        return points, claimed_cards  # Return the points and the claimed cards

    def get_scores(self):
        """Return the current scores of both players."""
        return self.scores

    def get_claimed_cards(self, player):
        return [square for square, owner in self.claimed_cards.items() if owner == player]


    def finalize_scores(self):
        """Return base scores, bonus scores from claimed cards, and final totals without mutating internal state."""
        base_scores = self.get_scores()
    
        bonus_scores = {
            player: len(self.get_claimed_cards(player))
            for player in base_scores
        }
    
        final_scores = {
            player: base_scores[player] + bonus_scores[player]
            for player in base_scores
        }
    
        return {
            "base_scores": base_scores,
            "bonus_scores": bonus_scores,
            "final_scores": final_scores
        }


    def reset(self):
        self.scores = {1: 0, 2: 0}
        self.claimed_cards = {}

