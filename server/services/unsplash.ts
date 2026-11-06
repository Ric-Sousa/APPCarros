import { createApi } from 'unsplash-js';

// Opcional: sem chave, os veículos ficam sem imagem automática.
const unsplash = process.env.UNSPLASH_ACCESS_KEY
  ? createApi({ accessKey: process.env.UNSPLASH_ACCESS_KEY })
  : null;

export async function getVehicleImage(query: string): Promise<string | null> {
  if (!unsplash) return null;
  try {
    const result = await unsplash.search.getPhotos({ query: `${query} car`, perPage: 1, orientation: 'landscape' });
    return result.response?.results[0]?.urls.regular ?? null;
  } catch (error) {
    console.error('Erro ao procurar imagem no Unsplash:', error);
    return null;
  }
}
