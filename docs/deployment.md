# خطوات النشر – Deployment

كل الأوامر تُنفَّذ من مجلد المشروع على **جهازك**. **لا تكتب مفاتيح أو كلمات مرور في المحادثة أو في Git**: تُوضَع فقط في `.env.production.local` (على جهازك) أو في Vercel → Environment Variables، والأسماء موضحة أدناه.

## 0) قبل البدء
- حساب Supabase وحساب Vercel وحساب GitHub (المشروع ليس مستودع Git بعد: `git init` نُفِّذ محلياً بلا Commit).
- `git add -A && git commit -m "Initial production-ready version"` ثم ارفعه إلى مستودع **خاص** على GitHub. (`.env.local` وملفات النسخ الاحتياطي مستثناة تلقائياً.)
- اقترح الدومين لاحقاً؛ يمكن الإطلاق أولاً على عنوان `*.vercel.app`.

## 1) Supabase
1. **New project**: المنطقة الأقرب لك (مثلاً Frankfurt) وكلمة مرور قوية لقاعدة البيانات تُحفظ في مدير كلمات مرورك. (المنطقة نفسها اخترها في `vercel.json` → `regions`؛ الحالية `fra1`.)
2. **Authentication → Providers → Email**: مفعّل. **Sign In / Providers → عطّل "Allow new users to sign up"** (لا تسجيل عام). كلمة المرور ≥ 10 مع أحرف كبيرة/صغيرة/أرقام. فعّل حماية كلمات المرور المسرّبة إن كانت خطتك تدعمها.
3. **Authentication → URL Configuration**: Site URL = عنوان موقعك (مؤقتاً عنوان Vercel) وأضفه إلى Redirect URLs.
4. اربط المشروع وادفع المخطط (6 migrations، غير هدّامة):
   ```bash
   npx supabase@2.117.0 login
   npx supabase@2.117.0 link --project-ref <REF من رابط المشروع>
   npm run prod:db-push
   ```
   (لا تنفّذ `supabase config push`: إعداداته محلية.)
5. **SQL Editor**: الصق `supabase/tests/rls_audit.sql` ونفّذه ← يجب أن تكون كل الصفوف `PASS` (الصف الأخير INFO = عدد حسابات الاختبار ويجب 0).
6. أنشئ ملف **`.env.production.local`** (في جذر المشروع، خارج Git) بهذه **الأسماء**، وقيمها من Supabase → Project Settings → API:
   ```
   NEXT_PUBLIC_SITE_URL=            ← عنوان موقعك https://…
   NEXT_PUBLIC_SUPABASE_URL=        ← Project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=   ← anon / publishable key
   SUPABASE_SERVICE_ROLE_KEY=       ← service_role / secret key  (على جهازك فقط!)
   ```
7. تحقق: `npm run prod:check-env`
8. **نقل الـ72 منتجاً وصورها**: `npm run prod:seed` ثم `npm run prod:verify` (يجب PASS) ثم `npm run prod:audit` (قارن مع `supabase/local-audit.json`).
9. **حساب الأدمن الحقيقي** (كلمة المرور تُكتب مخفية في الطرفية، لا تُطبع ولا تُحفظ):
   ```bash
   npm run prod:create-admin -- --email بريدك@الحقيقي --role admin --name "الاسم"
   ```
   السكربت يرفض بريد `.test/.example` وكلمات المرور الضعيفة/الافتراضية على المشاريع البعيدة.
10. `npm run prod:staff-audit` ← يجب PASS (لا حسابات اختبار، ويوجد أدمن حقيقي). لحذف أي حساب اختبار: `… scripts/staff-audit.mts --allow-remote --remove-test-accounts --apply`.

## 2) Vercel
1. **Add New → Project** ← استورد المستودع. Framework: Next.js (تلقائي). Node: 24.x (من `package.json`).
2. **Settings → Environment Variables** — أضف **ثلاثة فقط** (والقيم لصقاً من لوحة Supabase، لا في المحادثة):
   | الاسم | Production | Preview | Development |
   |---|:-:|:-:|:-:|
   | `NEXT_PUBLIC_SITE_URL` | ✓ | — | — |
   | `NEXT_PUBLIC_SUPABASE_URL` | ✓ | مشروع تجريبي أو اتركه غير مضاف | — |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | مثل السابق | — |
   ❌ **لا تضف `SUPABASE_SERVICE_ROLE_KEY`** إلى Vercel: التطبيق لا يقرؤه، ووجوده يوسّع الضرر لو تسرّب.
3. **Deploy**. إن ظهر خطأ "Production environment is not ready" فهو يذكر أسماء المتغيرات الناقصة فقط.
4. بعد النشر: `https://عنوانك/api/health` يجب أن يُظهر `{"status":"ok","database":true,…}`.
5. **الاختبار الكامل على الإنتاج** (متصفح حقيقي، بيانات TEST فقط، يحذف المنتج بنفسه):
   ```bash
   $env:E2E_BASE_URL="https://عنوانك"      # PowerShell   (cmd: set E2E_BASE_URL=https://عنوانك)
   npm run smoke:e2e          # يسألك عن بريد/كلمة مرور الأدمن (مخفية)
   npm run prod:cleanup-test-data -- --apply    # يحذف حجز الاختبار المتبقي
   ```
6. **الأسعار**: من لوحة التحكم ← الإعدادات ← «تأكيد عملة الأسعار المستوردة» بعد أن تؤكد أن كل الأسعار بالدينار (أو الدولار). قبل ذلك يعرض الموقع «السعر عند الاستفسار».

## 3) الدومين (DNS) — لا أشتري دومين نيابةً عنك
1. Vercel → Project → **Settings → Domains → Add** وأدخل دومينك.
2. عند مزوّد الدومين أضف السجلات **كما تعرضها Vercel بالضبط** (عادةً `A` للجذر و`CNAME` لـ`www`)، وانتظر التحقق. شهادة HTTPS تصدر تلقائياً.
3. غيّر `NEXT_PUBLIC_SITE_URL` في Vercel (Production) إلى `https://دومينك` ثم **Redeploy**، وحدّث Site URL في Supabase Auth. أعد فحص الـsitemap: `https://دومينك/sitemap.xml`.
4. (اختياري) أرسل الـsitemap إلى Google Search Console.

## 4) بعد الإطلاق
- شغّل `npm run prod:backup` بانتظام، وأضف `/api/health` إلى مراقب Uptime.
- لا تستعمل حساب أدمن واحداً مشتركاً؛ أنشئ حساباً لكل موظف بالدور المناسب (`manager` / `editor`).
- كلمات المرور تُغيَّر من اللوحة ← الإعدادات.
