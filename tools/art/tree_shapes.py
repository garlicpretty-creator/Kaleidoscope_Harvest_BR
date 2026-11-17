"""Fruit-tree shapes for Kaleidoscope Harvest: one table of data -> Bedrock tree features, feature rules, preview.

Usage: python tools/art/tree_shapes.py

Each tree in TREES holds its shape as data (trunk kind + height range, canopy kind + size, lean/branches).
From that table the script writes, deterministically:
  packs/BP/features/trees/<tree>_tree_feature.json            minecraft:tree_feature
  packs/BP/feature_rules/trees/<tree>_tree_feature_rule.json  wild placement (mandarin's never places: village saplings only,
                                                              but without a rule the game does not register the feature)
  art/previews/tree_shapes.png                                isometric voxel render, bare leaves with fruit hanging below, fixed seed

Schema: https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/features/minecrafttree_feature
        https://learn.microsoft.com/en-us/minecraft/creator/reference/content/featuresreference/examples/featuresintroduction
Field values follow the vanilla oak / savanna / roofed / fancy_oak / spruce / pine / mega_jungle tree features.

The preview is our reading of how the engine grows each canopy kind (modelled on the legacy tree generators the
data-driven kinds came from). The game randomises every placement, so treat it as a representative instance only;
see docs/art/TREE_SHAPES.md for where the game may differ.
"""
import json, math, os, random
from PIL import Image, ImageDraw, ImageFont
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fruit_models as fm  # noqa: E402  (fruit palettes)

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
NS = 'kaleidoscope_harvest'
FEATURES = os.path.join(ROOT, 'packs', 'BP', 'features', 'trees')
RULES = os.path.join(ROOT, 'packs', 'BP', 'feature_rules', 'trees')
TEX = os.path.join(ROOT, 'packs', 'RP', 'textures', NS, 'blocks', 'trees')
PREVIEW = os.path.join(ROOT, 'art', 'previews', 'tree_shapes.png')

FEATURE_FORMAT = '1.21.60'
RULE_FORMAT = '1.13.0'

TREE_IDS = ['mandarin', 'sweet_orange', 'lemon', 'peach', 'pear', 'persimmon',
            'lychee', 'mango', 'banana', 'star_anise', 'cinnamon',
            'longan', 'loquat', 'star_fruit', 'papaya']  # 1.1: the last four


def rng_(a, b):
    return {'range_min': a, 'range_max': b}


def chance(n, d):
    return {'numerator': n, 'denominator': d}


def raw_tag(t, op='=='):
    return {'test': 'has_biome_tag', 'operator': op, 'value': t}


# ## Biomes O' Plenty compatibility (our Bedrock port, BOP_BR/docs/HANDSHAKE.md): BOP biomes carry no
# ## vanilla vegetation tags, only bop_like_<tag>. So `== X` also accepts bop_like_X, and `!= X` also
# ## rejects it. Without BOP those tags never match, so vanilla placement is unchanged.
# ## Keep BOP_LIKE_EXTRA in step with packs/BP/scripts/data/bop.js.
BOP_LIKE_EXTRA = {'edge': ['bop_like_jungle_edge']}  # the handshake has no bop_like_edge


def bop_like(t):
    return [f'bop_like_{t}'] + BOP_LIKE_EXTRA.get(t, [])


def tag(t, op='=='):
    tests = [raw_tag(v, op) for v in [t] + bop_like(t)]
    return {'any_of' if op == '==' else 'all_of': tests}


