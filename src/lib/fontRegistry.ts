const popularFonts = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Nunito',
  'Raleway',
  'Merriweather',
  'Playfair Display',
  'Oswald',
  'Bebas Neue',
  'DM Sans',
  'Work Sans',
  'Space Grotesk',
  'Manrope',
  'Rubik',
  'Cabin',
  'Fira Sans',
  'Source Sans 3',
  'Quicksand',
  'Josefin Sans',
  'Barlow',
  'Mulish',
  'Karla',
  'Arimo',
  'Noto Sans',
  'Noto Serif',
  'Inconsolata',
  'Pacifico',
] as const;

const loadedFontFamilies = new Set<string>(['Inter']);
const fontLoadPromises = new Map<string, Promise<void>>();

let catalogPromise: Promise<string[]> | null = null;
let cachedCatalog: string[] | null = null;

const normalizeFamily = (family: string) => family.trim().replace(/\s+/g, ' ');

const toGoogleFamilyParam = (family: string) => family.trim().replace(/\s+/g, '+');

const dedupeFamilies = (families: string[]) => {
  const unique = new Set<string>();
  const output: string[] = [];

  for (const family of families) {
    const normalized = normalizeFamily(family);
    if (!normalized || unique.has(normalized)) {
      continue;
    }
    unique.add(normalized);
    output.push(normalized);
  }

  return output;
};

export const defaultFontFamilies = dedupeFamilies([...popularFonts]);

export async function getGoogleFontFamilies(limit = 700): Promise<string[]> {
  if (cachedCatalog) {
    return cachedCatalog.slice(0, limit);
  }

  if (!catalogPromise) {
    catalogPromise = import('google-fonts-complete/google-fonts.json')
      .then((module) => {
        const registry = module.default as Record<string, unknown>;
        const allFamilies = Object.keys(registry).sort((a, b) => a.localeCompare(b));
        const merged = dedupeFamilies([...popularFonts, ...allFamilies]);
        cachedCatalog = merged;
        return merged;
      })
      .catch(() => {
        cachedCatalog = dedupeFamilies([...popularFonts]);
        return cachedCatalog;
      });
  }

  const catalog = await catalogPromise;
  return catalog.slice(0, limit);
}

export async function ensureGoogleFontLoaded(
  family: string,
  weights: Array<500 | 600 | 700 | 800 | 400> = [400, 500, 600, 700, 800],
): Promise<void> {
  const normalizedFamily = normalizeFamily(family);

  if (!normalizedFamily || loadedFontFamilies.has(normalizedFamily)) {
    return;
  }

  const cacheKey = normalizedFamily;
  const existingPromise = fontLoadPromises.get(cacheKey);
  if (existingPromise) {
    await existingPromise;
    return;
  }

  const weightList = Array.from(new Set(weights)).sort((a, b) => a - b);
  const familyParam = toGoogleFamilyParam(normalizedFamily);
  const href = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@400;500;600;700;800&display=swap`;
  const linkId = `gf-${normalizedFamily.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  const loadPromise = new Promise<void>((resolve) => {
    let link = document.getElementById(linkId) as HTMLLinkElement | null;

    const onReady = () => resolve();

    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = href;
      link.media = 'all';
      link.onload = onReady;
      link.onerror = onReady;
      document.head.appendChild(link);
      return;
    }

    onReady();
  }).then(async () => {
    if ('fonts' in document && typeof document.fonts?.load === 'function') {
      await Promise.all(
        weightList.map(async (weight) => {
          await document.fonts.load(`${weight} 16px "${normalizedFamily}"`);
        }),
      );
    }

    loadedFontFamilies.add(normalizedFamily);
  });

  fontLoadPromises.set(cacheKey, loadPromise);
  await loadPromise;
}
