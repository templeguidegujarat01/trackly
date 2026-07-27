/**
 * ui.js
 * Small, reusable UI behaviours that aren't tied to one specific
 * component (that's what components.js is for). Things like toggling a
 * button's loading state, or rendering a consistent empty state — used
 * from many places, owned by none of them.
 */

/**
 * Puts a button into/out of its loading state (see .btn[data-loading] in
 * buttons.css). Future phases (subscribe flow, form submit) call this
 * around their async requests.
 */
export function setButtonLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    button.setAttribute("data-loading", "true");
    button.setAttribute("aria-busy", "true");
    button.disabled = true;
  } else {
    button.removeAttribute("data-loading");
    button.removeAttribute("aria-busy");
    button.disabled = false;
  }
}

/**
 * Renders a consistent "nothing here yet" state inside `container`.
 * Used wherever a future data-driven list (tracked topics, notifications,
 * search results) might legitimately be empty — never leave a blank page.
 */
export function renderEmptyState(container, { title, message }) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state" role="status">
      <p class="text-lead">${title}</p>
      <p class="text-small text-muted">${message}</p>
    </div>
  `;
}

/** Toggles a hidden attribute + open class pair used by menus and dropdowns. */
export function togglePanel(panel, openClass, shouldOpen) {
  if (!panel) return;
  if (shouldOpen) {
    panel.hidden = false;
    // Next frame, so the transition in CSS actually animates.
    requestAnimationFrame(() => panel.classList.add(openClass));
  } else {
    panel.classList.remove(openClass);
    const onEnd = () => {
      panel.hidden = true;
      panel.removeEventListener("transitionend", onEnd);
    };
    panel.addEventListener("transitionend", onEnd);
    // Fallback in case transitionend never fires (e.g. reduced motion).
    setTimeout(onEnd, 350);
  }
}
