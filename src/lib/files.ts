import * as fs from "node:fs";
import * as path from "node:path";
import { paths } from "../config.js";
import { parseFrontmatter } from "./offers.js";

/** Todo el I/O concentrado aqui: el resto de modulos son funciones puras. */

export function ensureLayout(dataDir: string): void {
  const p = paths(dataDir);
  fs.mkdirSync(p.perfilDir, { recursive: true });
  fs.mkdirSync(p.ofertasDir, { recursive: true });
}

export function readIfExists(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

export function readRequired(file: string, etiqueta: string): string {
  const content = readIfExists(file);
  if (content === undefined) {
    throw new Error(
      `No existe ${etiqueta} en ${file}. Comprueba que JOB_MCP_DATA_DIR apunta a tu boveda.`
    );
  }
  return content;
}

/** Escritura atomica: fichero temporal + rename, para no dejar un .md a medias. */
export function writeAtomic(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, file);
}

/** El id es nombre de archivo: se restringe para no poder salir de ofertas/. */
export function assertSafeId(id: string): string {
  const clean = id.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(clean)) {
    throw new Error(
      `Id de oferta invalido: "${id}". Usa solo letras, numeros, guion, guion bajo y punto (ej. 2026-07-google).`
    );
  }
  return clean;
}

export interface OfferSummary {
  id: string;
  file: string;
  title: string;
  company: string;
  status: string;
  updated: string;
  score: string;
}

export function listOffers(dataDir: string): OfferSummary[] {
  const dir = paths(dataDir).ofertasDir;
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".md"));
  } catch {
    return [];
  }

  return files
    .map((f) => {
      const content = readIfExists(path.join(dir, f)) ?? "";
      const { data } = parseFrontmatter(content);
      return {
        id: data.id ?? path.basename(f, ".md"),
        file: f,
        title: data.title ?? "(sin titulo)",
        company: data.company ?? "(sin empresa)",
        status: data.status ?? "(sin estado)",
        updated: data.updated ?? "",
        score: data.score ?? ""
      };
    })
    .sort((a, b) => b.updated.localeCompare(a.updated) || a.id.localeCompare(b.id));
}

/** Fecha local en ISO corto. Se inyecta en las funciones puras para poder testear. */
export function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
