import * as path from "node:path";
import * as os from "node:os";

/**
 * Raiz de los datos. Configurable por variable de entorno para poder apuntar el
 * servidor a una carpeta de pruebas sin tocar codigo (lo usan los tests).
 */
export const DATA_DIR =
  process.env.JOB_MCP_DATA_DIR ??
  path.join(os.homedir(), "Desktop", "Productivo", "Trabajo", "Perfil");

export function paths(dataDir: string = DATA_DIR) {
  return {
    dataDir,
    perfilDir: path.join(dataDir, "perfil"),
    ofertasDir: path.join(dataDir, "ofertas"),
    skills: path.join(dataDir, "perfil", "perfil-skills.md"),
    radar: path.join(dataDir, "perfil", "radar-huecos.md"),
    criteria: path.join(dataDir, "perfil", "criterios.md"),
    cv: path.join(dataDir, "perfil", "cv.md"),
    offer: (id: string) => path.join(dataDir, "ofertas", `${id}.md`)
  };
}
