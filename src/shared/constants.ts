// Map dimensions (in world units, 1 unit ~ 1 meter)
export const MAP = {
  WIDTH: 80,
  DEPTH: 100,
  WALL_HEIGHT: 6,
  WALL_THICKNESS: 1,
  GATE_WIDTH: 8,
  CORRIDOR_WIDTH: 3,
  BUILDING_HEIGHT: 5,
  ROOF_OVERHANG: 1.5,
};

// Game balance
export const GAME = {
  MAX_PLAYERS: 10,
  NINJA_COUNT: 1,
  SAMURAI_COUNT: 8,
  SHOGUN_COUNT: 1,
  MATCH_DURATION_SEC: 300,
  TICK_RATE_MS: 50,
  DEV_MIN_PLAYERS: 1,
};

// Player stats by role
export const STATS = {
  ninja: {
    maxHp: 80,
    moveSpeed: 7,
    attackDamage: 40,
    attackRange: 2.5,
    attackCooldownMs: 600,
    waterBombCount: 9999,
    smokeBombCount: 2,
    grapplingHookCount: 1,
    smokeBombRadius: 6,
    smokeBombDurationMs: 8000,
    waterBombBlastRadius: 3,
    bombMaxThrowDist: 12,
    maxStamina: 100,
    sprintMultiplier: 3,
    staminaDrain: 25,
    staminaRegen: 20,
    staminaRegenDelay: 600,
    caltropsCount: 1,
    caltropsRadius: 2.5,
    caltropsSlowFactor: 0.4,
    caltropsDurationMs: 30000,
  },
  samurai: {
    maxHp: 120,
    moveSpeed: 5,
    katanaDamage: 30,
    lanceDamage: 25,
    katanaRange: 2.5,
    lanceRange: 4.5,
    attackCooldownMs: 800,
    armorReduction: 0.25,
    torchRange: 12,
    torchCount: 3,
    maxStamina: 100,
    sprintMultiplier: 2.8,
    staminaDrain: 20,
    staminaRegen: 18,
    staminaRegenDelay: 600,
  },
  shogun: {
    maxHp: 150,
    moveSpeed: 4.5,
    attackDamage: 35,
    attackRange: 2.5,
    attackCooldownMs: 700,
    chargeDist: 8,
    chargeStunMs: 1500,
    chargeCooldownMs: 8000,
    chargeWidth: 2,
    maxStamina: 100,
    sprintMultiplier: 2.6,
    staminaDrain: 18,
    staminaRegen: 15,
    staminaRegenDelay: 600,
  },
};

export const LAMP = {
  LIGHT_RADIUS: 12,
  RELIGHT_TIME_MS: 1000,
  RELIGHT_RANGE: 2.5,
  DEFAULT_HEIGHT: 3,
};

export const LIGHTING = {
  AMBIENT_INTENSITY: 0.03,
  MOON_INTENSITY: 0.12,
  LAMP_POOL_INTENSITY: 5,
  LAMP_POOL_RANGE: 12,
  TORCH_LIGHT_INTENSITY: 1.2,
  TORCH_LIGHT_RANGE: 12,
  TORCH_LIGHT_COLOR: 0xff6622,
};

