// ─────────────────────────────────────────────────────────────
// 25 Miles — Category Taxonomy
// ─────────────────────────────────────────────────────────────

export type CategoryCode =
  // Manufacturers
  | "MFR_STONE"
  | "MFR_TIMBER"
  | "MFR_BRICK"
  | "MFR_SLATE"
  | "MFR_REED"
  | "MFR_NATURAL_INSULATION"
  | "MFR_OTHER_NATURAL"
  | "MFR_RECLAMATION"
  | "MFR_NATURAL_PAINTS"
  | "MFR_OTHER"
  // Suppliers
  | "SUP_STONE"
  | "SUP_TIMBER"
  | "SUP_BRICK"
  | "SUP_SLATE"
  | "SUP_LIME"
  | "SUP_NATURAL_INSULATION"
  | "SUP_GLAZING"
  | "SUP_OTHER_NATURAL"
  | "SUP_RECLAMATION"
  // Craftspeople
  | "CRAFT_STONEMASON"
  | "CRAFT_JOINER"
  | "CRAFT_TIMBER_FRAMER"
  | "CRAFT_LIME_PLASTERER"
  | "CRAFT_GLAZER"
  | "CRAFT_LEADWORKER"
  | "CRAFT_BLACKSMITH"
  // Contractors & Specialists
  | "TRADE_CONTRACTOR"
  | "TRADE_ROOFER"
  | "SPEC_SIPS_CLT"
  | "SPEC_STRAWBALE"
  | "SPEC_RAMMED_EARTH"
  // Heritage Crafts
  | "HERITAGE_STONEWORK"
  | "HERITAGE_GLAZING"
  | "HERITAGE_TILING"
  | "HERITAGE_METALWORK"
  | "HERITAGE_PLASTERWORK"
  | "HERITAGE_THATCH"
  | "HERITAGE_WOODWORK"
  | "HERITAGE_GILDING"
  | "HERITAGE_TEXTILE"
  | "HERITAGE_CERAMICS"

export type GroupKey = "manufacturers" | "suppliers" | "craftspeople" | "contractors" | "heritage"

export interface CategoryDefinition {
  code: CategoryCode
  label: string
  group: GroupKey
  searchQuery: string // Tavily search query fragment
}

export interface GroupDefinition {
  key: GroupKey
  label: string
  colour: string // hex
  dotColour: string // CSS custom property reference
}

export const GROUPS: GroupDefinition[] = [
  {
    key: "manufacturers",
    label: "Manufacturers",
    colour: "#4a7c59",
    dotColour: "var(--color-manufacturers)",
  },
  {
    key: "suppliers",
    label: "Suppliers",
    colour: "#c8831a",
    dotColour: "var(--color-suppliers)",
  },
  {
    key: "craftspeople",
    label: "Craftspeople",
    colour: "#b85c38",
    dotColour: "var(--color-craftspeople)",
  },
  {
    key: "contractors",
    label: "Contractors & Specialists",
    colour: "#4a6fa5",
    dotColour: "var(--color-contractors)",
  },
  {
    key: "heritage",
    label: "Heritage Crafts",
    colour: "#7a2d3e",
    dotColour: "var(--color-heritage)",
  },
]

