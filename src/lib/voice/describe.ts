/**
 * Texto hablado para el elemento que recibe el foco: "nombre, rol, estado"
 * (p. ej. "Play, button" o "Seek, slider, value 12").
 *
 * Es una versión reducida del cálculo de nombre accesible del navegador, con
 * los casos que usa este sitio: enlaces, botones, sliders y radios.
 */

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

function accessibleName(el: HTMLElement): string {
  const label = clean(el.getAttribute("aria-label"));
  if (label) return label;

  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = clean(
      labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent)
        .join(" "),
    );
    if (text) return text;
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    const text = clean(Array.from(el.labels ?? []).map((l) => l.textContent).join(" "));
    if (text) return text;
  }

  const text = clean(el.textContent);
  if (text) return text;

  const img = el.querySelector("img[alt]");
  return clean(img?.getAttribute("alt")) || clean(el.getAttribute("title"));
}

function roleAndState(el: HTMLElement): string[] {
  const parts: string[] = [];
  const role = el.getAttribute("role");
  const pressed = el.getAttribute("aria-pressed");

  if (el instanceof HTMLInputElement && el.type === "range") {
    parts.push("slider", `value ${clean(el.getAttribute("aria-valuetext")) || el.value}`);
  } else if (el instanceof HTMLInputElement && el.type === "radio") {
    const group = el.name
      ? Array.from(el.form?.elements ?? el.ownerDocument.querySelectorAll("input[type=radio]")).filter(
          (r): r is HTMLInputElement => r instanceof HTMLInputElement && r.type === "radio" && r.name === el.name,
        )
      : [el];
    parts.push("radio button", `${group.indexOf(el) + 1} of ${group.length}`, el.checked ? "selected" : "not selected");
  } else if (el instanceof HTMLInputElement && el.type === "checkbox") {
    parts.push("checkbox", el.checked ? "checked" : "not checked");
  } else if (role === "switch") {
    parts.push("switch", el.getAttribute("aria-checked") === "true" ? "on" : "off");
  } else if (pressed !== null) {
    parts.push("toggle button", pressed === "true" ? "on" : "off");
  } else if (el instanceof HTMLAnchorElement && el.href) {
    parts.push("link");
  } else if (el instanceof HTMLButtonElement || role === "button") {
    parts.push("button");
  } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    parts.push("text field");
  } else if (role) {
    parts.push(role);
  }

  const expanded = el.getAttribute("aria-expanded");
  if (expanded !== null) parts.push(expanded === "true" ? "expanded" : "collapsed");

  const current = el.getAttribute("aria-current");
  if (current && current !== "false") parts.push(current === "page" ? "current page" : "current");

  if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") parts.push("unavailable");

  return parts;
}

/** "Nombre, rol, estado" del elemento, o "" si no hay nada que decir. */
export function describeElement(el: HTMLElement): string {
  return [accessibleName(el), ...roleAndState(el)].filter(Boolean).join(", ");
}

/** Nombre de la sección (`data-voice-section`) más cercana al elemento. */
export function sectionOf(el: Element): string | null {
  return clean(el.closest("[data-voice-section]")?.getAttribute("data-voice-section")) || null;
}
