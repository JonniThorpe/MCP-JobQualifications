import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DATA_DIR } from "./config.js";
import { ensureLayout } from "./lib/files.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";

// El nombre y la version se los anuncia el servidor al cliente en el handshake
// `initialize`. Es lo que veras identificado en la lista de servidores MCP.
const server = new McpServer({
  name: "job-search",
  version: "0.4.0"
});

registerResources(server);
registerTools(server);
registerPrompts(server);

async function main() {
  // Si la boveda aun no tiene la estructura, se crea: el servidor no debe morir
  // por una carpeta que falta.
  ensureLayout(DATA_DIR);

  // stdio: el cliente nos lanza como proceso hijo y hablamos JSON-RPC por
  // stdin/stdout. Por eso NUNCA se hace console.log aqui: stdout es el canal
  // del protocolo. Todo log de diagnostico va a stderr.
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`job-search-mcp escuchando en stdio. Datos en ${DATA_DIR}`);
}

main().catch((error) => {
  console.error("Error fatal arrancando el servidor:", error);
  process.exit(1);
});
