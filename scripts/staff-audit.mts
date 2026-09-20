/**
 * Who can sign in? Lists every Auth user (e-mail MASKED) with their staff role and flags throw-away / test accounts.
 *
 *   tsx --env-file=.env.production.local scripts/staff-audit.mts --allow-remote --forbid-test-accounts
 *       → exit code 1 if any test account (or any Auth user without a staff profile) exists
 *   tsx --env-file=.env.production.local scripts/staff-audit.mts --allow-remote --remove-test-accounts            (dry run)
 *   tsx --env-file=.env.production.local scripts/staff-audit.mts --allow-remote --remove-test-accounts --apply    (deletes them)
 *
 * The local development database is expected to contain test accounts; the HOSTED project must not.
 */
import { flag, operatorTarget } from "./lib/operator.mts";

const { db, args, isLocal } = operatorTarget("Staff / account audit");

const TEST_DOMAIN = /(^|\.)(test|example|invalid|localhost)(\.|$)/i;
const mask = (email: string | undefined) => {
  if (!email) return "(no e-mail)";
  const [user, domain = ""] = email.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
};

const users: { id: string; email?: string }[] = [];
for (let page = 1; page < 50; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  users.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
  if (data.users.length < 200) break;
}
const { data: profiles } = await db.from("profiles").select("id, role");
const role = new Map((profiles ?? []).map((p) => [p.id as string, p.role as string]));

const rows = users.map((u) => ({
  account: mask(u.email),
  role: role.get(u.id) ?? "— none (cannot use the admin)",
  testAccount: TEST_DOMAIN.test((u.email ?? "").split("@")[1] ?? ""),
  id: u.id,
}));
console.table(rows.map((r) => ({ account: r.account, role: r.role, testAccount: r.testAccount })));

const testAccounts = rows.filter((r) => r.testAccount);
const orphans = rows.filter((r) => !role.has(r.id));
const admins = rows.filter((r) => role.get(r.id) === "admin" && !r.testAccount);
console.log(`users: ${rows.length} · real admins: ${admins.length} · test accounts: ${testAccounts.length} · users without staff role: ${orphans.length}`);

if (flag(args, "remove-test-accounts")) {
  if (!testAccounts.length) console.log("no test accounts to remove");
  for (const t of testAccounts) {
    if (!flag(args, "apply")) {
      console.log(`[dry run] would delete ${t.account}`);
      continue;
    }
    const { error } = await db.auth.admin.deleteUser(t.id); // profile row cascades
    console.log(error ? `FAILED to delete ${t.account}: ${error.message}` : `deleted ${t.account}`);
  }
  if (!flag(args, "apply") && testAccounts.length) console.log("nothing was changed – add --apply to delete them");
}

if (flag(args, "forbid-test-accounts")) {
  const problems = [
    ...(testAccounts.length ? [`${testAccounts.length} test account(s) exist`] : []),
    ...(orphans.length ? [`${orphans.length} Auth user(s) have no staff profile`] : []),
    ...(admins.length === 0 ? ["no real admin account exists yet (run: npm run db:create-admin)"] : []),
  ];
  if (problems.length) {
    console.error("FAIL:", problems.join("; "));
    process.exit(1);
  }
  console.log("PASS – only real staff accounts exist.");
} else if (isLocal && testAccounts.length) {
  console.log("(local development database: test accounts are expected here)");
}
