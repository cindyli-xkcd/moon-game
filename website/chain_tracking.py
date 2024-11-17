# chain_tracking.py

from abc import ABC, abstractmethod

class ChainTracker(ABC):

    @abstractmethod
    def track_cycle(self, player, node, adjacent_nodes):
        """Track if placing a node extends or creates a lunar cycle."""
        pass

    @abstractmethod
    def get_cycles(self):
        """Return the current list of lunar cycles."""
        pass

