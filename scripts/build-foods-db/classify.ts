// Names, categories and diet for foods. INDB has no category or diet columns, so they are worked
// out from the dish name with keyword rules. Mistakes are fixed in
// data/curated/category_overrides.csv rather than by making these rules ever longer.

import { normalizeText } from '../../src/lib/search';
import type { Diet, Kind } from './types';

// --- INDB names -------------------------------------------------------------------------

/** Top-level bracket groups in a name: "A (b) (c (d))" → ["b", "c (d)"]. */
export function bracketGroups(name: string): { text: string; start: number; end: number }[] {
  const groups: { text: string; start: number; end: number }[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < name.length; i++) {
    if (name[i] === '(') {
      if (depth === 0) start = i;
      depth++;
    } else if (name[i] === ')' && depth > 0) {
      depth--;
      if (depth === 0) groups.push({ text: name.slice(start + 1, i), start, end: i });
    }
  }
  return groups;
}

// Words that only ever appear in INDB's English notes, like "(salted)" or "(with cream)".
const ENGLISH_NOTE_WORDS = new Set(
  (
    'with without fresh juices squashes minced meat mutton chicken pear semolina cream coconut ' +
    'baked curry dry grilled medium salted steamed stirred thick thin toasted vegetarian wet ' +
    'indian english style clear soup puffed rice'
  ).split(' '),
);

/** True for an English note such as "salted" or "with cream"; false for a Hindi name. */
export function isEnglishNote(bracket: string): boolean {
  const words = normalizeText(bracket).split(' ').filter(Boolean);
  return words.length > 0 && words.every((w) => ENGLISH_NOTE_WORDS.has(w));
}

/**
 * Splits an INDB name into an English display name and a Hindi name:
 * "Hot tea (Garam Chai)" → { name: "Hot tea", nameHi: "Garam Chai" }.
 * English notes stay in the name: "Lassi (salted)".
 */
export function splitIndbName(raw: string): { name: string; nameHi: string | null } {
  let name = '';
  let nameHi: string | null = null;
  let last = 0;
  for (const g of bracketGroups(raw)) {
    name += raw.slice(last, g.start);
    const inner = g.text.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (isEnglishNote(inner)) name += `(${inner})`;
    else if (nameHi === null) nameHi = inner;
    last = g.end + 1;
  }
  name += raw.slice(last);
  return { name: name.replace(/\s+/g, ' ').trim(), nameHi };
}

/** Splits "Semiya/Seviyan, Kala chana" into ["Semiya", "Seviyan", "Kala chana"]. */
export function splitAlternatives(text: string): string[] {
  return text
    .split(/[/,]/)
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter((t) => t.length >= 2);
}

// --- IFCT local names -------------------------------------------------------------------

/**
 * Parses IFCT's local-name column: "A. Moricha guti; H. Ramdana; Tam. Keerai vidai."
 * Returns the Hindi names ("H.") and all other regional names separately.
 */
export function parseIfctLocalNames(lang: string): { hindi: string[]; regional: string[] } {
  const hindi: string[] = [];
  const regional: string[] = [];
  for (const part of lang.split(';')) {
    const m = part.trim().match(/^([A-Z][A-Za-z]*)\.\s*(.+)$/);
    if (!m) continue;
    const names = splitAlternatives(m[2].replace(/\.$/, '')).filter((n) => n.length <= 40);
    (m[1] === 'H' ? hindi : regional).push(...names);
  }
  return { hindi, regional };
}

// --- Categories -------------------------------------------------------------------------

type CategoryRule = [category: string, pattern: RegExp];