# ---------------------------------------------------------------- the shape table
# trunk kinds:  trunk (straight, height range) | acacia (base + intervals, optional lean / branch) | fancy (big-oak style)
# canopy kinds: random_spread | canopy (oak blob) | acacia | fancy | roofed | mega | spruce | pine
# ## Do not use random_spread: in game (1.0.0) it placed no leaves on a plain `trunk` at all, and on an
# ## acacia trunk only when a script placed the tree; world generation still left bare trunks. canopy,
# ## acacia, fancy and mega were seen generating full trees in the wild.
# ## acacia canopies need an acacia trunk; a straight one is base + intervals with no lean (3 or 4 logs).
# ## A `canopy` is only confirmed in game with offset -3..0 and four variations (as vanilla oak and
# ## persimmon), so keep to that. That crown hangs 3 blocks below the trunk
# ## top, so the trunk needs 4 or more logs or the tree sits on the ground like a bush.
# wild: biome filter (list = all must pass) and per-chunk chance (one attempt per chunk); None = no wild rule.
TREES = {
    'mandarin': dict(
        zh='柑橘', note='較矮的幹、稀疏小圓冠',
        trunk=dict(kind='trunk', height=(4, 5)),
        canopy=dict(kind='canopy', offset=(-3, 0), variation=[(1, 2), (1, 2), (1, 2), (1, 1)]),
        wild=None),
    'sweet_orange': dict(
        zh='柳橙', note='5 寬濃密圓球冠',
        trunk=dict(kind='trunk', height=(5, 6)),
        canopy=dict(kind='canopy', offset=(-3, 0), variation=[(1, 3), (1, 3), (1, 3), (1, 1)]),
        wild=dict(filter=[tag('plains')], chance=(1, 4), biomes='plains（平原、向日葵平原）')),
    'lemon': dict(
        zh='檸檬', note='微斜幹、偏一側的鬆散不規則冠',
        trunk=dict(kind='acacia', base=3, intervals=[2], lean=dict(height=(1, 2), steps=(1, 1))),
        canopy=dict(kind='acacia', size=1),
        wild=dict(filter=[tag('savanna')], chance=(1, 4), biomes='savanna（熱帶草原、高原）')),
    'peach': dict(
        zh='桃', note='斜幹＋反向分枝、開心形兩片平展傘冠',
        trunk=dict(kind='acacia', base=4, intervals=[2], lean=dict(height=(2, 3), steps=(2, 3)),
                   branch=dict(chance=(2, 3), length=(3, 3), position=(1, 2), size=2)),
        canopy=dict(kind='acacia', size=2),
        wild=dict(filter=[tag('flower_forest')], chance=(1, 3), biomes='flower_forest（繁花森林）')),
    'pear': dict(
        zh='梨', note='大橡樹式分枝、不規則多團冠',
        trunk=dict(kind='fancy', base=6, variance=2, scale=0.618, slope=0.381, density=1.0,
                   min_altitude=0.2, width_scale=1.0, foliage_altitude=0.3),
        canopy=dict(kind='fancy', height=3, radius=2),
        wild=dict(filter=[tag('forest'), tag('taiga', '!='), tag('roofed', '!='), tag('mega', '!='),
                          tag('extreme_hills', '!='), tag('cold', '!=')],
                  chance=(1, 4), biomes='forest，排除 taiga / roofed / mega / extreme_hills / cold（森林、樺木林）')),
    'persimmon': dict(
        zh='柿子', note='較高幹、橡樹式圓冠',
        trunk=dict(kind='trunk', height=(5, 7)),
        canopy=dict(kind='canopy', offset=(-3, 0), variation=[(1, 2), (1, 2), (1, 2), (1, 1)]),
        wild=dict(filter=[tag('taiga'), tag('cold', '!='), tag('mega', '!=')], chance=(1, 5),
                  biomes='taiga，排除 cold / mega（一般針葉林）')),
    'lychee': dict(
        zh='荔枝', note='7 寬平頂濃密圓頂',
        trunk=dict(kind='acacia', base=4, intervals=[2]),
        canopy=dict(kind='roofed', height=3, outer=2, inner=3),
        wild=dict(filter=[tag('jungle'), tag('edge', '!='), tag('bamboo', '!=')], chance=(1, 3),
                  biomes='jungle，排除 edge / bamboo（叢林）')),
    'mango': dict(
        zh='芒果', note='較高幹、上窄下寬的傘形大冠',
        trunk=dict(kind='trunk', height=(5, 6)),
        canopy=dict(kind='mega', height=3, radius=1),
        wild=dict(filter=[tag('jungle'), tag('edge', '!='), tag('bamboo', '!=')], chance=(1, 3),
                  biomes='jungle，排除 edge / bamboo（叢林）')),
    'banana': dict(
        zh='香蕉', note='香蕉莖、頂端稀疏扇葉叢',
        trunk=dict(kind='acacia', base=3, intervals=[2], block='banana_trunk'),
        canopy=dict(kind='acacia', size=1),
        wild=dict(filter=[tag('jungle')], chance=(1, 3), biomes='jungle（叢林、稀疏叢林、竹林）')),
    'star_anise': dict(
        zh='八角', note='直立窄塔、雲杉式分層',
        trunk=dict(kind='trunk', height=(7, 8)),
        canopy=dict(kind='spruce', lower=(2, 3), upper=(0, 1), max_radius=(2, 2)),
        wild=dict(filter=[{'any_of': [tag('bamboo'), {'all_of': [tag('jungle'), tag('hills')]}]}],
                  chance=(1, 3), biomes='bamboo，或 jungle＋hills（竹林、竹林丘陵、叢林丘陵）')),
    'cinnamon': dict(
        zh='肉桂', note='直立窄柱、尖頂',
        trunk=dict(kind='trunk', height=(6, 7)),
        canopy=dict(kind='pine', height=(5, 6), radius=1),
        wild=dict(filter=[tag('jungle'), tag('edge')], chance=(1, 3), biomes='jungle＋edge（稀疏叢林）')),
    # --- 1.1
    'longan': dict(
        zh='龍眼', note='高一點的幹、比荔枝更寬的圓頂大冠',
        trunk=dict(kind='acacia', base=5, intervals=[2]),
        canopy=dict(kind='roofed', height=3, outer=3, inner=4),
        wild=dict(filter=[tag('jungle'), tag('edge', '!='), tag('bamboo', '!=')], chance=(1, 4),
                  biomes='jungle，排除 edge / bamboo（叢林）')),
    'loquat': dict(
        zh='枇杷', note='中等常綠圓冠',
        trunk=dict(kind='trunk', height=(4, 5)),
        canopy=dict(kind='canopy', offset=(-3, 0), variation=[(1, 3), (1, 3), (1, 3), (1, 1)]),
        wild=dict(filter=[tag('flower_forest')], chance=(1, 4), biomes='flower_forest（繁花森林）')),
    'star_fruit': dict(
        zh='楊桃', note='矮幹、低垂的灌木狀冠，常有一根側枝',
        trunk=dict(kind='acacia', base=3, intervals=[2],
                   branch=dict(chance=(1, 2), length=(2, 2), position=(1, 1), size=1)),
        canopy=dict(kind='acacia', size=2),
        wild=dict(filter=[tag('jungle'), tag('edge')], chance=(1, 3), biomes='jungle＋edge（稀疏叢林）')),
    'papaya': dict(
        zh='木瓜', note='細高單幹、頂端一小叢葉，果實貼著樹幹掛在葉叢下',
        trunk=dict(kind='acacia', base=5, intervals=[3]),
        canopy=dict(kind='acacia', size=1),
        wild=dict(filter=[tag('savanna')], chance=(1, 4), biomes='savanna（熱帶草原、高原）')),
}

