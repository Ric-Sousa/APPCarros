import { makeAuthenticatedRequest } from "@/lib/apiUtils";

/** Descarrega um ficheiro protegido (ex.: CSV) com o nome sugerido pelo servidor ou o indicado. */
export async function downloadProtected(url: string, fallbackName: string) {
  const response = await makeAuthenticatedRequest(url);
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  const blobUrl = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