// Checked top to bottom on the normalised English name; the first match wins. Specific dishes
// come before broad words, e.g. "kadhi" before "pakora" so "Besan kadhi with pakodies" is a curry.
const INDB_CATEGORY_RULES: CategoryRule[] = [
  ['curry', /\bkadhi\b/],
  ['sweet', /\bmilk cake\b/],
  [
    'condiment',
    /\b(pav bhaji masala|garam masala|chat masala|kashmiri masala|rasam powder|sambar powder|spice blend|panch phoran|premix)\b|^(?!.*\bwith\b).*\b(baghar|tadka)$/,
  ],
  ['dish', /\b(cheese|potato|fish|spinach|masala|chicken|paneer)\b[a-z ]*\bsouffle\b/],
  ['sweet', /\bsouffle\b/],
  [
    'beverage',
    /\b(tea|kehwa|(instant|espresso|espreso|cold|hot|steeped) coffee|hot chocolate|hot cocoa|lassi|milkshake|shake|smoothie|juice|sharbat|sherbet|lemonade|cooler|punch|thandai|drink|jal jeera|infused water|mintade|gingo|canjee|kanji|egg nog|lem o gin|saffron milk)\b/,
  ],
  ['soup', /\b(soup|stock|consomme|rasam|shorba|shoraba)\b/],
  ['salad', /\b(salad|raita|coleslaw|aspic|towers)\b/],
  [
    'baked',
    /\b(cakes?|gateau|cookies?|biscuits?|pastry|pastries|tarts?|pies?|flan|puffs|eclairs?|swiss roll|muffins?|buns?|horns|swans|shells|straws|meringue|pavlova|aigrettes|loaf|cheesecake|coconut finger|melting moments|coffee drops|ginger bread)\b/,
  ],
  [
    'sweet',
    /\b(kheer|payasam|halwa|ladoos?|laddoo|laddu|burfi|barfi|gulab jamun|rasgulla|rasmalai|chum chum|dil bahar|rasbhari|rajbogh|malpua|mal pua|shahi tukre|phirni|kulfi|ice cream|sundae|sunday|custard|pudding|mousse|trifle|triffle|shrikhand|rabri|chikki|brittle|gunjia|ghujia|lavang latika|chenna murki|chhena poda|kesari bath|putharekulu|candy|sorbet|fool|whip|bavarian cream|fruit delight|charlotte rousse|snowballs|fudge|dessert|stewed|sweetened|butterscotch|alaska|melba|souffle|orange cream|pineapple cream|banana cream)\b/,
  ],
  [
    'dish',
    /\b(pasta|spaghetti|macaroni|macroni|lasagne|penne|fettuccine|noodles?|chowmein|couscous|casserole|hot pot)\b/,
  ],
  [
    'snack',
    /\b(sandwich|toast|burger|pizza|samosa|kachori|mathri|pakoras?|pakodas?|pakodies|bonda|vadas?|cutlets?|tikki|kebab|kabab|seekh|patties|patty|spring roll|rolls?|chaat|chat|bhel|sev|papdi|murukku|namak paras|chips|namkeen|dhokla|khaman|handvo|muthias|fritters|manchurian|gobi 65|cheese balls|scotch egg|fish finger|nuggets|tikka|shaslik|mixture|jave|khakhra)\b/,
  ],
  [
    'breakfast',
    /\b(idli|dosa|uttapam|pesarattu|upma|poha|porridge|daliya|dalia|cheela|chilla|pancakes?|cornflakes|flakes|murmura|puffed|oatmeal|muesli|granola|khura)\b/,
  ],
  [
    'bread',
    /\b(roti|chapati|phulka|paratha|parantha|poori|puri|naan|bhatura|kulcha|thepla|puranpoli|appam|puttu)\b/,
  ],
  [
    'condiment',
    // "Tomato sauce" is a condiment; "Paneer in butter sauce" is not (it has "in" / "with").
    /\b(chutney|pickle|pickled|achaa?r|ketchup|dressing|mayonnaise|dip|icing|frosting|marmalade|murabba|squash|preserves|jam|jelly|filling|puree)\b|^(?!.*\b(in|with)\b).*\bsauce$/,
  ],
  ['curry', /\b(curry|korma|koftas?|masala|yakhni|stew|jalfrezi|do piaza|do pyaza|lababdar)\b/],
  ['egg', /\b(eggs?|omelettes?|omlet|anda|ande)\b/],
  [
    'rice_dish',
    /\b(rice|pulao|pulav|biryani|biriyani|khichdi|khichri|khitchdi|tahar|bhat|bhaat|chawal)\b/,
  ],
  [
    'dish',
    /\b(tandoori|roast|roasted|fried|fry|grilled|baked|chops|cajun|afghani|orly|fillet|stuffed|musallam|au gratin|fricassee|nests?|basket)\b/,
  ],
  [
    'dal',
    /\b(dal|daal|dhal|sambar|dalma|dhansak|rajmah|rajma|chana|channa|chane|chole|lobia|moong|urad|masoor|moth|arhar|toor|kulthi|lentils?|chickpeas?|kidney beans?|black beans|soyabean|gatte|dhokli|(green|bengal|black|red|horse) gram)\b/,
  ],
  [
    'curry',
    /\b(sabzi|sabji|subji|paneer|palak|aloo|gobhi|gobi|bhindi|okra|baingan|brinjal|bhartha|bharta|saag|sag|josh|methi|matar|mutter|avial|thoran|foogath|bhujia|dum|chaman|arbi|kathal|jackfruit|keema|mushroom|capsicum|karela|bittergourd|tinde|ghiya|lauki|yam|potato|potatoes|cauliflower|cabbage|spinach|vegetables?|chicken|mutton|fish|prawn|lamb|meat|peas|beans|radish|pumpkin|fenugreek|turnip|papaya|bhaji)\b/,
  ],
];