export const CATEGORIES: CategoryDefinition[] = [
  // ── Manufacturers ──────────────────────────────────────────
  {
    code: "MFR_STONE",
    label: "Stone (quarries)",
    group: "manufacturers",
    searchQuery: "stone quarry natural stone manufacturer",
  },
  {
    code: "MFR_TIMBER",
    label: "Timber sources",
    group: "manufacturers",
    searchQuery: "sustainable timber supplier sawmill woodland",
  },
  {
    code: "MFR_BRICK",
    label: "Brickworks",
    group: "manufacturers",
    searchQuery: "brickworks brick manufacturer handmade brick",
  },
  {
    code: "MFR_SLATE",
    label: "Slate quarries",
    group: "manufacturers",
    searchQuery: "slate quarry natural roofing slate",
  },
  {
    code: "MFR_REED",
    label: "Reed / thatching",
    group: "manufacturers",
    searchQuery: "water reed thatching material supplier",
  },
  {
    code: "MFR_NATURAL_INSULATION",
    label: "Natural insulation",
    group: "manufacturers",
    searchQuery: "natural insulation manufacturer sheep wool hemp flax",
  },
  {
    code: "MFR_OTHER_NATURAL",
    label: "Other natural materials",
    group: "manufacturers",
    searchQuery: "natural building materials manufacturer local",
  },
  {
    code: "MFR_RECLAMATION",
    label: "Reclamation yards",
    group: "manufacturers",
    searchQuery: "architectural reclamation salvage yard reclaimed materials",
  },
  {
    code: "MFR_NATURAL_PAINTS",
    label: "Natural paints & finishes",
    group: "manufacturers",
    searchQuery: "natural paints lime wash earth pigment manufacturer",
  },
  {
    code: "MFR_OTHER",
    label: "Other manufacturers",
    group: "manufacturers",
    searchQuery: "local building material manufacturer",
  },

  // ── Suppliers ──────────────────────────────────────────────
  {
    code: "SUP_STONE",
    label: "Stone suppliers",
    group: "suppliers",
    searchQuery: "natural stone supplier masonry stone yard",
  },
  {
    code: "SUP_TIMBER",
    label: "Timber suppliers",
    group: "suppliers",
    searchQuery: "structural timber supplier oak frame hardwood",
  },
  {
    code: "SUP_BRICK",
    label: "Brick suppliers",
    group: "suppliers",
    searchQuery: "brick supplier builders merchant reclaimed brick",
  },
  {
    code: "SUP_SLATE",
    label: "Slate suppliers",
    group: "suppliers",
    searchQuery: "roofing slate supplier natural slate",
  },
  {
    code: "SUP_LIME",
    label: "Lime & mortars",
    group: "suppliers",
    searchQuery: "lime mortar hydraulic lime supplier",
  },
  {
    code: "SUP_NATURAL_INSULATION",
    label: "Natural insulation",
    group: "suppliers",
    searchQuery: "sheep wool insulation natural insulation supplier",
  },
  {
    code: "SUP_GLAZING",
    label: "Glazing",
    group: "suppliers",
    searchQuery: "heritage glazing secondary glazing traditional windows",
  },
  {
    code: "SUP_OTHER_NATURAL",
    label: "Other natural suppliers",
    group: "suppliers",
    searchQuery: "natural building materials supplier",
  },
  {
    code: "SUP_RECLAMATION",
    label: "Reclaimed materials",
    group: "suppliers",
    searchQuery: "reclaimed building materials salvage reclamation",
  },

  // ── Craftspeople ───────────────────────────────────────────
  {
    code: "CRAFT_STONEMASON",
    label: "Stonemasons",
    group: "craftspeople",
    searchQuery: "stonemason stone carver masonry craftsperson",
  },
  {
    code: "CRAFT_JOINER",
    label: "Joiners / carpenters",
    group: "craftspeople",
    searchQuery: "joiner carpenter traditional woodwork craftsperson",
  },
  {
    code: "CRAFT_TIMBER_FRAMER",
    label: "Timber framers",
    group: "craftspeople",
    searchQuery: "oak frame timber framer green oak carpenter",
  },
  {
    code: "CRAFT_LIME_PLASTERER",
    label: "Lime plasterers",
    group: "craftspeople",
    searchQuery: "lime plasterer traditional plaster specialist",
  },
  {
    code: "CRAFT_GLAZER",
    label: "Glaziers",
    group: "craftspeople",
    searchQuery: "heritage glazier leaded lights stained glass craftsperson",
  },
  {
    code: "CRAFT_LEADWORKER",
    label: "Lead workers",
    group: "craftspeople",
    searchQuery: "lead worker leadwork heritage roofing craftsperson",
  },
  {
    code: "CRAFT_BLACKSMITH",
    label: "Blacksmiths",
    group: "craftspeople",
    searchQuery: "blacksmith ironwork architectural metalwork",
  },

  // ── Contractors & Specialists ──────────────────────────────
  {
    code: "TRADE_CONTRACTOR",
    label: "Local contractors",
    group: "contractors",
    searchQuery: "local building contractor traditional construction",
  },
  {
    code: "TRADE_ROOFER",
    label: "Roofers",
    group: "contractors",
    searchQuery: "traditional roofing contractor heritage slater tiler",
  },
  {
    code: "SPEC_SIPS_CLT",
    label: "SIPs / CLT specialists",
    group: "contractors",
    searchQuery: "structural insulated panels cross laminated timber specialist",
  },
  {
    code: "SPEC_STRAWBALE",
    label: "Strawbale specialists",
    group: "contractors",
    searchQuery: "strawbale construction specialist natural building",
  },
  {
    code: "SPEC_RAMMED_EARTH",
    label: "Rammed earth",
    group: "contractors",
    searchQuery: "rammed earth cob earthen construction specialist",
  },

  // ── Heritage Crafts ────────────────────────────────────────
  {
    code: "HERITAGE_STONEWORK",
    label: "Stonemasonry & stone carving",
    group: "heritage",
    searchQuery: "heritage stonemason stone carver traditional masonry craftsman",
  },
  {
    code: "HERITAGE_GLAZING",
    label: "Stained glass & leaded lights",
    group: "heritage",
    searchQuery: "stained glass maker leaded lights heritage glazier traditional craft",
  },
  {
    code: "HERITAGE_TILING",
    label: "Encaustic & decorative tiling",
    group: "heritage",
    searchQuery: "encaustic tile maker decorative heritage Victorian tile craftsman",
  },
  {
    code: "HERITAGE_METALWORK",
    label: "Traditional metalwork",
    group: "heritage",
    searchQuery: "bell founder heritage metalwork traditional ironwork blacksmith craftsman",
  },
  {
    code: "HERITAGE_PLASTERWORK",
    label: "Ornamental plasterwork",
    group: "heritage",
    searchQuery: "ornamental plasterer fibrous plaster heritage decorative plasterwork",
  },
  {
    code: "HERITAGE_THATCH",
    label: "Regional thatching traditions",
    group: "heritage",
    searchQuery: "master thatcher regional thatching tradition water reed long straw combed wheat",
  },
  {
    code: "HERITAGE_WOODWORK",
    label: "Woodcarving & traditional joinery",
    group: "heritage",
    searchQuery: "woodcarver heritage joinery traditional woodwork craftsman green woodworking",
  },
  {
    code: "HERITAGE_GILDING",
    label: "Gilding & traditional signwriting",
    group: "heritage",
    searchQuery: "traditional gilder gold leaf gilding signwriter heritage craftsman",
  },
  {
    code: "HERITAGE_TEXTILE",
    label: "Historic textiles & upholstery",
    group: "heritage",
    searchQuery: "historic textile conservator traditional upholstery heritage fabric interior craftsman",
  },
  {
    code: "HERITAGE_CERAMICS",
    label: "Traditional ceramics & tilework",
    group: "heritage",
    searchQuery: "heritage potter hand made brick tile traditional ceramics craftsman local",
  },
]

export const CATEGORY_MAP: Record<CategoryCode, CategoryDefinition> = Object.fromEntries(
  CATEGORIES.map((c) => [c.code, c])
) as Record<CategoryCode, CategoryDefinition>

export function getGroupColour(group: GroupKey): string {
  return GROUPS.find((g) => g.key === group)?.colour ?? "#666"
}

export function categoriesByGroup(): Record<GroupKey, CategoryDefinition[]> {
  const result: Record<GroupKey, CategoryDefinition[]> = {
    manufacturers: [],
    suppliers: [],
    craftspeople: [],
    contractors: [],
    heritage: [],
  }
  for (const cat of CATEGORIES) {
    result[cat.group].push(cat)
  }
  return result
}
