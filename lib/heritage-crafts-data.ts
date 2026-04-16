// HCA Red List reference data — curated to building and decorative crafts only
// Source: Heritage Crafts Association Red List (heritagecrafts.org.uk)

export type HeritageCraftRisk =
  | 'CRITICALLY_ENDANGERED'
  | 'ENDANGERED'
  | 'CULTURALLY_DISTINCTIVE'
  | 'RESURGENT'

export interface HeritageCraft {
  name: string
  risk: HeritageCraftRisk
}

export const HERITAGE_CRAFTS: HeritageCraft[] = [
  // Critically Endangered
  { name: 'Encaustic tile making', risk: 'CRITICALLY_ENDANGERED' },
  { name: 'Bell founding', risk: 'CRITICALLY_ENDANGERED' },
  { name: 'Traditional gilding', risk: 'CRITICALLY_ENDANGERED' },
  { name: 'Gold beating', risk: 'CRITICALLY_ENDANGERED' },
  { name: 'Traditional signwriting', risk: 'CRITICALLY_ENDANGERED' },
  { name: 'Fibrous plaster making', risk: 'CRITICALLY_ENDANGERED' },
  { name: 'Decorative ironwork', risk: 'CRITICALLY_ENDANGERED' },
  // Endangered
  { name: 'Stained glass window making', risk: 'ENDANGERED' },
  { name: 'Leaded lights making', risk: 'ENDANGERED' },
  { name: 'Ornamental plasterwork', risk: 'ENDANGERED' },
  { name: 'Traditional stonemasonry', risk: 'ENDANGERED' },
  { name: 'Stone carving', risk: 'ENDANGERED' },
  { name: 'Organ building', risk: 'ENDANGERED' },
  { name: 'Traditional woodcarving', risk: 'ENDANGERED' },
  { name: 'Green woodworking', risk: 'ENDANGERED' },
  { name: 'Traditional upholstery', risk: 'ENDANGERED' },
  { name: 'Historic textile conservation', risk: 'ENDANGERED' },
  { name: 'Traditional wallpaper making', risk: 'ENDANGERED' },
  { name: 'Chair caning and rushing', risk: 'ENDANGERED' },
  { name: 'Marquetry and parquetry', risk: 'ENDANGERED' },
  { name: 'Traditional tile making', risk: 'ENDANGERED' },
  { name: 'Brick making (hand made)', risk: 'ENDANGERED' },
  { name: 'Leadwork (decorative)', risk: 'ENDANGERED' },
  // Culturally Distinctive
  { name: 'Water reed thatching', risk: 'CULTURALLY_DISTINCTIVE' },
  { name: 'Long straw thatching', risk: 'CULTURALLY_DISTINCTIVE' },
  { name: 'Combed wheat reed thatching', risk: 'CULTURALLY_DISTINCTIVE' },
  { name: 'Fair Isle knitting', risk: 'CULTURALLY_DISTINCTIVE' },
  { name: 'Harris tweed weaving', risk: 'CULTURALLY_DISTINCTIVE' },
  // Resurgent
  { name: 'Hazel coppicing and products', risk: 'RESURGENT' },
  { name: 'Charcoal burning', risk: 'RESURGENT' },
]

export const HERITAGE_CRAFT_LIST_FOR_PROMPT = HERITAGE_CRAFTS.map(
  (c) => `- ${c.name} [${c.risk}]`
).join('\n')
