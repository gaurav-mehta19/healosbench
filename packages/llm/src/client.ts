import Anthropic from "@anthropic-ai/sdk";

export function createClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}
