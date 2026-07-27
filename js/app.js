/**
 * app.js
 * Entry point, loaded on every page via <script type="module" src="/js/app.js">.
 * Its only job is to boot the shared modules — it should never grow
 * page-specific logic. A future page needing unique behaviour gets its own
 * small module, imported here or loaded alongside this one.
 */

import { onReady, setCurrentYear } from "./utils.js";
import { initNavigation } from "./navigation.js";
import { initDropdowns, initAccordions } from "./components.js";

onReady(() => {
  initNavigation();
  initDropdowns();
  initAccordions();
  setCurrentYear();
});
