export interface MovePayload {
  dx: number;
  dz: number;
  rotationY: number;
  sprint?: boolean;
}

export interface AttackPayload {
  targetX: number;
  targetZ: number;
}

export interface UseAbilityPayload {
  ability: string;
  targetX?: number;
  targetZ?: number;
}

export interface SelectWeaponPayload {
  weapon: string;
}

export interface RoleAssignedPayload {
  role: string;
}

export interface AttackResultPayload {
  attackerSessionId: string;
  targetSessionId: string;
  damage: number;
  targetHpAfter: number;
}

export interface AbilityEffectPayload {
  ability: string;
  casterSessionId: string;
  x: number;
  z: number;
  radius?: number;
  duration?: number;
}

export interface GameOverPayload {
  winner: string;
  reason: string;
}

export interface PlayerKilledPayload {
  sessionId: string;
  killerSessionId: string;
}
