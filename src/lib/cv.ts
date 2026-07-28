import { z } from "zod";

/**
 * Render del CV en HTML a partir de cv-data.json y templates/cv.html.
 *
 * Dos invariantes gobiernan este modulo:
 *
 * 1. El modelo NO escribe contenido factico. Solo elige ids que ya existen en
 *    cv-data.json. Si una seleccion cita un id o un tag inexistente el render
 *    falla entero. Un prompt pidiendo "no inventes" es una suplica; esto es una
 *    garantia. Las unicas excepciones son headline y summary, que son
 *    encuadre y no afirmacion de hechos.
 *
 * 2. La plantilla tiene .page con height fija y overflow:hidden, asi que lo que
 *    no cabe DESAPARECE sin error. Por eso se estima la altura antes de
 *    escribir y se devuelve un aviso. La estimacion es heuristica: no hay
 *    navegador aqui. Esta calibrada contra el CV de diseno original (ver
 *    cv.test.ts), que ocupa la pagina casi entera.
 */

// --------------------------------------------------------------- esquemas ---

const LinkSchema = z.object({ label: z.string().min(1), href: z.string().min(1) });

const CvBaseSchema = z.object({
  identity: z.object({
    nameTop: z.string().min(1),
    nameBottom: z.string().min(1),
    headline: z.string().min(1),
    location: z.string().min(1),
    links: z.array(LinkSchema)
  }),
  summary: z.string().min(1),
  stack: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      tags: z.array(z.string().min(1))
    })
  ),
  experience: z.array(
    z.object({
      id: z.string().min(1),
      role: z.string().min(1),
      org: z.string().optional(),
      dates: z.string().optional(),
      bullets: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) }))
    })
  ),
  projects: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      org: z.string().optional(),
      stack: z.string().optional(),
      lines: z.array(z.object({ label: z.string().min(1), text: z.string().min(1) }))
    })
  ),
  education: z.array(
    z.object({
      id: z.string().min(1),
      role: z.string().min(1),
      org: z.string().optional(),
      dates: z.string().optional(),
      note: z.string().optional()
    })
  ),
  languages: z.array(z.object({ name: z.string().min(1), level: z.string().min(1) }))
});

export type CvBase = z.infer<typeof CvBaseSchema>;

/**
 * Shape suelto para poder reusarlo tal cual como inputSchema de la tool. Las
 * descripciones son el unico contexto que tiene el modelo al elegir: se
 * escriben para el que llama, no para el que mantiene.
 */
export const cvSelectionShape = {
  offerId: z
    .string()
    .min(1)
    .describe("Id de la oferta a la que se adapta el CV, formato AAAA-MM-empresa. Da nombre al archivo."),
  headline: z
    .string()
    .optional()
    .describe(
      "Titular bajo el nombre. Texto libre (admite <br>), es encuadre y no afirmacion de hechos. Omitelo para dejar el de cv-data.json."
    ),
  summary: z
    .string()
    .optional()
    .describe(
      "Resumen del lateral. Texto libre, pero solo puede reordenar y enfatizar lo que ya es cierto en cv-data.json: no anadas tecnologias ni experiencia que no esten ahi. Unas 300 caracteres; mas largo empuja el resto de la columna fuera de la pagina."
    ),
  stack: z
    .array(
      z.object({
        id: z.string().min(1).describe("Id del grupo en cv-data.json. Ej: 'languages'."),
        tags: z
          .array(z.string())
          .optional()
          .describe("Subconjunto y orden de los tags de ESE grupo. Cada tag debe existir tal cual en cv-data.json. Omitelo para incluirlos todos.")
      })
    )
    .optional()
    .describe("Grupos del Tech Stack a mostrar, en orden. Omitelo para incluirlos todos sin tocar."),
  experience: z
    .array(
      z.object({
        id: z.string().min(1).describe("Id del puesto en cv-data.json. Ej: 'indra'."),
        bullets: z
          .array(z.string())
          .optional()
          .describe("Ids de los bullets de ESE puesto, en orden. Omitelo para incluirlos todos.")
      })
    )
    .optional()
    .describe("Puestos a mostrar, en orden. Omitelo para incluirlos todos."),
  projects: z
    .array(z.string())
    .optional()
    .describe("Ids de proyectos, en orden. Aqui es donde mas se gana adaptando: pon delante los que tocan la oferta y quita los que no. Omitelo para incluirlos todos."),
  education: z
    .array(z.string())
    .optional()
    .describe("Ids de formacion, en orden. Omitelo para incluirla toda."),
  note: z
    .string()
    .optional()
    .describe("Por que estas elecciones para esta oferta. Se guarda como comentario dentro del HTML, no se ve al imprimir.")
};

