import gsap from "gsap";
import type { Cue } from "@/config/audio";
import { PROLOGUE_TIMING as T, REDUCED_TOTAL, type ProloguePhase } from "@/config/timing";
import { CAMERA } from "@/config/world";
import { LAST_ARRIVAL } from "./shards";
import type { StageState } from "./stage";

type Dom = {
  bubble: HTMLElement | null;
  chars: Element[];
  next: HTMLElement | null;
  /** Full-screen white flash overlay (impact) */
  flash: HTMLElement | null;
};

/**
 * Builds the ONE master timeline for the prologue. It only tweens plain values on `state`
 * (read by the 3D components every frame), the HTML overlay elements, and sound cues (`play`).
 * Sound cues are `call`s, so scrubbing (`seek`) or skipping with `progress(1, true)` stays silent.
 */
export function buildPrologueTimeline(
  state: StageState,
  dom: Dom,
  reduced: boolean,
  onComplete: () => void,
  play: (cue: Cue) => void,
) {
  const tl = gsap.timeline({ paused: true, onComplete });

  // HTML overlay initial state
  if (dom.bubble) gsap.set(dom.bubble, { autoAlpha: 0, scale: 0.9, y: 8, transformOrigin: "50% 100%" });
  gsap.set(dom.chars, { opacity: 0 });
  if (dom.next) gsap.set(dom.next, { autoAlpha: 0, y: 10 });
  if (dom.flash) gsap.set(dom.flash, { autoAlpha: 0 });

  if (reduced) {
    // No flight, shake, shatter or flashes: fade straight to the final composition.
    const u = REDUCED_TOTAL / 2.5;
    state.reduced = true;
    tl.set(state, { camT: 1, crystalOpacity: 0, moonBlue: 1, moonGlow: 1, fogBlue: 1, coneBlue: 1 }, 0)
      .set(state.lookTarget, { x: CAMERA.lookFinal.x, y: CAMERA.lookFinal.y, z: CAMERA.lookFinal.z }, 0)
      .to(state, { curtainAlpha: 0, duration: 0.7 * u, ease: "power1.inOut" }, 0)
      .to(state, { coneOpacity: 0.9, duration: 0.6 * u, ease: "power1.out" }, 0.6 * u)
      .to(state, { snow: 0.35, duration: 0.8 * u, ease: "power1.out" }, 0.6 * u)
      .to(state, { figure: 1, duration: 0.6 * u, ease: "power1.out" }, 0.9 * u)
      .set(dom.chars, { opacity: 1 }, 0)
      .to(dom.bubble, { autoAlpha: 1, scale: 1, y: 0, duration: 0.4 * u }, 1.6 * u)
      .to(dom.next, { autoAlpha: 1, y: 0, duration: 0.4 * u }, 2.1 * u)
      .call(play, ["curtain"], 0)
      .call(play, ["chord"], 0.6 * u);
    return tl;
  }

  // Phase labels, back to back
  let cursor = 0;
  (Object.keys(T) as ProloguePhase[]).forEach((p) => {
    tl.addLabel(p, cursor);
    cursor += T[p];
  });
  const at = (p: ProloguePhase, frac = 0) => `${p}+=${T[p] * frac}`;
  const d = (p: ProloguePhase, frac: number) => T[p] * frac;
  const lf = CAMERA.lookFinal;
  const lb = CAMERA.lookBeam;

  // 1) Curtain gathers; camera starts dolly-in through it
  tl.to(state, { curtainOpen: 1, duration: d("curtain", 1), ease: "power2.inOut" }, at("curtain"))
    .to(
      state,
      {
        camT: 1,
        duration: d("curtain", 0.8) + d("flight", 1) + d("beam", 0.65),
        ease: "sine.inOut",
      },
      at("curtain", 0.2),
    )
    .set(state, { curtainAlpha: 0 }, at("flight", 0.3));

  // 2) Valley flight; the moon brightens; look drifts toward the hill + moon
  tl.to(state, { moonGlow: 1, duration: d("flight", 0.9), ease: "power2.out" }, at("flight"))
    .to(state.lookTarget, { x: lb.x, y: lb.y, z: lb.z, duration: d("flight", 0.75) + d("beam", 0.5), ease: "power2.inOut" }, at("flight", 0.35));

  // 3) Light cone onto the crystal
  tl.to(state, { coneOpacity: 1, duration: d("beam", 0.55), ease: "power2.out" }, at("beam"))
    .to(state, { crystalFlash: 0.3, duration: d("beam", 0.4), ease: "sine.inOut" }, at("beam", 0.4));

  // 4) Crystal flash, shake, curved flight up; camera pulls back and looks up after it
  const liftOff = at("crystal", 0.52);
  tl.to(state, { crystalFlash: 1, duration: d("crystal", 0.1), ease: "power2.out" }, at("crystal"))
    .to(state, { crystalFlash: 0.5, duration: d("crystal", 0.16), ease: "sine.out" }, at("crystal", 0.1))
    .to(state, { bloomBoost: 0.5, duration: d("crystal", 0.08), ease: "power2.out", yoyo: true, repeat: 1 }, at("crystal"))
    .to(state, { crystalShake: 1, duration: d("crystal", 0.06), ease: "power1.in" }, at("crystal", 0.16))
    .to(state, { crystalShake: 0, duration: d("crystal", 0.06), ease: "power1.out" }, at("crystal", 0.46))
    // Grass and dust tremble while it shakes, peak at lift-off
    .to(state, { tremble: 0.5, duration: d("crystal", 0.1), ease: "power1.in" }, at("crystal", 0.18))
    .to(state, { tremble: 1, duration: d("crystal", 0.06), ease: "power2.out" }, at("crystal", 0.48))
    .to(state, { tremble: 0, duration: d("crystal", 0.35), ease: "power2.out" }, at("crystal", 0.56))
    // Light wave spreading over the hill as it leaves the ground
    .fromTo(state, { liftRing: 0.001 }, { liftRing: 1, duration: d("crystal", 0.4), ease: "power1.out", immediateRender: false }, liftOff)
    .to(state, { bloomBoost: 0.7, duration: d("crystal", 0.04), ease: "power2.out", yoyo: true, repeat: 1 }, liftOff)
    // The moon's beam grows stronger as the crystal approaches
    .to(state, { coneOpacity: 1.35, duration: d("crystal", 0.46), ease: "power1.in" }, at("crystal", 0.54))
    .to(state, { moonGlow: 1.7, duration: d("crystal", 0.46), ease: "power2.in" }, at("crystal", 0.54))
    .to(state.camOffset, {
      x: CAMERA.crystalOffset.x,
      y: CAMERA.crystalOffset.y,
      z: CAMERA.crystalOffset.z,
      duration: d("crystal", 0.65),
      ease: "power2.inOut",
    }, at("crystal", 0.35))
    .to(state, { lookCrystal: 0.55, duration: d("crystal", 0.42), ease: "power2.inOut" }, at("crystal", 0.45))
    .to(state, { crystalFly: 1, duration: d("crystal", 0.48), ease: "power2.in" }, liftOff)
    // Very light shake as it accelerates
    .to(state, { camShake: 0.22, duration: d("crystal", 0.3), ease: "power2.in" }, at("crystal", 0.7));

  // 5) Impact → shatter → shards orbit the moon, then dive in one by one → squash → sapphire burst
  const D = T.shatter;
  const HIT_STOP = 0.1; // seconds frozen on impact
  const SPIRAL = 2.6; // seconds for the shard choreography: burst, 2–3 laps, dive (shatter 0 → 1)
  const burstAt = HIT_STOP + LAST_ARRIVAL * SPIRAL + 0.08; // last shard in + a beat
  const s = (sec: number) => `shatter+=${sec}`;
  tl.to(state, { camShake: 1, duration: 0.04, ease: "power2.out" }, s(0))
    .to(state, { camShake: 0, duration: 0.45, ease: "power2.out" }, s(0.05))
    // Hit-stop: crystal frozen at the impact point under a white flash
    .to(dom.flash, { autoAlpha: 0.55, duration: 0.03, ease: "power2.out" }, s(0))
    .to(dom.flash, { autoAlpha: 0, duration: 0.2, ease: "power2.out" }, s(0.05))
    .to(state, { aberration: 1, duration: 0.04 }, s(0))
    .to(state, { aberration: 0, duration: 0.5, ease: "power2.out" }, s(0.06))
    .to(state, { bloomBoost: 1, duration: 0.04 }, s(0))
    .to(state, { bloomBoost: 0, duration: 0.3, ease: "power2.out" }, s(0.06))
    .to(state, { coneOpacity: 0, moonGlow: 1, duration: 0.3, ease: "power1.out" }, s(HIT_STOP))
    .fromTo(state, { impactRing: 0.001 }, { impactRing: 1, duration: 0.75, ease: "power1.out", immediateRender: false }, s(0.02))
    .set(state, { crystalOpacity: 0 }, s(HIT_STOP))
    // Shards: burst out, orbit 2–3 laps, then dive in (per-shard timing lives in shards.ts)
    .fromTo(state, { shatter: 0.0001 }, { shatter: 1, duration: SPIRAL, ease: "none", immediateRender: false }, s(HIT_STOP))
    // Moon squashes for a beat once the last shard is in…
    .to(state, { moonSquash: 1, duration: 0.09, ease: "power2.in" }, s(burstAt - 0.1))
    .to(state, { moonSquash: 0, duration: 0.45, ease: "elastic.out(1.1, 0.45)" }, s(burstAt))
    // …then bursts: big ring, wave across the sky, fog / hills / beams go blue
    .to(state, { moonBlue: 1, duration: 0.35, ease: "power2.out" }, s(burstAt))
    .to(state, { bloomBoost: 2.6, duration: 0.06, ease: "power2.out" }, s(burstAt))
    .to(state, { bloomBoost: 0, duration: 0.8, ease: "power2.in" }, s(burstAt + 0.08))
    .to(state, { aberration: 0.6, duration: 0.05 }, s(burstAt))
    .to(state, { aberration: 0, duration: 0.6, ease: "power2.out" }, s(burstAt + 0.05))
    .fromTo(state, { burst: 0.001 }, { burst: 1, duration: 1.1, ease: "power1.out", immediateRender: false }, s(burstAt))
    .to(state, { fogBlue: 1, coneBlue: 1, duration: 0.8, ease: "sine.out" }, s(burstAt + 0.1))
    // Aftermath: blue dust drifting down, stars sparkle for a moment
    .to(state, { snow: 1, duration: 0.8, ease: "power1.out" }, s(burstAt + 0.2))
    .to(state, { snow: 0.45, duration: 3, ease: "sine.inOut" }, s(burstAt + 1.4))
    .to(state, { starBoost: 1, duration: 0.25, ease: "power2.out" }, s(burstAt + 0.15))
    .to(state, { starBoost: 0, duration: 1.8, ease: "power1.inOut" }, s(burstAt + 0.5));

  // Sound cues
  tl.call(play, ["curtain"], at("curtain"))
    .call(play, ["moon"], at("flight", 0.1))
    .call(play, ["chime"], at("beam", 0.45))
    .call(play, ["rise"], at("crystal", 0.5))
    .call(play, ["impact"], s(0))
    .call(play, ["swirl"], s(HIT_STOP + SPIRAL * 0.1))
    .call(play, ["chord"], s(burstAt));

  // 6) Camera settles down onto the hill (once the burst has started); blue beam; figure assembles
  const settle = s(burstAt - 0.15);
  const settleDur = D - burstAt + 0.15;
  tl.to(state, { lookCrystal: 0, duration: settleDur + d("reveal", 0.5), ease: "power2.inOut" }, settle)
    .to(state.lookTarget, { x: lf.x, y: lf.y, z: lf.z, duration: settleDur + d("reveal", 0.6), ease: "power2.inOut" }, settle)
    .to(state.camOffset, { x: 0, y: 0, z: 0, duration: settleDur + d("reveal", 0.7), ease: "power3.inOut" }, settle)
    .to(state, { coneOpacity: 0.9, duration: d("reveal", 0.4), ease: "power2.out" }, at("reveal"))
    .to(state, { figure: 1, duration: d("reveal", 0.65), ease: "power1.inOut" }, at("reveal", 0.3));

  // 7) Wave, bubble types out, Next button
  tl.to(state, { wave: 1, duration: d("greet", 0.15), ease: "back.out(2)" }, at("greet"))
    .to(dom.bubble, { autoAlpha: 1, scale: 1, y: 0, duration: d("greet", 0.18), ease: "back.out(1.8)" }, at("greet", 0.05))
    .to(dom.chars, { opacity: 1, duration: 0.01, ease: "none", stagger: { amount: d("greet", 0.55) } }, at("greet", 0.2))
    .to(dom.next, { autoAlpha: 1, y: 0, duration: d("greet", 0.2), ease: "power2.out" }, at("greet", 0.8));

  return tl;
}
