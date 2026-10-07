import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { paths } from "./config.js";
import { readIfExists } from "./lib/files.js";

/**
 * Prompts: el unico primitivo que invoca el USUARIO, no el modelo.
 *
 * Un prompt es una plantilla que el servidor rellena con datos frescos y
 * entrega al cliente como mensajes iniciales. Aparece en el menu '/'.
 *
 * Aqui resuelve un problema concreto: la plantilla de analisis pide pegar el
 * perfil y el CV a mano, y lo que se pega a mano se queda desactualizado. El
 * servidor los lee del disco EN EL MOMENTO de invocar el prompt, asi que el
 * analisis siempre corre contra el perfil de hoy.
 */

/** El texto es del usuario. El servidor solo lo rellena; no opina sobre el. */
function plantilla(skills: string, criterios: string, cv: string | undefined): string {
  const bloqueCv = cv
    ? ["## Mi CV", "", cv, ""].join("\n")
    : [
        "## Mi CV",
        "",
        "(No hay cv.md en la bóveda. Para el punto 2 usa solo el perfil de skills",
        "de arriba, y avisa de que la evidencia será menos concreta de lo debido.)",
        ""
      ].join("\n");

  return [
    "Analiza esta oferta contra mi perfil. Mi objetivo a largo plazo es ingeniería",
    "de software y ML en una empresa grande tipo Google, o mi propia startup de IA.",
    "Sé honesto, no me consueles.",
    "",
    "Cada oferta se juzga SOLA, contra mi perfil y nada más. No la compares con",
    "otras ofertas del pipeline, no digas cuál es mejor y no me propongas elegir",
    "entre varias: cada una se decide por su cuenta y tiene su propio CV.",
    "",
    "Estructura tu respuesta así:",
    "",
    "1. **Veredicto**: elige UNA de estas cuatro y justifícala. La justificación es",
    "   lo que importa, así que apóyala en requisitos concretos de la oferta y en",
    "   evidencia concreta de mi perfil.",
    "   - *Encaja*: cumplo lo que pide, aplicar es lo obvio.",
    "   - *Reach razonable*: me falta algo real, pero es defendible y merece el tiro.",
    "   - *Demasiado exigente*: el nivel que pide está por encima de donde estoy hoy.",
    "     Di qué exactamente lo pone fuera de alcance.",
    "   - *No merece el tiempo*: llego al listón técnico, pero falla en lo que me",
    "     importa según mis criterios.",
    "",
    "   El salario NUNCA decide el veredicto: ni bajo ni sin publicar justifica",
    "   *No merece el tiempo*. Menciónalo como dato y puntúalo en su eje, nada más.",
    "",
    "2. **Lo que ya tengo** que la oferta pide. Cita evidencia concreta de mi CV o",
    "   proyectos, no genéricos.",
    "",
    "3. **Lo que NO tengo** y la oferta pide. Separa en:",
    "   - Indispensable (sin esto ni me leen)",
    "   - Deseable (suma pero no bloquea)",
    "   - Ruido (lo piden pero da igual, se aprende en el puesto)",
    "",
    "4. **El hueco más barato de cerrar**: de todo lo que me falta, qué es lo que con",
    "   menos esfuerzo me haría pasar de \"no cualificado\" a \"candidato defendible\".",
    "",
    "5. **Términos que no domino**: lista los conceptos técnicos de la oferta que",
    "   debería saber definir en una entrevista y probablemente no sepa. No los",
    "   expliques todavía, solo lístalos para que yo pida los que quiera.",
    "",
    "6. **Qué destacar y qué callar en el CV para ESTA oferta**: qué tres cosas de mi",
    "   perfil pongo arriba del todo, y qué cosas irrelevantes quito para no diluir.",
    "",
    "---",
    "",
    "## Qué hacer después del análisis",
    "",
    "Cuando termines el análisis, y solo entonces:",
    "",
    "- Guarda el análisis con `save_offer`. El id es AAAA-MM-empresa (ej. 2026-07-google).",
    "  Incluye `score` si has podido puntuar los seis ejes de mis criterios sobre 12.",
    "- Por CADA término de los puntos 3 y 5 que yo no tenga, llama a `record_gap` una",
    "  vez, con su categoría y con esta oferta como fuente. Son dos fuentes distintas",
    "  de huecos: el punto 3 son requisitos del puesto, el punto 5 son conceptos que no",
    "  sabría defender en una entrevista. Ambos cuentan.",
    "- NO llames a `record_gap` con algo que ya esté en mi perfil de skills.",
    "- NO llames a `confirm_skill` por tu cuenta: eso solo lo confirmo yo cuando de",
    "  verdad haya adquirido la skill.",
    "- Al terminar, ofreceme un CV adaptado a esta oferta: dime en dos lineas que",
    "  proyectos pondrias delante y que quitarias del punto 6. NO llames a",
    "  `render_cv` hasta que yo te diga que si. Cuando lo haga, recuerda que solo",
    "  puedes elegir contenido que ya exista en cv-data.json.",
    "",
    "---",
    "",
    "## Mi perfil de skills (lo que YA tengo)",
    "",
    skills,
    "",
    "---",
    "",
    bloqueCv,
    "---",
    "",
    "## Mis criterios de decisión",
    "",
    criterios,
    "",
    "---",
    "",
    "Debajo de esta linea pego el texto de la oferta:",
    ""
  ].join("\n");
}

export function registerPrompts(server: McpServer): void {
  const p = paths();

  server.registerPrompt(
    "analyze_offer",
    {
      title: "Analizar una oferta",
      description:
        "Devuelve la plantilla de analisis rellenada con mi perfil, mi CV y mis criterios actuales, lista para pegar debajo el texto de una oferta."
    },
    async () => {
      const skills = readIfExists(p.skills) ?? "(No se encontro perfil-skills.md)";
      const criterios = readIfExists(p.criteria) ?? "(No se encontro criterios.md)";
      const cv = readIfExists(p.cv);

      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text: plantilla(skills, criterios, cv) }
          }
        ]
      };
    }
  );
}
