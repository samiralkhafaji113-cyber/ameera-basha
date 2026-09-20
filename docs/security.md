# الأمان – Security

نتائج المراجعة الفعلية (محلياً) والقواعد المعمول بها. الفحوص التي تحتاج مشروع Supabase/Vercel الحقيقيين مذكورة بـ`NOT VERIFIED` وطريقة تنفيذها في [deployment.md](deployment.md).

## 1. الأسرار (Secrets)

| البند | الوضع | كيف يُتحقق |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` في كود التطبيق | **لا يُقرأ ولا يُذكر** في أي ملف تحت `src/` (الاستثناء الوحيد: اسم المتغيّر في `src/lib/prod-env.ts` لتحذير البناء، ولا يستوردها أي كود تطبيق) | `tests/secrets.test.ts` |
| في حزمة المتصفح / HTML / JS المُرسَل | غير موجود (لا القيمة ولا الاسم) | نفس الاختبار يمسح `.next/static` بعد البناء (نجح) |
| كلمات مرور/JWT/مفاتيح `sb_secret_` في الملفات | لا شيء في أي ملف مُلتزَم به (المشروع كله عدا `node_modules`/`.next`/`public`) | `tests/production-config.test.ts` |
| `.env.example` | أسماء فقط، **قيم فارغة**، بلا حساب أو بريد | نفس الاختبار |
| `.env.local` / `.env.production.local` / `backups/` | مستثناة من Git؛ `.env.example` فقط مسموح | `.gitignore` + اختبار |
| Vercel | لا يوضع فيه `service_role`؛ بناء Production يحذّر إن وُجد | `next.config.ts` |
| السجلات | `redact()` يحذف JWT/مفاتيح/Bearer/بريد/هاتف/password قبل الكتابة؛ لا ترويسات/كوكيز/أجسام/queries | `tests/production-config.test.ts` |
| الطرفية | السكربتات لا تطبع مفاتيح؛ كلمة مرور الأدمن تُطلب مخفية أو من متغير بيئة ولا تُقبل كوسيط أمر | `scripts/*` |

## 2. المصادقة والصلاحيات

* Supabase Auth بدل أي حساب محلي. حسابات الاختبار المحلية **لا تُنقل**: الهجرات وملفات الـseed لا تحوي حسابات أصلاً (اختبار آلي)، وسكربت الإنشاء يرفض على المشروع البعيد أي بريد `.test/.example` وكلمات المرور الافتراضية.
* `npm run prod:staff-audit` يفشل إن وُجد حساب اختبار أو مستخدم بلا دور أو لم يوجد أدمن حقيقي. `--remove-test-accounts --apply` يحذفها.
* `/admin/*`: غير مسجَّل → `/admin/login?next=…` (redirect آمن، لا open redirect)؛ مسجَّل بلا دور موظف أو بلا صلاحية → `/admin/access-denied`. مُختبَر في متصفح حقيقي بحساب editor (الأقسام والحجوزات ممنوعة).
* كل Server Action وRoute Handler يعيد فحص الجلسة والدور في الخادم (`withPermission` / `requirePermission`) — إخفاء الزر لا يُعدّ صلاحية.
* جلسة: كوكي HttpOnly + SameSite=Lax + Secure (إنتاج)، `auth.getUser()` (تحقق من الخادم).
* حماية من التخمين: حدود GoTrue للدخول + رسالة خطأ موحّدة (لا كشف لوجود الحساب).

| العملية | admin | manager | editor |
|---|:-:|:-:|:-:|
| إنشاء/تعديل منتج، رفع صورة | ✓ | ✓ | ✓ |
| نشر / إخفاء / أرشفة / تمييز / حذف ناعم / استعادة | ✓ | ✓ | ✗ |
| **حذف صورة** (صف + ملف) | ✓ | ✓ | ✗ |
| حذف نهائي للمنتج | ✓ | ✗ | ✗ |
| الأقسام · الحجوزات وحالاتها | ✓ | ✓ | ✗ |
| سجل النشاطات · تأكيد العملة | ✓ | ✗ | ✗ |

## 3. RLS وسياسات Storage (نتيجة `supabase/tests/rls_audit.sql` محلياً: 12/12 PASS)

* RLS مفعّلة على كل جداول `public` (9). المجهول: **لا كتابة على أي جدول**، يقرأ فقط الأقسام الفعّالة والمنتجات **المنشورة غير المحذوفة** وصورها وسجل الـslug لمنتجات منشورة؛ لا يرى الحجوزات ولا السجل ولا الموظفين ولا العدّاد.
* ينفّذ فقط: `create_reservation` (حجز) و`normalize_arabic` و`iraqi_governorates`.
* الحجز: لا `SELECT/INSERT/UPDATE/DELETE` للعامة؛ الإنشاء عبر RPC فقط، والأدمن يحدّث `status` و`admin_notes` فقط (صلاحية على مستوى العمود) — لا يمكن حتى للأدمن تعديل بيانات العميل أو الـsnapshot.
* `audit_logs`: SELECT للأدمن فقط، وتُكتب بـTriggers؛ لا إدراج/تعديل/حذف من أي عميل (مُختبَر بحساب أدمن).
* Storage `store-media`: قراءة عامة للروابط بلا سرد، إدراج/تعديل للموظفين، **حذف admin/manager فقط**، الـbucket يرفض غير WebP وما فوق 2MiB.
* على مشروعك الحقيقي: شغّل نفس الملف في SQL Editor — `NOT VERIFIED` حتى تفعل.

## 4. المدخلات والرفع

* كل Action يتحقق في الخادم بمحقّقات نقية (`src/lib/validation/*`): لا يمكن تمرير `status/deleted_at/created_by` عبر النموذج. القيود نفسها مكرّرة في قاعدة البيانات (CHECK/Triggers).
* بحث الأدمن: تنقية مدخلات `.or()` لمنع حقن مرشحات PostgREST.
* الحجز: تحقق مزدوج (Action + RPC)، حقل مصيدة، حدّ 5/ساعة للهاتف و300/ساعة عام.
* الرفع: جلسة → دور → Origin → حجم → magic bytes → أبعاد → إعادة ترميز WebP بلا EXIF → RLS على Storage → حد 12 صورة/منتج → تنظيف الملف اليتيم. اختُبر بـ SVG/HTML/PHP/PDF/GIF/exe (415)، صورة تالفة/صغيرة/9MB، JPEG بسكربت ملحق (يُنظَّف)، منتج غير موجود (404 بلا ملف يتيم).
* CSRF: Origin مطلوب لرفع الصور (فحص يدوي) وSame-Site Lax + فحص Origin/Host لـServer Actions.

## 5. رؤوس وتهيئة

`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP (frame-ancestors/base-uri/object-src/form-action), COOP, HSTS (إنتاج). لا CSP لـscript-src عمداً (Next يحقن سكربتات مضمّنة؛ nonce قرار لاحق). `robots.txt` يمنع `/admin` و`/api/`، واللوحة ترسل `noindex, nofollow, no-store`.

## 6. حدود معروفة وتوصيات

1. **CAPTCHA**: حجز الزوار محمي بالحدود والمصيدة فقط؛ أضف Cloudflare Turnstile إن ظهر إساءة استخدام.
2. **MFA** للأدمن غير مفعّل (متاح في Supabase Auth للحسابات).
3. حدّ 4.5MB لجسم الطلب على Vercel: المعالجة الأمامية تصغّر الصور؛ الحد الفعلي للرفع المباشر ≈ 4.5MB.
4. خطة Supabase Free: تحقق من النسخ الاحتياطية وحدود الاستخدام قبل الاعتماد عليها لتجارة حقيقية.
5. مراجعة دورية: `npm audit`، و`prod:staff-audit`، وتدوير كلمات المرور عند تغيّر الموظفين.

## 7. قائمة تحقق ما قبل الإعلان

- [ ] `rls_audit.sql` على الإنتاج: كلها PASS.
- [ ] `prod:staff-audit` PASS (لا حسابات اختبار).
- [ ] `prod:verify` PASS (صور ومنتجات).
- [ ] `smoke:e2e` على الإنتاج: ALL PASSED، ثم `prod:cleanup-test-data`.
- [ ] `/api/health` يعمل، و`view-source` لا يحوي أي مفتاح `service_role`.
- [ ] `https://دومينك/sitemap.xml` يحوي المنشور فقط.
