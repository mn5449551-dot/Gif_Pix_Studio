import { ACTION_PROMPTS, BASE_TEMPLATE } from "@/lib/constants";
import type { PromptComposeInput, PromptComposeOutput } from "@/lib/types";

const RUN_DIRECTION_LOCK =
  "Run direction lock rule: keep one fixed facing direction across all 16 frames; do not turn around, do not face the opposite side, and do not horizontally flip/mirror in any frame.";

function sanitizeCustomPrompt(input: string): string {
  const trimmed = input.trim().replace(/<[^>]*>/g, "");
  return trimmed.slice(0, 300);
}

export function composePrompt(input: PromptComposeInput): PromptComposeOutput {
  const actionPromptTemplate = ACTION_PROMPTS[input.actionType] ?? ACTION_PROMPTS.idle;
  const customPrompt = sanitizeCustomPrompt(input.userCustomPrompt ?? "");

  const actionPrompt =
    input.actionType === "custom"
      ? actionPromptTemplate.replace(
          "{user_custom_prompt}",
          customPrompt || "a clean idle loop",
        )
      : actionPromptTemplate;

  let finalPrompt = BASE_TEMPLATE.replace("[INJECT_ACTION_PROMPT]", actionPrompt);

  if (customPrompt && input.actionType !== "custom") {
    finalPrompt += `\n\n=== USER CUSTOM CONSTRAINTS ===\n${customPrompt}`;
  }
  if (input.actionType === "run") {
    finalPrompt += `\n\n=== DIRECTION LOCK (NON-NEGOTIABLE) ===\n${RUN_DIRECTION_LOCK}`;
  }

  return {
    baseTemplate: BASE_TEMPLATE,
    actionPrompt,
    customPrompt,
    finalPrompt,
  };
}
