// ============================================================
// طبيّة — firebase-client.js  v2.0
// Auth: email+password ONLY (no Google / Apple)
// Roles: admin | teacher | student
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs, query, where, orderBy,
  deleteDoc, serverTimestamp, runTransaction, increment, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref as storageRef,
  uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ── Firebase Config ────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBKxq5Z92zYjjn1SBmFmWRW_jfW2u3EvS0",
  authDomain:        "ppo32-dbe59.firebaseapp.com",
  projectId:         "ppo32-dbe59",
  storageBucket:     "ppo32-dbe59.firebasestorage.app",
  messagingSenderId: "118954286012",
  appId:             "1:118954286012:web:650f68780535ad9f32a9b9",
  measurementId:     "G-1KJQ271ZRY"
};

const app     = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (_) {}

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// ── Helpers ────────────────────────────────────────────────
function randomUsername() {
  return "user_" + Math.random().toString(36).slice(2, 8);
}

/** Create profile + streak docs on first sign-in */
async function ensureUserDocs(user, extra = {}) {
  const profileRef = doc(db, "profiles", user.uid);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) {
    await setDoc(profileRef, {
      full_name:     extra.full_name || user.displayName || "مستخدم جديد",
      username:      extra.username  || randomUsername(),
      email:         user.email,
      avatar_url:    null,
      academic_year: 2,
      role:          "student",   // default role — admin promotes via console/panel
      welcomed:      false,
      created_at:    serverTimestamp()
    });
    await setDoc(doc(db, "streaks", user.uid), {
      current_streak:  0,
      longest_streak:  0,
      last_active_date: null
    });
    await setDoc(
      doc(db, "meta", "stats"),
      { studentCount: increment(1) },
      { merge: true }
    );
  }
}

