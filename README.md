# job-search-mcp

Servidor MCP local que gestiona una busqueda de empleo sobre archivos Markdown.

El servidor no razona. El usuario habla con Claude, y Claude usa este servidor
para leer y escribir sus archivos con una estructura fija. **El cerebro es el
cliente; esto es la memoria y las manos.**

De un solo usuario, sin red, sin base de datos.

---

## Concepto central: dos archivos separados

Es la idea que sostiene todo lo demas.

- **`perfil-skills.md`** es lo que YA se tiene. Todo a nivel `[solido]` o
  `[parcial]`, nunca huecos. Un termino entra aqui solo cuando el usuario
  confirma que lo tiene.
- **`radar-huecos.md`** es lo que el mercado pide y no se tiene, cada termino con
  un **contador** de cuantas ofertas objetivo lo han pedido. Ordenado por
  contador: lo de arriba es lo mas urgente de aprender.

Ciclo de vida de una skill: nace como hueco cuando una oferta la pide, su
contador sube cada vez que otra oferta la vuelve a pedir, y **se gradua** cuando
el usuario confirma que la ha adquirido: sale del radar y entra en el perfil con
su nivel. Ese es el unico camino de hueco a perfil.

---

## Modelo de datos

Todo vive en `DATA_DIR`, un directorio que es a la vez una boveda de Obsidian.
El MCP escribe los `.md` y Obsidian los renderiza: la misma carpeta, cero
conflicto.

```
DATA_DIR/
  perfil/
    perfil-skills.md    - [solido|parcial] Termino (nota)          bajo '## Categoria'
    radar-huecos.md     - [contador: N] Termino (Categoria). Fuentes: a; b
    criterios.md        prosa libre: que hace que una oferta merezca el tiempo
    cv.md               CV en Markdown, fuente de la evidencia concreta
  ofertas/
    AAAA-MM-empresa.md  frontmatter YAML + analisis + registro de estados + notas
```

Estados de una oferta:
`analizada -> solicitada -> entrevista -> oferta -> aceptada`, con dos salidas
laterales desde cualquier punto: `denegada` y `descartada`.

### El servidor nunca regenera un archivo

Parsea solo las lineas que reconoce y edita **esa linea concreta**, dejando el
resto de bytes intactos. El discriminador es el patron (`- [contador: N] `), no
la posicion: por eso una seccion `## Reglas` llena de vinietas normales convive
sin problema con las lineas de datos.

Esto es deliberado. Los archivos los edita tambien un humano en Obsidian, asi que
**el formato es del usuario, no del servidor**.

---

## Superficie MCP

### Resources (solo lectura, los adjunta el usuario)

| URI | Contenido |
| --- | --- |
| `profile://skills` | perfil-skills.md |
| `profile://gaps` | radar-huecos.md, ordenado por contador al servir |
| `profile://cv` | cv.md |
| `profile://criteria` | criterios.md |
| `offers://list` | tabla del pipeline: estado, empresa, puesto, score |
| `offers://{id}` | una oferta entera: analisis, estados y notas |

### Tools (escriben, los invoca el modelo)

| Tool | Que hace |
| --- | --- |
| `record_gap(term, category, source)` | Sube el contador en 1 y anade la fuente. Si no existe, lo crea con 1. Nunca duplica. |
| `list_gaps()` | Huecos ordenados por contador descendente. |
| `confirm_skill(term, level, evidence, category?)` | La graduacion: saca del radar y mete en el perfil. Descarta las fuentes: al perfil solo viaja la evidencia. |
| `update_skill_level(term, level)` | Cambia solido/parcial de algo que ya esta en el perfil. |
| `save_offer(id, title, company, markdown, score?, salario?, url?, tags?)` | Crea o actualiza una oferta. Al actualizar conserva estado y notas. |
| `set_offer_status(id, status)` | Mueve por el ciclo de vida y lo anota con fecha. |
| `add_offer_note(id, note)` | Nota fechada en "Notas de entrevista". |
| `ping()` | Diagnostico: responde y dice sobre que `DATA_DIR` trabaja. |

### Prompt (lo invoca el usuario)

`analyze_offer` devuelve la plantilla de analisis rellenada con perfil, CV y
criterios **leidos del disco en ese instante**, mas las instrucciones de guardar
la oferta con `save_offer` y registrar cada hueco con `record_gap`. Debajo se
pega el texto de la oferta.

---

## Instalacion

