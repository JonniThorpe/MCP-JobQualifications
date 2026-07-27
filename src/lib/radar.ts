import {
  appendToSection,
  detectEol,
  findHeadings,
  findSection,
  fromLines,
  normalize,
  toLines
} from "./markdown.js";

/**
 * radar-huecos.md es lo que el mercado pide y no tengo. Cada termino lleva un
 * contador de cuantas ofertas objetivo lo han pedido: la demanda repetida es la
 * senal de prioridad.
 */

export const CONFIRMED_SECTION = "Confirmados por ofertas";
export const WATCHLIST_SECTION = "Watchlist sin confirmar por ofertas";
export const SOURCES_SECTION = "Fuentes registradas";

/**
 * Separador de fuentes. Es ';' y no ',' porque las fuentes reales llevan comas
 * dentro ("Google SWE II, Malaga"): con coma no habria forma de saber si son
 * una fuente o dos.
 */
export const SOURCE_SEPARATOR = "; ";

export interface Gap {
  counter: number;
  /** Termino sin la categoria entre parentesis. */
  term: string;
  category?: string;
  sources: string[];
  /** Cabecera bajo la que vive la linea. */
  section: string;
  lineIndex: number;
  raw: string;
}

// '- [contador: 2] Kubernetes (Infraestructura). Fuentes: X; Y'
const GAP_RE = /^(\s*[-*]\s+)\[contador:\s*(\d+)\]\s*(.+?)\s*$/i;

