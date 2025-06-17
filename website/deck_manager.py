# deck_manager.py
import random
from collections import defaultdict

class DeckManager:
    def __init__(self, phases, mode="without_replacement", deck_type="per_player"):
        self.phases = phases
        self.mode = mode
        self.deck_type = deck_type
        self.deck_states = defaultdict(self._new_player_state)

    def _new_player_state(self):
        deck = self.phases.copy()
        random.shuffle(deck)
        return {
            "deck": deck,
            "hand": [],
            "discard": [],
        }

    def _get_key(self, player):
        return player if self.deck_type == "per_player" else "shared"

    def draw(self, player, n=3):
        key = self._get_key(player)
        state = self.deck_states[key]

        print(f"Before draw - Player {player} hand:", state["hand"])  # 🪵 LOG HERE

    
        # Count how many cards are missing
        missing = n - sum(1 for c in state["hand"] if c is not None)
    
        for i in range(len(state["hand"])):
            if state["hand"][i] is None and missing > 0:
                state["hand"][i] = self._draw_card(state)
                missing -= 1
    
        while missing > 0:
            state["hand"].append(self._draw_card(state))
            missing -= 1
    
        return state["hand"]
 
    def _draw_card(self, state):
        if self.mode == "without_replacement":
            if not state["deck"]:
                state["deck"] = state["discard"]
                state["discard"] = []
                random.shuffle(state["deck"])
            if not state["deck"]:
                return None
            return state["deck"].pop()
        else:
            return random.choice(self.phases)



    def play(self, player, card):
        key = self._get_key(player)
        state = self.deck_states[key]
        if card not in state["hand"]:
            raise ValueError("Card not in hand.")
        index = state["hand"].index(card)
        state["hand"][index] = None
        state["discard"].append(card)
        return index

    def get_hand(self, player):
        key = self._get_key(player)
        hand = self.deck_states[key]["hand"]
        print(f"[DEBUG] get_hand for player {player}: {hand}")
        return [c for c in hand if c is not None]  # Should return full hand

    def reset(self):
        self.deck_states.clear()

