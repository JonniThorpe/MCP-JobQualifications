import {
  appendToSection,
  detectEol,
  findHeadings,
  findSection,
  fromLines,
  normalize,
  toLines
} from "./markdown.js";

/** Ciclo de vida de una oferta. El servidor valida contra esta lista. */
export const OFFER_STATUSES = [
  "analizada",
  "solicitada",
  "entrevista",
  "oferta",
  "aceptada",
  "denegada",
  "descartada"
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export function isOfferStatus(value: string): value is OfferStatus {
  return (OFFER_STATUSES as readonly string[]).includes(value);
}

// Texto visible en Obsidian: va con tilde. La comparacion usa normalize(), que
// ignora acentos, asi que una cabecera escrita a mano sin tilde tambien casa.
export const ANALYSIS_SECTION = "Análisis";
export const STATUS_LOG_SECTION = "Registro de estados";
export const NOTES_SECTION = "Notas de entrevista";

export interface Frontmatter {
  [key: string]: string;
}

/**
 * Frontmatter YAML plano (clave: valor). No metemos un parser de YAML entero
 * porque el formato que escribimos es de una sola profundidad, y una dependencia
 * menos es una dependencia menos que reinstalar si formateas la maquina.
 */
export function parseFrontmatter(content: string): {
  data: Frontmatter;
  bodyStart: number;
} {
  const lines = toLines(content);
  if (lines[0]?.trim() !== "---") return { data: {}, bodyStart: 0 };
  const data: Frontmatter = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === "---") return { data, bodyStart: i + 1 };
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(lines[i]!);
    if (m) data[m[1]!] = m[2]!.trim().replace(/^["'](.*)["']$/, "$1");
  }
  return { data, bodyStart: 0 };
}

/** Escapa solo lo imprescindible para que el YAML siga siendo valido. */
function yamlValue(value: string): string {
  const v = value.trim();
  return /^[\w][\w .,:;/&+()-]*$/u.test(v) && !v.includes(": ") ? v : JSON.stringify(v);
}

export function setFrontmatterField(
  content: string,
  key: string,
  value: string
): string {
  const eol = detectEol(content);
  const lines = toLines(content);
  const { bodyStart } = parseFrontmatter(content);
  if (bodyStart === 0) return content;

  for (let i = 1; i < bodyStart - 1; i++) {
    if (new RegExp(`^${key}\\s*:`).test(lines[i]!)) {
      lines[i] = `${key}: ${yamlValue(value)}`;
      return fromLines(lines, eol);
    }
  }
  lines.splice(bodyStart - 1, 0, `${key}: ${yamlValue(value)}`);
  return fromLines(lines, eol);
}

export interface BuildOfferInput {
  id: string;
  title: string;
  company: string;
  markdown: string;
  status?: OfferStatus;
  date: string;
  /** Rango o cifra tal y como lo publica la oferta. Es un dato, nunca un motivo para descartar. */
  salario?: string;
  /** Puntuacion 0-12 de los seis ejes de criterios.md. */
  score?: number;
  url?: string;
  tags?: string[];
}

/** Lista inline de YAML: 'tags: [backend, ml]', que es lo que Obsidian indexa. */
function yamlList(values: string[]): string {
  return `[${values.map((t) => t.trim()).filter(Boolean).join(", ")}]`;
}

/**
 * Estructura fija: frontmatter para que Dataview y Kanban lo lean, y tres
 * secciones que el resto de tools saben localizar por nombre.
 *
 * Los campos opcionales se escriben SIEMPRE, aunque vengan vacios: una clave
 * presente y vacia se rellena luego a mano en Obsidian, mientras que una clave
 * ausente hay que recordar como se llamaba.
 */
export function buildOffer(input: BuildOfferInput): string {
  const status = input.status ?? "analizada";
  return [
    "---",
    `id: ${yamlValue(input.id)}`,
    `title: ${yamlValue(input.title)}`,
    `company: ${yamlValue(input.company)}`,
    `status: ${status}`,
    `score: ${input.score ?? ""}`,
    `salario: ${input.salario ? yamlValue(input.salario) : ""}`,
    `url: ${input.url ?? ""}`,
    `tags: ${yamlList(input.tags ?? [])}`,
    `created: ${input.date}`,
    `updated: ${input.date}`,
    "---",
    "",
    `# ${input.title} - ${input.company}`,
    "",
    `## ${ANALYSIS_SECTION}`,
    "",
    input.markdown.trim(),
    "",
    `## ${STATUS_LOG_SECTION}`,
    `- ${input.date}: ${status}`,
    "",
    `## ${NOTES_SECTION}`,
    ""
  ].join("\n");
}

/**
 * Limites de la seccion de analisis.
 *
 * No sirve "hasta la siguiente cabecera de nivel 2": el analisis trae sus
 * PROPIAS cabeceras (los puntos de la plantilla) y cortariamos en la primera.
 * El analisis termina donde empieza la siguiente seccion FIJA conocida.
 */
function analysisRange(lines: string[]): { start: number; end: number } | undefined {
  const headings = findHeadings(lines);
  const inicio = headings.find(
    (h) => h.level === 2 && normalize(h.text) === normalize(ANALYSIS_SECTION)
  );
  if (!inicio) return undefined;

  const fijas = [STATUS_LOG_SECTION, NOTES_SECTION].map(normalize);
  const fin = headings.find(
    (h) => h.level === 2 && h.index > inicio.index && fijas.includes(normalize(h.text))
  );
  return { start: inicio.index + 1, end: fin ? fin.index : lines.length };
}

/**
 * Conserva estado y notas al reguardar una oferta ya existente: solo se
 * reemplaza la seccion de analisis y se refresca 'updated'.
 */
export function replaceAnalysis(
  content: string,
  markdown: string,
  date: string
): string {
  const eol = detectEol(content);
  const lines = toLines(content);
  const rango = analysisRange(lines);
  if (!rango) return content;

  const nuevo = ["", ...markdown.trim().split(/\r?\n/), ""];
  const out = lines.slice(0, rango.start).concat(nuevo, lines.slice(rango.end));
  return setFrontmatterField(fromLines(out, eol), "updated", date);
}

export interface OfferEditResult {
  content: string;
  changed: boolean;
  message: string;
}

export function setOfferStatus(
  content: string,
  status: OfferStatus,
  date: string
): OfferEditResult {
  const { data } = parseFrontmatter(content);
  const anterior = data.status ?? "(sin estado)";
  if (anterior === status) {
    return { content, changed: false, message: `La oferta ya estaba en "${status}".` };
  }

  let next = setFrontmatterField(content, "status", status);
  next = setFrontmatterField(next, "updated", date);

  const eol = detectEol(next);
  let lines = toLines(next);
  const section = findSection(lines, STATUS_LOG_SECTION, 2);
  const entrada = `- ${date}: ${anterior} -> ${status}`;

  if (section) {
    lines = appendToSection(lines, section, [entrada]);
  } else {
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
    lines.push("", `## ${STATUS_LOG_SECTION}`, entrada, "");
  }

  return {
    content: fromLines(lines, eol),
    changed: true,
    message: `Estado: ${anterior} -> ${status}.`
  };
}

export function addOfferNote(
  content: string,
  note: string,
  date: string
): OfferEditResult {
  const texto = note.trim();
  if (!texto) return { content, changed: false, message: "La nota esta vacia." };

  const eol = detectEol(content);
  let lines = toLines(content);
  // Cabecera de nivel 3 con la fecha: permite notas de varias lineas y las deja
  // plegables en Obsidian.
  const bloque = ["", `### ${date}`, "", ...texto.split(/\r?\n/)];

  const section = findSection(lines, NOTES_SECTION, 2);
  if (section) {
    lines = appendToSection(lines, section, bloque);
  } else {
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
    lines.push("", `## ${NOTES_SECTION}`, ...bloque, "");
  }

  return {
    content: setFrontmatterField(fromLines(lines, eol), "updated", date),
    changed: true,
    message: `Nota fechada ${date} anadida.`
  };
}
