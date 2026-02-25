import type { ActionType } from "@/lib/types";

const ACTION_FALLBACK_MAP: Record<ActionType, string> = {
  walk:
    "Summary: Side-view walk loop. Sequence: contact step; weight transfer; passing leg; rise; opposite contact; settle to start. Body: opposite arm swing, stable torso height, clear heel-to-toe rhythm.",
  run:
    "Summary: Fast run cycle. Sequence: forefoot contact; quick recoil; airborne drive; opposite contact; rebound; return to start. Body: forward lean, stronger knee lift, active arm pump, no facing flip.",
  idle:
    "Summary: Calm idle stance. Sequence: inhale lift; micro sway right; exhale settle; blink beat; micro sway left; loop. Body: minimal amplitude, soft shoulder motion, stable feet anchor.",
  jump:
    "Summary: Vertical jump loop. Sequence: crouch load; explosive takeoff; rise; peak hold; descent; landing compression; recover. Body: knees bend-extend-bend, arms assist lift, head follows arc, smooth reset.",
  attack:
    "Summary: Melee strike cycle. Sequence: guard set; wind-up; burst strike; impact hold; follow-through; recovery to guard. Body: hip rotation drives punch, front shoulder leads, back foot pivots, clear recoil.",
  fall:
    "Summary: Hit-and-fall loop. Sequence: balance break; drop phase; ground impact; bounce settle; weak recovery beat; return low. Body: center of mass drops fast, limbs lag on impact, torso curls then relaxes.",
  custom:
    "Summary: Stylized custom action. Sequence: anticipation; main action burst; follow-through; settle and reset. Body: clear weight shift, readable limb arcs, head-chest rhythm, cloth or hair delay then settle.",
};

export function getFallbackActionDescription(
  actionId: ActionType,
  userMessage: string,
): string {
  const base = ACTION_FALLBACK_MAP[actionId] ?? ACTION_FALLBACK_MAP.custom;
  const normalized = userMessage.trim();
  if (!normalized) return base;
  return `${base} Detail focus: ${normalized.slice(0, 120)}.`;
}

export function getDefaultClarifyQuestion(actionId: ActionType): string {
  const map: Record<ActionType, string> = {
    walk: "你希望是轻松步态、正常步态，还是夸张步态？",
    run: "你希望跑步节奏偏快还是偏稳，角色重心要前倾多少？",
    idle: "待机时你更希望表现呼吸感、头部转动，还是衣摆轻摆？",
    jump: "跳跃动作你希望突出起跳力度，还是落地缓冲感？",
    attack: "攻击动作你希望偏重挥击速度还是打击停顿感？",
    fall: "倒地动作你希望偏夸张还是偏自然？",
    custom: "请补充动作节奏、幅度和道具细节，我再帮你优化。",
  };
  return map[actionId];
}