const CvSelectionSchema = z.object(cvSelectionShape);
export type CvSelection = z.infer<typeof CvSelectionSchema>;

export function parseCvBase(json: string): CvBase {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new Error(`cv-data.json no es JSON valido: ${err instanceof Error ? err.message : err}`);
  }
  const r = CvBaseSchema.safeParse(raw);
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `  - ${i.path.join(".") || "(raiz)"}: ${i.message}`);
    throw new Error(["cv-data.json no cumple el esquema:", ...detalle].join("\n"));
  }
  return r.data;
}

// ----------------------------------------------------------------- altura ---

/**
 * Presupuesto de espacio. Todo en mm, derivado del CSS de templates/cv.html.
 * Si tocas el CSS de la plantilla, estos numeros dejan de valer y el test de
 * calibracion te lo dira.
 */
const MM_POR_PT = 0.3528;

/**
 * Ancho medio de caracter como fraccion del tamano de fuente, para Inter con
 * texto en ingles. Es el unico numero de aqui que no sale del CSS, y del que
 * depende el recuento de lineas de todo el CV: subirlo hace el modelo mas
 * pesimista. El test de calibracion es quien fija que siga siendo razonable.
 */
const RATIO_CARACTER = 0.48;

const PAGINA = {
  sidebarAlto: 297 - 8 - 5,
  sidebarAncho: 64 - 7.5 - 6.5,
  mainAlto: 297 - 8 - 5,
  mainAncho: 210 - 64 - 8 - 8
};

/**
 * Correccion del error sistematico de cada columna. Medido, no estimado.
 *
 * Metodo (2026-07-28, Chrome headless --print-to-pdf sobre el CV de diseno
 * original): se quita el overflow:hidden de .page, se inyecta un div espaciador
 * de altura conocida al final de la columna y se busca por biseccion la altura
 * a la que el PDF pasa de una pagina a dos. Eso da el hueco libre real.
 *
 *   lateral:   ~35mm libres de 284 -> ocupacion real 88%, el modelo decia 82%
 *   principal:  ~8mm libres de 284 -> ocupacion real 97%, el modelo decia 103%
 *
 * Van en direcciones opuestas, asi que no se corrigen tocando RATIO_CARACTER:
 * el lateral es cajas apiladas y el principal es prosa que fluye, y el modelo
 * falla distinto en cada uno. Si cambias el CSS de la plantilla, repite la
 * medicion antes de fiarte de un solo aviso.
 */
const CALIBRACION = { sidebar: 1.06, main: 0.94 };

/** Altura de una linea de texto de N puntos con el line-height dado. */
const alturaLinea = (pt: number, lh: number) => pt * lh * MM_POR_PT;

/** Cuantas lineas ocupa un texto en un ancho dado. Nunca menos de una. */
function lineas(texto: string, anchoMm: number, pt: number): number {
  const anchoCaracter = pt * RATIO_CARACTER * MM_POR_PT;
  return Math.max(1, Math.ceil((texto.length * anchoCaracter) / anchoMm));
}

/** Los tags son inline-block con wrap: se empaquetan como cajas, no como texto. */
function filasDeTags(tags: string[], anchoMm: number): number {
  const GAP = 1.2;
  const PADDING = 1.7 * 2 + 0.6; // padding horizontal + los dos bordes
  let filas = 1;
  let usado = 0;
  for (const tag of tags) {
    const ancho = tag.length * 7.2 * RATIO_CARACTER * MM_POR_PT + PADDING;
    const necesita = usado === 0 ? ancho : ancho + GAP;
    if (usado + necesita > anchoMm) {
      filas += 1;
      usado = ancho;
    } else {
      usado += necesita;
    }
  }
  return filas;
}

