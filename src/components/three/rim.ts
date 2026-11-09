import * as THREE from "three";
import { MOON } from "@/config/world";

const MOON_DIR = MOON.position.clone().normalize();

/** Adds a moonlit rim to a standard material: glancing faces turned toward the moon catch light. */
export function addRim(material: THREE.MeshStandardMaterial, color: string, strength: number) {
  const rimDir = { value: MOON_DIR };
  const rimColor = { value: new THREE.Color(color).multiplyScalar(strength) };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimDir = rimDir;
    shader.uniforms.uRimColor = rimColor;
    shader.fragmentShader =
      "uniform vec3 uRimDir;\nuniform vec3 uRimColor;\n" +
      shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        vec3 rimLight = normalize((viewMatrix * vec4(uRimDir, 0.0)).xyz);
        // Slopes only: flat ground seen at a low angle must not turn silver.
        float rimSlope = 1.0 - smoothstep(0.8, 0.96, dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)));
        float rimEdge = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.2);
        totalEmissiveRadiance += uRimColor * rimEdge * smoothstep(0.0, 0.7, dot(normal, rimLight)) * rimSlope;`,
      );
  };
  return material;
}
