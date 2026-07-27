import {
  appendToSection,
  detectEol,
  findHeadings,
  findSection,
  fromLines,
  normalize,
  toLines
} from "./markdown.js";

/** En perfil-skills.md solo hay cosas que YA tengo. Nunca huecos. */
export const SKILL_LEVELS = ["solido", "parcial"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export function isSkillLevel(value: string): value is SkillLevel {
  return (SKILL_LEVELS as readonly string[]).includes(value);
}

export interface Skill {
  category: string;
  level: SkillLevel;
  /** Termino sin la nota entre parentesis: 'Java'. */
  term: string;
  /** Todo lo que sigue a la etiqueta: 'Java (Java 8, un ano en Indra)'. */
  text: string;
  lineIndex: number;
  raw: string;
}

// '- [solido] Java (Java 8, ...)'  ->  vinieta | nivel | resto
const SKILL_RE = /^(\s*[-*]\s+)\[(solido|parcial)\]\s*(.+?)\s*$/i;

/**
 * El termino es el texto anterior a la nota final entre parentesis. Ojo: las
 * lineas reales llevan comas y dos puntos dentro ('Testing: JUnit5, Mockito'),
 * asi que solo se recorta el ULTIMO parentesis y solo si cierra la linea.
 */
export function extractTerm(text: string): string {
  const m = /^(.*?)\s*\([^()]*\)\s*\.?\s*$/.exec(text);
  return (m ? m[1]! : text).replace(/\.\s*$/, "").trim();
}

export function parseSkills(content: string): Skill[] {
  const lines = toLines(content);
  const headings = findHeadings(lines);
  const out: Skill[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = SKILL_RE.exec(lines[i]!);
    if (!m) continue;
    let category = "";
    for (const h of headings) {
      if (h.index < i && h.level >= 2) category = h.text;
      else if (h.index >= i) break;
    }
    const text = m[3]!;
    out.push({
      category,
      level: m[2]!.toLowerCase() as SkillLevel,
      term: extractTerm(text),
      text,
      lineIndex: i,
      raw: lines[i]!
    });
  }
  return out;
}

export function findSkill(content: string, term: string): Skill | undefined {
  const target = normalize(term);
  return parseSkills(content).find((s) => normalize(s.term) === target);
}

export function listCategories(content: string): string[] {
  return findHeadings(toLines(content))
    .filter((h) => h.level === 2)
    .map((h) => h.text);
}

export interface CategoryMatch {
  /** Cabecera bajo la que hay que escribir. */
  name: string;
  how: "exacta" | "prefijo" | "nueva" | "ambigua";
  candidates?: string[];
}

/**
 * Resuelve la categoria del radar contra las cabeceras reales del perfil.
 *
 * Existe porque el radar usa nombres cortos escritos a mano ("Infraestructura")
 * y el perfil tiene cabeceras largas ("Infraestructura, DevOps y despliegue").
 * Sin esto, graduar una skill creaba una categoria paralela y partia el archivo
 * en dos secciones que significan lo mismo.
 */
export function resolveCategory(content: string, category: string): CategoryMatch {
  const cats = listCategories(content);
  const target = normalize(category);
  if (!target) return { name: category, how: "nueva" };

  const exacta = cats.find((c) => normalize(c) === target);
  if (exacta) return { name: exacta, how: "exacta" };

  // "Infraestructura" encaja con "Infraestructura, DevOps y despliegue" pero no
  // con "Infraestructuras": se exige que el corte caiga en un limite de palabra.
  const porPrefijo = cats.filter((c) => {
    const n = normalize(c);
    return n.startsWith(target) && /[\s,:;-]/.test(n.charAt(target.length));
  });
  if (porPrefijo.length === 1) return { name: porPrefijo[0]!, how: "prefijo" };
  if (porPrefijo.length > 1) {
    return { name: category, how: "ambigua", candidates: porPrefijo };
  }
  return { name: category, how: "nueva" };
}

export interface EditResult {
  content: string;
  changed: boolean;
  message: string;
}

/**
 * Cambia SOLO la etiqueta de nivel. El resto de la linea (la nota entre
 * parentesis, la indentacion, el tipo de vinieta) se conserva byte a byte.
 */
export function updateSkillLevel(
  content: string,
  term: string,
  level: SkillLevel
): EditResult {
  const skill = findSkill(content, term);
  if (!skill) {
    return {
      content,
      changed: false,
      message: `El termino "${term}" no esta en perfil-skills.md. Si es algo que acabas de adquirir, usa confirm_skill; si te falta, vive en el radar.`
    };
  }
  if (skill.level === level) {
    return { content, changed: false, message: `"${skill.term}" ya estaba en [${level}].` };
  }
  const eol = detectEol(content);
  const lines = toLines(content);
  lines[skill.lineIndex] = skill.raw.replace(`[${skill.level}]`, `[${level}]`);
  return {
    content: fromLines(lines, eol),
    changed: true,
    message: `"${skill.term}": [${skill.level}] -> [${level}] en "${skill.category}".`
  };
}

/**
 * Alta de una skill en su categoria. Si la categoria no existe se crea al final
 * del archivo: es preferible una cabecera nueva a colocar la linea en un sitio
 * arbitrario. La evidencia se guarda como nota entre parentesis, que es el
 * formato que ya usan las lineas escritas a mano.
 */
export function addSkill(
  content: string,
  category: string,
  term: string,
  level: SkillLevel,
  evidence?: string
): EditResult {
  const existing = findSkill(content, term);
  if (existing) {
    return {
      content,
      changed: false,
      message: `"${existing.term}" ya estaba en perfil-skills.md, en "${existing.category}" con nivel [${existing.level}]. Usa update_skill_level si quieres cambiarlo.`
    };
  }

  const match = resolveCategory(content, category);
  if (match.how === "ambigua") {
    return {
      content,
      changed: false,
      message: `La categoria "${category}" encaja con varias del perfil: ${match.candidates!.join(
        " / "
      )}. Indica cual con el parametro category.`
    };
  }

  const eol = detectEol(content);
  let lines = toLines(content);
  const nota = evidence && evidence.trim() ? ` (${evidence.trim()})` : "";
  const nueva = `- [${level}] ${term.trim()}${nota}`;

  const section = findSection(lines, match.name, 2);
  if (section) {
    lines = appendToSection(lines, section, [nueva]);
    const aclaracion =
      match.how === "prefijo" ? ` (la categoria del radar era "${category}")` : "";
    return {
      content: fromLines(lines, eol),
      changed: true,
      message: `"${term}" anadido a "${section.heading.text}"${aclaracion} como [${level}].`
    };
  }

  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") lines.pop();
  lines.push("", `## ${category.trim()}`, nueva, "");
  return {
    content: fromLines(lines, eol),
    changed: true,
    message: `Categoria "${category}" no existia: creada al final del archivo. "${term}" anadido como [${level}].`
  };
}
