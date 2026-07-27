import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DATA_DIR, paths } from "./config.js";
import {
  assertSafeId,
  readIfExists,
  readRequired,
  today,
  writeAtomic
} from "./lib/files.js";
import { confirmSkill } from "./lib/graduate.js";
import {
  addOfferNote,
  buildOffer,
  OFFER_STATUSES,
  replaceAnalysis,
  setFrontmatterField,
  setOfferStatus
} from "./lib/offers.js";
import { listGaps, recordGap } from "./lib/radar.js";
import { SKILL_LEVELS, updateSkillLevel } from "./lib/skills.js";

/**
 * Tools: acciones CON efectos secundarios que el modelo puede decidir invocar.
 *
 * La descripcion de cada tool y de cada parametro no es documentacion: es el
 * unico contexto que tiene el modelo para decidir cuando y como llamarlo. El
 * esquema Zod valida despues; la descripcion evita la llamada equivocada antes.
 */

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({
  content: [{ type: "text" as const, text }],
  isError: true
});

/**
 * Un fallo esperado (id invalido, archivo que falta) se devuelve como isError
 * con un mensaje accionable. Una excepcion sin capturar solo produce un error
 * opaco en el cliente y el modelo no sabe como corregirse.
 */
function guard(fn: () => { content: { type: "text"; text: string }[]; isError?: boolean }) {
  try {
    return fn();
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

export function registerTools(server: McpServer): void {
  const p = paths();

  // ---------------------------------------------------------------- radar ---

  server.registerTool(
    "record_gap",
    {
      title: "Registrar hueco",
      description:
        "Registra que una oferta pide una skill que NO tengo. Si el termino ya esta en el radar sube su contador en uno y anade la fuente; si no esta, lo crea con contador 1. Nunca duplica. Llamalo una vez por cada skill que la oferta pida y falte en mi perfil, incluidos los terminos que no sabria definir en una entrevista.",
      inputSchema: {
        term: z
          .string()
          .min(1)
          .describe("La skill o concepto que falta, tal y como lo llamaria un ingeniero. Ej: 'Kubernetes'."),
        category: z
          .string()
          .describe(
            "Categoria a la que pertenece, para saber bajo que '##' colocarla en el perfil cuando se gradue. Ej: 'Infraestructura'."
          ),
        source: z
          .string()
          .describe("Oferta que lo pide, para poder rastrearlo. Ej: 'Google SWE II, Malaga'.")
      },
      annotations: { destructiveHint: false, idempotentHint: false }
    },
    async ({ term, category, source }) =>
      guard(() => {
        const content = readRequired(p.radar, "radar-huecos.md");
        const r = recordGap(content, term, category, source);
        if (r.changed) writeAtomic(p.radar, r.content);
        return ok(r.message);
      })
  );

  server.registerTool(
    "list_gaps",
    {
      title: "Listar huecos",
      description:
        "Devuelve todos los huecos del radar ordenados por contador descendente: lo primero es lo que mas ofertas han pedido y por tanto lo mas urgente de aprender.",
      annotations: { readOnlyHint: true }
    },
    async () =>
      guard(() => {
        const gaps = listGaps(readRequired(p.radar, "radar-huecos.md"));
        if (gaps.length === 0) return ok("El radar esta vacio.");
        const filas = gaps.map(
          (g) =>
            `| ${g.counter} | ${g.term} | ${g.category ?? "-"} | ${g.sources.join("; ") || "-"} |`
        );
        return ok(
          [
            `${gaps.length} hueco(s), de mas a menos urgente:`,
            "",
            "| Contador | Termino | Categoria | Fuentes |",
            "| --- | --- | --- | --- |",
            ...filas
          ].join("\n")
        );
      })
  );

  server.registerTool(
    "confirm_skill",
    {
      title: "Graduar skill",
      description:
        "La graduacion: confirma que ya tengo una skill que estaba en el radar. La saca del radar y la mete en perfil-skills.md con su nivel y la evidencia. Es el UNICO camino de hueco a perfil. Usalo solo cuando el usuario confirme que lo ha adquirido (certificacion, proyecto o experiencia real), nunca por iniciativa propia.",
      inputSchema: {
        term: z.string().min(1).describe("Termino tal y como aparece en el radar."),
        level: z
          .enum(SKILL_LEVELS)
          .describe(
            "solido = lo defiendo en entrevista con evidencia en un proyecto. parcial = lo he tocado, no lo domino."
          ),
        evidence: z
          .string()
          .min(1)
          .describe(
            "Por que puedo defenderlo: certificacion, proyecto o experiencia. Va al perfil como nota. La oferta que origino el hueco NO se conserva."
          ),
        category: z
          .string()
          .optional()
          .describe("Solo si el hueco no traia categoria en el radar.")
      },
      annotations: { destructiveHint: false, idempotentHint: false }
    },
    async ({ term, level, evidence, category }) =>
      guard(() => {
        const radar = readRequired(p.radar, "radar-huecos.md");
        const skills = readRequired(p.skills, "perfil-skills.md");
        const r = confirmSkill(radar, skills, term, level, evidence, category);
        if (!r.ok) return fail(r.message);
        // Los dos archivos se escriben juntos o no se escribe ninguno.
        writeAtomic(p.radar, r.radar);
        writeAtomic(p.skills, r.skills);
        return ok(r.message);
      })
  );

  // --------------------------------------------------------------- perfil ---

  server.registerTool(
    "update_skill_level",
    {
      title: "Cambiar nivel de una skill",
      description:
        "Cambia el nivel de un termino que YA esta en perfil-skills.md. Para algo que aun no esta en el perfil usa confirm_skill.",
      inputSchema: {
        term: z.string().min(1).describe("Termino tal y como aparece en perfil-skills.md."),
        level: z.enum(SKILL_LEVELS).describe("Nuevo nivel: solido o parcial.")
      },
      annotations: { destructiveHint: false, idempotentHint: true }
    },
    async ({ term, level }) =>
      guard(() => {
        const content = readRequired(p.skills, "perfil-skills.md");
        const r = updateSkillLevel(content, term, level);
        if (!r.changed) return fail(r.message);
        writeAtomic(p.skills, r.content);
        return ok(r.message);
      })
  );

  // -------------------------------------------------------------- ofertas ---

  server.registerTool(
    "save_offer",
    {
      title: "Guardar analisis de oferta",
      description:
        "Crea o actualiza el archivo de una oferta con su analisis. Si la oferta ya existia se sustituye SOLO el analisis: el estado y las notas de entrevista se conservan.",
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe("Identificador y nombre de archivo, formato AAAA-MM-empresa. Ej: '2026-07-google'."),
        title: z.string().min(1).describe("Puesto tal y como lo titula la oferta."),
        company: z.string().min(1).describe("Empresa."),
        markdown: z
          .string()
          .min(1)
          .describe("El analisis completo en Markdown, con los seis puntos de la plantilla."),
        score: z
          .number()
          .int()
          .min(0)
          .max(12)
          .optional()
          .describe("Puntuacion 0-12 sumando los seis ejes de criterios.md."),
        salario: z.string().optional().describe("Rango o cifra tal y como la publica la oferta."),
        url: z.string().optional().describe("Enlace a la oferta original."),
        tags: z.array(z.string()).optional().describe("Etiquetas cortas. Ej: ['backend','bigtech'].")
      },
      annotations: { destructiveHint: false, idempotentHint: true }
    },
    async ({ id, title, company, markdown, score, salario, url, tags }) =>
      guard(() => {
        const safe = assertSafeId(id);
        const file = p.offer(safe);
        const fecha = today();
        const existente = readIfExists(file);

        if (existente === undefined) {
          writeAtomic(
            file,
            buildOffer({ id: safe, title, company, markdown, date: fecha, score, salario, url, tags })
          );
          return ok(`Oferta "${safe}" creada en ofertas/${safe}.md con estado "analizada".`);
        }

        let content = replaceAnalysis(existente, markdown, fecha);
        content = setFrontmatterField(content, "title", title);
        content = setFrontmatterField(content, "company", company);
        if (score !== undefined) content = setFrontmatterField(content, "score", String(score));
        if (salario !== undefined) content = setFrontmatterField(content, "salario", salario);
        if (url !== undefined) content = setFrontmatterField(content, "url", url);
        if (tags !== undefined) content = setFrontmatterField(content, "tags", `[${tags.join(", ")}]`);
        writeAtomic(file, content);
        return ok(
          `Oferta "${safe}" actualizada: analisis sustituido, estado y notas de entrevista conservados.`
        );
      })
  );

  server.registerTool(
    "set_offer_status",
    {
      title: "Cambiar estado de una oferta",
      description:
        "Mueve una oferta por su ciclo de vida y deja el cambio anotado con fecha en su registro. Ciclo: analizada -> solicitada -> entrevista -> oferta -> aceptada. Salidas laterales desde cualquier punto: denegada (me rechazan) y descartada (decido no seguir).",
      inputSchema: {
        id: z.string().min(1).describe("Id de la oferta. Ej: '2026-07-google'."),
        status: z.enum(OFFER_STATUSES).describe("Nuevo estado, uno de los siete del ciclo de vida.")
      },
      annotations: { destructiveHint: false, idempotentHint: true }
    },
    async ({ id, status }) =>
      guard(() => {
        const safe = assertSafeId(id);
        const file = p.offer(safe);
        const content = readIfExists(file);
        if (content === undefined) return fail(`No existe la oferta "${safe}" en ofertas/.`);
        const r = setOfferStatus(content, status, today());
        if (!r.changed) return ok(r.message);
        writeAtomic(file, r.content);
        return ok(`${safe}: ${r.message}`);
      })
  );

  server.registerTool(
    "add_offer_note",
    {
      title: "Anotar en una oferta",
      description:
        "Anade una nota fechada a la seccion 'Notas de entrevista' de una oferta. Para quien me entrevista, que me preguntaron, feedback recibido o cualquier cosa que quiera releer antes de la siguiente ronda. Las notas se acumulan, nunca se sobrescriben.",
      inputSchema: {
        id: z.string().min(1).describe("Id de la oferta."),
        note: z.string().min(1).describe("Texto de la nota. Admite varias lineas y Markdown.")
      },
      annotations: { destructiveHint: false, idempotentHint: false }
    },
    async ({ id, note }) =>
      guard(() => {
        const safe = assertSafeId(id);
        const file = p.offer(safe);
        const content = readIfExists(file);
        if (content === undefined) return fail(`No existe la oferta "${safe}" en ofertas/.`);
        const r = addOfferNote(content, note, today());
        if (!r.changed) return fail(r.message);
        writeAtomic(file, r.content);
        return ok(`${safe}: ${r.message}`);
      })
  );

  server.registerTool(
    "ping",
    {
      title: "Ping",
      description:
        "Comprueba que el servidor esta vivo y sobre que carpeta de datos esta trabajando.",
      annotations: { readOnlyHint: true }
    },
    async () => ok(`pong. Datos en ${DATA_DIR}. ${new Date().toISOString()}`)
  );
}
