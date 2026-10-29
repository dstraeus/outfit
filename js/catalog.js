// Kategorie-Katalog – hier neue Kleidungsstücke ergänzen oder Werte anpassen.
//
// slot:      Rolle im Outfit; base/bottom/shoes braucht jedes Outfit. label = Gruppe im Schrank
// layer:     nur Oberteile – Schicht von innen (1) nach außen. Ein Teil kann nur über Teilen
//            mit kleinerer Zahl getragen werden; gleiche Zahl = nicht übereinander kombinierbar.
// over:      Teil braucht direkt darunter eines dieser Teile
// notOver:   Teil wird nicht über diesen Teilen getragen (z. B. Winterjacke nicht über Jacke)
// warmth:    grobe Wärmepunkte; die Summe eines Outfits wird mit der Temperatur verglichen
// formality: 1 = sportlich … 5 = elegant; große Sprünge innerhalb eines Outfits kosten Punkte
// neutral:   true = zählt farblich immer als neutral (z. B. Denim)
// minTemp / maxTemp: Accessoires nur bei passender Temperatur vorschlagen
// prompts:   englische Beschreibungen für die Bilderkennung (CLIP). Ähnliche Teile, die man
//            gleich kombiniert, sind eine Kategorie mit mehreren Prompts.

export const SLOTS = {
  base:      { label: 'Oberteile', required: true },
  mid:       { label: 'Oberteile' },
  outer:     { label: 'Jacken' },
  bottom:    { label: 'Hosen', required: true },
  shoes:     { label: 'Schuhe', required: true },
  accessory: { label: 'Accessoires' },
};

export const CATEGORIES = [
  { id: 'tshirt',      label: 'T-Shirt',     slot: 'base',   layer: 2,   warmth: 1,   formality: 1,   prompts: ['a short sleeve t-shirt'] },
  { id: 'longsleeve',  label: 'Longsleeve',  slot: 'base',   layer: 1,   warmth: 1.5, formality: 2,   prompts: ['a long sleeve t-shirt'] },
  { id: 'shirtpolo',   label: 'Hemd/Polo',   slot: 'base',   layer: 3,   warmth: 1.5, formality: 3.5, prompts: ['a button-up shirt', 'a polo shirt with a collar'] },
  { id: 'pullover',    label: 'Pullover',    slot: 'mid',    layer: 5,   warmth: 2.5, formality: 2,
    prompts: ['a knitted wool sweater', 'a crewneck sweatshirt', 'a hoodie with a hood', 'a knitted cardigan with buttons', 'a sleeveless knitted sweater vest'] },

  { id: 'lightjacket', label: 'Jacke',       slot: 'outer',  layer: 7,   warmth: 2,   formality: 2,   prompts: ['a light thin jacket', 'a denim jacket'] },
  { id: 'blazer',      label: 'Sakko',       slot: 'outer',  layer: 7,   warmth: 1.5, formality: 5,   prompts: ['a tailored blazer'] },
  { id: 'gilet',       label: 'Weste',       slot: 'outer',  layer: 7.5, warmth: 1.5, formality: 2,   notOver: ['blazer'], prompts: ['a sleeveless quilted puffer vest'] },
  { id: 'heavyjacket', label: 'Winterjacke', slot: 'outer',  layer: 8,   warmth: 3.5, formality: 3,   notOver: ['lightjacket', 'gilet'], prompts: ['a thick padded winter jacket', 'a long wool coat'] },

  { id: 'jeans',       label: 'Jeans',       slot: 'bottom', warmth: 1,   formality: 2,   neutral: true, prompts: ['denim jeans'] },
  { id: 'chino',       label: 'Stoffhose',   slot: 'bottom', warmth: 1,   formality: 3.5, prompts: ['chino trousers', 'formal dress trousers'] },
  { id: 'joggers',     label: 'Jogginghose', slot: 'bottom', warmth: 1,   formality: 1,   prompts: ['jogging sweatpants'] },
  { id: 'shorts',      label: 'Shorts',      slot: 'bottom', warmth: 0,   formality: 1,   prompts: ['short pants'] },

  { id: 'sneaker',     label: 'Sneaker',     slot: 'shoes',  warmth: 0,   formality: 2,   prompts: ['sneakers'] },
  { id: 'leathershoe', label: 'Lederschuhe', slot: 'shoes',  warmth: 0,   formality: 5,   prompts: ['leather dress shoes'] },
  { id: 'boots',       label: 'Boots',       slot: 'shoes',  warmth: 0.5, formality: 3,   prompts: ['leather boots'] },

  { id: 'belt',        label: 'Gürtel',      slot: 'accessory', warmth: 0,   formality: 3, prompts: ['a leather belt'] },
  { id: 'watch',       label: 'Uhr',         slot: 'accessory', warmth: 0,   formality: 3, prompts: ['a wristwatch'] },
  { id: 'cap',         label: 'Cap',         slot: 'accessory', warmth: 0,   formality: 1, minTemp: 15, prompts: ['a baseball cap'] },
  { id: 'beanie',      label: 'Mütze',       slot: 'accessory', warmth: 0.5, formality: 1, maxTemp: 8, prompts: ['a knitted beanie hat'] },
  { id: 'scarf',       label: 'Schal',       slot: 'accessory', warmth: 0.5, formality: 3, maxTemp: 8, prompts: ['a scarf'] },
];

export const CATEGORY = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// Frühere Kategorien, die inzwischen zusammengelegt sind (gespeicherte Teile werden beim Laden umgeschrieben).
export const CATEGORY_ALIASES = {
  hoodie: 'pullover', knitvest: 'pullover', sweater: 'pullover', cardigan: 'pullover',
  coat: 'heavyjacket', shirt: 'shirtpolo', polo: 'shirtpolo', trousers: 'chino',
};
