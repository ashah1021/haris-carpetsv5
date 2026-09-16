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

/* Modules import each other — worker.js pulls in worker-admin.js, which pulls
   in worker-analytics.js — so inlining is done by following the imports rather
   than from a list that has to be kept in step by hand. A relative import that
   cannot be read fails here, loudly, instead of at some confusing point later.

   Each module is inlined once however many times it is imported: a second copy
   would redeclare every one of its constants. */
function bundle(name, seen = new Set(), entry = true) {
  /* `export` is stripped from everything that gets inlined, turning each
     module's declarations into plain top-level ones — which is what the import
     statement would have bound anyway. The entry module keeps its own exports:
     worker.js needs `export default` to still be a default export, and
     loadAdmin() reads clean() and empty() off worker-admin.js. */
  let source = read(name);
  if (!entry) source = source.replace(/^export /gm, "");
  for (const [line, dep] of [...source.matchAll(/^import \{[^}]*\} from "\.\/([\w.-]+)";$/gm)]) {
    source = source.replace(line, seen.has(dep) ? "" : bundle(dep, seen.add(dep), false));
  }
  if (/^import .* from "\.\//m.test(source)) {
    throw new Error(`a relative import in ${name} was not inlined — has the import line changed?`);
  }
  return source;
}

export async function loadWorker() {
  const main = bundle("worker.js");
  return import("data:text/javascript;base64," + Buffer.from(main).toString("base64"));
}

export async function loadAdmin() {
  const admin = bundle("worker-admin.js");
  return import("data:text/javascript;base64," + Buffer.from(admin).toString("base64"));
}
