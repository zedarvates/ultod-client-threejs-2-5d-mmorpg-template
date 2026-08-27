export const CLIENT_CORE_VERSION = "0.1.0";

export { IsometricCamera } from "./camera/isometric-camera.js";
export { IsometricControls } from "./camera/isometric-controls.js";
export { InputManager } from "./input/input-manager.js";
export { KeyboardSource } from "./input/keyboard-source.js";
export { PointerSource } from "./input/pointer-source.js";
export { TouchJoystick } from "./input/touch-joystick.js";
export type { MoveIntent } from "./input/types.js";
export type { PointerSample } from "./input/pointer-source.js";

export { createProceduralCreaturePart } from "./presentation/procedural-creature-parts.js";
export { createProceduralTemplateProps } from "./presentation/procedural-template-props.js";
export { loadTemplateProps } from "./presentation/prop-loader.js";
export { PlayerPresentation } from "./presentation/player-presentation.js";
export { NPCPresentation } from "./presentation/npc-presentation.js";
export { buildFromBlueprint } from "./presentation/blueprint-bridge.js";
export type {
  BlueprintFloor,
  BlueprintProp,
  BlueprintRoof,
  BlueprintTile,
  BlueprintWall,
  BridgeResult,
  ColliderBox,
  HouseBlueprint,
} from "./presentation/blueprint-bridge.js";
export { buildCreature } from "./presentation/creature-bridge.js";
export type {
  CreatureBuildOptions,
  CreatureGenome,
  GenomePart,
} from "./presentation/creature-bridge.js";
