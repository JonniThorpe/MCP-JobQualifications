import { test } from "node:test";
import assert from "node:assert/strict";
import { RADAR_MD, SKILLS_MD } from "./fixtures.test-data.js";
import { confirmSkill } from "./graduate.js";
import { findGap, recordGap } from "./radar.js";
import { findSkill } from "./skills.js";

test("la graduacion saca del radar y mete en el perfil, en su categoria", () => {
  const r = confirmSkill(
    RADAR_MD,
    SKILLS_MD,
    "Accesibilidad, a11y",
    "parcial",
    "curso de a11y + auditoria en el proyecto WhatsApp"
  );
  assert.equal(r.ok, true);
  assert.equal(findGap(r.radar, "Accesibilidad, a11y"), undefined);

  const skill = findSkill(r.skills, "Accesibilidad, a11y")!;
  assert.equal(skill.level, "parcial");
  // La categoria viene del parentesis que llevaba el hueco en el radar.
  assert.equal(skill.category, "Frontend");
  assert.match(skill.text, /curso de a11y/);
});

test("las fuentes del radar NO viajan al perfil", () => {
  const r = confirmSkill(RADAR_MD, SKILLS_MD, "Accesibilidad, a11y", "solido", "cert");
  assert.ok(!r.skills.includes("Google SWE II"));
  assert.ok(!r.skills.includes("Fuentes"));
});

test("graduar algo que no esta en el radar avisa y no toca ningun archivo", () => {
  const r = confirmSkill(RADAR_MD, SKILLS_MD, "COBOL", "solido", "la vida");
  assert.equal(r.ok, false);
  assert.equal(r.radar, RADAR_MD);
  assert.equal(r.skills, SKILLS_MD);
  assert.match(r.message, /no esta en el radar/);
});

test("graduar algo que ya esta en el perfil avisa y no duplica", () => {
  const r = confirmSkill(RADAR_MD, SKILLS_MD, "Docker", "solido", "x");
  assert.equal(r.ok, false);
  assert.equal(r.radar, RADAR_MD);
  assert.match(r.message, /update_skill_level/);
});

test("un hueco sin categoria pide que se le indique una", () => {
  const radar = recordGap(RADAR_MD, "Observabilidad", "", "Oferta Z").content;
  const sin = confirmSkill(radar, SKILLS_MD, "Observabilidad", "parcial", "curso");
  assert.equal(sin.ok, false);
  assert.match(sin.message, /categoria/);

  const con = confirmSkill(radar, SKILLS_MD, "Observabilidad", "parcial", "curso", "Backend");
  assert.equal(con.ok, true);
  assert.equal(findSkill(con.skills, "Observabilidad")!.category, "Backend");
});

test("la categoria del radar puede no existir en el perfil: se crea", () => {
  const radar = recordGap(RADAR_MD, "Threat intelligence", "Seguridad", "Google").content;
  const r = confirmSkill(radar, SKILLS_MD, "Threat intelligence", "parcial", "curso SANS");
  assert.equal(r.ok, true);
  assert.match(r.skills, /## Seguridad/);
  assert.match(r.message, /no existia/);
});
