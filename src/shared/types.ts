export enum PlayerRole {
  NINJA = "ninja",
  SAMURAI = "samurai",
  SHOGUN = "shogun",
}

export enum WeaponType {
  KATANA = "katana",
  LANCE = "lance",
  NONE = "none",
}

export enum GamePhase {
  LOBBY = "lobby",
  PLAYING = "playing",
  FINISHED = "finished",
}

export enum AbilityType {
  GRAPPLING_HOOK = "grappling_hook",
  WATER_BOMB = "water_bomb",
  SMOKE_BOMB = "smoke_bomb",
  TORCH_RELIGHT = "torch_relight",
  SHOGUN_CHARGE = "shogun_charge",
}

export enum ClientMsg {
  MOVE = "move",
  ATTACK = "attack",
  USE_ABILITY = "use_ability",
  SELECT_WEAPON = "select_weapon",
  READY = "ready",
  DEBUG_NOCLIP = "debug_noclip",
}

export enum ServerMsg {
  ROLE_ASSIGNED = "role_assigned",
  GAME_START = "game_start",
  ATTACK_RESULT = "attack_result",
  ABILITY_EFFECT = "ability_effect",
  GAME_OVER = "game_over",
  PLAYER_KILLED = "player_killed",
  LAMP_CHANGED = "lamp_changed",
  PLAYER_HIT = "player_hit",
}
