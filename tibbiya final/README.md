# طبيّة — إعداد Firebase

المشروع مربوط الآن بمشروع Firebase: **x75t-96ae5**

## خطوات لازم تسويها بالـ Firebase Console

1. **Authentication → Sign-in method** → فعّل **Email/Password**.
2. **Firestore Database** → أنشئ قاعدة بيانات (وضع Production).
3. **Firestore → Rules** → الصق محتوى ملف `firestore.rules` ونشره.
4. **Storage** → فعّل Storage، وبـ **Rules** الصق محتوى `storage.rules` ونشره.
5. **Authentication → Settings → Authorized domains** → أضف الدومين الي راح تنشر عليه (Vercel/Netlify).
6. **أول حساب أدمن**: سجّل حساب طالب عادي من التطبيق، بعدين روح بـ Firestore Console → collection `profiles` → مستند الـ uid تبعك → غيّر الحقل `role` من `student` إلى `admin` يدوياً (مرة وحدة بس، أي أدمن بعدين تقدر تسويه من لوحة الإدارة نفسها).

## آلية الأدوار

- كل حساب جديد ينسجل يصير `role: student` تلقائياً.
- الأستاذ يسجّل من تبويب "انضم كأستاذ" بالصفحة الرئيسية → ينحفظ طلبه بـ `teacherRequests` وبيبقى حسابه `student` لين الأدمن يوافق من لوحة الإدارة (طلبات الأساتذة → قبول) → عندها ينترقّى تلقائياً لـ `teacher`.
- الأدمن يقدر يغيّر دور أي مستخدم مباشرة من "إدارة المستخدمين".

## بنية المحتوى

كل المحاضرات والملازم مخزّنة بمجموعة وحدة اسمها `lectures`، وتنفرق بالحقل `content_type`:
- `video` → محاضرة (رابط يوتيوب و/أو ملف مرفوع)
- `note` → ملزمة/PDF

## الملفات المحذوفة

- `register-teacher.html` انحذفت — صار التسجيل كأستاذ مدمج بتبويب داخل `index.html`.
