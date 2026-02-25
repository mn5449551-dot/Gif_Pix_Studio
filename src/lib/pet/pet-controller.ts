import { ACTION_LABELS } from "@/lib/constants";
import type {
  ActionType,
  PetCreateContext,
  PetEventPayloadMap,
  PetEventType,
  PetMood,
} from "@/lib/types";

export interface PetControllerState {
  mood: PetMood;
  successStreak: number;
  createContext: PetCreateContext;
}

export interface PetControllerResult {
  next: PetControllerState;
  suggestedMood?: PetMood;
  milestone?: boolean;
}

export const HAPPY_RETURN_MS = 2_000;
export const CELEBRATE_RETURN_MS = 4_000;

export function createInitialCreateContext(actionId: ActionType = "walk"): PetCreateContext {
  return {
    actionId,
    actionLabel: ACTION_LABELS[actionId],
    customPrompt: "",
    hasImage: false,
  };
}

export function createInitialPetControllerState(): PetControllerState {
  return {
    mood: "idle",
    successStreak: 0,
    createContext: createInitialCreateContext(),
  };
}

function mergeCreateContext(
  current: PetCreateContext,
  patch?: Partial<PetCreateContext>,
): PetCreateContext {
  if (!patch) return current;
  const nextAction = patch.actionId ?? current.actionId;
  return {
    ...current,
    ...patch,
    actionId: nextAction,
    actionLabel: patch.actionLabel ?? ACTION_LABELS[nextAction],
  };
}

export function reducePetEvent<T extends PetEventType>(
  state: PetControllerState,
  event: T,
  payload?: PetEventPayloadMap[T],
): PetControllerResult {
  const shouldMergeContext =
    event === "page:create:entered" ||
    event === "image:uploaded" ||
    event === "image:cleared" ||
    event === "task:generate:start";
  const createContext = shouldMergeContext
    ? mergeCreateContext(state.createContext, payload as Partial<PetCreateContext> | undefined)
    : state.createContext;
  let mood = state.mood;
  let successStreak = state.successStreak;
  let milestone = false;

  switch (event) {
    case "page:create:entered":
      mood = createContext.hasImage ? "idle" : "guide";
      break;
    case "image:uploaded":
      mood = "idle";
      break;
    case "image:audit":
      mood = createContext.hasImage ? "idle" : "guide";
      break;
    case "image:cleared":
      mood = "guide";
      break;
    case "task:generate:start":
    case "task:reencode:start":
      mood = "thinking";
      break;
    case "task:generate:progress":
      mood = "thinking";
      break;
    case "task:generate:success":
      successStreak += 1;
      milestone = (payload as { milestone?: boolean } | undefined)?.milestone ?? successStreak === 1;
      mood = milestone ? "celebrate" : "happy";
      break;
    case "task:reencode:success":
      mood = "happy";
      break;
    case "task:generate:failed":
    case "task:reencode:failed":
      mood = "error";
      successStreak = 0;
      break;
    case "task:generate:cancelled":
      mood = createContext.hasImage ? "idle" : "guide";
      break;
    default:
      break;
  }

  return {
    next: {
      mood,
      successStreak,
      createContext,
    },
    suggestedMood: mood,
    milestone,
  };
}
