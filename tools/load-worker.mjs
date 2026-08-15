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

/* Every module worker.js pulls in has to be inlined the same way, so this is a
   list rather than one special case — a new import that is not added here fails
   loudly below instead of at some confusing point later. */
const MODULES = ["worker-admin.js", "worker-instagram.js"];

export async function loadWorker() {
  let main = read("worker.js");
  for (const name of MODULES) {
    const source = read(name).replace(/^export /gm, "");
    main = main.replace(
      new RegExp(`^import \\{[^}]*\\} from "\\./${name.replace(".", "\\.")}";$`, "m"),
      source);
    if (main.includes(`"./${name}"`)) {
      throw new Error(`the ${name} import was not inlined — has the import line changed?`);
    }
  }
  return import("data:text/javascript;base64," + Buffer.from(main).toString("base64"));
}

export async function loadAdmin() {
  const admin = read("worker-admin.js");
  return import("data:text/javascript;base64," + Buffer.from(admin).toString("base64"));
}
