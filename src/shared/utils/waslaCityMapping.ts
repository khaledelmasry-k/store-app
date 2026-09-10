// Shared Wasla city alias table — mirrors functions/src/shipping/wasla.ts
// Used by Checkout to deterministically map Matjari cities to Wasla provider IDs
// without fuzzy matching. Keep both files in sync when adding aliases.

function normalized(value: unknown): string {
  return String(value || '').trim().toLocaleLowerCase('ar-EG')
    .replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[\s\-_/]+/g, '').replace(/^ال/, '')
}

// Keep in sync with functions/src/shipping/wasla.ts WASLA_CITY_ALIASES
export const WASLA_CITY_ALIASES: Record<string, string> = {
  [normalized('العجمي')]: 'أجami',
  [normalized('كرموز')]: 'كارموز',
  [normalized('بدر')]: 'مدينة بدر',
  [normalized('15 مايو')]: 'مدينة 15 مايو',
  [normalized('6 أكتوبر')]: 'مدينة ٦ أكتوبر',
  [normalized('نبروه')]: 'نبريه',
  [normalized('العاشر من رمضان')]: 'مدينة ١٠ رمضان',
  [normalized('منيا القمح')]: 'منية القمح',
  [normalized('ههيا')]: 'هيهيا',
  [normalized('السادات')]: 'مدينة السادات',
  [normalized('برج البرلس')]: 'البرلس',
  [normalized('ببا')]: 'بيبا',
  [normalized('أبو قرقاص')]: 'أبو قرقاس',
  [normalized('عتاقة')]: 'عاتقة',
  [normalized('الجناين')]: 'الجنائن',
  [normalized('واحة سيوة')]: 'سيوة',
  [normalized('بئر العبد')]: 'بير العبد',
  [normalized('حي العرب')]: 'العرب',
  [normalized('حي الشرق')]: 'الشرق',
  [normalized('حي المناخ')]: 'المناخ',
  [normalized('حي الضواحي')]: 'الضواحي',
  [normalized('حي الزهور')]: 'الزهور',
  [normalized('حي الجنوب')]: 'جنوب بورسعيد',
  [normalized('القنطرة غرب')]: 'القنطرة',
}

export function waslaAliasTarget(city: unknown): string | null {
  return WASLA_CITY_ALIASES[normalized(city)] || null
}

// Known UNSUPPORTED Matjari cities where Wasla has no equivalent district
// at the same granularity (generic capital names or sub-villages). Checkout
// should warn / block Wasla selection for these.
const UNSUPPORTED_NORM = new Set<string>([
  normalized('القاهرة'),
  normalized('العباسية'),
  normalized('الجيزة'),
  normalized('العجوزة'),
  normalized('منشأة القناطر'),
  normalized('أطفيح'),
  normalized('الواحات البحرية'),
  normalized('الإسكندرية'),
  normalized('بسيون'),
  normalized('كفر البطيخ'),
  normalized('ميت أبو غالب'),
  normalized('القصاصين'),
  normalized('قفط'),
  normalized('الزينية'),
])

export function isWaslaUnsupportedCity(city: unknown): boolean {
  return UNSUPPORTED_NORM.has(normalized(city))
}

// Helper to check if a Matjari city can be resolved to Wasla via direct normalized
// match or via alias (i.e., not UNSUPPORTED). This is a local heuristic without
// live Wasla fetch; the authoritative check remains server-side in wasla.ts.
export function isWaslaMappableCity(city: unknown): boolean {
  if (!city) return false
  if (isWaslaUnsupportedCity(city)) return false
  // Any city that is either directly mappable or via alias is considered mappable
  // for UI purposes. The server will still do the exact Wasla live check.
  // Conservatively: if it's in alias table, it's mappable; otherwise assume direct
  // normalized match is possible (optimistic) except for known unsupported.
  return true
}

export function normalizedCity(value: unknown): string {
  return normalized(value)
}