function altoSidebar(sel: Resuelta): number {
  const W = PAGINA.sidebarAncho;
  let h = 0;

  // Nombre: siempre dos lineas, van en dos divs.
  h += 2 * alturaLinea(15.5, 1.08) + 3.8;

  // Titular: una linea por cada <br> mas la ultima.
  const lineasTitular = sel.headline.split(/<br\s*\/?>/i).reduce((acc, trozo) => acc + lineas(trozo, W, 9.2), 0);
  h += lineasTitular * alturaLinea(9.2, 1.45) + 3.8;

  h += lineas(sel.summary, W, 7.8) * alturaLinea(7.8, 1.34) + 3.6;

  const contacto = [sel.base.identity.location, ...sel.base.identity.links.map((l) => l.label)];
  h += contacto.reduce((acc, t) => acc + lineas(t, W, 7.8) * alturaLinea(7.8, 1.34) + 0.8, 0) + 3.8;

  // Tech Stack
  h += alturaLinea(10.5, 1.2) + 1.3 + 2.3;
  const altoFilaTag = alturaLinea(7.2, 1.34) + 0.8 * 2 + 0.6;
  for (const g of sel.stack) {
    h += alturaLinea(7.6, 1.34) + 1.2;
    const filas = filasDeTags(g.tags, W);
    h += filas * altoFilaTag + (filas - 1) * 1.2 + 2;
  }
  h += 3.7;

  // Idiomas
  h += alturaLinea(10.5, 1.2) + 1.3 + 2.3;
  h += sel.base.languages.length * (alturaLinea(7.8, 1.34) + 0.8) + 3.7;

  return h;
}

function altoMain(sel: Resuelta): number {
  const W = PAGINA.mainAncho;
  const LINEA = alturaLinea(8.2, 1.34);
  let h = 0;
  let primeraSeccion = true;

  const abreSeccion = () => {
    h += alturaLinea(12.5, 1.2) + 3.8 + (primeraSeccion ? 0 : 4);
    primeraSeccion = false;
  };

  if (sel.experience.length > 0) {
    abreSeccion();
    for (const e of sel.experience) {
      const titulo = `${e.role}${e.org ? ` · ${e.org}` : ""}`;
      // El titulo comparte fila flex con las fechas, que le roban ancho.
      h += lineas(titulo, W - 25, 10) * alturaLinea(10, 1.34);
      h += 0.9;
      h += e.bullets.reduce((acc, b) => acc + lineas(b.text, W - 4.5, 8.2) * LINEA + 0.6, 0);
      h += 2.6;
    }
  }

  if (sel.projects.length > 0) {
    abreSeccion();
    for (const p of sel.projects) {
      const titulo = `${p.title}${p.org ? ` · ${p.org}` : ""}`;
      h += lineas(titulo, W, 10) * alturaLinea(10, 1.34);
      if (p.stack) h += lineas(p.stack, W, 7.7) * alturaLinea(7.7, 1.34) + 0.3;
      h += p.lines.reduce(
        (acc, l) => acc + lineas(`${l.label}: ${l.text}`, W, 8.2) * LINEA + 0.9,
        0
      );
      h += 2.6;
    }
  }

  if (sel.education.length > 0) {
    abreSeccion();
    for (const e of sel.education) {
      const titulo = `${e.role}${e.org ? ` · ${e.org}` : ""}`;
      h += lineas(titulo, W - 20, 10) * alturaLinea(10, 1.34);
      if (e.note) h += lineas(e.note, W, 7.7) * alturaLinea(7.7, 1.34) + 0.3;
      h += 2.6;
    }
  }

  return h;
}

// -------------------------------------------------------------- seleccion ---

interface Resuelta {
  base: CvBase;
  headline: string;
  summary: string;
  stack: { label: string; tags: string[] }[];
  experience: CvBase["experience"];
  projects: CvBase["projects"];
  education: CvBase["education"];
}

/**
 * Resuelve la seleccion contra los datos base. Acumula TODOS los errores antes
 * de fallar: si el modelo se ha inventado tres ids quiero verlos los tres de
 * una vez, no descubrirlos en tres intentos.
 */