# Preview only: leaves to draw a tree with until its own leaf texture exists.
STAND_IN = {'longan': 'lychee', 'loquat': 'sweet_orange', 'star_fruit': 'lemon', 'papaya': 'banana'}

LEAVES = [f'{NS}:{t}_leaves' for t in TREE_IDS]
SAPLINGS = [f'{NS}:{t}_sapling' for t in TREE_IDS]
VANILLA_LEAVES = ['minecraft:oak_leaves', 'minecraft:spruce_leaves', 'minecraft:birch_leaves', 'minecraft:jungle_leaves',
                  'minecraft:acacia_leaves', 'minecraft:dark_oak_leaves', 'minecraft:mangrove_leaves',
                  'minecraft:cherry_leaves', 'minecraft:azalea_leaves', 'minecraft:azalea_leaves_flowered']
PLANTS = ['minecraft:short_grass', 'minecraft:fern', 'minecraft:tall_grass', 'minecraft:large_fern',
          'minecraft:dandelion', 'minecraft:poppy', 'minecraft:sunflower', 'minecraft:lilac',
          'minecraft:rose_bush', 'minecraft:peony', 'minecraft:vine', 'minecraft:snow_layer']
MAY_GROW_ON = ['minecraft:grass_block', 'minecraft:dirt', 'minecraft:coarse_dirt', 'minecraft:podzol',
               'minecraft:dirt_with_roots', 'minecraft:moss_block']
MAY_GROW_THROUGH = ['minecraft:short_grass', 'minecraft:fern', 'minecraft:tall_grass', 'minecraft:large_fern',
                    'minecraft:snow_layer']


def median(r):
    return (r[0] + r[1]) // 2


