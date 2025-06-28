// event_player.js

import { Animator } from "./animator.js";
import { logWithTime, sleep } from "./utils.js";
import { Renderer } from "./renderer.js"
import { GameState } from "./game_state.js";


export const EventPlayer = {
  /**
   * Plays a list of animation events in sequence
   * @param {Array} events - List of events from backend
   */
  async play(events) {
    if (!events || events.length === 0) {
      logWithTime("[EventPlayer] No events to play");
      return;
    }

    logWithTime(`[EventPlayer] Playing ${events.length} event(s)`);

    for (const event of events) {
      await this.playEvent(event);
    }
  },

  /**
   * Plays a single animation event based on its type
   * @param {Object} event - One event from the backend
   */
  async playEvent(event) {
    logWithTime("[EventPlayer] Playing event:", event);

    switch (event.type) {
      case "phase_pair": {
        const pair = event.structure?.pair;
        if (!Array.isArray(pair)) {
          logWithTime("[EventPlayer] Invalid phase_pair event:", event);
          return;
        }

	// Pulse Nodes
        if (window.animationsEnabled) {
          await Animator.animatePairConnection(pair);
        } 

	// Draw Dots
        await Renderer.drawTwoDots(pair);

	// Stars and update score
        if (window.animationsEnabled) {
          await Animator.animateStarsFromPair(pair, event.player, event.points);
        } else {
          Renderer.updateScores(GameState.current.scores);
        }
        break;
      }



      case "full_moon_pair": {
        const pair = event.structure?.pair;
        if (!Array.isArray(pair)) {
          logWithTime("[EventPlayer] Invalid full_moon_pair event:", event);
          return;
        }

	// Pulse Nodes
        if (window.animationsEnabled) {
          await Animator.animateFullMoonConnection(pair);
        }

	// Draw Dot
        await Renderer.drawOneDot(pair);

	// Stars and update score
        if (window.animationsEnabled) {
          await Animator.animateStarsFromPair(pair, event.player, event.points);
        } else {
          Renderer.updateScores(GameState.current.scores);
        }
        break;
      }

      case "lunar_cycle":
        if (window.animationsEnabled) {
          await Animator.animateLunarCycle(event.structure.chain, event.connections);
        }
        for (const [a, b] of event.connections) {
          Renderer.drawPersistentBoldEdge(a, b);
        }

        if (window.animationsEnabled) {
          await Animator.animateStarsFromNodes(event.structure.chain, event.player, event.points);
        } else {
          Renderer.updateScores(GameState.current.scores);
        }
        break;

      default:
        console.warn("[EventPlayer] Unknown event type:", event);
        await sleep(200);
        break;
    }
  }
};