function resolver(base: CvBase, sel: CvSelection): Resuelta {
  const errores: string[] = [];
  const disponibles = (xs: { id: string }[]) => xs.map((x) => x.id).join(", ");

  let stack: { label: string; tags: string[] }[];
  if (sel.stack === undefined) {
    stack = base.stack.map((g) => ({ label: g.label, tags: g.tags }));
  } else {
    stack = [];
    for (const pedido of sel.stack) {
      const g = base.stack.find((x) => x.id === pedido.id);
      if (!g) {
        errores.push(`stack: no existe el grupo "${pedido.id}". Disponibles: ${disponibles(base.stack)}.`);
        continue;
      }
      let tags = g.tags;
      if (pedido.tags !== undefined) {
        const invalidos = pedido.tags.filter((t) => !g.tags.includes(t));
        if (invalidos.length > 0) {
          errores.push(
            `stack "${g.id}": estos tags no estan en cv-data.json y no puedo inventarlos: ${invalidos
              .map((t) => `"${t}"`)
              .join(", ")}. Disponibles: ${g.tags.join(", ")}.`
          );
        }
        tags = pedido.tags.filter((t) => g.tags.includes(t));
      }
      stack.push({ label: g.label, tags });
    }
  }

  let experience: CvBase["experience"];
  if (sel.experience === undefined) {
    experience = base.experience;
  } else {
    experience = [];
    for (const pedido of sel.experience) {
      const e = base.experience.find((x) => x.id === pedido.id);
      if (!e) {
        errores.push(
          `experience: no existe el puesto "${pedido.id}". Disponibles: ${disponibles(base.experience)}.`
        );
        continue;
      }
      let bullets = e.bullets;
      if (pedido.bullets !== undefined) {
        const invalidos = pedido.bullets.filter((id) => !e.bullets.some((b) => b.id === id));
        if (invalidos.length > 0) {
          errores.push(
            `experience "${e.id}": no existen los bullets ${invalidos
              .map((t) => `"${t}"`)
              .join(", ")}. Disponibles: ${disponibles(e.bullets)}.`
          );
        }
        bullets = pedido.bullets
          .map((id) => e.bullets.find((b) => b.id === id))
          .filter((b): b is { id: string; text: string } => b !== undefined);
      }
      experience.push({ ...e, bullets });
    }
  }

  const porIds = <T extends { id: string }>(
    todos: T[],
    ids: string[] | undefined,
    campo: string
  ): T[] => {
    if (ids === undefined) return todos;
    const salida: T[] = [];
    for (const id of ids) {
      const item = todos.find((x) => x.id === id);
      if (!item) {
        errores.push(`${campo}: no existe "${id}". Disponibles: ${disponibles(todos)}.`);
        continue;
      }
      salida.push(item);
    }
    return salida;
  };

  const projects = porIds(base.projects, sel.projects, "projects");
  const education = porIds(base.education, sel.education, "education");

  if (errores.length > 0) {
    throw new Error(
      [
        "La seleccion cita contenido que no existe en cv-data.json, asi que no se ha escrito nada.",
        "El CV solo puede contener lo que ya esta en esos datos: si algo falta, anadelo antes al archivo.",
        "",
        ...errores.map((e) => `- ${e}`)
      ].join("\n")
    );
  }

  return {
    base,
    headline: sel.headline ?? base.identity.headline,
    summary: sel.summary ?? base.summary,
    stack,
    experience,
    projects,
    education
  };
}

// ----------------------------------------------------------------- render ---

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** El titular es el unico sitio donde un <br> del usuario es intencional. */
const escaparConSaltos = (s: string) => escapar(s).replace(/&lt;br\s*\/?&gt;/gi, "<br>");

function bloqueContacto(base: CvBase): string {
  return [
    `      <span>${escapar(base.identity.location)}</span>`,
    ...base.identity.links.map(
      (l) => `      <a href="${escapar(l.href)}">${escapar(l.label)}</a>`
    )
  ].join("\n");
}

function bloqueStack(stack: { label: string; tags: string[] }[]): string {
  return stack
    .map((g) =>
      [
        `      <div class="stack-group">`,
        `        <div class="stack-label">${escapar(g.label)}</div>`,
        `        <div class="tags">`,
        ...g.tags.map((t) => `          <span class="tag">${escapar(t)}</span>`),
        `        </div>`,
        `      </div>`
      ].join("\n")
    )
    .join("\n\n");
}

function bloqueIdiomas(base: CvBase): string {
  return base.languages
    .map(
      (l) =>
        `      <div class="lang-row"><b>${escapar(l.name)}</b><span>${escapar(l.level)}</span></div>`
    )
    .join("\n");
}

function cabeceraEntrada(titulo: string, org: string | undefined, fechas: string | undefined): string {
  const rol = org
    ? `${escapar(titulo)} <span class="org">· ${escapar(org)}</span>`
    : escapar(titulo);
  return [
    `        <div class="entry-head">`,
    `          <div class="role">${rol}</div>`,
    ...(fechas ? [`          <div class="dates">${escapar(fechas)}</div>`] : []),
    `        </div>`
  ].join("\n");
}