# ---------------------------------------------------------------- feature JSON
def trunk_json(t, log):
    k = t['kind']
    if k == 'trunk':
        return 'trunk', {'trunk_height': rng_(*t['height']), 'trunk_block': log}
    if k == 'acacia':
        lean = t.get('lean')
        body = {
            'trunk_width': 1,
            'trunk_height': {'base': t['base'], 'intervals': t['intervals']},
            'trunk_block': log,
            'trunk_lean': {
                'allow_diagonal_growth': lean is not None,
                'lean_height': rng_(*(lean['height'] if lean else (0, 0))),
                'lean_steps': rng_(*(lean['steps'] if lean else (0, 0))),
            },
        }
        return 'acacia_trunk', body
    if k == 'fancy':
        return 'fancy_trunk', {
            'trunk_height': {'base': t['base'], 'variance': t['variance'], 'scale': t['scale']},
            'trunk_width': 1,
            'trunk_block': log,
            'branches': {'slope': t['slope'], 'density': t['density'], 'min_altitude_factor': t['min_altitude']},
            'width_scale': t['width_scale'],
            'foliage_altitude_factor': t['foliage_altitude'],
        }
    raise ValueError(k)


def canopy_json(c, leaf):
    k = c['kind']
    if k == 'random_spread':
        return 'random_spread_canopy', {'canopy_height': c['height'], 'canopy_radius': c['radius'],
                                        'leaf_placement_attempts': c['attempts'], 'leaf_blocks': [[leaf, 1]]}
    if k == 'canopy':
        return 'canopy', {'canopy_offset': {'min': c['offset'][0], 'max': c['offset'][1]},
                          'variation_chance': [chance(*v) for v in c['variation']], 'leaf_block': leaf}
    if k == 'acacia':
        return 'acacia_canopy', {'canopy_size': c['size'], 'leaf_block': leaf}
    if k == 'fancy':
        return 'fancy_canopy', {'height': c['height'], 'radius': c['radius'], 'leaf_block': leaf}
    if k == 'roofed':
        return 'roofed_canopy', {'canopy_height': c['height'], 'core_width': 1, 'outer_radius': c['outer'],
                                 'inner_radius': c['inner'], 'leaf_block': leaf}
    if k == 'mega':
        return 'mega_canopy', {'canopy_height': c['height'], 'base_radius': c['radius'], 'core_width': 1,
                               'simplify_canopy': False, 'leaf_block': leaf}
    if k == 'spruce':
        return 'spruce_canopy', {'lower_offset': rng_(*c['lower']), 'upper_offset': rng_(*c['upper']),
                                 'max_radius': rng_(*c['max_radius']), 'leaf_block': leaf}
    if k == 'pine':
        return 'pine_canopy', {'canopy_height': rng_(*c['height']), 'base_radius': c['radius'], 'leaf_block': leaf}
    raise ValueError(k)


def feature_json(tid):
    d = TREES[tid]
    if d['canopy']['kind'] == 'random_spread':
        raise ValueError(f'{tid}: random_spread canopy leaves bare trunks in world generation; use another kind')
    if d['canopy']['kind'] == 'canopy' and (tuple(d['canopy']['offset']) != (-3, 0) or len(d['canopy']['variation']) != 4):
        raise ValueError(f'{tid}: keep canopy offset -3..0 with four variations (the only form confirmed in game)')
    if d['canopy']['kind'] == 'acacia' and d['trunk']['kind'] != 'acacia':
        raise ValueError(f'{tid}: an acacia canopy needs an acacia trunk')
    log = f"{NS}:{d['trunk'].get('block', 'fruitwood_log')}"
    leaf = f'{NS}:{tid}_leaves'
    tk, tb = trunk_json(d['trunk'], log)
    br = d['trunk'].get('branch')
    if br:
        tb['branches'] = {
            'branch_chance': chance(*br['chance']),
            'branch_length': rng_(*br['length']),
            'branch_position': rng_(*br['position']),
            'branch_canopy': {'acacia_canopy': {'canopy_size': br['size'], 'leaf_block': leaf, 'simplify_canopy': True}},
        }
    ck, cb = canopy_json(d['canopy'], leaf)
    return {
        'format_version': FEATURE_FORMAT,
        'minecraft:tree_feature': {
            'description': {'identifier': f'{NS}:{tid}_tree_feature'},
            tk: tb,
            ck: cb,
            'may_grow_on': MAY_GROW_ON,
            'may_replace': ['minecraft:air'] + LEAVES + SAPLINGS + VANILLA_LEAVES + PLANTS,
            'may_grow_through': MAY_GROW_THROUGH,
        },
    }


