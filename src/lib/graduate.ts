import { removeGap } from "./radar.js";
import { addSkill, findSkill, type SkillLevel } from "./skills.js";

/**
 * La graduacion: unico camino de hueco a perfil.
 *
 * Toca DOS archivos, y por eso vive aparte. Devuelve los dos contenidos nuevos
 * sin escribir nada: quien llama decide si persiste. Asi la operacion se puede
 * testear entera y, sobre todo, se puede abortar sin haber dejado el radar y el
 * perfil en estados incoherentes.
 *
 * Decision importante del documento: las FUENTES del radar se descartan. Al
 * perfil solo viaja la evidencia (cert, proyecto, experiencia), nunca la oferta
 * que origino el hueco. El perfil dice lo que se, no por que lo aprendi.
 */
export interface GraduateResult {
  ok: boolean;
  radar: string;
  skills: string;
  message: string;
}

export function confirmSkill(
  radarContent: string,
  skillsContent: string,
  term: string,
  level: SkillLevel,
  evidence: string,
  categoryOverride?: string
): GraduateResult {
  const yaEnPerfil = findSkill(skillsContent, term);
  if (yaEnPerfil) {
    return {
      ok: false,
      radar: radarContent,
      skills: skillsContent,
      message: `"${yaEnPerfil.term}" ya esta en perfil-skills.md ("${yaEnPerfil.category}", [${yaEnPerfil.level}]). Para cambiar su nivel usa update_skill_level.`
    };
  }

  const retirada = removeGap(radarContent, term);
  if (!retirada.changed || !retirada.gap) {
    return {
      ok: false,
      radar: radarContent,
      skills: skillsContent,
      message: `"${term}" no esta en el radar de huecos, asi que no hay nada que graduar. Si es una skill nueva que no paso por el radar, anadela tu al perfil.`
    };
  }

  const categoria = (categoryOverride ?? retirada.gap.category ?? "").trim();
  if (!categoria) {
    return {
      ok: false,
      radar: radarContent,
      skills: skillsContent,
      message: `"${retirada.gap.term}" no tiene categoria en el radar. Indica una para saber bajo que "##" colocarlo en el perfil.`
    };
  }

  const alta = addSkill(skillsContent, categoria, retirada.gap.term, level, evidence);
  if (!alta.changed) {
    return {
      ok: false,
      radar: radarContent,
      skills: skillsContent,
      message: alta.message
    };
  }

  return {
    ok: true,
    radar: retirada.content,
    skills: alta.content,
    message: `Graduado "${retirada.gap.term}": fuera del radar (contador ${retirada.gap.counter}) y dentro de "${categoria}" como [${level}]. ${alta.message}`
  };
}
