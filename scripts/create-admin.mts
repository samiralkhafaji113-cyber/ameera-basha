/**
 * Operator script: create (or update) a staff account. Runs on a TRUSTED machine only – it needs the service-role key.
 *
 *   tsx --env-file=.env.local scripts/create-admin.mts --email owner@example.com --role admin [--name "الاسم"] [--password-env VAR]
 *
 * The password is read from the environment variable named by --password-env, or typed interactively
 * (hidden). It is never accepted as a command-line argument, never logged and never stored in the repo.
 */
import readline from "node:readline";
import { operatorTarget } from "./lib/operator.mts";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const email = arg("email");
const role = arg("role") ?? "admin";
const name = arg("name");
const passwordEnv = arg("password-env");

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("--email is required and must look like an email address");
if (!["admin", "manager", "editor"].includes(role)) throw new Error("--role must be admin | manager | editor");

const target = operatorTarget("Create / update a staff account");
// A hosted project must never get a throw-away account: no *.test / example.* / localhost addresses.
if (!target.isLocal && /(^|\.)(test|example|invalid|localhost)(\.|$)/i.test(email.split("@")[1] ?? "")) {
  throw new Error("Refusing to create a test-looking account on a REMOTE project. Use the real owner e-mail address.");
}

async function readHidden(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // mute echo
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
  process.stdout.write(prompt);
  return new Promise((resolve) => rl.question("", (v) => { rl.close(); process.stdout.write("\n"); resolve(v); }));
}

const password = passwordEnv ? process.env[passwordEnv] : await readHidden("Password (hidden): ");
if (!password) throw new Error("No password supplied");
if (!target.isLocal && /local-test|password|12345|ameera/i.test(password)) throw new Error("That password looks like a known/test password – choose a strong unique one");
if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
  throw new Error("Password must be at least 10 characters with upper-case, lower-case and a digit");
}

const admin = target.db;

// find an existing user with this email
let userId: string | undefined;
for (let page = 1; page < 20 && !userId; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  if (data.users.length < 200) break;
}

if (userId) {
  const { error } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
  if (error) throw error;
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
}

const { error: profileError } = await admin.from("profiles").upsert({ id: userId, role, display_name: name ?? null }, { onConflict: "id" });
if (profileError) throw profileError;
console.log(`OK – ${email} is now "${role}" (${userId}).`);
