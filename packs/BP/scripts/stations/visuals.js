// Display entities for the stations' moving parts (設計：docs/superpowers/specs/
// 2026-11-17-station-animations-design.md). A block model cannot move, so the
// juicer's reamer and juice and the pickling jar's lid live on an invisible,
// untouchable entity standing in the block. The block stays the only truth:
// scripts copy its state into the entity's properties, and the client
// animations (tools/generate.mjs) ease the parts towards those values.
//
// Kept in step from three sides, so old worlds and /kill heal themselves:
// placing, using and random ticks make sure exactly one entity stands there;
// breaking removes it; a slow sweep removes any left over a block that is gone.

import { system, world } from "@minecraft/server";
import { rid } from "../data/ns.js";
import { VISUAL_SWEEP_SECONDS } from "../data/stations.js";

/** Bottom centre of the block, where the entity stands. */
const standOf = ({ location: { x, y, z } }) => ({ x: x + 0.5, y, z: z + 0.5 });

function visualsAt(block, type) {
  try {
    return block.dimension.getEntities({ type: rid(type), location: standOf(block), maxDistance: 0.45 });
  } catch {
    return [];
  }
}

/** The one display entity on this block, spawned if missing (extra ones are removed). */
export function ensureVisual(block, type) {
  const found = visualsAt(block, type);
  for (const extra of found.slice(1)) extra.remove();
  if (found[0]) return found[0];
  try {
    return block.dimension.spawnEntity(rid(type), standOf(block));
  } catch {
    // ## Unloaded chunk or a world without the entity: the station still works, just without motion.
    return undefined;
  }
}

/** Ensures the entity and sets its properties ({ level: 1 } → kaleidoscope_harvest:level = 1). */
export function syncVisual(block, type, props) {
  const entity = ensureVisual(block, type);
  if (!entity) return;
  for (const [name, value] of Object.entries(props)) {
    try {
      entity.setProperty(rid(name), value);
    } catch {
      // ## An entity removed in the same tick; the next use or random tick puts it right.
    }
  }
}

export function removeVisual(block, type) {
  for (const entity of visualsAt(block, type)) entity.remove();
}

const DIMENSIONS = ["overworld", "nether", "the_end"];

/** Every few seconds, removes display entities whose station block is gone (explosions, commands). */
export function startVisualSweep(stations) {
  const byType = new Map(stations.map((s) => [rid(s.visual), rid(s.id)]));
  system.runInterval(() => {
    for (const id of DIMENSIONS) {
      let dimension;
      try {
        dimension = world.getDimension(id);
      } catch {
        continue;
      }
      for (const [type, blockId] of byType) {
        let entities = [];
        try {
          entities = dimension.getEntities({ type });
        } catch {
          continue;
        }
        for (const entity of entities) {
          let block;
          try {
            block = dimension.getBlock(entity.location);
          } catch {
            continue;
          }
          if (block && block.typeId !== blockId) entity.remove();
        }
      }
    }
  }, VISUAL_SWEEP_SECONDS * 20);
}
