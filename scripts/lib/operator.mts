/**
 * Shared guard rails for OPERATOR scripts (seed, create-admin, audit, verify, backup …). They use the service-role key,
 * so they must only ever run on a trusted machine and must make it obvious WHICH project they are about to touch.
 *
 *  - env comes from a file chosen by the operator:  tsx --env-file=.env.local …   (local stack)
 *                                                   tsx --env-file=.env.production.local … --allow-remote   (hosted project)
 *  - a REMOTE target is refused unless --allow-remote is passed (so a mistyped env file can never touch production)
 *  - the target host is printed; keys are never printed
 */
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface OperatorTarget {
  db: SupabaseClient;
  url: string;
  host: string;
  isLocal: boolean;
  args: string[];
}

export const flag = (args: string[], name: string) => args.includes(`--${name}`);
export const option = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

export function operatorTarget(purpose: string, { needServiceKey = true }: { needServiceKey?: boolean } = {}): OperatorTarget {
  const args = process.argv.slice(2);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = needServiceKey ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set (load an env file with --env-file)");
  if (!key) throw new Error(`${needServiceKey ? "SUPABASE_SERVICE_ROLE_KEY" : "NEXT_PUBLIC_SUPABASE_ANON_KEY"} is not set`);
  const parsed = new URL(url);
  const isLocal = ["127.0.0.1", "localhost"].includes(parsed.hostname);
  console.log(`▶ ${purpose}\n  target: ${parsed.host} (${isLocal ? "LOCAL development stack" : "REMOTE hosted project"})`);
  if (!isLocal) {
    if (parsed.protocol !== "https:") throw new Error("a remote Supabase URL must be https://");
    if (!flag(args, "allow-remote")) throw new Error("This is a REMOTE project. Re-run with --allow-remote if you really mean to touch it.");
  }
  return { db: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), url, host: parsed.host, isLocal, args };
}
