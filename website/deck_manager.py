# deck_manager.py
import random

class DeckManager:
    def __init__(self):
        self.deck_size = 8  # Moon phases 0–7
        self.hand_size = 3
        self.reset()

    def reset(self):
        self.players = {
            1: {"hand": [self._draw_card() for _ in range(self.hand_size)]},
            2: {"hand": [self._draw_card() for _ in range(self.hand_size)]},
        }

    def _draw_card(self):
        return random.randint(0, self.deck_size - 1)

    def get_hand(self, player):
        return self.players[player]["hand"]

    def play(self, player, card):
        hand = self.players[player]["hand"]
        if card not in hand:
            raise ValueError(f"Player {player} does not have card {card} in hand: {hand}")

        index = hand.index(card)
        hand[index] = self._draw_card()  
        return index

