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
export { DIRECTIONS, directionForVector, parseSpritePack } from "./presentation/sprite-pack.js";
export type {
  SpriteAnimation,
  SpriteDirection,
  SpriteFrameRect,
  SpritePack,
  SpritePackFile,
} from "./presentation/sprite-pack.js";
export { SpriteActor } from "./presentation/sprite-actor.js";
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

export {
  MAX_GAME_FRAME_BYTES,
  MSG,
  encodeMessage,
  decodeMessage,
  encodeMovement,
  decodePositionUpdate,
} from "./net/protocol.js";
export type { PositionUpdate } from "./net/protocol.js";
export { NetworkClient } from "./net/network-client.js";
export type {
  NetworkConnectOptions,
  NetworkSocket,
  NetworkSocketCloseEvent,
  NetworkSocketFactory,
  NetworkSocketMessageEvent,
  NetworkState,
  PositionListener,
} from "./net/network-client.js";
export { HudOverlay } from "./ui/hud-overlay.js";
export { DialogBox } from "./ui/dialog-box.js";
export type { DialogAction } from "./ui/dialog-box.js";
export { ContentPackLoader } from "./content/content-pack-loader.js";
export type { EntityVisualizer } from "./content/content-pack-loader.js";
