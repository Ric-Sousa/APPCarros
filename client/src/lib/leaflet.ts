// Leaflet só é carregado quando é preciso (Planeador de rotas), e não em todas as páginas.
const VERSION = "1.9.4";
const CSS = { href: `https://unpkg.com/leaflet@${VERSION}/dist/leaflet.css`, integrity: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" };
const JS = { src: `https://unpkg.com/leaflet@${VERSION}/dist/leaflet.js`, integrity: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" };

let loading: Promise<any> | null = null;

/** Devolve o objeto global `L` do Leaflet, injetando o CSS e o script na primeira chamada. */
export function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (loading) return loading;

  const link = document.createElement("link");
  Object.assign(link, { rel: "stylesheet", href: CSS.href, integrity: CSS.integrity, crossOrigin: "anonymous" });
  document.head.appendChild(link);

  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    Object.assign(script, { src: JS.src, integrity: JS.integrity, crossOrigin: "anonymous", async: true });
    script.onload = () => resolve((window as any).L);
    script.onerror = () => {
      loading = null;
      reject(new Error("Não foi possível carregar o mapa."));
    };
    document.body.appendChild(script);
  });
  return loading;
}
