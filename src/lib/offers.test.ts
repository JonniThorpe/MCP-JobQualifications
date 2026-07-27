import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addOfferNote,
  buildOffer,
  isOfferStatus,
  parseFrontmatter,
  replaceAnalysis,
  setOfferStatus
} from "./offers.js";

const OFERTA = buildOffer({
  id: "2026-07-google",
  title: "SWE II, Threat Intelligence",
  company: "Google",
  markdown: "## Encaje\nAlto.\n\n## Riesgos\nSistemas distribuidos.",
  date: "2026-07-27"
});

test("build_offer produce frontmatter y las tres secciones fijas", () => {
  const { data } = parseFrontmatter(OFERTA);
  assert.equal(data.id, "2026-07-google");
  assert.equal(data.company, "Google");
  assert.equal(data.status, "analizada");
  assert.equal(data.created, "2026-07-27");
  assert.ok(OFERTA.includes("## Análisis"));
  assert.ok(OFERTA.includes("## Registro de estados"));
  assert.ok(OFERTA.includes("## Notas de entrevista"));
  assert.ok(OFERTA.includes("- 2026-07-27: analizada"));
});

test("los campos opcionales se escriben aunque vengan vacios", () => {
  const { data } = parseFrontmatter(OFERTA);
  assert.equal(data.score, "");
  assert.equal(data.salario, "");
  assert.equal(data.url, "");
  assert.equal(data.tags, "[]");
});

test("score, salario, url y tags se serializan cuando llegan", () => {
  const md = buildOffer({
    id: "2026-07-acme",
    title: "Backend Engineer",
    company: "Acme",
    markdown: "1. **Encaje realista**: reach razonable.",
    date: "2026-07-27",
    score: 9,
    salario: "38.000 - 45.000 EUR",
    url: "https://acme.example/jobs/42",
    tags: ["backend", "ml"]
  });
  const { data } = parseFrontmatter(md);
  assert.equal(data.score, "9");
  assert.equal(data.salario, "38.000 - 45.000 EUR");
  assert.equal(data.url, "https://acme.example/jobs/42");
  assert.equal(data.tags, "[backend, ml]");
});

test("el analisis con listas numeradas de la plantilla se conserva intacto", () => {
  const plantilla = [
    "1. **Encaje realista**: reach razonable.",
    "",
    "2. **Lo que ya tengo**",
    "   - Spring Boot: backend del proyecto WhatsApp.",
    "",
    "5. **Terminos que no domino**",
    "   - sharding, quorum"
  ].join("\n");
  const md = buildOffer({
    id: "x",
    title: "T",
    company: "C",
    markdown: plantilla,
    date: "2026-07-27"
  });
  for (const linea of plantilla.split("\n")) assert.ok(md.includes(linea));
});

test("un titulo con coma se serializa citado para no romper el YAML", () => {
  const { data } = parseFrontmatter(OFERTA);
  assert.equal(data.title, "SWE II, Threat Intelligence");
});

test("los estados validos son los siete del ciclo de vida", () => {
  assert.ok(isOfferStatus("entrevista"));
  assert.ok(isOfferStatus("descartada"));
  assert.ok(!isOfferStatus("pendiente"));
  assert.ok(!isOfferStatus("ANALIZADA"));
});

test("set_offer_status actualiza frontmatter y deja rastro fechado", () => {
  const r = setOfferStatus(OFERTA, "solicitada", "2026-07-28");
  assert.equal(r.changed, true);
  const { data } = parseFrontmatter(r.content);
  assert.equal(data.status, "solicitada");
  assert.equal(data.updated, "2026-07-28");
  assert.ok(r.content.includes("- 2026-07-28: analizada -> solicitada"));
  // El registro anterior no se pisa.
  assert.ok(r.content.includes("- 2026-07-27: analizada"));
});

test("set_offer_status al mismo estado no hace nada", () => {
  const r = setOfferStatus(OFERTA, "analizada", "2026-07-28");
  assert.equal(r.changed, false);
  assert.equal(r.content, OFERTA);
});

test("las notas se acumulan fechadas y admiten varias lineas", () => {
  const a = addOfferNote(OFERTA, "Entrevista con Marta.\nPreguntan por concurrencia.", "2026-07-29");
  const b = addOfferNote(a.content, "Segunda ronda.", "2026-08-02");
  assert.ok(b.content.includes("### 2026-07-29"));
  assert.ok(b.content.includes("Preguntan por concurrencia."));
  assert.ok(b.content.includes("### 2026-08-02"));
  assert.ok(b.content.indexOf("### 2026-07-29") < b.content.indexOf("### 2026-08-02"));
  assert.equal(parseFrontmatter(b.content).data.updated, "2026-08-02");
});

test("una nota vacia se rechaza", () => {
  const r = addOfferNote(OFERTA, "   ", "2026-07-29");
  assert.equal(r.changed, false);
});

test("reguardar la oferta sustituye el analisis pero conserva estado y notas", () => {
  const conNota = addOfferNote(OFERTA, "Contacto: Marta.", "2026-07-29").content;
  const avanzada = setOfferStatus(conNota, "entrevista", "2026-07-30").content;
  const r = replaceAnalysis(avanzada, "## Encaje\nRevisado a la baja.", "2026-07-31");

  assert.ok(r.includes("Revisado a la baja."));
  assert.ok(!r.includes("Alto."));
  assert.ok(r.includes("Contacto: Marta."));
  assert.equal(parseFrontmatter(r).data.status, "entrevista");
  assert.equal(parseFrontmatter(r).data.updated, "2026-07-31");
});
