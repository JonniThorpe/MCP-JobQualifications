import {
  McpServer,
  ResourceTemplate
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { DATA_DIR, paths } from "./config.js";
import { assertSafeId, listOffers, readIfExists } from "./lib/files.js";
import { sortRadar } from "./lib/radar.js";

/**
 * Resources: contexto de SOLO LECTURA identificado por URI.
 *
 * A diferencia de un tool, un resource no lo invoca el modelo por su cuenta: lo
 * adjunta el usuario. Por eso no tienen esquema de entrada ni efectos
 * secundarios. Si algo escribe, es un tool aunque devuelva datos.
 */

const MD = "text/markdown";

function textResource(uri: string, text: string) {
  return { contents: [{ uri, mimeType: MD, text }] };
}

/** Un archivo que falta no es un crash: es un mensaje que explica que hacer. */
function fileOrHint(uri: string, file: string, queEs: string) {
  const content = readIfExists(file);
  if (content === undefined) {
    return textResource(
      uri,
      `No existe ${queEs}.\n\nEsperaba encontrarlo en:\n  ${file}\n\n` +
        `Comprueba que JOB_MCP_DATA_DIR apunta a tu boveda (ahora mismo: ${DATA_DIR}).`
    );
  }
  return textResource(uri, content);
}

export function registerResources(server: McpServer): void {
  const p = paths();

  server.registerResource(
    "perfil-skills",
    "profile://skills",
    {
      title: "Perfil de skills",
      description:
        "Lo que YA tengo, por categorias, con nivel [solido] o [parcial]. Nunca contiene huecos.",
      mimeType: MD
    },
    async (uri) => fileOrHint(uri.href, p.skills, "perfil-skills.md")
  );

  server.registerResource(
    "radar-huecos",
    "profile://gaps",
    {
      title: "Radar de huecos",
      description:
        "Lo que el mercado pide y NO tengo, con un contador de cuantas ofertas lo han pedido, ordenado de mas a menos urgente.",
      mimeType: MD
    },
    async (uri) => {
      const content = readIfExists(p.radar);
      if (content === undefined) return fileOrHint(uri.href, p.radar, "radar-huecos.md");
      // El orden se garantiza al servir, no solo al escribir: si el archivo se
      // ha editado a mano, el resource lo devuelve ordenado igualmente.
      return textResource(uri.href, sortRadar(content));
    }
  );

  server.registerResource(
    "cv",
    "profile://cv",
    {
      title: "CV",
      description:
        "Mi CV en Markdown: experiencia, proyectos con su contexto y stack. Es la fuente de la evidencia concreta que hay que citar al analizar una oferta.",
      mimeType: MD
    },
    async (uri) => fileOrHint(uri.href, p.cv, "cv.md")
  );

  server.registerResource(
    "criterios",
    "profile://criteria",
    {
      title: "Criterios de decision",
      description:
        "Filtros eliminatorios y los seis ejes de puntuacion que deciden si una oferta merece el tiempo.",
      mimeType: MD
    },
    async (uri) => fileOrHint(uri.href, p.criteria, "criterios.md")
  );

  server.registerResource(
    "ofertas",
    "offers://list",
    {
      title: "Pipeline de ofertas",
      description:
        "Todas las ofertas analizadas con su estado actual, para ver el pipeline de un vistazo.",
      mimeType: MD
    },
    async (uri) => {
      const ofertas = listOffers(DATA_DIR);
      if (ofertas.length === 0) {
        return textResource(
          uri.href,
          `# Pipeline de ofertas\n\nTodavia no hay ninguna oferta analizada en ${p.ofertasDir}.`
        );
      }
      const filas = ofertas.map(
        (o) =>
          `| ${o.status} | ${o.company} | ${o.title} | ${o.score || "-"} | ${o.updated || "-"} | \`${o.id}\` |`
      );
      return textResource(
        uri.href,
        [
          "# Pipeline de ofertas",
          "",
          `${ofertas.length} oferta(s). Lee \`offers://{id}\` para el detalle de una.`,
          "",
          "| Estado | Empresa | Puesto | Score | Actualizada | Id |",
          "| --- | --- | --- | --- | --- | --- |",
          ...filas
        ].join("\n")
      );
    }
  );

  // Resource dinamico: una URI por oferta. El `list` enumera las existentes para
  // que el cliente pueda ofrecerlas sin que el usuario recuerde los ids.
  server.registerResource(
    "oferta",
    new ResourceTemplate("offers://{id}", {
      list: async () => ({
        resources: listOffers(DATA_DIR).map((o) => ({
          uri: `offers://${o.id}`,
          name: `${o.company} - ${o.title} [${o.status}]`,
          mimeType: MD
        }))
      })
    }),
    {
      title: "Oferta analizada",
      description:
        "Una oferta completa: analisis, registro de estados y notas de entrevista. Pensado para ponerse en contexto antes de una entrevista.",
      mimeType: MD
    },
    async (uri, variables) => {
      const raw = Array.isArray(variables.id) ? variables.id[0]! : String(variables.id);
      const id = assertSafeId(decodeURIComponent(raw));
      const content = readIfExists(p.offer(id));
      if (content === undefined) {
        const disponibles = listOffers(DATA_DIR).map((o) => o.id);
        return textResource(
          uri.href,
          `No existe la oferta "${id}".\n\n` +
            (disponibles.length
              ? `Ofertas disponibles:\n${disponibles.map((d) => `  - ${d}`).join("\n")}`
              : "Todavia no hay ninguna oferta analizada.")
        );
      }
      return textResource(uri.href, content);
    }
  );
}
