/**
 * Fixtures calcados de los archivos reales, incluidas sus trampas:
 * la seccion '## Reglas' con vinietas que NO son huecos, la watchlist con
 * contador 0, las notas entre parentesis y las fuentes con comas dentro.
 */

export const SKILLS_MD = `# Perfil de skills: lo que tengo

Solo skills que poseo, a nivel **[solido]** o **[parcial]**.

---

## Lenguajes de programacion
- [solido] Java (Java 8, un ano en Indra mas el backend del proyecto WhatsApp)
- [solido] Python (proyectos de IA, scripting, fine-tuning)
- [parcial] JavaScript y TypeScript

## Backend
- [solido] Spring y Spring Boot
- [solido] Testing: JUnit5, Mockito, cobertura de codigo
- [parcial] JBoss, Maven

## Infraestructura, DevOps y despliegue
- [solido] Docker
- [parcial] RunPod y GPU cloud (usado para fine-tuning, no en produccion)
`;

export const RADAR_MD = `# Radar de huecos

Skills que las ofertas piden y que aun no tengo.

## Reglas
- Cuando una oferta pide algo que ya esta aqui, sube su contador en uno.
- Anade la fuente y tambien un contador a la seccion de fuentes registradas.
- Aqui nunca hay skills que ya tengo.

## Confirmados por ofertas
- [contador: 1] Sistemas distribuidos e infraestructura a gran escala (Infraestructura). Fuentes: Google SWE II Threat Intelligence, Malaga.
- [contador: 3] Diseno de sistemas a gran escala (Fundamentos). Fuentes: Google SWE II, Malaga
- [contador: 1] Accesibilidad, a11y (Frontend). Fuentes: Google SWE II, Malaga.

## Watchlist sin confirmar por ofertas
Hipotesis de valor que aun no ha pedido ninguna oferta.
- [contador: 0] Kubernetes (Infraestructura).
- [contador: 0] Graph RAG (Ingenieria de LLM).

## Fuentes registradas
`;
