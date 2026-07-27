# job-search-mcp

Servidor MCP local que gestiona mi busqueda de empleo sobre archivos Markdown.

El servidor no razona. Yo hablo con Claude, y Claude usa este servidor para leer y
escribir mis archivos con una estructura fija. **El cerebro es el cliente; esto es
la memoria y las manos.**

---

## Las dos carpetas

Estan separadas a proposito: el codigo se versiona en publico, los datos no.

| Que | Donde |
| --- | --- |
| **Codigo del servidor** | `C:\Users\Jonni\Documents\Personal-Workspace\job-search-mcp` |
| **Datos (`DATA_DIR`)** | `C:\Users\Jonni\Desktop\Productivo\Trabajo\Perfil` |

El `DATA_DIR` es a la vez una boveda de Obsidian. El MCP escribe los `.md` y
Obsidian los renderiza: la misma carpeta, cero conflicto.

```
DATA_DIR/
  perfil/
    perfil-skills.md    lo que YA tengo:  - [solido|parcial] Termino (nota)
    radar-huecos.md     lo que me falta:  - [contador: N] Termino (Categoria). Fuentes: a; b
    criterios.md        que hace que una oferta merezca mi tiempo (prosa libre)
    cv.md               CV en Markdown (transcripcion del .docx ATS)
  ofertas/
    AAAA-MM-empresa.md  una por oferta: frontmatter + analisis + estados + notas
```

El servidor **nunca regenera** un archivo entero: parsea solo las lineas que
reconoce y edita esa linea concreta. Tu prosa, tus secciones y tu formato
sobreviven a cualquier escritura. Estos archivos los editas tu tambien.

---

## Instalacion desde cero (p.ej. despues de formatear)

```powershell
# 1. Requisitos
winget install --id OpenJS.NodeJS.LTS   # Node >= 18 (probado con 24)
winget install --id Git.Git
winget install --id Anthropic.Claude    # Claude Desktop, opcional

# 2. Codigo
cd C:\Users\Jonni\Documents\Personal-Workspace
git clone <este-repo> job-search-mcp
cd job-search-mcp
npm install
npm run build

# 3. Comprobar que arranca (debe imprimir la ruta de datos y quedarse esperando)
$env:JOB_MCP_DATA_DIR="C:\Users\Jonni\Desktop\Productivo\Trabajo\Perfil"
node build/index.js      # Ctrl+C para salir
```

---

## Configurar los clientes

El servidor se declara en **dos archivos distintos**, uno por cliente. Los dos
apuntan al mismo `build/index.js`.

### Claude Code (CLI y sesiones de codigo)

Archivo: `C:\Users\Jonni\.claude.json`

```powershell
claude mcp add job-search --scope user -- node "C:\Users\Jonni\Documents\Personal-Workspace\job-search-mcp\build\index.js"
```

**Cuidado:** el flag `-e` de `claude mcp add` es variadic y en PowerShell se traga
el separador `--`, asi que falla con "missing required argument". Anade el `env`
editando el JSON a mano despues:

```jsonc
"mcpServers": {
  "job-search": {
    "type": "stdio",
    "command": "node",
    "args": ["C:\\Users\\Jonni\\Documents\\Personal-Workspace\\job-search-mcp\\build\\index.js"],
    "env": { "JOB_MCP_DATA_DIR": "C:\\Users\\Jonni\\Desktop\\Productivo\\Trabajo\\Perfil" }
  }
}
```

Comprobar: `claude mcp list` debe decir `job-search: ... - Connected`.

### Claude Desktop

Archivo: `%APPDATA%\Claude\claude_desktop_config.json`

Se anade el bloque `mcpServers` al mismo nivel que `preferences`. Ruta absoluta de
`node`, porque Desktop se lanza desde el explorador y **no hereda el PATH**:

```jsonc
{
  "mcpServers": {
    "job-search": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\Users\\Jonni\\Documents\\Personal-Workspace\\job-search-mcp\\build\\index.js"],
      "env": { "JOB_MCP_DATA_DIR": "C:\\Users\\Jonni\\Desktop\\Productivo\\Trabajo\\Perfil" }
    }
  },
  "preferences": { ... }
}
```

---

## LA REGLA QUE MAS TIEMPO CUESTA APRENDER

> **Cada `npm run build` obliga a reiniciar el cliente.**

Un servidor MCP por stdio se lanza **una vez**, cuando arranca el cliente, y ese
proceso se queda vivo. No hay recarga en caliente. Cerrar la ventana de Claude
Desktop **no basta**: hay que salir desde el icono de la bandeja del sistema, o
matar los procesos en el Administrador de tareas.

Sintoma tipico: pides un tool nuevo y el cliente jura que no existe.

Comprobacion rapida de que corre el build actual:

