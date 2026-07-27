import { test } from "node:test";
import assert from "node:assert/strict";
import { RADAR_MD } from "./fixtures.test-data.js";
import { findGap, listGaps, parseGaps, recordGap, removeGap, sortRadar } from "./radar.js";

test("sortRadar ordena cada seccion sin tocar la prosa ni perder lineas", () => {
  // El fixture viene con los contadores en orden 1, 3, 1.
  const ordenado = sortRadar(RADAR_MD);
  const confirmados = parseGaps(ordenado)
    .filter((g) => g.section === "Confirmados por ofertas")
    .map((g) => g.counter);
  assert.deepEqual(confirmados, [3, 1, 1]);
  assert.equal(ordenado.split("\n").length, RADAR_MD.split("\n").length);
  assert.ok(ordenado.includes("## Reglas"));
  assert.ok(ordenado.includes("- Aqui nunca hay skills que ya tengo."));
});

test("las vinietas de '## Reglas' no se confunden con huecos", () => {
  const gaps = parseGaps(RADAR_MD);
  assert.equal(gaps.length, 5);
  assert.ok(!gaps.some((g) => g.term.includes("Cuando una oferta")));
});

test("parsea contador, categoria y fuentes", () => {
  const g = findGap(RADAR_MD, "Accesibilidad, a11y")!;
  assert.equal(g.counter, 1);
  assert.equal(g.category, "Frontend");
  // Una sola fuente: la coma esta DENTRO del nombre, el separador es ';'.
  assert.deepEqual(g.sources, ["Google SWE II, Malaga"]);
  assert.equal(g.section, "Confirmados por ofertas");
});

test("list_gaps ordena por contador descendente", () => {
  const orden = listGaps(RADAR_MD).map((g) => g.counter);
  assert.deepEqual(orden, [3, 1, 1, 0, 0]);
});

test("record_gap sobre un termino existente sube el contador y anade la fuente", () => {
  const r = recordGap(RADAR_MD, "Accesibilidad, a11y", "Frontend", "Amazon SDE I");
  assert.equal(r.counter, 2);
  const g = findGap(r.content, "Accesibilidad, a11y")!;
  assert.equal(g.counter, 2);
  assert.deepEqual(g.sources, ["Google SWE II, Malaga", "Amazon SDE I"]);
  // No duplica: sigue habiendo 5 huecos.
  assert.equal(parseGaps(r.content).filter((x) => x.section !== "Fuentes registradas").length, 5);
});

test("record_gap dos veces seguidas deja contador 2", () => {
  const uno = recordGap(RADAR_MD, "Rust", "Lenguajes", "Oferta A");
  assert.equal(uno.counter, 1);
  const dos = recordGap(uno.content, "rust", "Lenguajes", "Oferta B");
  assert.equal(dos.counter, 2);
  assert.equal(findGap(dos.content, "Rust")!.counter, 2);
});

test("record_gap no repite una fuente ya registrada", () => {
  const r = recordGap(RADAR_MD, "Accesibilidad, a11y", "Frontend", "Google SWE II, Malaga");
  assert.deepEqual(findGap(r.content, "Accesibilidad, a11y")!.sources, [
    "Google SWE II, Malaga"
  ]);
  assert.match(r.message, /ya constaba/);
});

test("un termino de la watchlist sube a 1 pero se queda en la watchlist", () => {
  const r = recordGap(RADAR_MD, "Kubernetes", "Infraestructura", "Oferta X");
  const g = findGap(r.content, "Kubernetes")!;
  assert.equal(g.counter, 1);
  assert.equal(g.section, "Watchlist sin confirmar por ofertas");
  assert.deepEqual(g.sources, ["Oferta X"]);
});

test("un termino nuevo nace con contador 1 en Confirmados", () => {
  const r = recordGap(RADAR_MD, "Terraform", "Infraestructura", "Oferta Y");
  const g = findGap(r.content, "Terraform")!;
  assert.equal(g.counter, 1);
  assert.equal(g.section, "Confirmados por ofertas");
  assert.equal(g.category, "Infraestructura");
});

test("record_gap lleva un contador por fuente en 'Fuentes registradas'", () => {
  let content = recordGap(RADAR_MD, "Terraform", "Infra", "Oferta Y").content;
  content = recordGap(content, "Rust", "Lenguajes", "Oferta Y").content;
  const fuentes = parseGaps(content).filter((g) => g.section === "Fuentes registradas");
  assert.equal(fuentes.length, 1);
  assert.equal(fuentes[0]!.term, "Oferta Y");
  assert.equal(fuentes[0]!.counter, 2);
});

test("la seccion se reordena por contador tras incrementar", () => {
  const r = recordGap(RADAR_MD, "Accesibilidad, a11y", "Frontend", "A");
  const r2 = recordGap(r.content, "Accesibilidad, a11y", "Frontend", "B");
  const r3 = recordGap(r2.content, "Accesibilidad, a11y", "Frontend", "C");
  const confirmados = parseGaps(r3.content)
    .filter((g) => g.section === "Confirmados por ofertas")
    .map((g) => g.counter);
  assert.deepEqual(confirmados, [4, 3, 1]);
});

test("la prosa y las secciones ajenas sobreviven a las escrituras", () => {
  const r = recordGap(RADAR_MD, "Terraform", "Infra", "Oferta Y");
  assert.ok(r.content.includes("## Reglas"));
  assert.ok(r.content.includes("- Aqui nunca hay skills que ya tengo."));
  assert.ok(r.content.includes("Hipotesis de valor que aun no ha pedido ninguna oferta."));
});

test("remove_gap saca la linea entera y avisa si no existe", () => {
  const r = removeGap(RADAR_MD, "Kubernetes");
  assert.equal(r.changed, true);
  assert.equal(r.gap!.counter, 0);
  assert.ok(!r.content.includes("Kubernetes"));

  const nada = removeGap(RADAR_MD, "COBOL");
  assert.equal(nada.changed, false);
  assert.equal(nada.content, RADAR_MD);
});
