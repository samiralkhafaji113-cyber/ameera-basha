# الخلفية ولوحة التحكم – Backend & Admin

مجمع أميرة باشا – Next.js 16 (App Router) + **Supabase** (PostgreSQL 17 + Auth + Storage). لا خادم خلفي منفصل: الوصول إلى البيانات من Server Components / Server Actions / Route Handler واحد، وكل صلاحية تُفرض في قاعدة البيانات نفسها (RLS).

## 1. التشغيل المحلي

```bash
npm install
npm run db:start                # Supabase محلي عبر Docker (Postgres 54322 · API 54321). المنافذ لا تتعارض مع المشاريع الأخرى
npm run db:env                  # يكتب .env.local من `supabase status` (القيم لا تُطبع) + كلمات مرور اختبار محلية
npm run db:seed                 # ترحيل الـ72 منتجاً (آمن للتكرار: لا يكرّر ولا يكتب فوق تعديلات الأدمن) + تقرير قبل/بعد
npm run db:create-admin -- --email you@example.com --role admin --name "الاسم"   # كلمة المرور تُطلب بإخفاء، أو --password-env VAR
npm run dev                     # الموقع http://localhost:3000 · اللوحة /admin
```

الاختبارات: `npm test` (وحدات، بلا قاعدة بيانات) · `npm run test:integration` (تحتاج Supabase المحلي؛ ملف `upload.test.ts` يحتاج التطبيق شغّالاً على 3100 وإلا يُتخطّى).

## 2. المعمارية

| الطبقة | ما يستخدم |
|---|---|
| Frontend عام | `src/app/(site)/…` كما هو (نفس الهوية/الشعار/RTL/البحث/الفلاتر/البطاقات). يقرأ عبر `ProductRepository` (`src/lib/catalog.ts`) |
| Frontend الإدارة | `src/app/admin/…` (مجموعة `(panel)` محمية + `/admin/login`) — noindex |
| Backend | Server Actions (`src/app/admin/actions/*`, `src/app/actions/reservation.ts`) + Route Handler واحد لرفع الصور `POST /api/admin/media` |
| قاعدة البيانات | Postgres + RLS + Triggers + RPC (`supabase/migrations/*`) |
| التخزين | bucket `store-media` (قراءة عامة، رفع للموظفين، **حذف لـadmin/manager فقط**، WebP فقط، 2MiB) |
| المصادقة | Supabase Auth (بريد + كلمة مرور، التسجيل العام مغلق) + جدول `profiles` للأدوار |

قراءة الموقع العام: عميل `anon` بلا جلسة، طلبات `GET` موسومة `catalog` وتُجدَّد كل 5 دقائق **أو فوراً** عند أي تعديل من اللوحة (`updateTag`/`revalidateTag` في `src/lib/revalidate.ts`). المنتج المخفي/المؤرشف/المحذوف يختفي من الكتالوج والصفحة (404) والـ sitemap فور الحفظ.

إن لم تُضبط متغيرات Supabase يعمل الموقع العام على الكتالوج الثابت المضمَّن (للتطوير/CI) وتُعطَّل اللوحة والحجز.

## 3. مخطط قاعدة البيانات

`categories` · `subcategories` · `products` · `product_images` · `reservations` · `reservation_counters` · `audit_logs` · `profiles`

* **products**: كل حقول المواصفات (`name, slug, category_id, subcategory_id, description, price, currency, price_verified, sizes, numeric_sizes, size_label, age_min/max, available, status[draft|published|hidden|archived], featured, source[telegram|facebook|instagram|tiktok|manual], source_url, source_post_id, source_published_at, created_at, updated_at`) + `deleted_at` (حذف ناعم) + `search_text` (بحث عربي مُطبَّع) + `created_by/updated_by`. `unique(source, source_post_id)` يجعل الاستيراد idempotent.
* **العملة لا تُفترض**: `currency` فارغة و`price_verified=false` للأسعار المستوردة. الموقع يعرض السعر فقط إذا كان مؤكداً **ومعه عملة**؛ وإلا «السعر عند الاستفسار». تأكيد دفعة واحدة: الإعدادات ← «تأكيد عملة الأسعار المستوردة» (للأدمن فقط).
* **product_images**: المسار والرابط فقط (الملفات في Storage)، `sort_order`, `is_primary` (فهرس فريد جزئي: صورة رئيسية واحدة).
* **reservations**: `AB-YYYYMMDD-NNNN` (عدّاد يومي ذرّي بتوقيت بغداد)، `product_name_snapshot` (يبقى بعد تعديل/حذف المنتج)، حالات `pending → contacted → confirmed → completed` + `cancelled/rejected` (وإعادة فتح).
* **audit_logs**: تُكتب بـTriggers فقط (لا يستطيع أحد إدراجها/تعديلها/حذفها من العميل): إضافة/تعديل/نشر/إخفاء/أرشفة/حذف/استعادة منتج، صور، أقسام، حجوزات وتغيّر حالاتها — مع المستخدم والوقت.

CHECK constraints بدل enums (تعديلها بلا هجرة معقّدة)، Triggers للحراسة: لا نشر بلا صورة، الصورة الأخيرة لمنتج منشور لا تُحذف، القسم الفرعي يتبع القسم، وآلة حالات الحجز.

