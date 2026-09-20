import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Integration tests run against the LOCAL Supabase stack (npm run db:start) with the migrations applied.
 * The service-role client is used here ONLY to arrange/clean test data – exactly like an operator script;
 * every assertion is made through the anon key or a real signed-in session (i.e. through RLS).
 */
const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is missing – run "npm run db:env" (local Supabase must be running)`);
  return v;
};

export const URL_ = need("NEXT_PUBLIC_SUPABASE_URL");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(URL_)) throw new Error("Refusing to run integration tests against a non-local Supabase project");

const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;
export const anon = (): SupabaseClient => createClient(URL_, need("NEXT_PUBLIC_SUPABASE_ANON_KEY"), opts);
export const service = (): SupabaseClient => createClient(URL_, need("SUPABASE_SERVICE_ROLE_KEY"), opts);

export async function signedIn(role: "admin" | "editor"): Promise<SupabaseClient> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email: need(`E2E_${role.toUpperCase()}_EMAIL`), password: need(`E2E_${role.toUpperCase()}_PASSWORD`) });
  if (error) throw new Error(`cannot sign in as ${role}: ${error.message}`);
  return c;
}

export const TEST_PREFIX = "ZZTEST";
export const uid = () => randomUUID().slice(0, 8);

/** A phone number unique per call so the per-phone rate limit never interferes between tests. */
export const uniquePhone = () => `077${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

export async function firstCategory(svc: SupabaseClient): Promise<{ id: string; subId: string; otherSubId: string }> {
  const { data: cats } = await svc.from("categories").select("id, subcategories(id)").eq("slug", "women").single();
  const { data: other } = await svc.from("subcategories").select("id").neq("category_id", cats!.id).limit(1).single();
  return { id: cats!.id, subId: (cats!.subcategories as { id: string }[])[0].id, otherSubId: other!.id };
}

/** Creates a product (via service role) with N fake image rows, then moves it to the wanted status (publishing needs images). */
export async function makeProduct(
  svc: SupabaseClient,
  over: Record<string, unknown> = {},
  images = 1,
): Promise<{ id: string; slug: string; name: string }> {
  const { status = "draft", ...rest } = over;
  const cat = await firstCategory(svc);
  const slug = `zztest-${uid()}`;
  const name = `${TEST_PREFIX} منتج ${slug}`;
  const { data, error } = await svc
    .from("products")
    .insert({ name, slug, category_id: cat.id, status: "draft", sizes: ["M"], ...rest })
    .select("id")
    .single();
  if (error) throw new Error(`makeProduct: ${error.message}`);
  for (let i = 0; i < images; i++) {
    const path = `products/${data.id}/${randomUUID()}.webp`;
    const { error: e2 } = await svc.from("product_images").insert({ product_id: data.id, storage_path: path, public_url: `http://127.0.0.1/${path}`, sort_order: i + 1, width: 800, height: 1000 });
    if (e2) throw new Error(`makeProduct image: ${e2.message}`);
  }
  if (status !== "draft") {
    const { error: e3 } = await svc.from("products").update({ status }).eq("id", data.id);
    if (e3) throw new Error(`makeProduct status: ${e3.message}`);
  }
  return { id: data.id, slug, name };
}

export async function cleanup(svc: SupabaseClient) {
  await svc.from("reservations").delete().like("product_name_snapshot", `${TEST_PREFIX}%`);
  await svc.from("products").delete().like("name", `${TEST_PREFIX}%`);
}

/** An ephemeral staff account for role tests (deleted by `dropStaff`). */
export async function makeStaff(svc: SupabaseClient, role: "manager" | "editor" | "admin") {
  const email = `zztest-${role}-${uid()}@ameera.test`;
  const password = `Zz-${uid()}-Test-2026`;
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`makeStaff: ${error?.message}`);
  const { error: pe } = await svc.from("profiles").upsert({ id: data.user.id, role, display_name: `ZZTEST ${role}` });
  if (pe) throw new Error(`makeStaff profile: ${pe.message}`);
  const client = anon();
  const { error: se } = await client.auth.signInWithPassword({ email, password });
  if (se) throw new Error(`makeStaff sign-in: ${se.message}`);
  return { client, userId: data.user.id };
}
export const dropStaff = async (svc: SupabaseClient, userId: string) => {
  await svc.auth.admin.deleteUser(userId);
};
