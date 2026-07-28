import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

/**
 * Las plantillas son codigo del servidor, no datos: viven en el repo y NO en la
 * boveda. Se resuelven desde este modulo (build/config.js) para que el servidor
 * funcione se lance desde donde se lance.
 */
export const TEMPLATES_DIR = fileURLToPath(new URL("../templates/", import.meta.url));

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
    cvData: path.join(dataDir, "perfil", "cv-data.json"),
    offer: (id: string) => path.join(dataDir, "ofertas", `${id}.md`),
    // Las salidas generadas van aparte de las fuentes: nada de lo que hay en
    // salidas/ se edita a mano, se regenera.
    salidasDir: path.join(dataDir, "salidas"),
    cvOut: (id: string) => path.join(dataDir, "salidas", `cv-${id}.html`),
    cvTemplate: path.join(TEMPLATES_DIR, "cv.html")
  };
}
