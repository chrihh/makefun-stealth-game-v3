// Verdant Vault — tuning constants for the greenhouse stealth sim.
// Every number the simulation and renderer share lives here, so the
// balance can be revised in one place.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const VIEW_W = TILE * COLS;
export const VIEW_H = TILE * ROWS;

export const PLAYER_SPEED = 3.35;       // tiles per second, walking
export const PLAYER_SNEAK_SPEED = 1.85; // tiles per second, sneaking
export const PLAYER_RADIUS = 0.32;

export const GUARD_PATROL_SPEED = 1.65;
export const GUARD_PROWL_SPEED = 2.15;  // suspicious / distracted
export const GUARD_CHASE_SPEED = 2.88;
export const DRONE_SPEED = 1.25;

export const GUARD_RANGE = 5.3;         // vision cone length, tiles
export const DRONE_RANGE = 3.7;
export const CONE_HALF = 0.44;          // vision cone half-angle, radians

export const DETECT_FILL = 1.25;        // seconds in plain sight to fill
export const DETECT_DRAIN = 0.34;       // per second while unseen
export const LASER_SPIKE = 0.55;        // meter added by a tripwire
export const START_COVERS = 3;
export const PODS_PER_LEVEL = 5;

export const NOISE_WALK = 2.1;          // hearing radius, plain floor
export const NOISE_GRAVEL = 4.6;        // gravel crunches much further
export const NOISE_SNEAK = 0.8;
export const NOISE_SNEAK_GRAVEL = 1.7;
export const POD_HEARING = 7.5;         // guards this close hear a pod pop

export const SCORE_KEY = 150;
export const SCORE_PETAL = 75;
export const SCORE_CLEAR = 300;
export const SCORE_GHOST = 200;
export const SCORE_POD_LEFT = 20;
