import React, { useEffect, useState, useCallback } from "react";
import { collection, query, where, getDocs, Timestamp, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import emailjs from "@emailjs/browser";
import { ChevronLeft, ChevronRight, Mail, RefreshCw, Sparkles } from "lucide-react";

export default function WeeklyAaina({ currentUser }) {
  const [weeklyData,      setWeeklyData]      = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [showDailyModal,  setShowDailyModal]  = useState(false);
  const [dailyDiaryToday, setDailyDiaryToday] = useState(null);
  const [weekOffset,      setWeekOffset]      = useState(0);
  const [dateRangeText,   setDateRangeText]   = useState("");
  const [aiStatus,        setAiStatus]        = useState("idle"); // idle | loading | success | fallback

  // ─────────────────────────────────────────
  // 1. DAILY 9 PM NOTIFICATION + MODAL
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const checkTimeForDailyPopup = async () => {
      const now = new Date();
      if (now.getHours() < 21) return;

      const todayStr    = now.toDateString();
      const lastChecked = localStorage.getItem("lastDailyPopupDate");
      if (lastChecked === todayStr) return;

      localStorage.setItem("lastDailyPopupDate", todayStr);

      if (Notification.permission === "granted") {
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
    setAiStatus("idle");

    // Build date range
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
          setWeeklyData(docSnap.data().reportResult);
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
          setWeeklyData(JSON.parse(cachedData));
          setAiStatus("success");
          setLoading(false);
          return;
        }
      }

      // Fetch all diary entries for this user, filter by date in JS
      const q = query(collection(db, "diaries"), where("userId", "==", currentUser.uid));
      const querySnapshot = await getDocs(q);

      const validDiaries = [];
      querySnapshot.forEach((docSnap) => {
        const data    = docSnap.data();
        const docDate = data.createdAt?.toDate();
        if (docDate && docDate >= startDate && docDate <= endDate) {
          validDiaries.push(data);
        }
      });

      if (validDiaries.length === 0) {
        setWeeklyData(null);
        setLoading(false);
        return;
      }

      const emojiDataMap = {
        "🤩": { score: 5, label: "excited"   },
        "😊": { score: 5, label: "happy"     },
        "😁": { score: 5, label: "joyful"    },
        "🙂": { score: 4, label: "good"      },
        "😌": { score: 4, label: "calm"      },
        "😐": { score: 3, label: "neutral"   },
        "📓": { score: 3, label: "logged"    },
        "😔": { score: 2, label: "sad"       },
        "😢": { score: 2, label: "upset"     },
        "😰": { score: 1, label: "anxious"   },
        "😡": { score: 1, label: "angry"     },
        "😭": { score: 1, label: "exhausted" },
      };

      let totalMoodScore = 0;
      let bestDayObj     = null;
      let toughDayObj    = null;
      let maxScore       = -Infinity;
      let minScore       =  Infinity;
      let graphArray     = [];

      validDiaries.forEach((diary) => {
        const emoji  = diary.moodEmoji || "😐";
        const mapped = emojiDataMap[emoji] || { score: 3, label: "mixed" };
        const score  = mapped.score;
        totalMoodScore += score;

        const dateObj = diary.createdAt?.toDate() || new Date();
        const dayName = dateObj.toLocaleDateString("en-IN", { weekday: "short" });
        const dateNum = dateObj.toLocaleDateString("en-IN", { month: "short", day: "numeric" });

        const dayData = {
          day:     dayName,
          date:    dateNum,
          rawDate: dateObj,
          mood:    mapped.label,
          emoji,
          score,
          text:    diary.content || "No thoughts logged.",
        };

        graphArray.push(dayData);
        if (score > maxScore) { maxScore = score; bestDayObj  = dayData; }
        if (score < minScore) { minScore = score; toughDayObj = dayData; }
      });

      graphArray.sort((a, b) => a.rawDate - b.rawDate);

      const totalDays    = validDiaries.length;
      const exactAverage = (totalMoodScore / totalDays).toFixed(1);

      // Default fallback texts
      let patternText   = "Your heart felt a bit of everything this week — a very human, very normal balance.";
      let oneTipText    = "Take a deep breath and give yourself some grace. You are doing better than you think.";
      let sathiNoteText = "Life felt a little heavy this week, but Sathi is always here for you, no matter what.";
      let aiSuccess     = false;

      // AI Insights from Gemini via backend
      setAiStatus("loading");
      try {
        const summaryText = graphArray
          .map(d => `${d.day} (${d.emoji} — ${d.mood}, score ${d.score}/5): ${d.text.slice(0, 120)}`)
          .join(" | ");

        const aiResponse = await fetch("https://dapan-api-secure.onrender.com/api/generate-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ summaryText })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          if (aiData.candidates?.[0]?.content?.parts?.[0]?.text) {
            let rawText = aiData.candidates[0].content.parts[0].text.trim();
            rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

            const parsedData  = JSON.parse(rawText);
            patternText   = parsedData.moodPattern   || patternText;
            oneTipText    = parsedData.actionableTip || oneTipText;
            sathiNoteText = parsedData.sathisNote    || sathiNoteText;
            aiSuccess     = true;
            setAiStatus("success");
          }
        } else {
          console.warn("Backend AI insights error — using fallback text");
          setAiStatus("fallback");
        }
      } catch (aiErr) {
        console.error("AI Insights failed:", aiErr);
        setAiStatus("fallback");
      }

      const reportResult = {
        greeting:     weekOffset === 0
          ? `Hello ${currentUser.displayName?.split(" ")[0] || "friend"}, here is your weekly reflection.`
          : `Here is your reflection from ${startStr} – ${endStr}.`,
        graph:        graphArray,
        totalDays,
        averageScore: exactAverage,
        bestDay:      bestDayObj  ? `${bestDayObj.date}  ${bestDayObj.emoji} (${bestDayObj.mood})`  : "N/A",
        toughDay:     toughDayObj ? `${toughDayObj.date}  ${toughDayObj.emoji} (${toughDayObj.mood})` : "N/A",
        bestMoment:   bestDayObj?.text || "No specific moments captured.",
        pattern:      patternText,
        oneTip:       oneTipText,
        sathiNote:    sathiNoteText,
        aiPowered:    aiSuccess,
      };

      setWeeklyData(reportResult);

      // Save to cache only when AI succeeded
      if (aiSuccess) {
        if (weekOffset === 0) {
          localStorage.setItem(cacheKeyDate, todayString);
          localStorage.setItem(cacheKeyData, JSON.stringify(reportResult));
        }
        try {
          await setDoc(weekDocRef, {
            userId:      currentUser.uid,
            weekOffset,
            startDate:   Timestamp.fromDate(startDate),
            endDate:     Timestamp.fromDate(endDate),
            reportResult,
            lastUpdated: serverTimestamp()
          }, { merge: true });
        } catch (fsErr) {
          console.error("Firestore save error:", fsErr);
        }
      }

      // Sunday auto-email (current week only, AI required)
      const userEmail = currentUser.email;
      if (userEmail && weekOffset === 0 && aiSuccess) {
        const today       = new Date();
        const isSunday    = today.getDay() === 0;
        const lastSentKey = `aaina_lastEmail_${currentUser.uid}`;
        const lastSentStr = localStorage.getItem(lastSentKey);
        const daysSince   = lastSentStr ? (today - new Date(lastSentStr)) / 86400000 : Infinity;

        if (isSunday && daysSince >= 6) {
          const emailGraphStr = graphArray
            .map(d => `${d.date} | ${d.emoji} ${d.mood} | Score: ${d.score}/5`)
            .join("\n");

          try {
            await emailjs.send("service_0bjz9tp", "template_4fx97tr", {
              to_email:    userEmail,
              user_name:   currentUser.displayName || "there",
              total_days:  totalDays,
              average_mood:`${exactAverage}/5`,
              emoji_graph: emailGraphStr,
              best_day:    reportResult.bestDay,
              worst_day:   reportResult.toughDay,
              best_moment: reportResult.bestMoment,
              pattern:     reportResult.pattern,
              oneTip:      reportResult.oneTip,
              sathi_tip:   reportResult.sathiNote,
            }, "OEW3zqMBAL7Qg1og0");
            localStorage.setItem(lastSentKey, today.toISOString());
            console.log("✅ Weekly email sent!");
          } catch (emailErr) {
            console.error("EmailJS failed:", emailErr);
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

  // ── LOADING ────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#06060A] gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-[#A8C87E] border-t-transparent animate-spin" />
      <p className="font-mono text-[11px] tracking-[0.25em] text-[#A8C87E] uppercase">
        {aiStatus === "loading" ? "Generating AI insights…" : `Analyzing ${weekOffset > 0 ? "past" : "this"} week…`}
      </p>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────
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
                Today you felt <strong className="not-italic text-2xl">{dailyDiaryToday.moodEmoji || "😐"}</strong>: {dailyDiaryToday.content}
              </div>
            ) : (
              <p className="text-[#C8A97E] my-6 text-base bg-[#C8A97E]/5 p-4 rounded-xl border border-[#C8A97E]/20">
                You haven't logged any thoughts today yet. Take a moment to write in your Midnight Diary!
              </p>
            )}
            <button type="button" onClick={() => setShowDailyModal(false)}
              className="bg-[#A8C87E] text-black px-8 py-3 rounded-xl font-bold font-mono uppercase tracking-widest text-xs hover:bg-white transition-all cursor-pointer">
              Close Reflection
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto animate-fade-in">

        {/* Navigation Header */}
        <div className="flex justify-between items-center mb-8 p-4 sm:p-5 bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-2xl shadow-lg">
          <button type="button" onClick={() => setWeekOffset(prev => prev + 1)}
            className="flex items-center gap-1 sm:gap-2 text-[#C8A97E] hover:text-white transition-colors cursor-pointer font-mono uppercase text-[11px] sm:text-xs tracking-wider">
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Older</span>
          </button>

          <div className="text-center">
            <div className="font-mono text-[10px] sm:text-xs tracking-[0.2em] text-[#A8C87E] uppercase font-semibold">
              {weekOffset === 0 ? "Current Week" : `${weekOffset} Week${weekOffset > 1 ? "s" : ""} Ago`}
            </div>
            <div className="text-base sm:text-lg text-[#E8E4DC] font-bold mt-1">{dateRangeText}</div>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh button */}
            <button type="button"
              onClick={() => {
                localStorage.removeItem(`aaina_date_v3_${currentUser?.uid}_offset_${weekOffset}`);
                localStorage.removeItem(`aaina_data_v3_${currentUser?.uid}_offset_${weekOffset}`);
                generateWeeklyAaina(true);
              }}
              className="p-2 text-[#8A8580] hover:text-[#C8A97E] transition-colors rounded-full hover:bg-white/5 cursor-pointer"
              title="Refresh / regenerate insights">
              <RefreshCw size={14} />
            </button>
            <button type="button"
              onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
              disabled={weekOffset === 0}
              className={`flex items-center gap-1 sm:gap-2 font-mono uppercase text-[11px] sm:text-xs tracking-wider transition-colors ${
                weekOffset === 0 ? "text-[#5A5550] cursor-not-allowed" : "text-[#C8A97E] hover:text-white cursor-pointer"
              }`}>
              <span className="hidden sm:inline">Newer</span> <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* AI status badge */}
        {weeklyData && (
          <div className="flex justify-center mb-6">
            <span className={`flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full border ${
              weeklyData.aiPowered
                ? "bg-[#A8C87E]/10 border-[#A8C87E]/30 text-[#A8C87E]"
                : "bg-white/5 border-white/10 text-[#8A8580]"
            }`}>
              <Sparkles size={10} />
              {weeklyData.aiPowered ? "AI Insights Active" : "Default Insights (AI unavailable)"}
            </span>
          </div>
        )}

        {/* Empty state */}
        {!weeklyData ? (
          <div className="text-center text-[#A09A95] my-24 bg-[#0A0A0F]/50 border border-white/5 rounded-3xl p-12">
            <div className="text-5xl mb-4">📓</div>
            <p className="font-serif text-xl sm:text-2xl">
              {weekOffset > 0
                ? "No entries found for this period."
                : "No entries logged yet this week. Start your journey in the Midnight Diary!"}
            </p>
            {weekOffset === 0 && (
              <p className="font-mono text-xs text-[#8A8580] mt-3 tracking-widest uppercase">Write at least one diary entry to see your Mood Canvas</p>
            )}
          </div>
        ) : (
          <>
            {/* Title */}
            <div className="text-center mb-10">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-light leading-tight">
                {weekOffset === 0 ? "Your" : "Past"} week,<br />
                <strong className="text-[#A8C87E] font-bold">reflected.</strong>
              </h1>
              <p className="text-lg sm:text-xl italic mt-4 text-[#A09A95] max-w-2xl mx-auto">{weeklyData.greeting}</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8">
              {[
                { label: "⭐ Avg Mood",  value: `${weeklyData.averageScore} / 5`, color: "#A8C87E", border: "rgba(168,200,126,0.3)" },
                { label: "📈 Best Day",  value: weeklyData.bestDay,  color: "#E8E4DC", border: "rgba(255,255,255,0.1)" },
                { label: "📉 Tough Day", value: weeklyData.toughDay, color: "#E8E4DC", border: "rgba(255,255,255,0.1)" },
              ].map((stat, i) => (
                <div key={i} className="bg-[#0A0A0F]/80 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border" style={{ borderColor: stat.border }}>
                  <div className="text-[#A09A95] text-xs font-mono uppercase tracking-widest">{stat.label}</div>
                  <div className="text-xl sm:text-2xl font-bold mt-2 truncate" style={{ color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Mood Bar Chart */}
            <div className="bg-[#0A0A0F]/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl mb-8 border border-[#A8C87E]/20 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
              <h3 className="mb-6 text-[#A8C87E] font-mono uppercase tracking-widest text-xs sm:text-sm">
                📊 Mood Graph — {weeklyData.totalDays} {weeklyData.totalDays === 1 ? "entry" : "entries"}
              </h3>
              <div className="flex items-end justify-between h-[200px] gap-1 sm:gap-3 pb-2 overflow-x-auto">
                {weeklyData.graph.map((item, i) => (
                  <div key={i} className="flex flex-col items-center flex-1 min-w-[36px] group cursor-default">
                    <div className="text-xl sm:text-2xl mb-2">{item.emoji}</div>
                    <div
                      className="w-full max-w-[40px] rounded-t-xl transition-all duration-700 group-hover:opacity-100 opacity-80 relative"
                      style={{
                        height: `${Math.max((item.score / 5) * 130, 14)}px`,
                        backgroundColor: item.score >= 4 ? "#A8C87E" : item.score === 3 ? "#C8A97E" : "#ef4444"
                      }}
                    >
                      {/* tooltip on hover */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[9px] font-mono px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {item.score}/5
                      </div>
                    </div>
                    <div className="mt-2 font-mono text-[10px] text-[#E8E4DC] font-bold">{item.score}/5</div>
                    <div className="mt-1 text-center">
                      <div className="text-[10px] text-[#A8C87E] font-mono uppercase">{item.day}</div>
                      <div className="text-[9px] text-[#A09A95]">{item.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Best Moment */}
            {weeklyData.bestMoment && weeklyData.bestMoment !== "No specific moments captured." && (
              <div className="bg-[#A8C87E]/5 border border-dashed border-[#A8C87E]/25 rounded-2xl p-6 sm:p-8 mb-8">
                <h3 className="text-[#A8C87E] font-mono uppercase tracking-widest text-xs sm:text-sm mb-3">✨ Best Moment This Week</h3>
                <p className="text-[#E8E4DC] text-lg sm:text-xl leading-relaxed italic">"{weeklyData.bestMoment}"</p>
              </div>
            )}

            {/* Mood Pattern — shown for both current and past weeks */}
            <div className="bg-[#0A0A0F]/80 backdrop-blur-xl p-6 sm:p-8 rounded-2xl mb-8 border border-white/5">
              <h3 className="mb-3 text-[#C8A97E] font-mono uppercase tracking-widest text-xs sm:text-sm">🧩 Your Mood Pattern</h3>
              <p className="text-[#E8E4DC] text-lg sm:text-xl leading-relaxed">{weeklyData.pattern}</p>
            </div>

            {/* Tip + Sathi Note */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-[#A8C87E]/5 p-6 sm:p-8 rounded-2xl border border-dashed border-[#A8C87E]/30">
                <h4 className="mb-3 text-[#A8C87E] font-mono uppercase tracking-widest text-xs sm:text-sm">💡 Actionable Tip</h4>
                <p className="text-lg sm:text-xl text-[#E8E4DC] italic leading-relaxed">"{weeklyData.oneTip}"</p>
              </div>
              <div className="bg-[#0A0A0F]/80 backdrop-blur-xl p-6 sm:p-8 rounded-2xl border border-[#C8A97E]/20">
                <h4 className="mb-3 text-[#C8A97E] font-mono uppercase tracking-widest text-xs sm:text-sm">🤝 Sathi's Note</h4>
                <p className="text-base sm:text-lg leading-relaxed text-[#A09A95]">{weeklyData.sathiNote}</p>
              </div>
            </div>

            {/* Past week email note */}
            {weekOffset > 0 && (
              <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-xl p-4 text-center">
                <p className="font-mono text-[10px] tracking-widest uppercase text-[#8A8580] flex items-center justify-center gap-2">
                  <Mail size={12} /> This week's full report was emailed on Sunday
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}