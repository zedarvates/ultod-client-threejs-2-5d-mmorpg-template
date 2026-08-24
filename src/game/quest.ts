// SPDX-License-Identifier: MIT
// Quest state machine for the demo scenario: "Rescue the Princess".
//
// Offline-only. In the future the server owns quest authority; this client
// module mirrors that contract so switching to live data is mechanical.

export type QuestStage =
  | "not_started"
  | "talked_to_king"
  | "bought_sword"
  | "slain_monster"
  | "princess_rescued";

export const STAGE_ORDER: readonly QuestStage[] = [
  "not_started",
  "talked_to_king",
  "bought_sword",
  "slain_monster",
  "princess_rescued",
];

export interface QuestState {
  stage: QuestStage;
  gold: number;
  hasSword: boolean;
}

export function initialQuestState(): QuestState {
  return { stage: "not_started", gold: 25, hasSword: false };
}

/** Human-readable objective for the current stage. */
export function questObjective(state: QuestState): string {
  switch (state.stage) {
    case "not_started": return "Talk to the King (yellow NPC) to start the quest.";
    case "talked_to_king": return `Buy a sword from the Merchant (50g). You have ${state.gold}g.`;
    case "bought_sword": return "Slay the Beast (red creature) north of the village.";
    case "slain_monster": return "Return to the Princess (pink NPC) to free her.";
    case "princess_rescued": return "Quest complete! The kingdom is saved.";
  }
}

export function advanceTo(state: QuestState, next: QuestStage): QuestState {
  const cur = STAGE_ORDER.indexOf(state.stage);
  const nxt = STAGE_ORDER.indexOf(next);
  if (nxt !== cur + 1) return state; // enforce linear progression
  return { ...state, stage: next };
}
