import type Anthropic from "@anthropic-ai/sdk";
import type { Strategy } from "@test-evals/shared";
import { buildZeroShotMessages, buildZeroShotSystem, ZERO_SHOT_SYSTEM } from "./zero-shot.js";
import { buildFewShotMessages, buildFewShotSystem, FEW_SHOT_SYSTEM_TEXT } from "./few-shot.js";
import { buildCotMessages, buildCotSystem, COT_SYSTEM } from "./cot.js";

export interface StrategyConfig {
  systemBlocks: Anthropic.TextBlockParam[];
  buildMessages: (transcript: string) => Anthropic.MessageParam[];
  systemText: string;
}

export function getStrategy(strategy: Strategy): StrategyConfig {
  switch (strategy) {
    case "zero_shot":
      return {
        systemBlocks: buildZeroShotSystem(),
        buildMessages: buildZeroShotMessages,
        systemText: ZERO_SHOT_SYSTEM,
      };
    case "few_shot":
      return {
        systemBlocks: buildFewShotSystem(),
        buildMessages: buildFewShotMessages,
        systemText: FEW_SHOT_SYSTEM_TEXT,
      };
    case "cot":
      return {
        systemBlocks: buildCotSystem(),
        buildMessages: buildCotMessages,
        systemText: COT_SYSTEM,
      };
  }
}

export { buildZeroShotMessages, buildZeroShotSystem };
export { buildFewShotMessages, buildFewShotSystem };
export { buildCotMessages, buildCotSystem };
