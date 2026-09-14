import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { paths } from "../config.js";
import { CV_BASE, CV_ORIGINAL } from "./fixtures.test-data.js";
import { parseCvBase, renderCv } from "./cv.js";

const PLANTILLA = fs.readFileSync(paths().cvTemplate, "utf8");
const render = (sel: Parameters<typeof renderCv>[1]) =>
  renderCv(CV_BASE, sel, PLANTILLA, "2026-07-28");

/**
 * Calibracion contra medida real. El CV de diseno original, impreso con Chrome
 * headless y buscando por biseccion cuanto relleno admite antes de saltar a dos
 * paginas, deja ~35mm libres en el lateral y ~8mm en la principal: 88% y 97% de
 * ocupacion. El modelo tiene que reproducir esos dos numeros.
 *
 * Si este test se rompe, los avisos de desbordamiento de TODOS los demas CV
 * dejan de valer: o se ha tocado el CSS de la plantilla, o alguien ha movido
 * una constante sin repetir la medicion.
 */
test("el modelo reproduce la ocupacion medida del CV de diseno original", () => {
  const r = render(CV_ORIGINAL);
  assert.ok(
    Math.abs(r.usoMain - 97) <= 3,
    `principal al ${r.usoMain.toFixed(0)}%, medido 97%`
  );
  assert.ok(
    Math.abs(r.usoSidebar - 88) <= 3,
    `lateral al ${r.usoSidebar.toFixed(0)}%, medido 88%`
  );
});

test("meterlo todo desborda, y avisa en vez de cortar en silencio", () => {
  const r = render({ offerId: "2026-07-test" });
  assert.ok(r.usoMain > 100);
  assert.ok(r.avisos.some((a) => a.startsWith("DESBORDA") && a.includes("principal")));
});

test("una seleccion corta deja sitio de sobra y no avisa de nada", () => {
  const r = render({
    offerId: "2026-07-test",
    stack: [{ id: "languages", tags: ["Java", "Python"] }],
    experience: [{ id: "indra", bullets: ["indra-backend", "indra-coverage"] }],
    projects: ["whatsapp"],
    education: ["ual"]
  });
  assert.deepEqual(r.avisos, []);
  assert.ok(r.usoMain < 50);
});

test("un id inventado tumba el render entero y no escribe nada a medias", () => {
  assert.throws(
    () => render({ offerId: "x", projects: ["kubernetes-migration"] }),
    /no existe "kubernetes-migration".*Disponibles: scannet/s
  );
});

test("un tag que no esta en los datos no se cuela en el CV", () => {
  assert.throws(
    () => render({ offerId: "x", stack: [{ id: "languages", tags: ["Java", "Kotlin"] }] }),
    /no puedo inventarlos: "Kotlin"/
  );
});

test("se reportan todos los errores de una vez, no de uno en uno", () => {
  try {
    render({
      offerId: "x",
      projects: ["fantasma"],
      education: ["mit"],
      experience: [{ id: "indra", bullets: ["indra-nasa"] }]
    });
    assert.fail("deberia haber lanzado");
  } catch (err) {
    const msg = (err as Error).message;
    assert.match(msg, /fantasma/);
    assert.match(msg, /mit/);
    assert.match(msg, /indra-nasa/);
  }
});

test("el orden pedido manda sobre el orden de cv-data.json", () => {
  const r = render({ offerId: "x", projects: ["portfolio", "scannet"] });
  const iPortfolio = r.html.indexOf("Self-hosted Portfolio");
  const iScannet = r.html.indexOf("Scannet");
  assert.ok(iPortfolio > 0 && iScannet > 0);
  assert.ok(iPortfolio < iScannet, "portfolio deberia ir antes que scannet");
  // Y lo no pedido no aparece.
  assert.equal(r.html.includes("Online Store"), false);
});

test("headline y summary admiten texto libre; el <br> del titular sobrevive", () => {
  const r = render({
    offerId: "x",
    headline: "Backend Engineer ·<br>Java & Spring",
    summary: "Resumen a medida para esta oferta."
  });
  assert.match(r.html, /<div class="headline">Backend Engineer ·<br>Java &amp; Spring<\/div>/);
  assert.match(r.html, /Resumen a medida para esta oferta\./);
});

test("el texto se escapa: nada de HTML inyectado desde los datos", () => {
  const r = render({ offerId: "x", summary: "<script>alert(1)</script>" });
  assert.equal(r.html.includes("<script>alert(1)"), false);
  assert.match(r.html, /&lt;script&gt;/);
});

test("la nota de por que se adapto queda dentro del HTML, fuera de la vista", () => {
  const r = render({ offerId: "2026-07-indra", note: "piden Java y calidad" });
  assert.match(r.html, /<!-- Adaptado a 2026-07-indra: piden Java y calidad -->/);
});

test("no queda ningun marcador de plantilla sin sustituir", () => {
  const r = render(CV_ORIGINAL);
  assert.equal(/\{\{[A-Z]+\}\}/.test(r.html), false);
});

test("cv-data.json real cumple el esquema y renderiza", () => {
  const json = fs.readFileSync(paths().cvData, "utf8");
  const base = parseCvBase(json);
  const r = renderCv(base, { offerId: "2026-07-test" }, PLANTILLA, "2026-07-28");
  assert.ok(r.html.includes(base.identity.name));
});

test("un cv-data.json mal formado se explica, no revienta con un stack trace", () => {
  assert.throws(() => parseCvBase("{ esto no es json"), /no es JSON valido/);
  assert.throws(() => parseCvBase('{"summary":"x"}'), /no cumple el esquema/);
});

test("un proyecto se puede recortar a las lineas que aportan a la oferta", () => {
  const r = render({ offerId: "x", projects: [{ id: "scannet", lines: ["Build"] }] });
  assert.match(r.html, /<b>Build:<\/b>/);
  assert.equal(r.html.includes("<b>Need:</b>"), false);
  assert.equal(r.html.includes("<b>Idea:</b>"), false);
  // El proyecto sigue estando: se encoge, no se borra.
  assert.match(r.html, /Scannet/);
});

test("recortar lineas gana sitio sin sacar el proyecto del CV", () => {
  const todas = render({ offerId: "x", projects: ["scannet", "whatsapp", "portfolio"] });
  const soloBuild = render({
    offerId: "x",
    projects: [
      { id: "scannet", lines: ["Build"] },
      { id: "whatsapp", lines: ["Build"] },
      { id: "portfolio", lines: ["Build"] }
    ]
  });
  assert.ok(soloBuild.usoMain < todas.usoMain);
  for (const titulo of ["Scannet", "AI Order Automation", "Self-hosted Portfolio"]) {
    assert.ok(soloBuild.html.includes(titulo), `falta ${titulo}`);
  }
});

test("una linea inventada tumba el render y dice cuales hay", () => {
  assert.throws(
    () => render({ offerId: "x", projects: [{ id: "scannet", lines: ["Build", "Deploy"] }] }),
    /no existen las lineas "Deploy".*Disponibles: Need, Idea, Build/s
  );
});
