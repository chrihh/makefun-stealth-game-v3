// Verdant Vault — deterministic screenshot scenes. Each scene builds
// a real world, freezes it at a composed mid-game moment, and lets the
// renderer draw exactly what a player would see.

import { createWorld } from './world.js';

export function applyShot(name) {
  if (name === 'mist') {
    const w = createWorld(0);
    w.time = 6.2;
    w.player.x = 12.5; w.player.y = 5.5; w.player.face = 0.4;
    w.guards[0].x = 17.5; w.guards[0].y = 3.5; w.guards[0].face = 2.6;
    w.guards[1].x = 26.5; w.guards[1].y = 8.5; w.guards[1].face = -1.4;
    w.detection = 0.22;
    return { world: w, banner: null };
  }
  if (name === 'laser') {
    const w = createWorld(1);
    w.time = 2.0;
    w.player.x = 15.5; w.player.y = 11.5; w.player.face = 1.2;
    w.guards[1].x = 25.5; w.guards[1].y = 10.5; w.guards[1].face = 3.0;
    w.guards[2].x = 6.5; w.guards[2].y = 13.5; w.guards[2].face = 0.3;
    w.key.taken = false;
    w.detection = 0.48;
    w.alarmFlash = 0.5;
    return { world: w, banner: null };
  }
  if (name === 'vault') {
    const w = createWorld(2);
    w.time = 9.4;
    w.player.x = 21.5; w.player.y = 14.5; w.player.face = 0.2;
    w.guards[3].x = 25.5; w.guards[3].y = 15.5; w.guards[3].face = 3.1;
    w.guards[0].x = 10.5; w.guards[0].y = 3.5; w.guards[0].face = 0.8;
    w.key.taken = true;
    w.score = 975;
    w.detection = 0.35;
    return { world: w, banner: null };
  }
  // title: the Fern Court at rest, under the game's name
  const w = createWorld(0);
  w.time = 3.1;
  w.player.x = 3.5; w.player.y = 15.5; w.player.face = 0.2;
  w.guards[0].x = 15.5; w.guards[0].y = 5.5; w.guards[0].face = 0.9;
  return {
    world: w,
    banner: {
      title: 'VERDANT VAULT',
      lines: [
        'A stealth heist in a midnight glasshouse — steal the glass key, reach the EXIT unseen.',
        'WASD move · Shift sneak · Click throws a seed pod · Gravel crunches, moss and mist hide you.',
      ],
    },
  };
}
