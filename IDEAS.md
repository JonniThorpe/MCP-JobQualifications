# IDEAS — mejoras fuera de alcance (aparcadas)

Cosas que han surgido durante el desarrollo pero que NO estan en el alcance
acordado. No construir sin decidirlo antes explicitamente.

## Fase 0-1

- **`npm audit`: 2 vulnerabilidades moderate en `@hono/node-server`**, dependencia
  transitiva de `@modelcontextprotocol/sdk` >= 1.25. Es un path traversal en
  `serve-static` del transporte HTTP. No nos afecta: usamos stdio y ese codigo no
  se carga. El `audit fix --force` degradaria el SDK a 1.24.3 (breaking).
  Revisar cuando el SDK publique una version con `@hono/node-server` >= 2.0.5.

- **Script de instalacion / reconfiguracion automatica.** Registrar el servidor en
  los dos clientes es manual (`claude mcp add` + editar
  `claude_desktop_config.json`). Se podria escribir un `npm run install-client`.
  De momento se documenta en el README (Fase 7).

- **Tests de integracion sobre el protocolo.** Probamos el servidor mandandole
  JSON-RPC crudo por stdin a mano. Se podria automatizar con el `Client` del propio
  SDK para tener tests end-to-end de resources/tools/prompts. El alcance acordado
  solo pide tests unitarios de la capa de archivos.

## Fase 2

- **Contador por EMPRESA, no por fuente.** `record_gap` recibe `source` como texto
  libre ("Google SWE II, Malaga") y la seccion "Fuentes registradas" cuenta ese
  texto tal cual. Mide "cuantos huecos me ha destapado esta oferta", que es util,
  pero no agrega por empresa: dos ofertas de Google cuentan como dos fuentes. Para
  agregar por empresa habria que pasar la empresa como parametro aparte.

- **Fuentes historicas con coma.** El separador de fuentes es ';' porque las
  fuentes reales llevan comas dentro. Las lineas que ya existian en el radar con
  formato "Fuentes: Google SWE II, Malaga." se leen como UNA sola fuente, que es lo
  correcto en este caso pero es una suposicion. Si alguna linea antigua tenia dos
  fuentes separadas por coma, se leera como una. No se ha tocado ninguna.

- **Colision de nombres de seccion en las ofertas.** Si el analisis pegado
  contuviera una cabecera literal "## Notas de entrevista" o "## Registro de
  estados", los tools escribirian en el sitio equivocado. Se podria delimitar con
  comentarios HTML invisibles en Obsidian. Riesgo bajo, no se ha implementado.

- **Watchlist como zona de contador 0.** Decidido: `record_gap` sobre un termino de
  la watchlist sube su contador pero lo DEJA en la watchlist. Alternativa
  descartada de momento: migrarlo automaticamente a "Confirmados por ofertas"
  cuando su contador llega a 1.

- **PENDIENTE, no aparcado: `perfil/cv.md`.** El punto 2 de la plantilla de
  analisis exige evidencia concreta del CV, y el punto 6 reordena sus secciones
  por oferta. Jonni tiene un CV ATS en .pdf/.docx que hay que convertir a
  Markdown para que el prompt pueda inyectarlo. Se decide en la Fase 5.

## Fase 5

- **`cv.md` y el `.docx` son dos copias que hay que mantener a mano.** El .docx
  ATS sigue siendo el que se envia; cv.md es la version que lee el MCP. Si cambia
  uno hay que cambiar el otro. Se podria automatizar la conversion con un script
  que extraiga `word/document.xml` del .docx, que es como se genero.

- **Generar el CV por oferta.** El punto 6 de la plantilla dice que destacar y que
  callar para cada oferta. Con cv.md en Markdown seria natural un tool
  `render_cv(offer_id)` que reordene las secciones segun ese punto 6 y escriba un
  cv-2026-07-google.md. Es la evolucion obvia, pero no esta en el alcance.

- **`criterios.md` inyectado en el prompt.** No lo pedia el documento; se anadio
  porque el prompt pide puntuar `score` sobre 12 y el cliente no puede puntuar
  ejes que no conoce. Si el prompt se hace demasiado largo, esto es lo primero
  que se quita.

## Fase 7

- **La boveda de datos no esta bajo git.** Solo lo esta el codigo. Versionar el
  DATA_DIR daria historial de como evoluciona el radar (que huecos aparecieron y
  cuando), que es informacion util. Requiere un repo privado aparte.

- **Bloqueo de escrituras concurrentes.** Las escrituras son atomicas (tmp +
  rename) pero no hay lock: dos llamadas simultaneas al mismo archivo podrian
  perder una. Con un solo usuario y un solo cliente, no es un problema real.
