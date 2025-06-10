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
        while len(state["hand"]) < n:
            if self.mode == "without_replacement":
                if not state["deck"]:
                    state["deck"] = state["discard"]
                    state["discard"] = []
                    random.shuffle(state["deck"])
                if not state["deck"]:
                    break
                card = state["deck"].pop()
            else:
                card = random.choice(self.phases)
            state["hand"].append(card)
        return state["hand"]

    def play(self, player, card):
        key = self._get_key(player)
        state = self.deck_states[key]
        if card not in state["hand"]:
            raise ValueError("Card not in hand.")
        state["hand"].remove(card)
        state["discard"].append(card)

    def get_hand(self, player):
        return self.deck_states[self._get_key(player)]["hand"]

    def reset(self):
        self.deck_states.clear()

