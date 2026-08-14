// ============================================================
// Supabase configuration
// Replace these two values with your own free-tier project
// (Supabase Dashboard → Project Settings → API)
// ============================================================
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-PUBLIC-ANON-KEY";

// Loaded from CDN in each HTML file:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------------------------------------
// AUTH HELPERS
// ------------------------------------------------------------
const Auth = {
  async signUpWithEmail(email, password, fullName, username) {
    return await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, username } }
    });
  },

  async signInWithEmail(email, password) {
    return await supabase.auth.signInWithPassword({ email, password });
  },

  async signInWithGoogle() {
    return await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/app.html" }
    });
  },

  async signInWithApple() {
    return await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: window.location.origin + "/app.html" }
    });
  },

  // WhatsApp login = Supabase Phone Auth with WhatsApp OTP channel
  // (requires a Twilio/WhatsApp Business provider configured in
  // Supabase → Authentication → Providers → Phone)
  async requestWhatsAppOtp(phone) {
    return await supabase.auth.signInWithOtp({
      phone,
      options: { channel: "whatsapp" }
    });
  },

  async verifyWhatsAppOtp(phone, token) {
    return await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  },

  async signOut() {
    return await supabase.auth.signOut();
  },

  async getUser() {
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// ------------------------------------------------------------
// DATA HELPERS
// ------------------------------------------------------------
const Api = {
  async getProfile(userId) {
    const { data, error } = await supabase
      .from("profiles").select("*").eq("id", userId).single();
    if (error) console.error(error);
    return data;
  },

  async updateProfile(userId, fields) {
    return await supabase.from("profiles").update(fields).eq("id", userId);
  },

  async getStreak(userId) {
    const { data } = await supabase
      .from("streaks").select("*").eq("user_id", userId).single();
    return data ?? { current_streak: 0, longest_streak: 0 };
  },

  async getSubjectsWithLectureCounts() {
    const { data: subjects } = await supabase
      .from("subjects").select("*").order("sort_order");
    const { data: lectures } = await supabase.from("lectures").select("id, subject_id");
    return (subjects ?? []).map(s => ({
      ...s,
      lectureCount: (lectures ?? []).filter(l => l.subject_id === s.id).length
    }));
  },

  async getLecturesForSubject(subjectId) {
    const { data } = await supabase
      .from("lectures").select("*").eq("subject_id", subjectId)
      .order("lecture_number");
    return data ?? [];
  },

  // Call this any time the student does something worth tracking —
  // opens a lecture, watches a video, scans a QR, logs in for the day.
  // The `bump_streak` trigger in Postgres updates streak counters automatically.
  async logActivity(userId, activity_type, ref_id = null) {
    return await supabase
      .from("activity_log")
      .insert({ user_id: userId, activity_type, ref_id });
  },

  async getSavedItems(userId) {
    const { data } = await supabase
      .from("saved_items").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  },

  async saveItem(userId, item_type, ref_id, title) {
    return await supabase
      .from("saved_items").insert({ user_id: userId, item_type, ref_id, title });
  },

  async removeSavedItem(id) {
    return await supabase.from("saved_items").delete().eq("id", id);
  },

  async recordAttendance(sessionId, userId) {
    return await supabase
      .from("attendance_records")
      .insert({ session_id: sessionId, user_id: userId });
  }
};
