# scoring.py



class ScoreTracker:

    def __init__(self):
        self.scores = {1: 0, 2: 0}  # Initialize player scores
        self.claimed_cards = {}
        self.phase_pairs = []
        self.full_moon_pairs = []
        self.lunar_cycle_chains = []
        self.lunar_cycle_connections = []
        self.scoring_history = []


    def update_score_for_pair(self, player, pair_scoring_module, node):
        """
        Update score when a PhasePair or FullMoonPair is scored.
        Returns a list of individual scoring events.
        """
        scored_pairs, claimed_cards = pair_scoring_module.score_pair(player, node)
    
        # Record claimed card ownership
        for card in claimed_cards:
            self.claimed_cards[card.name] = player
    
        # Build and apply each scoring event
        scoring_events = []
        for item in scored_pairs:
            pair = item["pair"]
            print(f"[DEBUG] Scoring event has pair: {pair}")

            points = item["points"]
    
            self.scores[player] += points
    
            if pair_scoring_module.__class__.__name__ == "PhasePair":
                self.phase_pairs.append(pair)
                score_type = "phase_pair"
            elif pair_scoring_module.__class__.__name__ == "FullMoonPair":
                self.full_moon_pairs.append(pair)
                score_type = "full_moon_pair"
            else:
                score_type = "pair"
    
            event = {
                "player": player,
                "type": score_type,
                "structure": {"pair": pair, "points": points},
                "claimed": [c.name for c in item["claimed"]],
                "connections": [pair],
                "points": points
            }
    
            self.scoring_history.append(event)
            scoring_events.append(event)
    
        return scoring_events


    def update_score_for_cycle(self, player, cycle_scoring_module, node, graph):
        scored_chains = cycle_scoring_module.score_cycle(player, node, graph)

        scoring_events = []
        for item in scored_chains:
            points = item["points"]
            claimed_nodes = item["claimed"]

            self.scores[player] += points

            for node in claimed_nodes:
                self.claimed_cards[node.name] = player

            # Update long-term storage
            self.lunar_cycle_chains.append(item["chain"])
            for pair in item["connections"]:
                if pair not in self.lunar_cycle_connections:
                    self.lunar_cycle_connections.append(pair)

            event = {
                "player": player,
                "type": "lunar_cycle",
                "structure": {
                    "chain": item["chain"],
                    "points": points
                },
                "claimed": [n.name for n in claimed_nodes],
                "connections": item["connections"],
                "points": points
            }

            self.scoring_history.append(event)
            scoring_events.append(event)

        return scoring_events











    def get_scores(self):
        """Return the current scores of both players."""
        return self.scores

    def get_claimed_cards(self, player):
        return [square for square, owner in self.claimed_cards.items() if owner == player]

    def get_all_claimed_cards(self):
        return self.claimed_cards  # e.g., {"square-5": 1, "square-7": 2}


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
        self.phase_pairs = []
        self.full_moon_pairs = []
        self.lunar_cycle_chains = []
        self.lunar_cycle_connections = []
        self.scoring_history = []




