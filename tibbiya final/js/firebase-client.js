// ============================================================
// طبيّة — firebase-client.js
// Firebase configuration & data layer. Exposes `Auth` and `Api`
// on window so every page's regular (non-module) script can use
// them once the "firebase-ready" event has fired.
//
// Loaded as an ES module:
// <script type="module" src="js/firebase-client.js"></script>
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAnalytics, isSupported as analyticsSupported } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-analytics.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider,
  OAuthProvider, signOut, updateProfile as fbUpdateAuthProfile,
  updatePassword as fbUpdatePassword, reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection,
  addDoc, getDocs, query, where, orderBy, deleteDoc,
  serverTimestamp, runTransaction, increment, writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

// ------------------------------------------------------------
// Firebase project config — طبيّة (x75t-96ae5)
// ------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDB53ESSqNEKYxF7V3wgoPD9u8OB9yRrJk",
  authDomain: "x75t-96ae5.firebaseapp.com",
  projectId: "x75t-96ae5",
  storageBucket: "x75t-96ae5.firebasestorage.app",
  messagingSenderId: "18765637155",
  appId: "1:18765637155:web:8b040aada1a45abfdc7396",
  measurementId: "G-VFKV0FN12N"
};

const app = initializeApp(firebaseConfig);
// Analytics only works over https/localhost — guard so file:// or
// unsupported environments don't throw.
analyticsSupported().then((ok) => { if (ok) { try { getAnalytics(app); } catch (e) { /* noop */ } } }).catch(() => {});

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

function randomUsername() {
  return "user_" + Math.random().toString(36).slice(2, 8);
}

// ------------------------------------------------------------
// Create the Firestore profile/streak docs the first time a
// user signs in. Every new profile is created with role:"student"
// — teacher accounts are only promoted through the admin panel
// (which itself only promotes after a submitted + approved
// teacherRequests doc), so a student can never grant themselves
// teacher/admin access from the client. The public
// meta/stats.studentCount counter is bumped once per brand-new
// account so the login screen can show a live "registered
// students" figure.
// ------------------------------------------------------------
async function ensureUserDocs(user, extra = {}) {
  const profileRef = doc(db, "profiles", user.uid);
  const existing = await getDoc(profileRef);
  if (!existing.exists()) {
    await setDoc(profileRef, {
      full_name: extra.full_name || user.displayName || "طالب جديد",
      username: extra.username || randomUsername(),
      email: user.email || extra.email || null,
      avatar_url: user.photoURL || null,
      academic_year: 2,
      role: "student",
      welcomed: false,
      created_at: serverTimestamp()
    });
    await setDoc(doc(db, "streaks", user.uid), {
      current_streak: 0,
      longest_streak: 0,
      last_active_date: null
    });
    // Public counter — read by index.html before login, so keep it
    // in its own tiny doc instead of counting the profiles collection
    // (which non-signed-in visitors can't query).
    await setDoc(doc(db, "meta", "stats"), { studentCount: increment(1) }, { merge: true });
  }
  return existing;
}

// ------------------------------------------------------------
// AUTH
// ------------------------------------------------------------
const Auth = {
  async signUpWithEmail(email, password, fullName, username) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await fbUpdateAuthProfile(cred.user, { displayName: fullName });
      await ensureUserDocs(cred.user, { full_name: fullName, username, email });
      return { data: cred, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async signInWithEmail(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDocs(cred.user);
      return { data: cred, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async signInWithGoogle() {
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await ensureUserDocs(cred.user);
      return { data: cred, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async signInWithApple() {
    try {
      const cred = await signInWithPopup(auth, new OAuthProvider("apple.com"));
      await ensureUserDocs(cred.user);
      return { data: cred, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async signOut() {
    return await signOut(auth);
  },

  // Real password change: Firebase requires a fresh sign-in before it
  // will accept updatePassword, so we reauthenticate with the current
  // password first — this is also how we validate it's actually correct.
  async changePassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user || !user.email) return { error: { message: "لا يمكن تغيير كلمة السر لهذا نوع الحساب" } };
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await fbUpdatePassword(user, newPassword);
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  async getUser() {
    return new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub();
        resolve(user ? { id: user.uid, uid: user.uid, email: user.email } : null);
      });
    });
  },

  // Both spellings are kept so every page's guard code (old + new)
  // keeps working no matter which name it calls.
  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, (user) => callback(user));
  },
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, (user) => callback(user));
  }
};

