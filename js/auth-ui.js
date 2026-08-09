/**
 * auth-ui.js
 * Loaded on every page (alongside app.js). Wires the login modal and
 * keeps the header's login control in sync with real Firebase auth
 * state — a "Log In" button when signed out, a user chip (avatar +
 * name, linking to the dashboard) when signed in.
 */

import { qs, onReady } from "./utils.js";
import { showToast } from "./toast.js";
import {
  onAuthChange, signInWithGoogle, signUpWithEmail, signInWithEmail,
  signOut, friendlyAuthError,
} from "./auth.js";

function openModal() {
  const overlay = qs("[data-auth-overlay]");
  if (!overlay) return;
  overlay.hidden = false;
  clearError();
  qs("[data-auth-email]")?.focus();
}

function closeModal() {
  const overlay = qs("[data-auth-overlay]");
  if (!overlay) return;
  overlay.hidden = true;
  qs("[data-auth-form]")?.reset();
  clearError();
}

function clearError() {
  const el = qs("[data-auth-error]");
  if (el) el.hidden = true;
}

function showError(message) {
  const el = qs("[data-auth-error]");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

function setMode(mode) {
  const submitBtn = qs("[data-auth-submit]");
  const switchText = qs("[data-auth-switch-text]");
  const switchBtn = qs("[data-auth-switch-btn]");
  const title = qs("[data-auth-title]");
  if (!submitBtn) return;

  qs("[data-auth-form]").dataset.mode = mode;
  if (mode === "signup") {
    title.textContent = "Create your account";
    submitBtn.textContent = "Create account";
    switchText.textContent = "Already have an account?";
    switchBtn.textContent = "Sign in";
  } else {
    title.textContent = "Log in to Trackly";
    submitBtn.textContent = "Log in";
    switchText.textContent = "New to Trackly?";
    switchBtn.textContent = "Create an account";
  }
}

function initHeaderAuthState() {
  const loginBtn = qs("[data-login-trigger]");
  if (!loginBtn) return;

  onAuthChange((user) => {
    if (user) {
      loginBtn.setAttribute("href", "dashboard.html");
      loginBtn.className = "user-chip";
      const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();
      const avatarInner = user.photoURL
        ? `<img src="${user.photoURL}" alt="">`
        : initial;
      loginBtn.innerHTML = `
        <span class="user-chip__avatar" aria-hidden="true">${avatarInner}</span>
        <span class="hide-mobile">${user.displayName ? user.displayName.split(" ")[0] : "Account"}</span>
      `;
      loginBtn.onclick = null;
    } else {
      loginBtn.removeAttribute("href");
      loginBtn.className = "btn btn-secondary btn-sm nav-actions__login";
      loginBtn.textContent = "Log In";
      loginBtn.style.display = "";
      loginBtn.onclick = (event) => {
        event.preventDefault();
        openModal();
      };
    }
  });
}

function initModal() {
  const overlay = qs("[data-auth-overlay]");
  const form = qs("[data-auth-form]");
  if (!overlay || !form) return;

  qs("[data-auth-close]")?.addEventListener("click", closeModal);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  qs("[data-auth-google]")?.addEventListener("click", async () => {
    clearError();
    try {
      await signInWithGoogle();
      showToast("Welcome!");
      closeModal();
    } catch (err) {
      showError(friendlyAuthError(err));
    }
  });

  qs("[data-auth-switch-btn]")?.addEventListener("click", () => {
    setMode(form.dataset.mode === "signup" ? "login" : "signup");
    clearError();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    const email = qs("[data-auth-email]").value.trim();
    const password = qs("[data-auth-password]").value;
    const submitBtn = qs("[data-auth-submit]");
    submitBtn.setAttribute("data-loading", "true");
    submitBtn.disabled = true;

    try {
      if (form.dataset.mode === "signup") {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      showToast("Welcome!");
      closeModal();
    } catch (err) {
      showError(friendlyAuthError(err));
    } finally {
      submitBtn.removeAttribute("data-loading");
      submitBtn.disabled = false;
    }
  });

  setMode("login");
}

function initLogoutButtons() {
  document.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-sign-out]");
    if (!btn) return;
    event.preventDefault();
    await signOut();
    showToast("Signed out");
    if (document.body.dataset.requiresAuth === "true") {
      window.location.href = "index.html";
    }
  });
}

onReady(() => {
  initHeaderAuthState();
  initModal();
  initLogoutButtons();
});
