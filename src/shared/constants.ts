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
  DEV_MIN_PLAYERS: 3,
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

export const LAMP_POSITIONS: Array<{ id: string; x: number; z: number }> = [
  // South gate area
  { id: "lamp_01", x: 36, z: 2 },
  { id: "lamp_02", x: 44, z: 2 },
  // Spirit wall area
  { id: "lamp_03", x: 36, z: 8 },
  { id: "lamp_04", x: 44, z: 8 },
  // South rooms exterior
  { id: "lamp_05", x: 20, z: 12 },
  { id: "lamp_06", x: 60, z: 12 },
  // West side corridor (vertical x=5, z=18->28)
  { id: "lamp_07", x: 5, z: 20 },
  { id: "lamp_08", x: 5, z: 26 },
  // West wing exterior
  { id: "lamp_09", x: 8, z: 33 },
  { id: "lamp_10", x: 8, z: 45 },
  { id: "lamp_11", x: 8, z: 57 },
  // West side corridor (vertical x=5, z=62->75)
  { id: "lamp_12", x: 5, z: 65 },
  { id: "lamp_13", x: 5, z: 72 },
  // East side corridor (vertical x=75, z=18->28)
  { id: "lamp_14", x: 75, z: 20 },
  { id: "lamp_15", x: 75, z: 26 },
  // East wing exterior
  { id: "lamp_16", x: 72, z: 33 },
  { id: "lamp_17", x: 72, z: 45 },
  { id: "lamp_18", x: 72, z: 57 },
  // East side corridor (vertical x=75, z=62->75)
  { id: "lamp_19", x: 75, z: 65 },
  { id: "lamp_20", x: 75, z: 72 },
  // South connecting corridor (horizontal z=18, x=25->55)
  { id: "lamp_21", x: 30, z: 18 },
  { id: "lamp_22", x: 40, z: 18 },
  { id: "lamp_23", x: 50, z: 18 },
  // Central courtyard
  { id: "lamp_24", x: 25, z: 30 },
  { id: "lamp_25", x: 55, z: 30 },
  { id: "lamp_26", x: 30, z: 40 },
  { id: "lamp_27", x: 50, z: 40 },
  { id: "lamp_28", x: 40, z: 45 },
  { id: "lamp_29", x: 30, z: 55 },
  { id: "lamp_30", x: 50, z: 55 },
  { id: "lamp_31", x: 25, z: 65 },
  { id: "lamp_32", x: 55, z: 65 },
  // Main hall entrance
  { id: "lamp_33", x: 25, z: 73 },
  { id: "lamp_34", x: 40, z: 73 },
  { id: "lamp_35", x: 55, z: 73 },
  // Inside main hall
  { id: "lamp_36", x: 22, z: 80 },
  { id: "lamp_37", x: 40, z: 80 },
  { id: "lamp_38", x: 58, z: 80 },
  { id: "lamp_39", x: 22, z: 90 },
  { id: "lamp_40", x: 40, z: 90 },
  { id: "lamp_41", x: 58, z: 90 },
  // Ear room west
  { id: "lamp_42", x: 10, z: 82 },
  { id: "lamp_43", x: 10, z: 87 },
  // Ear room east
  { id: "lamp_44", x: 70, z: 82 },
  { id: "lamp_45", x: 70, z: 87 },
  // Back rooms
  { id: "lamp_46", x: 30, z: 97 },
  { id: "lamp_47", x: 40, z: 97 },
  { id: "lamp_48", x: 50, z: 97 },
];

// Wall collision boxes for the map (used by server PhysicsSystem)
// Each box: { minX, minZ, maxX, maxZ }
export const WALL_COLLIDERS: Array<{ minX: number; minZ: number; maxX: number; maxZ: number }> = [
  // Outer walls
  { minX: -0.5, minZ: -0.5, maxX: 0.5, maxZ: 100.5 },           // West wall
  { minX: 79.5, minZ: -0.5, maxX: 80.5, maxZ: 100.5 },          // East wall
  { minX: -0.5, minZ: 99.5, maxX: 80.5, maxZ: 100.5 },          // North wall
  { minX: -0.5, minZ: -0.5, maxX: 36, maxZ: 0.5 },              // South wall left
  { minX: 44, minZ: -0.5, maxX: 80.5, maxZ: 0.5 },              // South wall right
  // Spirit wall
  { minX: 34, minZ: 6, maxX: 46, maxZ: 7 },
  // South rooms (west)
  { minX: 5, minZ: 5, maxX: 25, maxZ: 18 },
  // South rooms (east)
  { minX: 55, minZ: 5, maxX: 75, maxZ: 18 },
  // West wing
  { minX: 3, minZ: 28, maxX: 18, maxZ: 62 },
  // East wing
  { minX: 62, minZ: 28, maxX: 77, maxZ: 62 },
  // Main hall
  { minX: 15, minZ: 75, maxX: 65, maxZ: 95 },
  // Back rooms
  { minX: 20, minZ: 95, maxX: 60, maxZ: 100 },
  // Ear room west
  { minX: 5, minZ: 78, maxX: 15, maxZ: 90 },
  // Ear room east
  { minX: 65, minZ: 78, maxX: 75, maxZ: 90 },
];
