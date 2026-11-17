// Biomes O' Plenty compatibility (our Bedrock port, Kaleidoscope BOP_BR).
// Plain data: no @minecraft imports. Nothing here matters when BOP is not installed:
// the extra biome tags simply never match and the ids never come up.
//
// Source: BOP_BR/docs/handshake.json (HANDSHAKE.md). BOP biomes carry no vanilla
// vegetation tags (plains, forest, jungle, …); instead each has `bop_like_<tag>` for
// every vegetation tag of the vanilla biomes it replaces. So wherever Harvest asks for
// biome tag X, it also accepts `bop_like_X` (world generation: tools/generate.mjs,
// tools/art/tree_shapes.py).

/** Every BOP biome tag that stands for vanilla biome tag `tag`. */
export function bopLike(tag) {
  return [`bop_like_${tag}`, ...(BOP_LIKE_EXTRA[tag] ?? [])];
}

// ## The handshake has no `bop_like_edge` / `bop_like_hills`: "edge" there is
// ## bop_like_jungle_edge (subtropics). Keep in step with BOP_LIKE_EXTRA in tools/art/tree_shapes.py.
const BOP_LIKE_EXTRA = {
  edge: ["bop_like_jungle_edge"],
};

// ## Climate of each BOP biome on Harvest's scale (data/climate.js), checked before the
// ## vanilla substring rules (which would read bop:cold_desert as cold, bop:lush_desert as hot
// ## and bop:volcanic_plains as temperate by name alone). Not the handshake's own `climate`
// ## column: that cuts at 0.9 / 1.5 like vanilla's temperature bands, while Harvest counts
// ## jungle (0.95) and savanna (1.2) as hot. Sorted from each biome's temperature the way the
// ## vanilla rules are: ≤ 0.3 cold, ≥ 0.9 hot, else temperate; wetlands warm unless cold;
// ## beaches warm from 0.6; nether and cave biomes temperate like their vanilla biomes.
export const BOP_CLIMATE = {
  "bop:auroral_garden":          "cold",       // -0.25 mountain; replaces grove, snowy_slopes
  "bop:bayou":                   "warm",       //  0.95 wetland; replaces swampland
  "bop:bog":                     "cold",       //   0.2 wetland; replaces mangrove_swamp
  "bop:cold_desert":             "cold",       //  0.25 plains; replaces ice_plains, ice_plains_spikes
  "bop:coniferous_forest":       "temperate",  //  0.45 forest; replaces taiga
  "bop:crag":                    "temperate",  //   0.6 mountain; replaces extreme_hills, jagged_peaks
  "bop:crystalline_chasm":       "temperate",  //   2.0 nether; replaces warped_forest
  "bop:dead_forest":             "cold",       //   0.2 forest; replaces cold_taiga_mutated
  "bop:dryland":                 "temperate",  //  0.85 arid; replaces savanna
  "bop:dune_beach":              "warm",       //   0.7 ocean; replaces beach
  "bop:erupting_inferno":        "temperate",  //   2.0 nether; replaces basalt_deltas
  "bop:field":                   "temperate",  //   0.4 plains; replaces plains
  "bop:fir_clearing":            "temperate",  //  0.45 forest; replaces taiga, taiga_mutated
  "bop:floodplain":              "warm",       //   1.2 wetland; replaces swampland_mutated
  "bop:forested_field":          "temperate",  //   0.4 plains; replaces sunflower_plains
  "bop:fungal_jungle":           "temperate",  //   0.9 cave; replaces lush_caves
  "bop:glowing_grotto":          "temperate",  //   0.5 cave; replaces lush_caves
  "bop:gravel_beach":            "temperate",  //  0.45 ocean; replaces stone_beach, cold_beach
  "bop:highland":                "temperate",  //   0.6 mountain; replaces extreme_hills, extreme_hills_mutated
  "bop:hot_springs":             "cold",       //  0.17 mountain; replaces meadow
  "bop:jade_cliffs":             "temperate",  //   0.8 mountain; replaces stony_peaks
  "bop:lavender_field":          "temperate",  //   0.8 plains; replaces sunflower_plains
  "bop:lush_desert":             "hot",        //   0.9 arid; replaces desert
  "bop:lush_savanna":            "hot",        //   0.9 arid; replaces savanna_plateau
  "bop:maple_woods":             "temperate",  //   0.4 forest; replaces taiga
  "bop:marsh":                   "warm",       //  0.65 wetland; replaces swampland
  "bop:mediterranean_forest":    "temperate",  //   0.8 arid; replaces savanna_plateau, savanna_plateau_mutated
  "bop:moor":                    "temperate",  //   0.6 mountain; replaces meadow
  "bop:muskeg":                  "cold",       //   0.0 wetland; replaces swampland_mutated
  "bop:mystic_grove":            "temperate",  //   0.7 forest; replaces flower_forest
  "bop:old_growth_dead_forest":  "cold",       //   0.3 forest; replaces mega_taiga
  "bop:old_growth_woodland":     "temperate",  //   0.8 forest; replaces roofed_forest, roofed_forest_mutated
  "bop:ominous_woods":           "temperate",  //   0.6 forest; replaces roofed_forest, pale_garden
  "bop:orchard":                 "temperate",  //   0.8 forest; replaces forest
  "bop:origin_valley":           "temperate",  //   0.6 forest; replaces forest
  "bop:overgrown_greens":        "temperate",  //   0.6 forest; replaces jungle, jungle_mutated
  "bop:pasture":                 "temperate",  //   0.8 plains; replaces plains
  "bop:prairie":                 "temperate",  //   0.8 plains; replaces plains
  "bop:pumpkin_patch":           "temperate",  //   0.4 forest; replaces forest
  "bop:rainforest":              "hot",        //   1.2 forest; replaces jungle
  "bop:redwood_forest":          "temperate",  //   0.8 forest; replaces redwood_taiga_mutated, mega_taiga
  "bop:rocky_rainforest":        "hot",        //   1.2 forest; replaces bamboo_jungle
  "bop:rocky_shrubland":         "temperate",  //   0.6 mountain; replaces extreme_hills_plus_trees, extreme_hills_edge
  "bop:scrubland":               "hot",        //   1.1 arid; replaces savanna
  "bop:seasonal_forest":         "cold",       // 0.175 forest; replaces birch_forest, birch_forest_mutated
  "bop:shrubland":               "temperate",  //   0.6 plains; replaces plains
  "bop:snowblossom_grove":       "cold",       // -0.25 forest; replaces cherry_grove
  "bop:snowy_coniferous_forest": "cold",       // -0.25 forest; replaces cold_taiga
  "bop:snowy_fir_clearing":      "cold",       // -0.25 forest; replaces cold_taiga
  "bop:snowy_maple_woods":       "cold",       // -0.25 forest; replaces cold_taiga
  "bop:spider_nest":             "temperate",  //   0.5 cave; replaces dripstone_caves
  "bop:subtropics":              "temperate",  //   0.6 forest; replaces jungle_edge, jungle_edge_mutated
  "bop:tropics":                 "warm",       //  0.95 ocean; replaces beach
  "bop:tundra":                  "cold",       //   0.2 plains; replaces ice_plains
  "bop:undergrowth":             "temperate",  //   2.0 nether; replaces crimson_forest
  "bop:visceral_heap":           "temperate",  //   2.0 nether; replaces hell
  "bop:volcanic_plains":         "hot",        //  0.95 arid; replaces savanna_mutated, mesa_bryce
  "bop:volcano":                 "hot",        //  0.95 mountain; replaces stony_peaks, frozen_peaks
  "bop:wasteland":               "hot",        //   2.0 arid; replaces desert, desert_mutated
  "bop:wasteland_steppe":        "hot",        //   2.0 arid; replaces desert
  "bop:wetland":                 "warm",       //   0.6 wetland; replaces mangrove_swamp
  "bop:wintry_origin_valley":    "cold",       // -0.25 plains; replaces ice_plains
  "bop:withered_abyss":          "temperate",  //   2.0 nether; replaces soulsand_valley
  "bop:woodland":                "temperate",  //   0.8 forest; replaces forest
};
