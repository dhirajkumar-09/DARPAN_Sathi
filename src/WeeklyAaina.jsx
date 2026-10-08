import React, { useEffect, useState, useCallback } from "react";
import { collection, query, where, getDocs, Timestamp, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import emailjs from "@emailjs/browser";
import { ChevronLeft, ChevronRight, Mail, RefreshCw, Sparkles, BookOpen, Calendar, ArrowRight, CheckCircle2, Clock } from "lucide-react";

export default function WeeklyAaina({ currentUser, setPage }) {
  const [weeklyData,      setWeeklyData]      = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [showDailyModal,  setShowDailyModal]  = useState(false);
  const [dailyDiaryToday, setDailyDiaryToday] = useState(null);
  const [weekOffset,      setWeekOffset]      = useState(0);
  const [dateRangeText,   setDateRangeText]   = useState("");
  const [aiStatus,        setAiStatus]        = useState("idle"); // idle | loading | success | fallback
  const [selectedDay,     setSelectedDay]     = useState(null);   // currently inspected day object
  const [emailStatus,     setEmailStatus]     = useState("idle"); // idle | sending | sent | error

  // ─────────────────────────────────────────
  // 1. DAILY 9 PM NOTIFICATION + MODAL
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const checkTimeForDailyPopup = async () => {
      const now = new Date();
      if (now.getHours() < 21) return;

      const todayStr    = now.toDateString();
      const lastChecked = localStorage.getItem("lastDailyPopupDate");
      if (lastChecked === todayStr) return;

      localStorage.setItem("lastDailyPopupDate", todayStr);

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("DARPAN — Reflection Time 🌙", {
          body: "It's past 9 PM! Time to review your mood and complete your daily reflection.",
          icon: "/icon-192.png"
        });
      }

      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const q = query(
          collection(db, "diaries"),
          where("userId", "==", currentUser.uid),
          where("createdAt", ">=", Timestamp.fromDate(startOfToday))
        );
        const snap = await getDocs(q);
        setDailyDiaryToday(snap.empty ? null : snap.docs[0].data());
      } catch (err) {
        console.error("Error fetching today's diary:", err);
      }
      setShowDailyModal(true);
    };

    checkTimeForDailyPopup();
    const interval = setInterval(checkTimeForDailyPopup, 60000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // ─────────────────────────────────────────
  // 2. WEEKLY AAINA — Core Generation
  // ─────────────────────────────────────────
  const generateWeeklyAaina = useCallback(async (forceRefresh = false) => {
    if (!currentUser) { setLoading(false); return; }

    setLoading(true);
    setWeeklyData(null);
    setSelectedDay(null);
    setAiStatus("idle");

    // Build rolling 7-day range
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    endDate.setDate(endDate.getDate() - weekOffset * 7);

    const startDate = new Date(endDate);
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - 6);

    const startStr = startDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    const endStr   = endDate.toLocaleDateString("en-IN",   { month: "short", day: "numeric" });
    setDateRangeText(`${startStr} – ${endStr}`);

    const weekIdentifier = `${startDate.getFullYear()}_${startDate.getMonth() + 1}_${startDate.getDate()}`;
    const weekDocId      = `${currentUser.uid}_v3_${weekIdentifier}`;
    const weekDocRef     = doc(db, "weekly_reflections", weekDocId);
    const todayString    = new Date().toDateString();
    const cacheKeyDate   = `aaina_date_v3_${currentUser.uid}_offset_${weekOffset}`;
    const cacheKeyData   = `aaina_data_v3_${currentUser.uid}_offset_${weekOffset}`;

    try {
      // Past weeks — use Firestore cache (skip if forceRefresh)
      if (weekOffset > 0 && !forceRefresh) {
        const docSnap = await getDoc(weekDocRef);
        if (docSnap.exists()) {
          const cached = docSnap.data().reportResult;
          setWeeklyData(cached);
          setSelectedDay(cached.days?.find(d => d.hasEntry) || cached.days?.[cached.days.length - 1] || null);
          setAiStatus("success");
          setLoading(false);
          return;
        }
      }

      // Current week — use localStorage cache (skip if forceRefresh)
      if (weekOffset === 0 && !forceRefresh) {
        const cachedDate = localStorage.getItem(cacheKeyDate);
        const cachedData = localStorage.getItem(cacheKeyData);
        if (cachedDate === todayString && cachedData) {
          const cached = JSON.parse(cachedData);
          setWeeklyData(cached);
          setSelectedDay(cached.days?.find(d => d.hasEntry) || cached.days?.[cached.days.length - 1] || null);
          setAiStatus("success");
          setLoading(false);
          return;
        }
      }

      // Fetch all user diaries, filter locally to avoid missing composite index
      const q = query(collection(db, "diaries"), where("userId", "==", currentUser.uid));
      const querySnapshot = await getDocs(q);

      const validDiaries = [];
      querySnapshot.forEach((docSnap) => {
        const data    = { id: docSnap.id, ...docSnap.data() };
        const docDate = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
        if (docDate && docDate >= startDate && docDate <= endDate) {
          validDiaries.push({ ...data, _dateObj: docDate });
        }
      });

      const emojiDataMap = {
        "🤩": { score: 5, label: "Excited" },
        "😊": { score: 5, label: "Happy" },
        "😁": { score: 5, label: "Joyful" },
        "🙂": { score: 4, label: "Good" },
        "😌": { score: 4, label: "Calm" },
        "😐": { score: 3, label: "Neutral" },
        "📓": { score: 3, label: "Logged" },
        "😔": { score: 2, label: "Sad" },
        "😢": { score: 2, label: "Upset" },
        "😰": { score: 1, label: "Anxious" },
        "😡": { score: 1, label: "Angry" },
        "😭": { score: 1, label: "Exhausted" },
      };

      // Build structured 7-day array
      const days = [];
      let totalMoodScore = 0;
      let loggedCount    = 0;
      let bestDayObj     = null;
      let toughDayObj    = null;
      let maxScore       = -Infinity;
      let minScore       =  Infinity;

      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);

        const dayName = d.toLocaleDateString("en-IN", { weekday: "short" });
        const dateNum = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
        const fullDateStr = d.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" });

        // Match all entries for this specific date
        const matchingEntries = validDiaries.filter(entry => {
          const ed = entry._dateObj;
          return ed.getFullYear() === d.getFullYear() &&
                 ed.getMonth() === d.getMonth() &&
                 ed.getDate() === d.getDate();
        });

        if (matchingEntries.length > 0) {
          // Sort by creation time, pick latest entry for primary mood
          matchingEntries.sort((a, b) => b._dateObj - a._dateObj);
          const primary = matchingEntries[0];
          const emoji   = primary.moodEmoji || "😐";
          const mapped  = emojiDataMap[emoji] || { score: 3, label: "Reflective" };
          const score   = mapped.score;

          totalMoodScore += score;
          loggedCount++;

          const dayData = {
            day:         dayName,
            date:        dateNum,
            fullDate:    fullDateStr,
            rawDate:     d,
            hasEntry:    true,
            emoji,
            mood:        mapped.label,
            score,
            content:     primary.content || "No thoughts logged.",
            entryCount:  matchingEntries.length,
            entries:     matchingEntries.map(e => ({
              id: e.id,
              content: e.content,
              time: e.time || e._dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
              emoji: e.moodEmoji || emoji
            }))
          };

          days.push(dayData);

          if (score > maxScore) { maxScore = score; bestDayObj = dayData; }
          if (score < minScore) { minScore = score; toughDayObj = dayData; }
        } else {
          // Empty slot for unlogged day
          days.push({
            day:        dayName,
            date:       dateNum,
            fullDate:   fullDateStr,
            rawDate:    d,
            hasEntry:   false,
            emoji:      "—",
            mood:       "Unlogged",
            score:      0,
            content:    null,
            entryCount: 0,
            entries:    []
          });
        }
      }

      if (loggedCount === 0) {
        setWeeklyData(null);
        setLoading(false);
        return;
      }

      const exactAverage = (totalMoodScore / loggedCount).toFixed(1);

      // Smart dynamic local fallback in case AI is asleep
      const avgNum = parseFloat(exactAverage);
      let patternText = avgNum >= 4
        ? "You had an overwhelmingly positive week. Moments of calm and contentment anchored your days."
        : avgNum >= 3
        ? "Your emotional balance stayed fairly steady this week with a very human mix of ups and downs."
        : "This week carried noticeable emotional weight. You persevered through some challenging days.";

      let oneTipText = avgNum < 3
        ? "When days feel heavy, step outside for a 15-minute walk without your phone. Fresh air resets cognitive overload."
        : "Keep documenting your wins, even tiny ones. Momentum builds from acknowledging small progress.";

      let sathiNoteText = "Every entry you write is a step toward understanding yourself better. I'm right here with you.";
      let aiSuccess = false;

      // Call Gemini for personalized weekly insights
      setAiStatus("loading");
      try {
        const loggedDays = days.filter(d => d.hasEntry);
        const summaryText = loggedDays
          .map(d => `${d.day} ${d.date} (${d.emoji} ${d.mood}, score ${d.score}/5): ${d.content.slice(0, 140)}`)
          .join(" | ");

        const aiResponse = await fetch("https://dapan-api-secure.onrender.com/api/generate-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summaryText })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          let rawText = "";

          if (aiData.candidates?.[0]?.content?.parts?.[0]?.text) {
            rawText = aiData.candidates[0].content.parts[0].text.trim();
          } else if (typeof aiData === "object" && aiData.moodPattern) {
            rawText = JSON.stringify(aiData);
          }

          if (rawText) {
            // Safe JSON extraction
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              patternText   = parsed.moodPattern   || patternText;
              oneTipText    = parsed.actionableTip || oneTipText;
              sathiNoteText = parsed.sathisNote    || sathiNoteText;
              aiSuccess     = true;
              setAiStatus("success");
            }
          }
        } else {
          setAiStatus("fallback");
        }
      } catch (aiErr) {
        console.error("AI Insights failed, using smart local analysis:", aiErr);
        setAiStatus("fallback");
      }

      const reportResult = {
        greeting: weekOffset === 0
          ? `Hello ${currentUser.displayName?.split(" ")[0] || "friend"}, here is your reflection.`
          : `Here is your past reflection from ${startStr} – ${endStr}.`,
        days,
        totalDays: loggedCount,
        averageScore: exactAverage,
        bestDay: bestDayObj ? `${bestDayObj.date} ${bestDayObj.emoji} (${bestDayObj.mood})` : "N/A",
        toughDay: toughDayObj ? `${toughDayObj.date} ${toughDayObj.emoji} (${toughDayObj.mood})` : "N/A",
        bestMoment: bestDayObj?.content || "No specific moments captured.",
        pattern: patternText,
        oneTip: oneTipText,
        sathiNote: sathiNoteText,
        aiPowered: aiSuccess,
      };

      setWeeklyData(reportResult);
      // Auto-select the first logged day or the latest
      const defaultDay = days.find(d => d.hasEntry) || days[days.length - 1];
      setSelectedDay(defaultDay);

      // Save to cache when AI succeeded
      if (aiSuccess) {
        if (weekOffset === 0) {
          localStorage.setItem(cacheKeyDate, todayString);
          localStorage.setItem(cacheKeyData, JSON.stringify(reportResult));
        }
        try {
          await setDoc(weekDocRef, {
            userId: currentUser.uid,
            weekOffset,
            startDate: Timestamp.fromDate(startDate),
            endDate: Timestamp.fromDate(endDate),
            reportResult,
            lastUpdated: serverTimestamp()
          }, { merge: true });
        } catch (fsErr) {
          console.error("Firestore cache save error:", fsErr);
        }
      }

      // Automatic Sunday email check (for current week)
      const userEmail = currentUser.email;
      if (userEmail && weekOffset === 0 && aiSuccess) {
        const today       = new Date();
        const isSunday    = today.getDay() === 0;
        const lastSentKey = `aaina_lastEmail_${currentUser.uid}`;
        const lastSentStr = localStorage.getItem(lastSentKey);
        const daysSince   = lastSentStr ? (today - new Date(lastSentStr)) / 86400000 : Infinity;

        if (isSunday && daysSince >= 6) {
          const emailGraphStr = days
            .filter(d => d.hasEntry)
            .map(d => `${d.date} | ${d.emoji} ${d.mood} | Score: ${d.score}/5`)
            .join("\n");

          try {
            await emailjs.send("service_0bjz9tp", "template_4fx97tr", {
              to_email:     userEmail,
              user_name:    currentUser.displayName || "there",
              total_days:   loggedCount,
              average_mood: `${exactAverage}/5`,
              emoji_graph:  emailGraphStr,
              best_day:     reportResult.bestDay,
              worst_day:    reportResult.toughDay,
              best_moment:  reportResult.bestMoment,
              pattern:      reportResult.pattern,
              oneTip:       reportResult.oneTip,
              sathi_tip:    reportResult.sathiNote,
            }, "OEW3zqMBAL7Qg1og0");
            localStorage.setItem(lastSentKey, today.toISOString());
          } catch (e) {
            console.error("Auto Sunday email failed:", e);
          }
        }
      }

    } catch (err) {
      console.error("Error generating Weekly Aaina:", err);
      setWeeklyData(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser, weekOffset]);

  useEffect(() => {
    generateWeeklyAaina(false);

    const handleUpdate = () => {
      localStorage.removeItem(`aaina_date_v3_${currentUser?.uid}_offset_0`);
      localStorage.removeItem(`aaina_data_v3_${currentUser?.uid}_offset_0`);
      if (weekOffset === 0) generateWeeklyAaina(true);
    };
    window.addEventListener("diaryUpdated", handleUpdate);
    return () => window.removeEventListener("diaryUpdated", handleUpdate);
  }, [currentUser, weekOffset, generateWeeklyAaina]);

  // Send email report on demand
  const handleSendEmailReport = async () => {
    if (!currentUser?.email || !weeklyData || emailStatus === "sending") return;
    setEmailStatus("sending");

    const emailGraphStr = weeklyData.days
      .filter(d => d.hasEntry)
      .map(d => `${d.date} | ${d.emoji} ${d.mood} | Score: ${d.score}/5`)
      .join("\n");

    try {
      await emailjs.send("service_0bjz9tp", "template_4fx97tr", {
        to_email:     currentUser.email,
        user_name:    currentUser.displayName || "there",
        total_days:   weeklyData.totalDays,
        average_mood: `${weeklyData.averageScore}/5`,
        emoji_graph:  emailGraphStr,
        best_day:     weeklyData.bestDay,
        worst_day:    weeklyData.toughDay,
        best_moment:  weeklyData.bestMoment,
        pattern:      weeklyData.pattern,
        oneTip:       weeklyData.oneTip,
        sathi_tip:    weeklyData.sathiNote,
      }, "OEW3zqMBAL7Qg1og0");
      setEmailStatus("sent");
      setTimeout(() => setEmailStatus("idle"), 4000);
    } catch (err) {
      console.error("Manual email send failed:", err);
      setEmailStatus("error");
      setTimeout(() => setEmailStatus("idle"), 3000);
    }
  };

  // ── LOADING STATE ──────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#06060A] gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-[#A8C87E] border-t-transparent animate-spin" />
      <p className="font-mono text-[11px] tracking-[0.25em] text-[#A8C87E] uppercase">
        {aiStatus === "loading" ? "Analyzing with Sathi AI…" : `Reviewing ${weekOffset > 0 ? "past" : "this"} week…`}
      </p>
    </div>
  );

  return (
    <div className="bg-[#06060A] text-[#E8E4DC] pt-28 md:pt-32 pb-24 px-4 sm:px-6 md:px-12 min-h-screen font-serif">

      {/* Daily evening modal */}
      {showDailyModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex justify-center items-center z-[9999] p-4 animate-fade-in">
          <div className="bg-[#0A0A0F] p-6 sm:p-10 rounded-2xl max-w-lg w-full border border-[#A8C87E]/40 text-center shadow-[0_0_40px_rgba(168,200,126,0.15)]">
            <h2 className="text-[#A8C87E] text-2xl md:text-3xl font-serif font-bold mb-2">🌙 Evening Check-in</h2>
            <p className="text-[#A09A95] text-base md:text-lg mb-4">Here is what you captured today:</p>
            {dailyDiaryToday ? (
              <div className="italic my-6 text-[#E8E4DC] text-lg border-l-2 border-[#A8C87E] pl-4 text-left bg-white/[0.02] p-4 rounded-r-xl">
                Today you felt <strong className="not-italic text-2xl">{dailyDiaryToday.moodEmoji || "📓"}</strong>: {dailyDiaryToday.content}
              </div>
            ) : (
              <p className="text-[#C8A97E] my-6 text-base bg-[#C8A97E]/5 p-4 rounded-xl border border-[#C8A97E]/20">
                You haven't logged any thoughts today yet. Take a moment to write in your Midnight Diary!
              </p>
            )}
            <div className="flex gap-3 justify-center">
              {setPage && (
                <button
                  type="button"
                  onClick={() => { setShowDailyModal(false); setPage("diary"); }}
                  className="bg-[#C8A97E] text-black px-6 py-3 rounded-xl font-bold font-mono uppercase tracking-widest text-xs hover:bg-white transition-all cursor-pointer"
                >
                  Go to Diary
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowDailyModal(false)}
                className="bg-white/10 text-white px-6 py-3 rounded-xl font-bold font-mono uppercase tracking-widest text-xs hover:bg-white/20 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto animate-fade-in">

        {/* Navigation & Controls Bar */}
        <div className="flex justify-between items-center mb-8 p-4 sm:p-5 bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-2xl shadow-lg">
          <button
            type="button"
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="flex items-center gap-1 sm:gap-2 text-[#C8A97E] hover:text-white transition-colors cursor-pointer font-mono uppercase text-[11px] sm:text-xs tracking-wider"
          >
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Older</span>
          </button>

          <div className="text-center">
            <div className="font-mono text-[10px] sm:text-xs tracking-[0.2em] text-[#A8C87E] uppercase font-semibold">
              {weekOffset === 0 ? "Current 7 Days" : `${weekOffset} Week${weekOffset > 1 ? "s" : ""} Ago`}
            </div>
            <div className="text-base sm:text-lg text-[#E8E4DC] font-bold mt-1">{dateRangeText}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(`aaina_date_v3_${currentUser?.uid}_offset_${weekOffset}`);
                localStorage.removeItem(`aaina_data_v3_${currentUser?.uid}_offset_${weekOffset}`);
                generateWeeklyAaina(true);
              }}
              className="p-2 text-[#8A8580] hover:text-[#C8A97E] transition-colors rounded-full hover:bg-white/5 cursor-pointer"
              title="Regenerate Reflection"
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
              disabled={weekOffset === 0}
              className={`flex items-center gap-1 sm:gap-2 font-mono uppercase text-[11px] sm:text-xs tracking-wider transition-colors ${
                weekOffset === 0 ? "text-[#5A5550] cursor-not-allowed" : "text-[#C8A97E] hover:text-white cursor-pointer"
              }`}
            >
              <span className="hidden sm:inline">Newer</span> <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* AI & Report Status Badges */}
        {weeklyData && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 px-1">
            <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full border ${
              weeklyData.aiPowered
                ? "bg-[#A8C87E]/10 border-[#A8C87E]/30 text-[#A8C87E]"
                : "bg-white/5 border-white/10 text-[#8A8580]"
            }`}>
              <Sparkles size={11} />
              {weeklyData.aiPowered ? "AI Deep Reflection Active" : "Heuristic Reflection (Backend Sleep)"}
            </span>

            {currentUser?.email && (
              <button
                type="button"
                onClick={handleSendEmailReport}
                disabled={emailStatus === "sending"}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full border border-[#C8A97E]/30 bg-[#C8A97E]/5 text-[#C8A97E] hover:bg-[#C8A97E]/15 transition-all cursor-pointer disabled:opacity-50"
              >
                {emailStatus === "sending" ? (
                  <>Sending…</>
                ) : emailStatus === "sent" ? (
                  <><CheckCircle2 size={12} className="text-green-400" /> Sent to Email!</>
                ) : (
                  <><Mail size={12} /> Email Report</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Empty State */}
        {!weeklyData ? (
          <div className="text-center text-[#A09A95] my-20 bg-[#0A0A0F]/60 border border-white/5 rounded-3xl p-10 sm:p-14">
            <div className="text-5xl mb-4">📓</div>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#E8E4DC] mb-3">No Entries in This Window</h2>
            <p className="font-serif text-base sm:text-lg max-w-md mx-auto text-[#A09A95]">
              {weekOffset > 0
                ? "You did not write any diary entries during this past week."
                : "Your Mood Canvas needs at least one diary entry to reflect your emotional patterns."}
            </p>
            {setPage && (
              <button
                type="button"
                onClick={() => setPage("diary")}
                className="mt-6 inline-flex items-center gap-2 bg-[#C8A97E] text-black px-6 py-3 rounded-xl font-mono text-xs uppercase tracking-widest font-bold hover:bg-white transition-all cursor-pointer shadow-[0_0_25px_rgba(200,169,126,0.3)]"
              >
                <BookOpen size={14} /> Open Midnight Diary
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Header Title */}
            <div className="text-center mb-8">
              <h1 className="text-4xl sm:text-5xl font-light leading-tight">
                {weekOffset === 0 ? "Your" : "Past"} 7 Days,<br />
                <strong className="text-[#A8C87E] font-bold">Reflected.</strong>
              </h1>
              <p className="text-base sm:text-lg italic mt-3 text-[#A09A95] max-w-xl mx-auto">{weeklyData.greeting}</p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 my-6">
              {[
                { label: "Avg Mood", value: `${weeklyData.averageScore} / 5`, color: "#A8C87E" },
                { label: "Consistency", value: `${weeklyData.totalDays} / 7 Days`, color: "#7EB8C8" },
                { label: "Best Day", value: weeklyData.bestDay.split(" ")[0] || "—", color: "#E8E4DC" },
                { label: "Tough Day", value: weeklyData.toughDay.split(" ")[0] || "—", color: "#E8E4DC" },
              ].map((m, i) => (
                <div key={i} className="bg-[#0A0A0F]/80 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-white/5">
                  <div className="text-[#8A8580] text-[10px] font-mono uppercase tracking-widest">{m.label}</div>
                  <div className="text-lg sm:text-xl font-bold mt-1.5 truncate" style={{ color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* 7-DAY INTERACTIVE MOOD CANVAS CHART */}
            <div className="bg-[#0A0A0F]/90 backdrop-blur-xl p-6 sm:p-8 rounded-3xl mb-8 border border-[#A8C87E]/20 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[#A8C87E] font-mono uppercase tracking-widest text-xs sm:text-sm flex items-center gap-2">
                  <span>📊</span> 7-Day Mood Canvas
                </h3>
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#8A8580]">
                  Tap any day to inspect
                </span>
              </div>

              {/* 7 Columns */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-3 items-end h-[220px] pt-4 pb-2">
                {weeklyData.days.map((d, idx) => {
                  const isSelected = selectedDay && selectedDay.date === d.date;
                  const barHeight = d.hasEntry ? Math.max((d.score / 5) * 130, 16) : 6;
                  const barColor = !d.hasEntry
                    ? "bg-white/5"
                    : d.score >= 4
                    ? "bg-[#A8C87E]"
                    : d.score === 3
                    ? "bg-[#C8A97E]"
                    : "bg-[#ef4444]";

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDay(d)}
                      className={`flex flex-col items-center justify-end h-full p-1 rounded-xl transition-all cursor-pointer group relative ${
                        isSelected
                          ? "bg-white/[0.06] ring-1 ring-[#C8A97E]/70"
                          : "hover:bg-white/[0.03]"
                      }`}
                    >
                      {/* Emoji */}
                      <div className="text-xl sm:text-2xl mb-2 transition-transform group-hover:scale-110">
                        {d.hasEntry ? d.emoji : <span className="text-[#4A4540] text-sm">·</span>}
                      </div>

                      {/* Bar */}
                      <div
                        className={`w-full max-w-[36px] rounded-t-lg transition-all duration-500 ${barColor} ${
                          d.hasEntry ? "opacity-85 group-hover:opacity-100" : "border-t border-dashed border-white/20"
                        }`}
                        style={{ height: `${barHeight}px` }}
                      />

                      {/* Score Tag */}
                      <div className="mt-2 font-mono text-[10px] font-bold text-[#E8E4DC]">
                        {d.hasEntry ? `${d.score}` : "—"}
                      </div>

                      {/* Day Label */}
                      <div className="mt-1 text-center">
                        <div className={`text-[10px] font-mono uppercase ${d.hasEntry ? "text-[#A8C87E]" : "text-[#5A5550]"}`}>
                          {d.day}
                        </div>
                        <div className="text-[9px] text-[#7A7570] hidden sm:block">
                          {d.date.split(" ")[1]}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DAY INSPECTOR PANEL (Tapping on any day reveals its details) */}
            {selectedDay && (
              <div className="bg-[#0A0A0F]/80 backdrop-blur-xl p-5 sm:p-7 rounded-2xl mb-8 border border-[#C8A97E]/30 animate-fade-in shadow-lg">
                <div className="flex flex-wrap justify-between items-start gap-2 border-b border-white/5 pb-3 mb-4">
                  <div>
                    <span className="font-mono text-[10px] text-[#A8C87E] uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar size={12} /> {selectedDay.fullDate}
                    </span>
                    <h4 className="font-serif text-lg sm:text-xl font-bold text-[#E8E4DC] mt-1 flex items-center gap-2">
                      {selectedDay.hasEntry ? (
                        <>
                          <span>{selectedDay.emoji}</span>
                          <span>{selectedDay.mood} Mood</span>
                          <span className="text-xs font-mono font-normal text-[#C8A97E] bg-[#C8A97E]/10 px-2 py-0.5 rounded-full">
                            Score: {selectedDay.score} / 5
                          </span>
                        </>
                      ) : (
                        <span className="text-[#8A8580]">No Diary Entry Logged</span>
                      )}
                    </h4>
                  </div>

                  {selectedDay.hasEntry && selectedDay.entryCount > 1 && (
                    <span className="font-mono text-[10px] text-[#7EB8C8] bg-[#7EB8C8]/10 px-2.5 py-1 rounded-full">
                      {selectedDay.entryCount} entries logged
                    </span>
                  )}
                </div>

                {selectedDay.hasEntry ? (
                  <div className="space-y-3">
                    {selectedDay.entries?.map((e, i) => (
                      <div key={i} className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                        <div className="flex items-center gap-2 text-xs font-mono text-[#8A8580] mb-2">
                          <Clock size={12} />
                          <span>{e.time}</span>
                          <span>·</span>
                          <span>{e.emoji}</span>
                        </div>
                        <p className="font-serif text-base text-[#E8E4DC] leading-relaxed whitespace-pre-line italic">
                          "{e.content}"
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-[#8A8580] text-sm font-serif">
                      You didn't write anything in your diary on this day.
                    </p>
                    {setPage && weekOffset === 0 && (
                      <button
                        type="button"
                        onClick={() => setPage("diary")}
                        className="inline-flex items-center gap-1.5 bg-[#C8A97E]/15 border border-[#C8A97E]/30 text-[#C8A97E] hover:bg-[#C8A97E] hover:text-black px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-semibold transition-all cursor-pointer"
                      >
                        Write Today <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Best Moment Highlight */}
            {weeklyData.bestMoment && weeklyData.bestMoment !== "No specific moments captured." && (
              <div className="bg-[#A8C87E]/5 border border-dashed border-[#A8C87E]/25 rounded-2xl p-6 sm:p-8 mb-8">
                <h3 className="text-[#A8C87E] font-mono uppercase tracking-widest text-xs sm:text-sm mb-2 flex items-center gap-2">
                  <span>✨</span> Best Moment This Week
                </h3>
                <p className="text-[#E8E4DC] text-lg sm:text-xl leading-relaxed italic">"{weeklyData.bestMoment}"</p>
              </div>
            )}

            {/* Mood Pattern Reflection */}
            <div className="bg-[#0A0A0F]/80 backdrop-blur-xl p-6 sm:p-8 rounded-2xl mb-8 border border-white/5">
              <h3 className="mb-3 text-[#C8A97E] font-mono uppercase tracking-widest text-xs sm:text-sm flex items-center gap-2">
                <span>🧩</span> Sathi's Weekly Review
              </h3>
              <p className="text-[#E8E4DC] text-base sm:text-lg leading-relaxed whitespace-pre-line">{weeklyData.pattern}</p>
            </div>

            {/* Actionable Tip & Sathi's Note */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-[#A8C87E]/5 p-6 sm:p-7 rounded-2xl border border-dashed border-[#A8C87E]/30">
                <h4 className="mb-2 text-[#A8C87E] font-mono uppercase tracking-widest text-xs sm:text-sm flex items-center gap-2">
                  <span>💡</span> Actionable Tip
                </h4>
                <p className="text-base sm:text-lg text-[#E8E4DC] italic leading-relaxed whitespace-pre-line">
                  "{weeklyData.oneTip}"
                </p>
              </div>
              <div className="bg-[#0A0A0F]/80 backdrop-blur-xl p-6 sm:p-7 rounded-2xl border border-[#C8A97E]/20">
                <h4 className="mb-2 text-[#C8A97E] font-mono uppercase tracking-widest text-xs sm:text-sm flex items-center gap-2">
                  <span>🤝</span> Sathi's Personal Note
                </h4>
                <p className="text-sm sm:text-base leading-relaxed text-[#A09A95] whitespace-pre-line">
                  {weeklyData.sathiNote}
                </p>
              </div>
            </div>

            {/* Navigation Footnote */}
            {setPage && (
              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={() => setPage("diary")}
                  className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#C8A97E] hover:text-white transition-colors cursor-pointer"
                >
                  <BookOpen size={14} /> Back to Midnight Diary <ArrowRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}