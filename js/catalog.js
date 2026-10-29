// Kategorie-Katalog – hier neue Kleidungsstücke ergänzen oder Werte anpassen.
//
// slot:      Gruppe im Schrank; base/bottom/shoes braucht jedes Outfit
// layer:     nur Oberteile – Schicht von innen (1) nach außen. Ein Teil kann nur über Teilen
//            mit kleinerer Zahl getragen werden; gleiche Zahl = nicht übereinander kombinierbar.
// over:      Teil braucht direkt darunter eines dieser Teile (z. B. Pullunder über Hemd)
// notOver:   Teil wird nicht über diesen Teilen getragen (z. B. dicke Jacke nicht über leichter Jacke)
// warmth:    grobe Wärmepunkte; die Summe eines Outfits wird mit der Temperatur verglichen
// formality: 1 = sportlich … 5 = elegant; große Sprünge innerhalb eines Outfits kosten Punkte
// neutral:   true = zählt farblich immer als neutral (z. B. Denim)
// minTemp / maxTemp: Accessoires nur bei passender Temperatur vorschlagen
// prompts:   englische Beschreibungen für die Bilderkennung (CLIP). Teile, die die Erkennung
//            nicht zuverlässig unterscheidet, sind zu einer Kategorie mit mehreren Prompts zusammengefasst.

export const SLOTS = {
  outer:     { label: 'Jacken & Westen' },
  mid:       { label: 'Pullis & Mittelschicht' },
  base:      { label: 'Shirts & Hemden', required: true },
  bottom:    { label: 'Hosen', required: true },
  shoes:     { label: 'Schuhe', required: true },
  accessory: { label: 'Accessoires' },
};

export const CATEGORIES = [
  { id: 'longsleeve',  label: 'Langarmshirt',          slot: 'base',   layer: 1,   warmth: 1.5, formality: 2,   prompts: ['a long sleeve t-shirt'] },
  { id: 'tshirt',      label: 'T-Shirt (kurzarm)',     slot: 'base',   layer: 2,   warmth: 1,   formality: 1,   prompts: ['a short sleeve t-shirt'] },
  { id: 'shirtpolo',   label: 'Hemd / Polo',           slot: 'base',   layer: 3,   warmth: 1.5, formality: 3.5, prompts: ['a button-up shirt', 'a polo shirt with a collar'] },

  { id: 'knitvest',    label: 'Pullunder / Strickweste', slot: 'mid',  layer: 5,   warmth: 1,   formality: 3,   over: ['longsleeve', 'shirtpolo'], prompts: ['a sleeveless knitted sweater vest'] },
  { id: 'pullover',    label: 'Pulli / Sweater / Strickjacke', slot: 'mid', layer: 5, warmth: 2.5, formality: 2.5, prompts: ['a knitted wool sweater', 'a crewneck sweatshirt', 'a knitted cardigan with buttons'] },
  { id: 'hoodie',      label: 'Hoodie',                slot: 'mid',    layer: 5,   warmth: 2.5, formality: 1,   prompts: ['a hoodie with a hood'] },

  { id: 'lightjacket', label: 'Leichte Jacke',         slot: 'outer',  layer: 7,   warmth: 2,   formality: 2,   prompts: ['a light thin jacket'] },
  { id: 'blazer',      label: 'Sakko / Blazer',        slot: 'outer',  layer: 7,   warmth: 1.5, formality: 5,   prompts: ['a tailored blazer'] },
  { id: 'gilet',       label: 'Steppweste',            slot: 'outer',  layer: 7.5, warmth: 1.5, formality: 2,   notOver: ['blazer'], prompts: ['a sleeveless quilted puffer vest'] },
  { id: 'heavyjacket', label: 'Dicke Jacke',           slot: 'outer',  layer: 8,   warmth: 3.5, formality: 2,   notOver: ['lightjacket', 'gilet', 'blazer'], prompts: ['a thick padded winter jacket'] },
  { id: 'coat',        label: 'Mantel',                slot: 'outer',  layer: 8,   warmth: 3.5, formality: 4,   notOver: ['lightjacket', 'gilet'], prompts: ['a long wool coat'] },

  { id: 'jeans',       label: 'Jeans',                 slot: 'bottom', warmth: 1,   formality: 2,   neutral: true, prompts: ['denim jeans'] },
  { id: 'chino',       label: 'Chino / Stoffhose',     slot: 'bottom', warmth: 1,   formality: 3.5, prompts: ['chino trousers', 'formal dress trousers'] },
  { id: 'joggers',     label: 'Jogginghose',           slot: 'bottom', warmth: 1,   formality: 1,   prompts: ['jogging sweatpants'] },
  { id: 'shorts',      label: 'Shorts',                slot: 'bottom', warmth: 0,   formality: 1,   prompts: ['short pants'] },

  { id: 'sneaker',     label: 'Sneaker',               slot: 'shoes',  warmth: 0,   formality: 2,   prompts: ['sneakers'] },
  { id: 'leathershoe', label: 'Lederschuhe',           slot: 'shoes',  warmth: 0,   formality: 5,   prompts: ['leather dress shoes'] },
  { id: 'boots',       label: 'Boots',                 slot: 'shoes',  warmth: 0.5, formality: 3,   prompts: ['leather boots'] },

  { id: 'belt',        label: 'Gürtel',                slot: 'accessory', warmth: 0,   formality: 3, prompts: ['a leather belt'] },
  { id: 'watch',       label: 'Uhr',                   slot: 'accessory', warmth: 0,   formality: 3, prompts: ['a wristwatch'] },
  { id: 'cap',         label: 'Cap',                   slot: 'accessory', warmth: 0,   formality: 1, minTemp: 15, prompts: ['a baseball cap'] },
  { id: 'beanie',      label: 'Mütze',                 slot: 'accessory', warmth: 0.5, formality: 1, maxTemp: 8, prompts: ['a knitted beanie hat'] },
  { id: 'scarf',       label: 'Schal',                 slot: 'accessory', warmth: 0.5, formality: 3, maxTemp: 8, prompts: ['a scarf'] },
];

export const CATEGORY = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
