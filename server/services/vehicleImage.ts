// Foto automática do veículo.
// 1. Wikimedia Commons: muitas fotos têm marca, modelo e ano no título ("Suzuki GSX-R 750 2007"),
//    por isso dá para acertar na geração do veículo. Sem chave de API.
// 2. Unsplash (com UNSPLASH_ACCESS_KEY): fotos bonitas mas sem ano; usado quando o Commons não tem o modelo.
// As duas fontes exigem crédito ao autor, guardado em imageCredit/imageCreditUrl e mostrado na interface.
import { createApi } from 'unsplash-js';

const USER_AGENT = 'LogiCar/1.0 (vehicle image lookup)';

const unsplash = process.env.UNSPLASH_ACCESS_KEY
  ? createApi({ accessKey: process.env.UNSPLASH_ACCESS_KEY })
  : null;

export type VehicleKind = 'motorcycle' | 'truck' | 'van' | 'car';

export interface VehicleInfo {
  brand: string;
  model: string;
  year?: number | null;
  engineDisplacement?: number | null;
  vehicleCategory?: string | null;
  iucCategory?: string | null;
}

export interface VehicleImage {
  url: string;
  credit: string;
  creditUrl: string;
}

/** Sugestão para a galeria de escolha de foto. */
export interface ImageSuggestion extends VehicleImage {
  thumbUrl: string;
  source: 'commons' | 'unsplash';
  /** Unsplash: URL a notificar quando a foto é escolhida (regras da API) */
  trackUrl?: string;
}

/** Tipo de veículo a partir da categoria (texto livre ou dados da matrícula) e da categoria IUC. */
export function vehicleKind({ vehicleCategory, iucCategory }: Pick<VehicleInfo, 'vehicleCategory' | 'iucCategory'>): VehicleKind {
  const category = `${vehicleCategory ?? ''} ${iucCategory ?? ''}`.toLowerCase();
  // IUC categoria E = motociclos, ciclomotores, triciclos e quadriciclos
  if (/\bmot[ao]s?\b|motocicl|ciclomotor|motorizada|scooter|quadricicl|tricicl|moto4|motorcycle|categoria\s*e\b/.test(category)) return 'motorcycle';
  if (/pesado|cami[aã]o|trator|tractor|truck/.test(category)) return 'truck';
  if (/mercadorias|furg|\bvan\b/.test(category)) return 'van';
  return 'car';
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

/** O texto aparece no título como palavra(s) inteira(s), ignorando hífens e espaços ("GSXR" = "GSX-R"). */
function hasTerm(title: string, term: string): boolean {
  const target = normalize(term);
  if (!target) return false;
  const tokens = title.toLowerCase().normalize('NFD').split(/[^a-z0-9]+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    let joined = '';
    for (let j = i; j < Math.min(tokens.length, i + 4); j++) {
      joined += tokens[j];
      if (joined === target) return true;
      if (!target.startsWith(joined)) break;
    }
  }
  return false;
}

const hasNumber = (title: string, n: string) => new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(title);

/**
 * Pontuação de uma foto pelo título: modelo (3) e ano (3) pesam mais; marca (1) e cilindrada (1) desempatam.
 * Sem o modelo no título a foto não serve (devolve 0).
 */
export function imageScore(title: string, v: VehicleInfo): number {
  if (!hasTerm(title, v.model)) return 0;
  let score = 3;
  if (hasTerm(title, v.brand)) score += 1;
  if (v.year && hasNumber(title, String(v.year))) score += 3;
  // 599 cc -> "600"; 998 cc -> "1000"
  if (v.engineDisplacement && hasNumber(title, String(Math.round(v.engineDisplacement / 50) * 50))) score += 1;
  return score;
}

async function commonsSearch(query: string) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '30',
    gsrsearch: `${query} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1080',
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Wikimedia Commons: HTTP ${res.status}`);
  const data = await res.json();
  return Object.values<any>(data.query?.pages ?? {});
}

