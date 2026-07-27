/**
 * components.js
 * Initializers for reusable interactive components. Each `init*` function
 * is idempotent and safe to call on a page that doesn't contain that
 * component — it just finds nothing and returns. app.js calls all of them
 * on every page so no page needs its own bootstrapping script.
 */

import { qs, qsa } from "./utils.js";
import { togglePanel } from "./ui.js";

/**
 * Custom dropdown — see the markup contract documented at the top of
 * css/dropdowns.css. Handles mouse, keyboard, and outside-click.
 */
export function initDropdowns() {
  qsa(".dropdown").forEach((dropdown) => {
    const trigger = qs(".dropdown__trigger", dropdown);
    const menu = qs(".dropdown__menu", dropdown);
    if (!trigger || !menu) return;

    const items = qsa(".dropdown__item", menu);
    let activeIndex = -1;

    const open = () => {
      dropdown.dataset.open = "true";
      trigger.setAttribute("aria-expanded", "true");
      togglePanel(menu, "dropdown__menu--open", true);
    };

    const close = () => {
      dropdown.dataset.open = "false";
      trigger.setAttribute("aria-expanded", "false");
      menu.hidden = true;
      activeIndex = -1;
      items.forEach((item) => item.removeAttribute("data-active"));
    };

    trigger.addEventListener("click", () => {
      const isOpen = dropdown.dataset.open === "true";
      isOpen ? close() : open();
    });

    items.forEach((item, index) => {
      item.addEventListener("click", () => {
        items.forEach((i) => i.removeAttribute("aria-selected"));
        item.setAttribute("aria-selected", "true");
        trigger.querySelector("[data-dropdown-value]") &&
          (trigger.querySelector("[data-dropdown-value]").textContent =
            item.textContent);
        close();
        trigger.focus();
      });
      item.addEventListener("mouseenter", () => {
        activeIndex = index;
      });
    });

    trigger.addEventListener("keydown", (event) => {
      if (["ArrowDown", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        open();
        activeIndex = 0;
        items[0] && items[0].setAttribute("data-active", "true");
        items[0] && items[0].focus?.();
      }
    });

    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
        trigger.focus();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        items.forEach((i) => i.removeAttribute("data-active"));
        items[activeIndex]?.setAttribute("data-active", "true");
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        items.forEach((i) => i.removeAttribute("data-active"));
        items[activeIndex]?.setAttribute("data-active", "true");
      }
    });

    document.addEventListener("click", (event) => {
      if (!dropdown.contains(event.target)) close();
    });
  });
}

/**
 * FAQ accordion — plain <details>/<summary> is used in the markup for
 * baseline accessibility and no-JS resilience; this only adds the
 * open/close chevron rotation class.
 */
export function initAccordions() {
  qsa(".accordion-item").forEach((item) => {
    item.addEventListener("toggle", () => {
      item.classList.toggle("accordion-item--open", item.open);
    });
  });
}
