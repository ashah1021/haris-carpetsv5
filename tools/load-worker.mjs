/**
 * Load the Worker for testing, without a package.json.
 *
 * The repo has no package.json on purpose: Cloudflare Workers Builds changes
 * what it runs when it finds one, and the site deploys from a plain wrangler
 * config today. Without it Node reads a bare .js as CommonJS, so the Worker —
 * which is ESM — has to be handed to the import machinery another way.
 *
 * A data: URL does that, but relative imports cannot be resolved from one, so
 * worker.js's import of worker-admin.js is inlined here first. Stripping the
 * `export` keywords turns the module's declarations into plain top-level ones,
 * which is exactly what the import statement would have bound anyway.
 */
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");

export async function loadWorker() {
  const admin = read("worker-admin.js").replace(/^export /gm, "");
  const main = read("worker.js")
    .replace(/^import \{[^}]*\} from "\.\/worker-admin\.js";$/m, admin);
  if (main.includes("worker-admin.js")) {
    throw new Error("the worker-admin import was not inlined — has the import line changed?");
  }
  return import("data:text/javascript;base64," + Buffer.from(main).toString("base64"));
}

export async function loadAdmin() {
  const admin = read("worker-admin.js");
  return import("data:text/javascript;base64," + Buffer.from(admin).toString("base64"));
}