const stripHtml = (html = '') => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/** Autor legível a partir dos metadados do Commons (que às vezes trazem texto técnico). */
export function cleanAuthor(html?: string): string {
  let author = stripHtml(html);
  const assumed = author.match(/No machine-readable author provided\.\s*(.+?)\s+assumed/i);
  if (assumed) author = assumed[1].replace(/~commonswiki$/i, '');
  return author.replace(/\s*\((talk|discussão)\)\s*/gi, ' ').trim() || 'Autor desconhecido';
}

/** Fotos do Commons ordenadas pela pontuação (só as que têm o modelo no título). */
async function commonsSuggestions(v: VehicleInfo, limit: number): Promise<ImageSuggestion[]> {
  const kind = vehicleKind(v);
  const queries = [
    v.year ? `${v.brand} ${v.model} ${v.year}` : null,
    `${v.brand} ${v.model}`,
    v.year ? `${v.brand} ${v.year} ${kind}` : null,
  ].filter(Boolean) as string[];
  const maxScore = 4 + (v.year ? 3 : 0) + (v.engineDisplacement ? 1 : 0);

  const found = new Map<number, { score: number; page: any }>();
  for (const query of queries) {
    for (const page of await commonsSearch(query)) {
      const info = page.imageinfo?.[0];
      // Só fotos em paisagem e com resolução suficiente para o cartão
      if (!info?.thumburl || info.width < 800 || info.height > info.width) continue;
      const score = imageScore(page.title, v);
      if (score > 0) found.set(page.pageid, { score, page });
    }
    // Já há fotos suficientes com a pontuação máxima: evita pedidos extra
    if ([...found.values()].filter((f) => f.score === maxScore).length >= limit) break;
  }

  return [...found.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ page }) => {
      const info = page.imageinfo[0];
      const meta = info.extmetadata ?? {};
      const author = cleanAuthor(meta.Artist?.value);
      const license = stripHtml(meta.LicenseShortName?.value) || 'licença no Wikimedia Commons';
      return {
        url: info.thumburl,
        thumbUrl: info.thumburl,
        credit: `Foto: ${author} (${license}), Wikimedia Commons`,
        creditUrl: info.descriptionurl,
        source: 'commons' as const,
      };
    });
}

async function unsplashSuggestions(v: VehicleInfo, limit: number): Promise<ImageSuggestion[]> {
  if (!unsplash) return [];
  const result = await unsplash.search.getPhotos({ query: `${v.brand} ${v.model} ${vehicleKind(v)}`, perPage: limit, orientation: 'landscape' });
  return (result.response?.results ?? []).map((photo) => ({
    url: photo.urls.regular,
    thumbUrl: photo.urls.small,
    credit: `Foto: ${photo.user.name} / Unsplash`,
    creditUrl: `${photo.links.html}?utm_source=logicar&utm_medium=referral`,
    source: 'unsplash' as const,
    trackUrl: photo.links.download_location,
  }));
}

async function safely<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (error) {
    console.error('Erro ao procurar fotos do veículo:', error instanceof Error ? error.message : error);
    return [];
  }
}

/** Sugestões para a galeria: primeiro as do Commons (acertam no ano), depois as do Unsplash. */
export async function getImageSuggestions(v: VehicleInfo): Promise<ImageSuggestion[]> {
  const [commons, stock] = await Promise.all([safely(() => commonsSuggestions(v, 8)), safely(() => unsplashSuggestions(v, 4))]);
  return [...commons, ...stock];
}

/** Regras da API do Unsplash: notificar quando uma foto é usada. */
export async function trackUnsplashUse(trackUrl: string) {
  if (unsplash && trackUrl.startsWith('https://api.unsplash.com/')) {
    await unsplash.photos.trackDownload({ downloadLocation: trackUrl }).catch(() => {});
  }
}

/** Foto automática ao criar um veículo sem foto: a melhor sugestão. */
export async function getVehicleImage(v: VehicleInfo): Promise<VehicleImage | null> {
  const commons = await safely(() => commonsSuggestions(v, 1));
  const best = commons[0] ?? (await safely(() => unsplashSuggestions(v, 1)))[0];
  if (!best) return null;
  if (best.trackUrl) await trackUnsplashUse(best.trackUrl);
  return { url: best.url, credit: best.credit, creditUrl: best.creditUrl };
}