# ## The game only registers a feature that some feature rule references; dimension.placeFeature then
# ## says "cannot be found in the registry" and that tree's saplings never grow (found in game, 1.0.0:
# ## mandarin, in a freshly started game; the registry stays cached for the life of the game process,
# ## so test this after restarting the game). A tree with no wild spawn still gets a rule, whose biome
# ## filter names a tag no biome has, so it never places.
NEVER = dict(filter=[raw_tag(f'{NS}_never')], chance=(1, 2))  # the game rejects 1/1


def rule_json(tid):
    w = TREES[tid]['wild'] or NEVER
    return {
        'format_version': RULE_FORMAT,
        'minecraft:feature_rules': {
            'description': {'identifier': f'{NS}:{tid}_tree_feature_rule',
                            'places_feature': f'{NS}:{tid}_tree_feature'},
            'conditions': {'placement_pass': 'surface_pass', 'minecraft:biome_filter': w['filter']},
            'distribution': {
                'iterations': 1,
                'scatter_chance': chance(*w['chance']),
                'x': {'distribution': 'uniform', 'extent': [0, 15]},
                'y': 'query.heightmap(variable.worldx, variable.worldz)',
                'z': {'distribution': 'uniform', 'extent': [0, 15]},
            },
        },
    }


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, indent=2) + '\n'
    json.loads(text)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


# ---------------------------------------------------------------- preview: our model of each kind
LOG, LEAF = 'log', 'leaf'


class Tree:
    def __init__(self):
        self.v = {}

    def log(self, x, y, z):
        self.v[(x, y, z)] = LOG

    def leaf(self, x, y, z):
        if self.v.get((x, y, z)) != LOG:
            self.v[(x, y, z)] = LEAF


def disk(t, cx, y, cz, r, test):
    for dx in range(-r, r + 1):
        for dz in range(-r, r + 1):
            if test(dx, dz, r):
                t.leaf(cx + dx, y, cz + dz)


def round_test(dx, dz, r):
    return dx * dx + dz * dz <= r * r + r


def no_corner(dx, dz, r):
    return not (r > 0 and abs(dx) == r and abs(dz) == r)