function parseRest(rest: string): Pick<Gap, "term" | "category" | "sources"> {
  let head = rest;
  let sources: string[] = [];

  const idx = rest.search(/Fuentes\s*:/i);
  if (idx !== -1) {
    head = rest.slice(0, idx).replace(/\s*\.?\s*$/, "");
    sources = rest
      .slice(idx)
      .replace(/^Fuentes\s*:\s*/i, "")
      .replace(/\s*\.\s*$/, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  let term = head.replace(/\s*\.\s*$/, "").trim();
  let category: string | undefined;
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(term);
  if (m) {
    term = m[1]!.trim();
    category = m[2]!.trim();
  }
  return { term, category, sources };
}

export function parseGaps(content: string): Gap[] {
  const lines = toLines(content);
  const headings = findHeadings(lines);
  const out: Gap[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = GAP_RE.exec(lines[i]!);
    // Las vinietas de '## Reglas' no llevan [contador: N] y por eso no entran
    // aqui. El discriminador es el patron, nunca la posicion en el archivo.
    if (!m) continue;
    let section = "";
    for (const h of headings) {
      if (h.index < i && h.level >= 2) section = h.text;
      else if (h.index >= i) break;
    }
    out.push({
      counter: Number(m[2]),
      section,
      lineIndex: i,
      raw: lines[i]!,
      ...parseRest(m[3]!)
    });
  }
  return out;
}

/** Huecos ordenados por contador descendente; a igual contador, alfabetico. */
export function listGaps(content: string): Gap[] {
  return parseGaps(content)
    .filter((g) => normalize(g.section) !== normalize(SOURCES_SECTION))
    .sort((a, b) => b.counter - a.counter || a.term.localeCompare(b.term, "es"));
}

export function findGap(content: string, term: string): Gap | undefined {
  const target = normalize(term);
  return parseGaps(content).find(
    (g) => normalize(g.term) === target && normalize(g.section) !== normalize(SOURCES_SECTION)
  );
}

/**
 * Reordena por contador descendente SOLO las lineas de hueco de una seccion,
 * reutilizando sus mismos indices. Las lineas que no son huecos (prosa, blancos)
 * se quedan donde estaban.
 */
function sortSectionLines(lines: string[], sectionName: string): string[] {
  const indices: number[] = [];
  const gaps = parseGaps(fromLines(lines, "\n")).filter(
    (g) => normalize(g.section) === normalize(sectionName)
  );
  if (gaps.length < 2) return lines;

  for (const g of gaps) indices.push(g.lineIndex);
  const ordered = gaps
    .slice()
    .sort((a, b) => b.counter - a.counter || a.term.localeCompare(b.term, "es"))
    .map((g) => g.raw);

  const out = lines.slice();
  indices.forEach((lineIndex, position) => {
    out[lineIndex] = ordered[position]!;
  });
  return out;
}

/**
 * Devuelve el radar con las lineas de hueco ordenadas por contador dentro de
 * cada seccion, SIN escribir en disco. Lo usa el resource profile://gaps para
 * garantizar el orden aunque el archivo se haya editado a mano.
 */
export function sortRadar(content: string): string {
  const eol = detectEol(content);
  let lines = toLines(content);
  const secciones = [...new Set(parseGaps(content).map((g) => g.section))];
  for (const seccion of secciones) lines = sortSectionLines(lines, seccion);
  return fromLines(lines, eol);
}

export interface RadarResult {
  content: string;
  changed: boolean;
  message: string;
  counter?: number;
}

/**
 * Corazon del sistema. Si el termino existe sube su contador en uno y anade la
 * fuente; si no, lo crea con contador 1. Nunca duplica.
 *
 * La linea existente se edita por sustitucion de texto, no se regenera: asi se
 * conserva su formato original (puntuacion, categoria escrita a mano, orden de
 * las fuentes previas).
 */
export function recordGap(
  content: string,
  term: string,
  category: string,
  source: string
): RadarResult {
  const eol = detectEol(content);
  let lines = toLines(content);
  const existing = findGap(content, term);
  const fuente = source.trim();

  if (existing) {
    const nuevoContador = existing.counter + 1;
    let raw = existing.raw.replace(
      /\[contador:\s*\d+\]/i,
      `[contador: ${nuevoContador}]`
    );

    const yaEstaba = existing.sources.some((s) => normalize(s) === normalize(fuente));
    if (fuente && !yaEstaba) {
      if (existing.sources.length > 0) {
        raw = raw.replace(/\s*\.?\s*$/, "") + `${SOURCE_SEPARATOR}${fuente}`;
      } else {
        raw = raw.replace(/\s*\.?\s*$/, "") + `. Fuentes: ${fuente}`;
      }
    }

    lines[existing.lineIndex] = raw;
    lines = sortSectionLines(lines, existing.section);

    const nota =
      normalize(existing.section) === normalize(WATCHLIST_SECTION)
        ? ` Sigue en "${WATCHLIST_SECTION}".`
        : "";
    return {
      content: bumpSource(fromLines(lines, eol), fuente),
      changed: true,
      counter: nuevoContador,
      message: `"${existing.term}": contador ${existing.counter} -> ${nuevoContador}.${nota}${
        yaEstaba ? ` La fuente "${fuente}" ya constaba.` : ""
      }`
    };
  }

  const cat = category.trim() ? ` (${category.trim()})` : "";
  const fuentes = fuente ? `. Fuentes: ${fuente}` : "";
  const nueva = `- [contador: 1] ${term.trim()}${cat}${fuentes}`;

  const section = findSection(lines, CONFIRMED_SECTION, 2);
  if (section) {
    lines = appendToSection(lines, section, [nueva]);
    lines = sortSectionLines(lines, CONFIRMED_SECTION);
  } else {
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
    lines.push("", `## ${CONFIRMED_SECTION}`, nueva, "");
  }

  return {
    content: bumpSource(fromLines(lines, eol), fuente),
    changed: true,
    counter: 1,
    message: `"${term}" es nuevo en el radar: creado con contador 1 en "${CONFIRMED_SECTION}".`
  };
}

/**
 * Contador por fuente en '## Fuentes registradas'. Cuenta cuantos huecos ha
 * destapado cada oferta: un numero alto significa "esta oferta pide muchas
 * cosas que no tengo".
 */
function bumpSource(content: string, source: string): string {
  if (!source) return content;
  const eol = detectEol(content);
  let lines = toLines(content);
  const section = findSection(lines, SOURCES_SECTION, 2);
  if (!section) return content;

  for (let i = section.start; i < section.end; i++) {
    const m = GAP_RE.exec(lines[i]!);
    if (!m) continue;
    const { term } = parseRest(m[3]!);
    if (normalize(term) === normalize(source)) {
      lines[i] = lines[i]!.replace(
        /\[contador:\s*\d+\]/i,
        `[contador: ${Number(m[2]) + 1}]`
      );
      return fromLines(sortSectionLines(lines, SOURCES_SECTION), eol);
    }
  }

  lines = appendToSection(lines, section, [`- [contador: 1] ${source}`]);
  return fromLines(sortSectionLines(lines, SOURCES_SECTION), eol);
}

/**
 * Saca un termino del radar. Se usa en la graduacion (confirm_skill): la linea
 * desaparece de aqui entera, incluidas sus fuentes, que NO viajan al perfil.
 */
export function removeGap(content: string, term: string): RadarResult & { gap?: Gap } {
  const gap = findGap(content, term);
  if (!gap) {
    return {
      content,
      changed: false,
      message: `"${term}" no esta en el radar de huecos.`
    };
  }
  const eol = detectEol(content);
  const lines = toLines(content);
  lines.splice(gap.lineIndex, 1);
  return {
    content: fromLines(lines, eol),
    changed: true,
    gap,
    message: `"${gap.term}" retirado del radar (tenia contador ${gap.counter}).`
  };
}