// ── AUTH ───────────────────────────────────────────────────
export const Auth = {
  /** Register with email + password */
  async signUpWithEmail(email, password, fullName, username) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await fbUpdateProfile(cred.user, { displayName: fullName });
      await ensureUserDocs(cred.user, { full_name: fullName, username });
      return { data: cred, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /** Login with email + password */
  async signInWithEmail(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDocs(cred.user);
      return { data: cred, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /** Sign out */
  async signOut() {
    try {
      await fbSignOut(auth);
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  /** Change password (requires recent auth) */
  async changePassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await fbUpdatePassword(user, newPassword);
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  /** Listen to auth state — calls cb(user|null) */
  onAuthStateChanged(cb) {
    return onAuthStateChanged(auth, cb);
  }
};

// ── API ────────────────────────────────────────────────────
export const Api = {
  // ---------- Profile ----------
  async getProfile(uid) {
    const snap = await getDoc(doc(db, "profiles", uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
  },

  async updateProfile(uid, updates) {
    await updateDoc(doc(db, "profiles", uid), updates);
    if (updates.full_name) {
      await fbUpdateProfile(auth.currentUser, { displayName: updates.full_name });
    }
  },

  // ---------- Avatar upload ----------
  async uploadAvatar(uid, file, onProgress) {
    const path = `avatars/${uid}/${Date.now()}_${file.name}`;
    const ref  = storageRef(storage, path);
    const task = uploadBytesResumable(ref, file);
    return new Promise((resolve, reject) => {
      task.on("state_changed",
        snap => onProgress && onProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          await updateDoc(doc(db, "profiles", uid), { avatar_url: url });
          resolve(url);
        }
      );
    });
  },

  // ---------- Student counter ----------
  async getStudentCount() {
    const snap = await getDoc(doc(db, "meta", "stats"));
    return snap.exists() ? (snap.data().studentCount || 0) : 0;
  },

  // ---------- Subjects ----------
  async getSubjects() {
    const q = query(collection(db, "subjects"), orderBy("order", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getSubjectsWithLectureCounts() {
    const subjects = await this.getSubjects();
    const counts = await Promise.all(subjects.map(async s => {
      const lSnap = await getDocs(collection(db, "subjects", s.id, "lectures"));
      const mSnap = await getDocs(collection(db, "subjects", s.id, "materials"));
      return { ...s, lectureCount: lSnap.size, materialCount: mSnap.size };
    }));
    return counts;
  },

  // ---------- Lectures ----------
  async getLectures(subjectId) {
    const q = query(
      collection(db, "subjects", subjectId, "lectures"),
      orderBy("created_at", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addLecture(subjectId, data) {
    return addDoc(collection(db, "subjects", subjectId, "lectures"), {
      ...data,
      created_at: serverTimestamp()
    });
  },

  async updateLecture(subjectId, lectureId, data) {
    await updateDoc(doc(db, "subjects", subjectId, "lectures", lectureId), data);
  },

  async deleteLecture(subjectId, lectureId) {
    await deleteDoc(doc(db, "subjects", subjectId, "lectures", lectureId));
  },

  // ---------- Materials ----------
  async getMaterials(subjectId) {
    const q = query(
      collection(db, "subjects", subjectId, "materials"),
      orderBy("created_at", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addMaterial(subjectId, data) {
    return addDoc(collection(db, "subjects", subjectId, "materials"), {
      ...data,
      created_at: serverTimestamp()
    });
  },

  async updateMaterial(subjectId, materialId, data) {
    await updateDoc(doc(db, "subjects", subjectId, "materials", materialId), data);
  },

  async deleteMaterial(subjectId, materialId) {
    await deleteDoc(doc(db, "subjects", subjectId, "materials", materialId));
  },

  // ---------- File Upload ----------
  async uploadFile(path, file, onProgress) {
    const ref  = storageRef(storage, path);
    const task = uploadBytesResumable(ref, file);
    return new Promise((resolve, reject) => {
      task.on("state_changed",
        snap => onProgress && onProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
        reject,
        async () => resolve(await getDownloadURL(task.snapshot.ref))
      );
    });
  },

  async deleteFile(url) {
    try {
      const ref = storageRef(storage, url);
      await deleteObject(ref);
    } catch (_) {}
  },

  // ---------- Subjects CRUD (admin only) ----------
  async addSubject(data) {
    return addDoc(collection(db, "subjects"), {
      ...data,
      order: data.order || 99,
      created_at: serverTimestamp()
    });
  },

  async updateSubject(subjectId, data) {
    await updateDoc(doc(db, "subjects", subjectId), data);
  },

  async deleteSubject(subjectId) {
    await deleteDoc(doc(db, "subjects", subjectId));
  },

  // ---------- Teacher Requests ----------
  async submitTeacherRequest(uid, data) {
    await setDoc(doc(db, "teacherRequests", uid), {
      uid,
      full_name:   data.full_name,
      email:       data.email,
      specialty:   data.specialty,
      bio:         data.bio || "",
      status:      "pending",   // pending | approved | rejected
      created_at:  serverTimestamp()
    });
  },

  async getTeacherRequests() {
    const q = query(collection(db, "teacherRequests"), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async approveTeacherRequest(uid) {
    await updateDoc(doc(db, "profiles", uid), { role: "teacher" });
    await updateDoc(doc(db, "teacherRequests", uid), { status: "approved" });
  },

  async rejectTeacherRequest(uid) {
    await updateDoc(doc(db, "teacherRequests", uid), { status: "rejected" });
  },

  // ---------- Users (admin) ----------
  async getAllUsers() {
    const snap = await getDocs(collection(db, "profiles"));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },

  async setUserRole(uid, role) {
    await updateDoc(doc(db, "profiles", uid), { role });
  },

  // ---------- Streak ----------
  async getStreak(uid) {
    const snap = await getDoc(doc(db, "streaks", uid));
    return snap.exists() ? snap.data() : { current_streak: 0, longest_streak: 0 };
  },

  async logActivity(uid, type) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const streakRef = doc(db, "streaks", uid);
      const streakSnap = await getDoc(streakRef);
      const streak = streakSnap.exists() ? streakSnap.data() : {};
      const last = streak.last_active_date;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      let current = streak.current_streak || 0;
      let longest = streak.longest_streak || 0;
      if (last !== today) {
        current = (last === yesterday) ? current + 1 : 1;
        longest = Math.max(longest, current);
        await updateDoc(streakRef, {
          current_streak: current,
          longest_streak: longest,
          last_active_date: today
        });
      }
      await addDoc(collection(db, "activity"), {
        uid, type, date: today, ts: serverTimestamp()
      });
    } catch (_) {}
  }
};

// Expose globally for non-module scripts
window.Auth = Auth;
window.Api  = Api;
window.db   = db;
window.auth = auth;