// ------------------------------------------------------------
// DATA (Firestore)
// ------------------------------------------------------------
const Api = {
  // ---------- profile ----------
  async getProfile(userId) {
    const snap = await getDoc(doc(db, "profiles", userId));
    return snap.exists() ? { id: userId, uid: userId, ...snap.data() } : null;
  },

  async updateProfile(userId, fields) {
    return await updateDoc(doc(db, "profiles", userId), fields);
  },

  async getStreak(userId) {
    const snap = await getDoc(doc(db, "streaks", userId));
    return snap.exists() ? snap.data() : { current_streak: 0, longest_streak: 0 };
  },

  async markWelcomed(userId) {
    return await updateDoc(doc(db, "profiles", userId), { welcomed: true });
  },

  // Real avatar upload — replaces the initial-letter placeholder with
  // the student's actual photo, stored under avatars/{uid}/... and
  // mirrored onto both the Firestore profile and the Firebase Auth user.
  async uploadAvatar(userId, file, onProgress) {
    const path = `avatars/${userId}/${Date.now()}_${file.name}`;
    const { url } = await Api.uploadFile(path, file, onProgress);
    await updateDoc(doc(db, "profiles", userId), { avatar_url: url });
    if (auth.currentUser) {
      try { await fbUpdateAuthProfile(auth.currentUser, { photoURL: url }); } catch (e) { /* non-fatal */ }
    }
    return url;
  },

  // Public "registered students" counter — safe to read before login
  // (see firestore.rules: meta/stats is the one publicly readable doc).
  async getStudentCount() {
    try {
      const snap = await getDoc(doc(db, "meta", "stats"));
      return snap.exists() ? (snap.data().studentCount || 0) : 0;
    } catch (e) {
      return 0;
    }
  },

  // ---------- subjects ----------
  async getSubjects() {
    const snap = await getDocs(query(collection(db, "subjects"), orderBy("order")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  // Same as getSubjects() but also attaches lectureCount / materialCount
  // — used by the student home grid and the admin subjects panel.
  async getSubjectsWithLectureCounts() {
    const [subjSnap, lecSnap] = await Promise.all([
      getDocs(query(collection(db, "subjects"), orderBy("order"))),
      getDocs(collection(db, "lectures"))
    ]);
    const content = lecSnap.docs.map((d) => d.data());
    return subjSnap.docs.map((d) => {
      const s = { id: d.id, ...d.data() };
      s.lectureCount = content.filter((c) => c.subject_id === d.id && c.content_type !== "note").length;
      s.materialCount = content.filter((c) => c.subject_id === d.id && c.content_type === "note").length;
      return s;
    });
  },

  async addSubject({ title, icon, color, order, description }) {
    return await addDoc(collection(db, "subjects"), {
      title: title || "مادة بدون اسم",
      icon: icon || "📘",
      color: color || "#14304A",
      order: Number(order) || 99,
      description: description || "",
      created_at: serverTimestamp()
    });
  },

  async updateSubject(id, { title, icon, color, order, description }) {
    return await updateDoc(doc(db, "subjects", id), {
      title, icon, color,
      order: Number(order) || 99,
      description: description || ""
    });
  },

  // Deletes the subject and cascades to every lecture/material that
  // belongs to it, so the admin panel never leaves orphaned content.
  async deleteSubject(id) {
    const lecSnap = await getDocs(query(collection(db, "lectures"), where("subject_id", "==", id)));
    const batch = writeBatch(db);
    lecSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, "subjects", id));
    await batch.commit();
  },

  // ---------- lectures (content_type:"video") & materials (content_type:"note") ----------
  // Both live in the same `lectures` collection so one teacher
  // dashboard manages both without a second schema.
  async getLecturesForSubject(subjectId) {
    return Api.getLectures(subjectId);
  },
  async getLectures(subjectId) {
    const snap = await getDocs(query(collection(db, "lectures"), where("subject_id", "==", subjectId)));
    return snap.docs
      .map((d) => ({ id: d.id, content_type: "video", ...d.data() }))
      .filter((l) => (l.content_type || "video") === "video")
      .sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
  },

  async getMaterialsForSubject(subjectId) {
    return Api.getMaterials(subjectId);
  },
  async getMaterials(subjectId) {
    const snap = await getDocs(query(collection(db, "lectures"), where("subject_id", "==", subjectId)));
    return snap.docs
      .map((d) => ({ id: d.id, content_type: "video", ...d.data() }))
      .filter((l) => l.content_type === "note")
      .sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
  },

  // Everything for a subject regardless of type — handy for a combined manage-list.
  async getAllContentForSubject(subjectId) {
    const snap = await getDocs(query(collection(db, "lectures"), where("subject_id", "==", subjectId)));
    return snap.docs.map((d) => ({ id: d.id, content_type: "video", ...d.data() }));
  },

  // Teacher/Admin-only: publish a new video lecture.
  // Firestore rules double-check role:"teacher"/"admin" server-side.
  async addLecture(subjectId, { title, youtube_url, file_url, published_by }) {
    return await addDoc(collection(db, "lectures"), {
      subject_id: subjectId,
      title: title || "بدون عنوان",
      content_type: "video",
      youtube_url: youtube_url || null,
      file_url: file_url || null,
      published_by: published_by || null,
      created_at: serverTimestamp()
    });
  },

  // Teacher/Admin-only: publish a new ملزمة (PDF handout).
  async addMaterial(subjectId, { title, file_url, published_by }) {
    return await addDoc(collection(db, "lectures"), {
      subject_id: subjectId,
      title: title || "بدون عنوان",
      content_type: "note",
      file_url: file_url || null,
      published_by: published_by || null,
      created_at: serverTimestamp()
    });
  },

  async deleteLecture(subjectId, id) {
    return Api.deleteContent(id);
  },
  async deleteMaterial(subjectId, id) {
    return Api.deleteContent(id);
  },
  async deleteContent(id) {
    try {
      const snap = await getDoc(doc(db, "lectures", id));
      const data = snap.exists() ? snap.data() : null;
      if (data && data.file_url && data.file_url.includes("firebasestorage")) {
        try { await deleteObject(storageRef(storage, data.file_url)); } catch (e) { /* already gone / external URL */ }
      }
    } catch (e) { /* ignore lookup errors, still try to delete the doc */ }
    return await deleteDoc(doc(db, "lectures", id));
  },

  // Generic legacy alias kept for any older caller.
  async addContent(subjectId, { title, content_type, url, file_path, published_by }) {
    return await addDoc(collection(db, "lectures"), {
      subject_id: subjectId,
      title: title || "بدون عنوان",
      content_type: content_type === "note" ? "note" : "video",
      youtube_url: content_type === "note" ? null : (url || null),
      file_url: file_path || url || null,
      published_by: published_by || null,
      created_at: serverTimestamp()
    });
  },

  // Uploads a file (PDF ملزمة or a small video clip) to Firebase Storage
  // and resolves with its public download URL.
  uploadFile(path, file, onProgress) {
    return new Promise((resolve, reject) => {
      const ref = storageRef(storage, path);
      const task = uploadBytesResumable(ref, file);
      task.on("state_changed",
        (snap) => {
          if (onProgress) onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        },
        (error) => reject(error),
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        }
      );
    });
  },

  // ---------- teacher requests (submitted from index.html "انضم كأستاذ" tab) ----------
  async submitTeacherRequest(uid, { full_name, email, specialty, bio }) {
    return await setDoc(doc(db, "teacherRequests", uid), {
      full_name: full_name || "",
      email: email || "",
      specialty: specialty || "",
      bio: bio || "",
      status: "pending",
      created_at: serverTimestamp()
    });
  },

  async getTeacherRequests() {
    const snap = await getDocs(collection(db, "teacherRequests"));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
  },

  async approveTeacherRequest(uid) {
    await updateDoc(doc(db, "teacherRequests", uid), { status: "approved" });
    return await updateDoc(doc(db, "profiles", uid), { role: "teacher" });
  },

  async rejectTeacherRequest(uid) {
    return await updateDoc(doc(db, "teacherRequests", uid), { status: "rejected" });
  },

  // ---------- users / roles (admin panel) ----------
  async getAllUsers() {
    const snap = await getDocs(collection(db, "profiles"));
    return snap.docs.map((d) => ({ id: d.id, uid: d.id, ...d.data() }));
  },

  async setUserRole(uid, role) {
    return await updateDoc(doc(db, "profiles", uid), { role });
  },

  // ---------- misc: activity log / streak / saved items / attendance ----------
  async logActivity(userId, activity_type, ref_id = null) {
    await addDoc(collection(db, "activity_log"), {
      user_id: userId, activity_type, ref_id, created_at: serverTimestamp()
    });

    const streakRef = doc(db, "streaks", userId);
    const today = new Date().toISOString().slice(0, 10);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(streakRef);
      const s = snap.exists() ? snap.data() : { current_streak: 0, longest_streak: 0, last_active_date: null };

      if (s.last_active_date === today) return; // already counted today

      let current;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (s.last_active_date === yesterday) {
        current = (s.current_streak || 0) + 1;
      } else {
        current = 1;
      }
      const longest = Math.max(s.longest_streak || 0, current);

      tx.set(streakRef, { current_streak: current, longest_streak: longest, last_active_date: today }, { merge: true });
    });
  },

  async getSavedItems(userId) {
    const snap = await getDocs(query(collection(db, "saved_items"), where("user_id", "==", userId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async saveItem(userId, item_type, ref_id, title) {
    return await addDoc(collection(db, "saved_items"), {
      user_id: userId, item_type, ref_id, title, created_at: serverTimestamp()
    });
  },

  async removeSavedItem(id) {
    return await deleteDoc(doc(db, "saved_items", id));
  },

  async recordAttendance(sessionId, userId) {
    return await setDoc(doc(db, "attendance_records", `${sessionId}_${userId}`), {
      session_id: sessionId, user_id: userId, scanned_at: serverTimestamp()
    });
  }
};

// Expose globally so regular (non-module) scripts can use them.
window.Auth = Auth;
window.Api = Api;
window.dispatchEvent(new Event("firebase-ready"));
