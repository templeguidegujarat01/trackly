/**
 * toast.js
 * One reusable toast system for the whole site. Creates its container
 * lazily on first use, so importing this module needs zero HTML changes
 * on any page.
 */

function getContainer() {
  let el = document.querySelector("[data-toast-container]");
  if (!el) {
    el = document.createElement("div");
    el.setAttribute("data-toast-container", "");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.style.cssText =
      "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:600;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;";
    document.body.appendChild(el);
  }
  return el;
}

/** Shows a short-lived toast message. type: "default" | "success" */
export function showToast(message, type = "default") {
  const container = getContainer();
  const toast = document.createElement("div");
  const bg = type === "success" ? "var(--color-ink)" : "var(--color-ink)";
  toast.style.cssText = `
    background-color: ${bg};
    color: var(--color-paper);
    font-size: var(--text-sm);
    font-weight: 600;
    padding: 10px 18px;
    border-radius: var(--radius-full);
    box-shadow: var(--shadow-md);
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 180ms ease, transform 180ms ease;
  `;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 200);
  }, 2200);
}
