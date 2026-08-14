// One-time seed script for initial subjects (المرحلة الثانية - طب الأسنان).
// Run with: node seed-firestore.js
// Requires: npm install firebase-admin
// and a service-account JSON key downloaded from
// Firebase Console → Project Settings → Service Accounts → Generate new private key

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // add this file yourself, don't commit it

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Subjects of the second stage (المرحلة الثانية) — rename/reorder these
// any time from the teacher dashboard's subject list, this seed just
// gives you a real starting point instead of an empty app.
const subjects = [
  { title: "التشريح", icon: "🫀", color: "#14304A", sort_order: 1 },
  { title: "الأنسجة", icon: "🔬", color: "#3FA796", sort_order: 2 },
  { title: "علم وظائف الأعضاء", icon: "🧠", color: "#F4A340", sort_order: 3 },
  { title: "الكيمياء الحيوية", icon: "🧪", color: "#C1440E", sort_order: 4 },
  { title: "تشريح الأسنان", icon: "🦷", color: "#14304A", sort_order: 5 },
  { title: "مبادئ التعويضات السنية", icon: "🦿", color: "#3FA796", sort_order: 6 }
];

(async () => {
  for (const s of subjects) {
    await db.collection("subjects").add(s);
    console.log("Added subject:", s.title);
  }

  // Public registered-students counter shown on the login screen —
  // create it at 0 so it exists before the first real signup increments it.
  await db.collection("meta").doc("stats").set({ studentCount: 0 }, { merge: true });
  console.log("Initialized meta/stats.studentCount = 0");

  console.log("\nDone. Next: promote a teacher account —");
  console.log("Firestore console → profiles → <the teacher's uid> → set field role = \"teacher\".");
  console.log("Everyone else stays role:\"student\" automatically at signup.");
})();
