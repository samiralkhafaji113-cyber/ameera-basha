/**
 * Validates the environment for a PRODUCTION deployment without printing any value (names + problems only).
 *
 *   tsx --env-file=.env.production.local scripts/check-env.mts
 *   NEXT_PUBLIC_SITE_URL=https://… NEXT_PUBLIC_SUPABASE_URL=https://… NEXT_PUBLIC_SUPABASE_ANON_KEY=… tsx scripts/check-env.mts
 *
 * Exit 1 when something is missing / points at localhost / is a placeholder. The same rules run automatically when
 * Vercel builds the Production environment (next.config.ts).
 */
import { checkProductionEnv, forbiddenRuntimeVars } from "../src/lib/prod-env.ts";

const problems = checkProductionEnv(process.env);
for (const name of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  const bad = problems.filter((p) => p.variable === name);
  console.log(`${bad.length ? "FAIL" : "ok  "}  ${name}${bad.length ? " – " + bad.map((b) => b.problem).join("; ") : ""}`);
}
const operatorOnly = forbiddenRuntimeVars(process.env);
console.log(
  operatorOnly.length
    ? `note  ${operatorOnly.join(", ")} present in this env file – fine on an OPERATOR machine, but do NOT add it to Vercel`
    : "ok    no operator-only secrets in this environment",
);
process.exit(problems.length ? 1 : 0);
