import { test } from "node:test";
import assert from "node:assert/strict";
import { SKILLS_MD } from "./fixtures.test-data.js";
import {
  addSkill,
  extractTerm,
  findSkill,
  listCategories,
  parseSkills,
  resolveCategory,
  updateSkillLevel
} from "./skills.js";

test("parsea las skills con su categoria", () => {
  const skills = parseSkills(SKILLS_MD);
  assert.equal(skills.length, 8);
  assert.equal(skills[0]!.term, "Java");
  assert.equal(skills[0]!.level, "solido");
  assert.equal(skills[0]!.category, "Lenguajes de programacion");
  assert.equal(skills.at(-1)!.category, "Infraestructura, DevOps y despliegue");
});

test("el termino se separa de la nota final, pero no de las comas internas", () => {
  assert.equal(extractTerm("Java (Java 8, un ano en Indra)"), "Java");
  assert.equal(
    extractTerm("Testing: JUnit5, Mockito, cobertura de codigo"),
    "Testing: JUnit5, Mockito, cobertura de codigo"
  );
  assert.equal(extractTerm("Kubernetes (Infraestructura)."), "Kubernetes");
});

test("la busqueda ignora mayusculas y acentos", () => {
  assert.equal(findSkill(SKILLS_MD, "  jAVA  ")!.term, "Java");
  assert.equal(findSkill(SKILLS_MD, "Diseno de sistemas"), undefined);
});

test("listCategories devuelve solo las cabeceras de nivel 2", () => {
  assert.deepEqual(listCategories(SKILLS_MD), [
    "Lenguajes de programacion",
    "Backend",
    "Infraestructura, DevOps y despliegue"
  ]);
});

test("update_skill_level cambia la etiqueta y conserva el resto de la linea", () => {
  const r = updateSkillLevel(SKILLS_MD, "RunPod y GPU cloud", "solido");
  assert.equal(r.changed, true);
  assert.match(
    r.content,
    /- \[solido\] RunPod y GPU cloud \(usado para fine-tuning, no en produccion\)/
  );
  // Ni una linea mas ni una menos: edicion quirurgica.
  assert.equal(r.content.split("\n").length, SKILLS_MD.split("\n").length);
});

test("update_skill_level sobre algo que no esta avisa y no toca nada", () => {
  const r = updateSkillLevel(SKILLS_MD, "Kubernetes", "parcial");
  assert.equal(r.changed, false);
  assert.equal(r.content, SKILLS_MD);
  assert.match(r.message, /confirm_skill/);
});

test("add_skill inserta bajo la categoria existente, sin duplicar", () => {
  const r = addSkill(SKILLS_MD, "Backend", "Kafka", "parcial", "curso interno");
  assert.equal(r.changed, true);
  const lines = r.content.split("\n");
  const idx = lines.findIndex((l) => l.includes("Kafka"));
  assert.equal(lines[idx], "- [parcial] Kafka (curso interno)");
  // Ha caido dentro de Backend, antes de la siguiente cabecera.
  assert.ok(idx > lines.indexOf("## Backend"));
  assert.ok(idx < lines.indexOf("## Infraestructura, DevOps y despliegue"));

  const otra = addSkill(r.content, "Backend", "kafka", "solido", "otra cosa");
  assert.equal(otra.changed, false);
  assert.match(otra.message, /ya estaba/);
});

test("resolveCategory casa el nombre corto del radar con la cabecera larga del perfil", () => {
  assert.deepEqual(resolveCategory(SKILLS_MD, "Backend"), {
    name: "Backend",
    how: "exacta"
  });
  // 'Infraestructura' del radar -> 'Infraestructura, DevOps y despliegue' del perfil.
  const r = resolveCategory(SKILLS_MD, "Infraestructura");
  assert.equal(r.how, "prefijo");
  assert.equal(r.name, "Infraestructura, DevOps y despliegue");
  // Sin parecido, se crea nueva.
  assert.equal(resolveCategory(SKILLS_MD, "Seguridad").how, "nueva");
  // El corte debe caer en limite de palabra: 'Back' no casa con 'Backend'.
  assert.equal(resolveCategory(SKILLS_MD, "Back").how, "nueva");
});

test("add_skill reutiliza la categoria existente en vez de crear una paralela", () => {
  const r = addSkill(SKILLS_MD, "Infraestructura", "Kubernetes", "parcial", "curso CKA");
  assert.equal(r.changed, true);
  // Una sola cabecera de infraestructura, la de siempre.
  assert.equal(r.content.match(/^## Infraestructura/gm)!.length, 1);
  assert.equal(findSkill(r.content, "Kubernetes")!.category, "Infraestructura, DevOps y despliegue");
  assert.match(r.message, /la categoria del radar era "Infraestructura"/);
});

test("add_skill crea la categoria si no existe", () => {
  const r = addSkill(SKILLS_MD, "Seguridad", "Threat intelligence", "parcial", "curso");
  assert.equal(r.changed, true);
  assert.match(r.content, /## Seguridad\n- \[parcial\] Threat intelligence \(curso\)/);
  assert.match(r.message, /no existia/);
});