/** Category for an INDB dish, from its English name (brackets removed). */
export function indbCategory(englishName: string): string {
  const text = normalizeText(englishName.replace(/\([^)]*\)/g, ' '));
  for (const [category, pattern] of INDB_CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  return 'dish';
}

const IFCT_GROUP_CATEGORY: Record<string, string> = {
  'Cereals and Millets': 'cereal',
  'Grain Legumes': 'pulse',
  'Green Leafy Vegetables': 'leafy_veg',
  'Other Vegetables': 'vegetable',
  Fruits: 'fruit',
  'Roots and Tubers': 'root_tuber',
  'Condiments and Spices': 'spice',
  'Nuts and Oil Seeds': 'nuts_seeds',
  Sugars: 'sugar',
  Mushrooms: 'mushroom',
  'Miscellaneous Foods': 'beverage',
  'Milk and Milk Products': 'dairy',
  'Egg and Egg Products': 'egg',
  Poultry: 'poultry',
  'Animal Meat': 'meat',
  'Marine Fish': 'fish',
  'Fresh Water Fish and Shellfish': 'fish',
  'Marine Shellfish': 'fish',
  'Marine Mollusks': 'fish',
  'Edible Oils and Fats': 'oil_fat',
};

/** Category for an IFCT food. IFCT files fresh onion and herbs under spices; those are fixed here. */
export function ifctCategory(group: string, name: string): string {
  const text = normalizeText(name);
  if (/\bjuice\b/.test(text)) return 'beverage';
  const category = IFCT_GROUP_CATEGORY[group] ?? 'misc';
  if (category === 'spice') {
    if (/\bonion\b/.test(text)) return 'vegetable';
    if (/\bleaves\b/.test(text)) return 'leafy_veg';
  }
  return category;
}

const USDA_CATEGORY: Record<string, string> = {
  'Dairy and Egg Products': 'dairy',
  'Spices and Herbs': 'spice',
  'Fats and Oils': 'oil_fat',
  'Poultry Products': 'poultry',
  'Soups, Sauces, and Gravies': 'soup',
  'Sausages and Luncheon Meats': 'meat',
  'Breakfast Cereals': 'cereal',
  'Fruits and Fruit Juices': 'fruit',
  'Pork Products': 'meat',
  'Vegetables and Vegetable Products': 'vegetable',
  'Nut and Seed Products': 'nuts_seeds',
  'Beef Products': 'meat',
  Beverages: 'beverage',
  'Finfish and Shellfish Products': 'fish',
  'Legumes and Legume Products': 'pulse',
  'Lamb, Veal, and Game Products': 'meat',
  'Baked Products': 'baked',
  Sweets: 'sweet',
  'Cereal Grains and Pasta': 'cereal',
  'Fast Foods': 'dish',
  'Meals, Entrees, and Side Dishes': 'dish',
  Snacks: 'snack',
  'Alcoholic Beverages': 'beverage',
};