```powershell
Get-Item "$env:APPDATA\Claude\logs\mcp-server-job-search.log" | Select LastWriteTime
```

Si la hora es vieja, Desktop sigue con el proceso antiguo.

---

## Que expone el servidor

### Resources (solo lectura, los adjunta el USUARIO)

| URI | Contenido |
| --- | --- |
| `profile://skills` | perfil-skills.md |
| `profile://gaps` | radar-huecos.md, ordenado por contador al servir |
| `profile://cv` | cv.md |
| `profile://criteria` | criterios.md |
| `offers://list` | tabla del pipeline: estado, empresa, puesto, score |
| `offers://{id}` | una oferta entera: analisis, estados y notas |

### Tools (escriben, los invoca el MODELO)

| Tool | Que hace |
| --- | --- |
| `record_gap(term, category, source)` | Sube el contador en 1 y anade la fuente. Si no existe, lo crea con 1. Nunca duplica. |
| `list_gaps()` | Huecos ordenados por contador descendente. |
| `confirm_skill(term, level, evidence, category?)` | La graduacion: saca del radar y mete en el perfil. Unico camino de hueco a perfil. |
| `update_skill_level(term, level)` | Cambia solido/parcial de algo que ya esta en el perfil. |
| `save_offer(id, title, company, markdown, score?, salario?, url?, tags?)` | Crea o actualiza una oferta. Al actualizar conserva estado y notas. |
| `set_offer_status(id, status)` | Mueve por el ciclo de vida y lo anota con fecha. |
| `add_offer_note(id, note)` | Nota fechada en "Notas de entrevista". |
| `ping()` | Diagnostico: responde y dice sobre que `DATA_DIR` trabaja. |

Ciclo de vida de una oferta:
`analizada -> solicitada -> entrevista -> oferta -> aceptada`,
con dos salidas laterales desde cualquier punto: `denegada` y `descartada`.

### Prompt (lo invoca el USUARIO, en el menu `/`)

`analyze_offer` devuelve la plantilla de analisis rellenada con perfil, CV y
criterios **leidos del disco en ese instante**, mas las instrucciones de que
guardar la oferta y registrar los huecos. Debajo se pega el texto de la oferta.

---

## Flujo diario

1. `/analyze_offer` en Claude Desktop. Pegar debajo el texto de la oferta.
2. Claude analiza los seis puntos y despues llama solo a:
   - `save_offer` con el analisis y el score,
   - `record_gap` una vez por cada skill que pida y yo no tenga.
3. Segun avance el proceso: `set_offer_status` y `add_offer_note`.
4. Cuando de verdad aprenda algo: **yo** pido `confirm_skill`. Nunca lo hace
   Claude por su cuenta.
5. De vez en cuando: `list_gaps` para ver que estudiar.

---

## Desarrollo

```powershell
npm run build     # tsc -> build/
npm test          # tsc + node --test "build/**/*.test.js"   (40 tests)
npm run watch     # recompilar al guardar
```

Arquitectura: `src/lib/*` son **funciones puras** con la forma
`(contenido, args) -> { contenido, changed, message }`. El unico modulo con I/O es
`src/lib/files.ts`. Por eso los tests no tocan el disco y corren en 100 ms.

`src/index.ts` solo cablea: `registerResources`, `registerTools`,
`registerPrompts` y el transporte stdio.

**Nunca uses `console.log` en el servidor.** stdout es el canal JSON-RPC y
escribir ahi rompe el protocolo. Los logs van a `console.error` (stderr).

---

## Diagnostico

| Sintoma | Donde mirar |
| --- | --- |
| El cliente no ve un tool nuevo | No has reiniciado el cliente. Ver la regla de arriba. |
| Desktop no arranca el servidor | `%APPDATA%\Claude\logs\mcp-server-job-search.log` |
| Errores generales de Desktop | `%APPDATA%\Claude\logs\main.log` |
| No se cual es el `DATA_DIR` activo | Pide el tool `ping`: lo dice en la respuesta. |
| El menu `/` no muestra el prompt | `/` lista prompts; los tools no salen ahi. |

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

## Obsidian

El `DATA_DIR` es una boveda. Dos plugins, y de momento solo estos:

- **Dataview**: tabla viva del radar ordenada por contador, y tabla de ofertas
  filtrada por estado, apoyada en el frontmatter YAML.
- **Kanban**: el pipeline de ofertas como tablero por estado.

La vista de grafo y los `[[enlaces]]` salen gratis.

No instales mas plugins al principio: configurar Obsidian es agradable y se come
horas que no toca gastar ahi.

---

## Fuera de alcance

Sin base de datos (son Markdown a proposito, legibles y versionables a mano), sin
interfaz web, sin scraping de LinkedIn, sin multiusuario, sin nube. Corre local.

Las mejoras aparcadas estan en `IDEAS.md`.
