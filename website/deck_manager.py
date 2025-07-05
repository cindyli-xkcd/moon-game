# deck_manager.py
import random

class DeckManager:
    def __init__(self, deck_type="infinite", copies_per_phase=None):
        self.deck_size = 8  # Moon phases 0–7
        self.hand_size = 3
        self.deck_type = deck_type
        self.copies_per_phase = copies_per_phase
        self.deck = []
        self.reset()

    def reset(self):
        if self.deck_type == "finite" and self.copies_per_phase:
            self.deck = []
            for phase in range(self.deck_size):
                self.deck.extend([phase] * self.copies_per_phase)
            random.shuffle(self.deck)
        else:
            self.deck = None  # infinite

        self.players = {
            1: {"hand": [self._draw_card() for _ in range(self.hand_size)]},
            2: {"hand": [self._draw_card() for _ in range(self.hand_size)]},
        }

    def _draw_card(self):
        if self.deck_type == "finite" and self.deck is not None:
            if not self.deck:
                return None  # Deck exhausted
            return self.deck.pop()
        else:
            return random.randint(0, self.deck_size - 1)

    def get_hand(self, player):
        return self.players[player]["hand"]

    def play(self, player, card):
        hand = self.players[player]["hand"]
        if card not in hand:
            raise ValueError(f"Player {player} does not have card {card} in hand: {hand}")

        index = hand.index(card)
        new_card = self._draw_card()
        hand[index] = new_card
        return index, new_card  # return what was drawn for more detailed client updates