## 4. الأدوار والصلاحيات (`src/lib/auth/roles.ts` ⇄ RLS)

| الصلاحية | admin | manager | editor |
|---|:-:|:-:|:-:|
| قراءة/إضافة/تعديل المنتجات، رفع الصور وترتيبها | ✓ | ✓ | ✓ |
| حذف الصور (صف + ملف) | ✓ | ✓ | ✗ |
| نشر / إخفاء / أرشفة / تمييز / حذف ناعم واستعادة | ✓ | ✓ | ✗ |
| حذف نهائي (مع الصور) | ✓ | ✗ | ✗ |
| الأقسام | ✓ | ✓ | ✗ |
| الحجوزات | ✓ | ✓ | ✗ |
| سجل النشاطات · تأكيد العملة | ✓ | ✗ | ✗ |

المرحلة الأولى: حساب `admin` فقط؛ `manager` و`editor` جاهزان ومختبَران. الدور يُقرأ من `profiles` (وليس `user_metadata` القابل للتعديل من المستخدم).

## 5. الأمان

* **لا أسرار في الواجهة**: `service_role` لا يُقرأ في أي ملف تحت `src/` (يتحقق منه `tests/secrets.test.ts` وكذلك حزمة العميل بعد البناء). يُستخدم فقط في سكربتات المشغّل (`scripts/*.mts`) من جهاز المشغّل.
* **لا بيانات دخول في الشيفرة**؛ `.env*` خارج Git. كلمات المرور تُخزَّن مُجزَّأة في GoTrue (bcrypt).
* **حماية مسارات الإدارة بطبقات**: `src/proxy.ts` (تحويل + no-store + noindex) ← حارس في كل صفحة (`requireStaffPage`) ← حارس في كل Server Action/Route (`requirePermission`) ← RLS في قاعدة البيانات. تجاوز طبقة واحدة لا يكفي.
* **كوكيز الجلسة** HttpOnly + SameSite=Lax + Secure (إنتاج). `auth.getUser()` (تحقق من الخادم) لا `getSession()`.
* **CSRF**: Server Actions تتحقق من Origin/Host (مدمج في Next)، وRoute Handler الرفع يتحقق من Origin بنفسه.
* **رفع الصور**: جلسة → صلاحية → Origin → حجم (≤ 8MB) → **magic bytes** (لا يُوثَق بالامتداد/النوع المُعلَن) → فك الترميز وأبعاد (200–8000px، حدّ بكسلات) → **إعادة ترميز إلى WebP وإزالة كل البيانات الوصفية (EXIF/GPS)** → رفع بجلسة المستخدم (RLS على Storage) → حدّ 12 صورة/منتج → تنظيف الملف اليتيم عند الفشل. SVG/HTML/PDF/GIF/exe مرفوضة، ومحتوى مُلحق بصورة JPEG لا يبقى بعد إعادة الترميز (مختبَر).
* **الحجز**: التحقق في الخادم مرتين (Action + دالة `create_reservation` SECURITY DEFINER): الاسم، هاتف عراقي، المحافظة، الكمية 1–50، منتج منشور ومتوفر، المقاس ضمن ما يقدّمه المنتج. حدّ 5 طلبات/ساعة لكل هاتف و300 عامّة/ساعة + حقل مصيدة (honeypot). **لا يُرسَل شيء تلقائياً إلى واتساب**: يُحفَظ الحجز أولاً ثم يظهر زر يفتح واتساب برسالة جاهزة.
* **RLS على كل الجداول**، صلاحيات أدنى (`revoke all` ثم `grant` صريح)، `reservations` تحديث عمودَي `status, admin_notes` فقط، مخطط `app` غير مكشوف عبر API.
* **بحث الحجوزات**: تنقية مدخلات `.or()` (PostgREST) لمنع حقن مرشحات.
* رؤوس: `X-Content-Type-Options`, `X-Frame-Options`, CSP (frame-ancestors/base-uri/object-src/form-action), COOP, HSTS (إنتاج). `robots.txt` يمنع `/admin` و`/api/`.

## 6. النشر على مشروع Supabase سحابي

تفاصيل النشر خطوة بخطوة (Supabase → Vercel → الدومين) في **[deployment.md](deployment.md)**، والبنية والنسخ الاحتياطي والتراجع في **[production.md](production.md)**، والأمان في **[security.md](security.md)**.

## 7. قرارات تصميم واجهة الإدارة

نفس الهوية (الشعار الرسمي، Noto Kufi/Noto Sans، الألوان والرموز، `design/tokens.json`) لكن **الكفاءة قبل الزخرفة**: جدول كثيف على الشاشات الواسعة وبطاقات على الهاتف، شارات حالة نصية (لا لون فقط)، تأكيد قبل الإجراءات الهدّامة، Skeleton للتحميل، حالات فارغة («لا توجد منتجات» / «لا توجد حجوزات»)، أخطاء مع «إعادة المحاولة»، Toast للنجاح. القائمة الجانبية على سطح المكتب و**Drawer** على الهاتف بنفس نمط `<dialog>` المُقتبس من 21st.dev (بلا مكتبة جديدة). لا تدرّجات ولا زجاج ولا حركة زائدة.