function seccion(titulo: string, entradas: string[]): string {
  return [
    `    <section>`,
    `      <div class="main-title"><span class="bar"></span>${titulo}</div>`,
    ``,
    entradas.join("\n\n"),
    `    </section>`
  ].join("\n");
}

function bloqueMain(sel: Resuelta): string {
  const secciones: string[] = [];

  if (sel.experience.length > 0) {
    secciones.push(
      seccion(
        "Work Experience",
        sel.experience.map((e) =>
          [
            `      <div class="entry">`,
            cabeceraEntrada(e.role, e.org, e.dates),
            `        <ul>`,
            ...e.bullets.map((b) => `          <li>${escapar(b.text)}</li>`),
            `        </ul>`,
            `      </div>`
          ].join("\n")
        )
      )
    );
  }

  if (sel.projects.length > 0) {
    secciones.push(
      seccion(
        "Projects",
        sel.projects.map((p) =>
          [
            `      <div class="entry">`,
            cabeceraEntrada(p.title, p.org, undefined),
            ...(p.stack ? [`        <div class="proj-stack">${escapar(p.stack)}</div>`] : []),
            ...p.lines.map(
              (l) =>
                `        <div class="proj-line"><b>${escapar(l.label)}:</b> ${escapar(l.text)}</div>`
            ),
            `      </div>`
          ].join("\n")
        )
      )
    );
  }

  if (sel.education.length > 0) {
    secciones.push(
      seccion(
        "Education",
        sel.education.map((e) =>
          [
            `      <div class="entry">`,
            cabeceraEntrada(e.role, e.org, e.dates),
            ...(e.note ? [`        <div class="proj-stack">${escapar(e.note)}</div>`] : []),
            `      </div>`
          ].join("\n")
        )
      )
    );
  }

  return secciones.join("\n\n");
}

export interface RenderCvResult {
  html: string;
  /** Porcentaje de la pagina ocupado, estimado. Por encima de 100 se pierde contenido. */
  usoSidebar: number;
  usoMain: number;
  avisos: string[];
}

/** Por encima de este porcentaje la estimacion ya no da margen a su propio error. */
const UMBRAL_JUSTO = 93;

export function renderCv(
  base: CvBase,
  seleccion: CvSelection,
  plantilla: string,
  sello: string
): RenderCvResult {
  const sel = resolver(base, seleccion);

  const usoSidebar = (altoSidebar(sel) / PAGINA.sidebarAlto) * 100 * CALIBRACION.sidebar;
  const usoMain = (altoMain(sel) / PAGINA.mainAlto) * 100 * CALIBRACION.main;

  const avisos: string[] = [];
  const revisar = (nombre: string, uso: number, consejo: string) => {
    if (uso > 100) {
      avisos.push(
        `DESBORDA: ${nombre} al ${uso.toFixed(0)}% de la pagina. Lo que sobra se corta sin aviso al imprimir. ${consejo}`
      );
    } else if (uso > UMBRAL_JUSTO) {
      avisos.push(
        `Justo: ${nombre} al ${uso.toFixed(0)}%. La estimacion no es exacta, abrelo y comprueba el final de la columna antes de enviarlo.`
      );
    }
  };
  revisar("la columna lateral", usoSidebar, "Quita tags del stack o acorta el summary.");
  revisar("la columna principal", usoMain, "Quita un proyecto o bullets de experiencia.");

  const comentario = seleccion.note
    ? `\n<!-- Adaptado a ${escapar(seleccion.offerId)}: ${escapar(seleccion.note)} -->`
    : "";

  const html = plantilla
    .replace("{{TITLE}}", `${escapar(base.identity.nameTop)} ${escapar(base.identity.nameBottom)} — CV`)
    .replace("{{STAMP}}", escapar(sello))
    .replace("{{NAME}}", `${escapar(base.identity.nameTop)}<br>${escapar(base.identity.nameBottom)}`)
    .replace("{{HEADLINE}}", escaparConSaltos(sel.headline))
    .replace("{{SUMMARY}}", escapar(sel.summary))
    .replace("{{CONTACT}}", bloqueContacto(base))
    .replace("{{STACK}}", bloqueStack(sel.stack))
    .replace("{{LANGUAGES}}", bloqueIdiomas(base))
    .replace("{{MAIN}}", bloqueMain(sel));

  return { html: html.replace("</body>", `${comentario}\n</body>`), usoSidebar, usoMain, avisos };
}