Requiere Node >= 18 (probado con 24).

```powershell
npm install
npm run build
```

Configuracion: una unica variable de entorno.

| Variable | Por defecto |
| --- | --- |
| `JOB_MCP_DATA_DIR` | `~/Desktop/Productivo/Trabajo/Perfil` |

Comprobar que arranca (imprime la ruta de datos y se queda esperando en stdio):

```powershell
$env:JOB_MCP_DATA_DIR="<ruta a la boveda>"
node build/index.js
```

### Registrarlo en un cliente

Es un servidor **stdio**: el cliente lo lanza como proceso hijo. La declaracion
tiene siempre esta forma:

```jsonc
{
  "command": "node",
  "args": ["<ruta al repo>/build/index.js"],
  "env": { "JOB_MCP_DATA_DIR": "<ruta a la boveda>" }
}
```

- **Claude Code**: `~/.claude.json`, o `claude mcp add job-search --scope user -- node <ruta>/build/index.js`.
- **Claude Desktop**: bloque `mcpServers` en `claude_desktop_config.json`. Usa la
  ruta **absoluta** del ejecutable de node: Desktop se lanza desde el explorador
  y no hereda el PATH.

> Las rutas concretas de esta maquina estan en `SETUP.local.md`, fuera de git.

---

## La regla que mas tiempo cuesta aprender

> **Cada `npm run build` obliga a reiniciar el cliente.**

Un servidor MCP por stdio se lanza **una vez**, cuando arranca el cliente, y ese
proceso se queda vivo. No hay recarga en caliente. Cerrar la ventana de Claude
Desktop no basta: hay que salir desde el icono de la bandeja del sistema.

Sintoma tipico: pides un tool nuevo y el cliente jura que no existe.

---

## Desarrollo

```powershell
npm run build     # tsc -> build/
npm test          # tsc + node --test "build/**/*.test.js"   (40 tests)
npm run watch     # recompilar al guardar
```

```
src/
  index.ts          solo cablea: resources + tools + prompts + transporte stdio
  config.ts         DATA_DIR y rutas derivadas
  resources.ts      los 6 resources
  tools.ts          los 8 tools, con sus esquemas Zod
  prompts.ts        analyze_offer
  lib/
    markdown.ts     primitivas por linea: cabeceras, secciones, EOL, normalize
    skills.ts       perfil-skills.md
    radar.ts        radar-huecos.md y los contadores
    offers.ts       frontmatter, estados y notas
    graduate.ts     confirm_skill: la operacion que cruza los dos archivos
    files.ts        el UNICO modulo con I/O
```

`src/lib/*` son **funciones puras** con la forma
`(contenido, args) -> { contenido, changed, message }`. Por eso los tests no
tocan el disco y corren en 100 ms.

`graduate.ts` devuelve los dos contenidos nuevos sin escribir: quien llama
persiste ambos o ninguno. Es lo mas cerca de una transaccion que tiene sentido
aqui.

**Nunca uses `console.log` en el servidor.** stdout es el canal JSON-RPC y
escribir ahi rompe el protocolo. Los logs van a `console.error` (stderr).

Probar el servidor sin ningun cliente, hablandole JSON-RPC crudo:

```powershell
$msgs = @(
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"m","version":"0"}}}'
'{"jsonrpc":"2.0","method":"notifications/initialized"}'
'{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
)
$msgs | node build/index.js
```

---

## Donde aparece cada primitivo en el cliente

Los tres primitivos tienen puntos de entrada distintos, segun quien decide usarlos:

| Primitivo | Quien lo invoca | Donde aparece |
| --- | --- | --- |
| Prompt | el usuario | menu `/` |
| Tool | el modelo | no se invoca desde un menu: se pide hablando |
| Resource | el usuario | menu de adjuntar |

---

## Obsidian

El `DATA_DIR` es una boveda. Dos plugins, y de momento solo estos:

- **Dataview**: tabla viva del radar ordenada por contador, y tabla de ofertas
  filtrada por estado, apoyada en el frontmatter YAML.
- **Kanban**: el pipeline de ofertas como tablero por estado.

La vista de grafo y los `[[enlaces]]` salen gratis.

---

## Fuera de alcance

Sin base de datos (son Markdown a proposito, legibles y versionables a mano), sin
interfaz web, sin scraping de portales, sin multiusuario, sin nube. Corre local.

Las mejoras aparcadas estan en `IDEAS.md`.
