import styles from "./Curtain.module.css";

/** Number of fold strips per curtain panel. */
export const CURTAIN_STRIPS = 5;

/** Wavy curtain edge (viewBox 0 0 20 400, 8 wave periods). */
function wavePath(side: "left" | "right"): string {
  const period = 50;
  const parts: string[] = [];
  if (side === "left") {
    // Solid on the left, wavy edge on the right.
    parts.push("M0 0 L10 0");
    for (let y = 0; y < 400; y += period) {
      parts.push(`Q18 ${y + period / 4} 10 ${y + period / 2}`);
      parts.push(`Q2 ${y + (3 * period) / 4} 10 ${y + period}`);
    }
    parts.push("L0 400 Z");
  } else {
    parts.push("M20 0 L10 0");
    for (let y = 0; y < 400; y += period) {
      parts.push(`Q2 ${y + period / 4} 10 ${y + period / 2}`);
      parts.push(`Q18 ${y + (3 * period) / 4} 10 ${y + period}`);
    }
    parts.push("L20 400 Z");
  }
  return parts.join(" ");
}

function Panel({ side }: { side: "left" | "right" }) {
  return (
    <div className={side === "left" ? styles.panelLeft : styles.panelRight}>
      {Array.from({ length: CURTAIN_STRIPS }, (_, i) => {
        const inner = i === CURTAIN_STRIPS - 1;
        return (
          // i = 0 is the outermost strip (at the screen edge); inner strips stack on top.
          <div
            key={i}
            className={styles.strip}
            data-a={side === "left" ? "strip-l" : "strip-r"}
            style={{ zIndex: i + 1 }}
          >
            {inner && (
              <svg
                className={side === "left" ? styles.edgeLeft : styles.edgeRight}
                data-a="curtain-edge"
                viewBox="0 0 20 400"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path d={wavePath(side)} fill="var(--c-curtain-dark)" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Two velvet panels + top valance. Animation is driven by the scene via data-a. */
export function Curtain() {
  return (
    <div className={styles.curtain} data-a="curtain" aria-hidden>
      <Panel side="left" />
      <Panel side="right" />
      <div className={styles.valance} data-a="valance">
        <svg className={styles.scallop} viewBox="0 0 120 10" preserveAspectRatio="none">
          <path
            d={
              "M0 0 " +
              Array.from({ length: 12 }, (_, i) => `Q${i * 10 + 5} 14 ${i * 10 + 10} 0`).join(" ") +
              " Z"
            }
            fill="var(--c-curtain-mid)"
          />
          <path
            d={"M0 0 " + Array.from({ length: 12 }, (_, i) => `Q${i * 10 + 5} 14 ${i * 10 + 10} 0`).join(" ")}
            fill="none"
            stroke="var(--c-curtain-trim)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}