def grow_trunk(t, tk, rnd):
    """Returns the foliage anchor list [(x, top_log_y, z, kind)] after placing logs."""
    k = tk['kind']
    if k == 'trunk':
        h = median(tk['height'])
        for y in range(h):
            t.log(0, y, 0)
        return h, [(0, h - 1, 0)]
    if k == 'acacia':
        h = tk['base'] + sum((i - 1) // 2 for i in tk['intervals'])
        x = z = 0
        lean = tk.get('lean')
        start = h - median(lean['height']) if lean else h
        steps = median(lean['steps']) if lean else 0
        col = {}
        for y in range(h):
            if y >= start and steps > 0:
                x += 1
                steps -= 1
            t.log(x, y, z)
            col[y] = x
        anchors = [(x, h - 1, z)]
        br = tk.get('branch')
        if br:
            by = h - 1 - median(br['position'])
            bx, bz = col[by], 0
            for _ in range(median(br['length'])):
                by += 1
                bx -= 1
                t.log(bx, by, bz)
            anchors.append((bx, by, bz, br['size']))
        return h, anchors
    raise ValueError(k)


def line(t, a, b):
    n = max(abs(b[i] - a[i]) for i in range(3))
    for s in range(n + 1):
        f = s / n if n else 0
        t.log(*(int(round(a[i] + (b[i] - a[i]) * f)) for i in range(3)))


def grow_fancy(t, tk, c, rnd):
    H = tk['base'] + tk['variance'] // 2
    trunk_h = int(H * tk['scale'])
    fh = c['height']
    per_layer = max(1, int(1.382 + (tk['density'] * H / 13.0) ** 2))
    nodes = [((0, H - fh, 0), trunk_h)]

    def layer_size(y):
        if y < H * tk['foliage_altitude']:
            return -1.0
        f1 = H / 2.0
        f2 = f1 - y
        if f2 == 0:
            f3 = f1
        elif abs(f2) >= f1:
            return 0.0
        else:
            f3 = math.sqrt(f1 * f1 - f2 * f2)
        return f3 * 0.5

    for y in range(H - fh - 1, -1, -1):
        ls = layer_size(y)
        if ls < 0:
            continue
        for _ in range(per_layer):
            dist = tk['width_scale'] * ls * (rnd.random() + 0.328)
            ang = rnd.random() * 2 * math.pi
            nx, nz = int(round(dist * math.sin(ang))), int(round(dist * math.cos(ang)))
            if nx == 0 and nz == 0:
                continue
            base_y = min(trunk_h, int(y - math.hypot(nx, nz) * tk['slope']))
            if base_y >= H * tk['min_altitude']:
                nodes.append(((nx, y, nz), base_y))
    for y in range(trunk_h + 1):
        t.log(0, y, 0)
    for (n, base_y) in nodes:
        line(t, (0, base_y, 0), n)
    for (n, _) in nodes:
        for i in range(fh):
            r = c['radius'] - (1 if i in (0, fh - 1) else 0)
            disk(t, n[0], n[1] + i, n[2], r, round_test if r > 1 else no_corner)
    return H


def acacia_head(t, x, y, z, size, rnd):
    disk(t, x, y, z, size, no_corner)
    disk(t, x, y + 1, z, max(size - 1, 0), lambda dx, dz, r: True)


def grow_canopy(t, h, anchors, c, rnd):
    k = c['kind']
    ax, ay, az = anchors[0][:3]
    top = ay + 1  # block above the trunk
    if k == 'random_spread':
        for _ in range(c['attempts']):
            dx = rnd.randrange(c['radius']) - rnd.randrange(c['radius'])
            dy = rnd.randrange(c['height']) - rnd.randrange(c['height'])
            dz = rnd.randrange(c['radius']) - rnd.randrange(c['radius'])
            t.leaf(ax + dx, top + dy, az + dz)
    elif k == 'canopy':
        lo, hi = c['offset']
        for i, oy in enumerate(range(lo, hi + 1)):
            r = 1 + (hi - oy) // 2
            n, d = c['variation'][i]
            for dx in range(-r, r + 1):
                for dz in range(-r, r + 1):
                    if abs(dx) == r and abs(dz) == r and rnd.random() < n / d:
                        continue
                    t.leaf(ax + dx, top + oy, az + dz)
    elif k == 'acacia':
        acacia_head(t, ax, ay, az, c['size'], rnd)
    elif k == 'roofed':
        for i in range(c['height']):
            r = c['outer'] if i in (0, c['height'] - 1) else c['inner']
            disk(t, ax, ay - 1 + i, az, r, round_test)
        disk(t, ax, ay - 1 + c['height'], az, 1, no_corner)  # the occasional cap layer
    elif k == 'mega':
        for i in range(c['height']):
            r = c['radius'] + i
            disk(t, ax, top - i, az, r, lambda dx, dz, r: dx * dx + dz * dz <= r * r)
    elif k == 'spruce':
        lower, upper, R = median(c['lower']), median(c['upper']), median(c['max_radius'])
        total = h  # trunk_height is the overall height; logs stop `upper` below the leaf tip
        for y in range(total - upper, total):
            t.v.pop((0, y, 0), None)
        cur, mx, mn = rnd.randrange(2), 1, 0
        for y in range(total, lower - 1, -1):
            disk(t, ax, y, az, cur, no_corner)
            if cur >= mx:
                cur, mn, mx = mn, 1, min(mx + 1, R)
            else:
                cur += 1
    elif k == 'pine':
        ch, R = median(c['height']), c['radius']
        bottom = top - ch
        cur = 0
        for y in range(top, bottom - 1, -1):
            disk(t, ax, y, az, cur, no_corner)
            if cur >= 1 and y == bottom + 1:
                cur -= 1
            elif cur < R:
                cur += 1
    for a in anchors[1:]:
        acacia_head(t, a[0], a[1], a[2], a[3], rnd)


def build(tid, seed):
    d = TREES[tid]
    rnd = random.Random(seed)
    t = Tree()
    if d['trunk']['kind'] == 'fancy':
        grow_fancy(t, d['trunk'], d['canopy'], rnd)
        return t
    h, anchors = grow_trunk(t, d['trunk'], rnd)
    grow_canopy(t, h, anchors, d['canopy'], rnd)
    return t


# ---------------------------------------------------------------- isometric renderer
PLATE = 4  # ground plate is 9x9 blocks around the trunk
B = 32  # block sprite width; top face is B x B/2
FACES = {  # (output polygon, affine data mapping output px -> 16x16 texture uv)
    'top': ([(16, 0), (32, 8), (16, 16), (0, 8)], (0.5, 1, -8, -0.5, 1, 8)),
    'left': ([(0, 8), (16, 16), (16, 32), (0, 24)], (1, 0, 0, -0.5, 1, -8)),
    'right': ([(16, 16), (32, 8), (32, 24), (16, 32)], (1, 0, -16, 0.5, 1, -24)),
}
SHADE = {'top': 1.06, 'left': 0.80, 'right': 0.62}
_cache = {}


def face_sprite(tex, face):
    key = (id(tex), face)
    if key in _cache:
        return _cache[key][1]
    poly, data = FACES[face]
    pad = Image.new('RGBA', (18, 18))  # 1px replicated border so the polygon outline samples real texels
    pad.paste(tex.resize((18, 18), Image.NEAREST), (0, 0))
    pad.paste(tex, (1, 1))
    a, b, c, d, e, f = data
    spr = pad.transform((B, B), Image.AFFINE, (a, b, c + 1, d, e, f + 1), resample=Image.NEAREST)
    mask = Image.new('L', (B, B), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255, outline=255)
    a = spr.getchannel('A')
    spr.putalpha(Image.composite(a, Image.new('L', (B, B), 0), mask))
    f = SHADE[face]
    r, g, b, a = spr.split()
    lut = [min(255, int(i * f)) for i in range(256)]
    spr = Image.merge('RGBA', (r.point(lut), g.point(lut), b.point(lut), a))
    _cache[key] = (tex, spr)  # keep tex alive so its id is never reused by another texture
    return spr


def load(name):
    return Image.open(os.path.join(TEX, name)).convert('RGBA')


def grass_textures():
    rnd = random.Random(7)
    top = Image.new('RGBA', (16, 16))
    side = Image.new('RGBA', (16, 16))
    greens = [(88, 140, 58), (98, 152, 64), (108, 162, 70), (80, 128, 52)]
    dirt = [(120, 86, 58), (134, 96, 64), (108, 76, 50), (146, 108, 72)]
    for x in range(16):
        for y in range(16):
            top.putpixel((x, y), greens[rnd.randrange(4)] + (255,))
            edge = 3 + (rnd.random() < 0.4)
            side.putpixel((x, y), (greens if y < edge else dirt)[rnd.randrange(4)] + (255,))
    return top, side


def render(tree, tex):
    """tex: dict kind -> (top, side). Returns RGBA image cropped to content."""
    vox = dict(tree.v)
    for x in range(-PLATE, PLATE + 1):
        for z in range(-PLATE, PLATE + 1):
            vox[(x, -1, z)] = 'ground'
    opaque = {LOG, 'ground'}
    pts = sorted(vox, key=lambda p: (p[0] + p[1] + p[2], p[1], p[0]))
    sx = [(p[0] - p[2]) * 16 for p in pts]
    sy = [(p[0] + p[2]) * 8 - p[1] * 16 for p in pts]
    ox, oy = -min(sx), -min(sy)
    img = Image.new('RGBA', (max(sx) + ox + B, max(sy) + oy + B), (0, 0, 0, 0))
    for p, x, y in zip(pts, sx, sy):
        kind = vox[p]
        top, side = tex[kind]
        nb = {'top': (p[0], p[1] + 1, p[2]), 'left': (p[0], p[1], p[2] + 1), 'right': (p[0] + 1, p[1], p[2])}
        for face in ('left', 'right', 'top'):
            if vox.get(nb[face]) in opaque:
                continue
            img.alpha_composite(face_sprite(top if face == 'top' else side, face), (x + ox, y + oy))
    return img


FRUIT = 'fruit'


def fruit_sprite(ramp, banana):
    """A hanging fruit drawn on a transparent 16x16 face: stem from the top, the fruit below it."""
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y in range(0, 3):
        im.putpixel((7, y), (82, 56, 34, 255))
        im.putpixel((8, y), (82, 56, 34, 255))
    x0, x1, y0, y1 = (3, 13, 3, 16) if banana else (3, 13, 3, 13)
    for y in range(y0, y1):
        for x in range(x0, x1):
            edge = x in (x0, x1 - 1) or y in (y0, y1 - 1)
            im.putpixel((x, y), (ramp[1] if edge else ramp[3 if y == y0 + 1 else 2]) + (255,))
    return im, im


def font(size, bold=False):
    for name in (('msjhbd.ttc' if bold else 'msjh.ttc'), 'NotoSansTC-VF.ttf'):
        p = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', name)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    for p in ('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'):
        if os.path.exists(p):  # Linux
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def describe(tid):
    d = TREES[tid]
    tk, c = d['trunk'], d['canopy']
    if tk['kind'] == 'trunk':
        th = '%d–%d' % tk['height']
    elif tk['kind'] == 'acacia':
        th = '%d–%d' % (tk['base'], tk['base'] + sum(i - 1 for i in tk['intervals']))
    else:
        th = '%d–%d' % (tk['base'], tk['base'] + tk['variance'])
    return th, canopy_json(c, '')[0]


def preview():
    log = (load('fruitwood_log_top.png'), load('fruitwood_log.png'))
    banana = load('banana_trunk.png')
    gtop, gside = grass_textures()
    cells = []
    missing = set()
    for i, tid in enumerate(TREE_IDS):
        tree = build(tid, seed=1000 + i)
        logs = (banana, banana) if TREES[tid]['trunk'].get('block') == 'banana_trunk' else log
        try:
            leaf = load(f'{tid}_leaves_bare.png')
        except FileNotFoundError:  # leaves not drawn yet: a stand-in, flagged on the card
            leaf = load(f'{STAND_IN.get(tid, "mandarin")}_leaves_bare.png')
            missing.add(tid)
        tex = {LOG: logs, LEAF: (leaf, leaf), 'ground': (gtop, gside)}
        if tid in fm.TREES:  # fruit blocks hanging under some of the lowest leaves
            tex[FRUIT] = fruit_sprite(fm.TREES[tid][0], tid == 'banana')
            under = sorted(p for p, k in tree.v.items() if k == LEAF and (p[0], p[1] - 1, p[2]) not in tree.v and p[1] > 0)
            for j, p in enumerate(under):
                if (p[0] * 7 + p[2] * 13 + j) % 2 == 0:
                    tree.v[(p[0], p[1] - 1, p[2])] = FRUIT
        ys = [p[1] for p in tree.v]
        cells.append((tid, render(tree, tex), max(ys) + 1))
    cw = max(c[1].width for c in cells) + 24
    ch = max(c[1].height for c in cells) + 70
    cols = 4
    rows = (len(cells) + 1 + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cw, rows * ch + 56), (236, 232, 222, 255))
    dr = ImageDraw.Draw(sheet)
    f1, f2, f3 = font(20, True), font(14), font(24, True)
    dr.text((16, 12), '森羅物語：豐收 — 果樹樹形（結果期：果實垂在葉下，代表樣本）', font=f3, fill=(50, 46, 40))
    for i, (tid, img, height) in enumerate(cells):
        cx, cy = (i % cols) * cw, (i // cols) * ch + 56
        dr.rounded_rectangle((cx + 6, cy + 6, cx + cw - 6, cy + ch - 6), 10, fill=(246, 243, 236), outline=(210, 204, 192))
        sheet.alpha_composite(img, (cx + (cw - img.width) // 2, cy + ch - 64 - img.height))
        th, kind = describe(tid)
        stand = ' · 葉暫用%s' % TREES[STAND_IN.get(tid, 'mandarin')]['zh'] if tid in missing else ''
        dr.text((cx + 16, cy + ch - 58), f"{TREES[tid]['zh']}  {tid}", font=f1, fill=(48, 44, 38))
        dr.text((cx + 16, cy + ch - 32), f'幹 {th} · {kind} · 圖高 {height}{stand}', font=f2, fill=(96, 90, 80))
    i = len(cells)
    cx, cy = (i % cols) * cw, (i // cols) * ch + 56
    notes = ['等角投影：頂面亮、左面 80%、右面 62%', '底板為示意草地（不在樹形內）',
             '每棵取各範圍中位數、固定種子', '遊戲內每次生成都會隨機變化',
             '說明：docs/art/TREE_SHAPES.md']
    for j, s in enumerate(notes):
        dr.text((cx + 20, cy + 30 + j * 26), s, font=f2, fill=(96, 90, 80))
    os.makedirs(os.path.dirname(PREVIEW), exist_ok=True)
    sheet.convert('RGB').save(PREVIEW)


def main():
    for tid in TREE_IDS:
        write_json(os.path.join(FEATURES, f'{tid}_tree_feature.json'), feature_json(tid))
        write_json(os.path.join(RULES, f'{tid}_tree_feature_rule.json'), rule_json(tid))
    preview()
    print('wrote', len(TREE_IDS), 'features and rules (', sum(1 for t in TREE_IDS if not TREES[t]['wild']),
          'never place), preview', PREVIEW)


if __name__ == '__main__':
    main()