/** USDA categories left out of foods.db: not useful for this app. */
export const USDA_EXCLUDED_CATEGORIES = new Set([
  'Baby Foods',
  'American Indian/Alaska Native Foods',
  'Quality Control Materials',
  'Branded Food Products Database',
  'Restaurant Foods',
]);

/** Category and kind for a USDA food. */
export function usdaCategory(
  usdaCategoryName: string,
  name: string,
): { category: string; kind: Kind } {
  const text = normalizeText(name);
  let category = USDA_CATEGORY[usdaCategoryName] ?? 'misc';
  if (category === 'fruit' && /\b(juice|nectar|drink)\b/.test(text)) category = 'beverage';
  // Drink powders and mixes are weighed, not poured: no glass for "coffee, instant, powder".
  if (category === 'beverage' && /\b(powder|dry|mix|granules|crystals)\b/.test(text))
    category = 'misc';
  if (category === 'dairy' && /^eggs?\b/.test(text)) category = 'egg';
  if (category === 'soup' && /\b(sauce|gravy|dip|salsa)\b/.test(text)) category = 'condiment';
  if (category === 'oil_fat' && /\b(dressing|mayonnaise)\b/.test(text)) category = 'condiment';
  const kind: Kind = ['dish', 'soup'].includes(category) ? 'dish' : 'ingredient';
  return { category, kind };
}

// --- Diet -------------------------------------------------------------------------------

const VEGETARIAN_MARK = /\b(vegetarian|vegeterian|eggless|egg less|without eggs?)\b/;
const NONVEG_WORDS =
  /\b(chicken|mutton|lamb|goat|meat|meats|keema|kheema|fish|prawns?|shrimps?|crab|lobster|salami|ham|bacon|sausages?|beef|pork|gushtaba|josh|machli|jhinga|boti|meat ?balls?|nargisi|tuna|salmon|anchovy|anchovies|brown stock|white stock|mixed stock|meat stock|mulligatawny|chops|liver|consomme|turkey|veal|venison|bison|duck|goose|lard|tallow|gelatin|clams?|oysters?|squid|octopus|scallops?|mussels?|cod|sardines?|herring|mackerel|trout|catfish|pollock|tilapia|haddock|halibut|frankfurter|pepperoni|bologna|broth|anchovies)\b/;
const EGG_WORDS =
  /\b(eggs?|omelettes?|omlet|anda|ande|meringue|pavlova|mayonnaise|souffles?|choux|eclairs?|swans|aigrettes|custard)\b/;
const MAYBE_EGG_WORDS =
  /\b(cakes?|gateau|pastry|pastries|cookies?|biscuits?|pancakes?|puddings?|mousse|muffins?|sponge|swiss roll|tarts?|pies?|flan|puffs|horns|buns?|ice cream|waffles?|doughnuts?|brownies?|noodles)\b/;

/**
 * Veg / egg / non-veg from a food's name. Returns `null` when the name alone can't tell
 * (a cake may or may not contain egg). Anything marked vegetarian or eggless is veg.
 */
export function dietFromName(fullName: string): Diet | null {
  const text = normalizeText(fullName);
  if (VEGETARIAN_MARK.test(text)) return 'veg';
  if (NONVEG_WORDS.test(text)) return 'nonveg';
  if (EGG_WORDS.test(text)) return 'egg';
  if (MAYBE_EGG_WORDS.test(text)) return null;
  return 'veg';
}

/** IFCT tags such as "vegetarian eggetarian fishetarian veg" → diet. */
export function dietFromIfctTags(tags: string, category: string): Diet {
  if (/\bveg\b/.test(tags) && !/\bnonveg\b/.test(tags)) return 'veg';
  return category === 'egg' ? 'egg' : 'nonveg';
}

const NONVEG_CATEGORIES = new Set(['meat', 'poultry', 'fish']);

/** Diet for a USDA food: meat, poultry and fish categories are non-veg; otherwise by name. */
export function usdaDiet(category: string, name: string): Diet | null {
  if (NONVEG_CATEGORIES.has(category)) return 'nonveg';
  if (category === 'egg') return 'egg';
  return dietFromName(name);
}
