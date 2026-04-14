export interface KeyBindings {
  forward: string;
  backward: string;
  left: string;
  right: string;
  attack: string;
  ability1: string;
  ability2: string;
  ability3: string;
  interact: string;
  switchWeapon: string;
  sprint: string;
  caltrops: string;
}

export const DEFAULT_BINDINGS: KeyBindings = {
  forward: "KeyW",
  backward: "KeyS",
  left: "KeyA",
  right: "KeyD",
  attack: "MouseLeft",
  ability1: "KeyQ",
  ability2: "KeyE",
  ability3: "KeyR",
  interact: "KeyF",
  switchWeapon: "KeyT",
  sprint: "ShiftLeft",
  caltrops: "KeyC",
};
