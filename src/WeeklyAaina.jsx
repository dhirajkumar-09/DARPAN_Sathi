import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, Timestamp, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import emailjs from "@emailjs/browser";
import { ChevronLeft, ChevronRight, Mail } from "lucide-react";

export default function WeeklyAaina({ currentUser }) {
  const [weeklyData,      setWeeklyData]      = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [showDailyModal,  setShowDailyModal]  = useState(false);
  const [dailyDiaryToday, setDailyDiaryToday] = useState(null);
  
  // Week Navigation States
  const [weekOffset,      setWeekOffset]      = useState(0); 
  const [dateRangeText,   setDateRangeText]   = useState("");

  // ─────────────────────────────────────────
  // 1. DAILY 9 PM NOTIFICATION + MODAL
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    if (Notification.permission === "default") {
      Notification.requestPermission().catch(err => console.log("Notification ignored", err));
    }

    const checkTimeForDailyPopup = async () => {
      const now = new Date();
      if (now.getHours() < 21) return;

      const todayStr   = now.toDateString();
      const lastChecked = localStorage.getItem("lastDailyPopupDate");
      if (lastChecked === todayStr) return;

      localStorage.setItem("lastDailyPopupDate", todayStr);

      if (Notification.permission === "granted") {
        new Notification("Darpan AI - Reflection Time", {
          body: "It's past 9 PM! Time to review your mood and complete your daily reflection.",
          icon: "/logo.png"
        });
      }

      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const q = query(
          collection(db, "diaries"),
          where("userId",    "==", currentUser.uid),
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
  // 2. WEEKLY AAINA (Bulletproof Filter & V3 Cache)
  // ─────────────────────────────────────────
  useEffect(() => {
    const generateWeeklyAaina = async () => {
      if (!currentUser) { setLoading(false); return; }
      
      setLoading(true);
      // Clear previous data immediately to avoid UI sticking
      setWeeklyData(null); 

      // Calculate Strict Date Range
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      endDate.setDate(endDate.getDate() - (weekOffset * 7)); 
      
      const startDate = new Date(endDate);
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() - 6); 

      const startStr = startDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      const endStr = endDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      setDateRangeText(`${startStr} - ${endStr}`);

      // V3 IDENTIFIER: 100% Fresh Start
      const weekIdentifier = `${startDate.getFullYear()}_${startDate.getMonth() + 1}_${startDate.getDate()}`;
      const weekDocId = `${currentUser.uid}_v3_${weekIdentifier}`;
      const weekDocRef = doc(db, "weekly_reflections", weekDocId);

      const todayString = new Date().toDateString();
      const cacheKeyDate = `aaina_date_v3_${currentUser.uid}_offset_${weekOffset}`;
      const cacheKeyData = `aaina_data_v3_${currentUser.uid}_offset_${weekOffset}`;

      try {
        // 1. PAST WEEKS (offset > 0): Strict Firestore Check
        if (weekOffset > 0) {
          const docSnap = await getDoc(weekDocRef);
          if (docSnap.exists()) {
            setWeeklyData(docSnap.data().reportResult);
            setLoading(false);
            return; 
          }
        } else {
          // 2. CURRENT WEEK (offset === 0): Local Cache Check
          const cachedDate  = localStorage.getItem(cacheKeyDate);
          const cachedData  = localStorage.getItem(cacheKeyData);
          if (cachedDate === todayString && cachedData) {
            setWeeklyData(JSON.parse(cachedData));
            setLoading(false);
            return;
          }
        }

        // 3. SAFE FIRESTORE FETCH
        const q = query(
          collection(db, "diaries"),
          where("userId", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);

        // JavaScript Filter to bypass Firebase Composite Index Error completely
        const validDiaries = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const docDate = data.createdAt?.toDate();
          if (docDate && docDate >= startDate && docDate <= endDate) {
            validDiaries.push(data);
          }
        });

        // STRICT CHECK: If user didn't write anything this specific week, EXIT!
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

        let totalMoodScore  = 0;
        let bestDayObj      = null;
        let toughDayObj     = null;
        let maxScore        = -Infinity;
        let minScore        =  Infinity;
        let graphArray      = [];

        validDiaries.forEach((diary) => {
          const currentEmoji = diary.moodEmoji || "😐";
          const mapped      = emojiDataMap[currentEmoji] || { score: 3, label: "mixed" };
          const score       = mapped.score;

          totalMoodScore += score;

          const dateObj = diary.createdAt?.toDate() || new Date();
          const dayName = dateObj.toLocaleDateString("en-IN", { weekday: "short" });
          const dateNum = dateObj.toLocaleDateString("en-IN", { month: "short", day: "numeric" });

          const dayData = {
            day:       dayName,
            date:      dateNum,
            rawDate:   dateObj,           
            mood:      mapped.label,
            emoji:     currentEmoji,
            score,
            text:      diary.content || "No thoughts logged.",
          };

          graphArray.push(dayData);

          if (score > maxScore) { maxScore = score; bestDayObj  = dayData; }
          if (score < minScore) { minScore = score; toughDayObj = dayData; }
        });

        graphArray.sort((a, b) => a.rawDate - b.rawDate);

        const totalDays    = validDiaries.length;
        const exactAverage = (totalMoodScore / totalDays).toFixed(1);
        const bestMomentText = bestDayObj ? bestDayObj.text : "No specific moments captured.";

        // Default text fallback
        let patternText = "Your heart felt a bit of everything this week. A very human, very normal balance.";
        let oneTipText = "Take a deep breath and give yourself some grace. You are doing better than you think.";
        let sathiNoteText = "Life felt a little heavy this week, but I am always here for you, no matter what.";

        // FLAG to check if AI generated actual insights
        let aiSuccess = false;

        // 🔥 GEMINI AI GENERATION 🔥
        try {
          const summaryText = graphArray.map(d => `${d.day} (${d.emoji}): ${d.text}`).join(" | ");

          const aiResponse = await fetch("https://dapan-api-secure.onrender.com/api/generate-insights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ summaryText: summaryText })
          });
          
          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            
            if (aiData.candidates && aiData.candidates[0]?.content?.parts[0]?.text) {
              let rawText = aiData.candidates[0].content.parts[0].text.trim();
              if (rawText.startsWith("```json")) {
                rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
              }
              
              const parsedData = JSON.parse(rawText);
              
              patternText = parsedData.moodPattern || patternText;
              oneTipText = parsedData.actionableTip || oneTipText;
              sathiNoteText = parsedData.sathisNote || sathiNoteText;
              
              // If code reached here, AI response was valid and successful
              aiSuccess = true;
            }
          } else {
            console.warn("Backend API error or waking up from sleep...");
          }
        } catch (aiErr) {
          console.error("🚨 AI Insights failed:", aiErr);
        }

        const reportResult = {
          greeting:     weekOffset === 0 ? `Hello ${currentUser.displayName || "my friend"}, here is your reflection.` : `Here is your past reflection from ${startStr}.`,
          graph:        graphArray,
          averageScore: exactAverage,
          bestDay:      bestDayObj  ? `${bestDayObj.date} (${bestDayObj.mood})`  : "N/A",
          toughDay:     toughDayObj ? `${toughDayObj.date} (${toughDayObj.mood})` : "N/A",
          bestMoment:   bestMomentText,
          pattern:      patternText,   
          oneTip:       oneTipText,    
          sathiNote:    sathiNoteText, 
        };

        // Update the UI immediately with either real data or default fallback
        setWeeklyData(reportResult);

        // 🔥 CRITICAL FIX: CACHE & FIRESTORE SAVING (ONLY IF AI SUCCESSFUL) 🔥
        if (aiSuccess) {
          // SAVE TO LOCAL CACHE (V3 KEYS)
          if (weekOffset === 0) {
            localStorage.setItem(cacheKeyDate, todayString);
            localStorage.setItem(cacheKeyData, JSON.stringify(reportResult));
          }

          // SAVE SECURELY TO FIRESTORE
          try {
            await setDoc(weekDocRef, {
              userId: currentUser.uid,
              weekOffset: weekOffset,
              startDate: Timestamp.fromDate(startDate),
              endDate: Timestamp.fromDate(endDate),
              reportResult: reportResult,
              lastUpdated: serverTimestamp()
            }, { merge: true });
          } catch (fsErr) {
            console.error("🚨 Firestore save error:", fsErr);
          }
        } else {
          console.log("⚠️ Showing default text because AI failed. Not saving to cache.");
        }

        // 🔥 AUTOMATIC SUNDAY EMAIL FOR CURRENT WEEK ONLY (Only if AI was successful) 🔥
        const userEmail = currentUser.email;
        if (userEmail && weekOffset === 0 && aiSuccess) {
          const today = new Date();
          const isSunday = today.getDay() === 0; 
          const lastSentKey  = `aaina_lastEmail_${currentUser.uid}`;
          const lastSentStr  = localStorage.getItem(lastSentKey);
          const lastSentDate = lastSentStr ? new Date(lastSentStr) : null;
          
          const daysSinceLast = lastSentDate ? (today - lastSentDate) / (1000 * 60 * 60 * 24) : Infinity;

          if (isSunday && daysSinceLast >= 6) {
            let emailGraphStr = "";
            graphArray.forEach(d => {
              emailGraphStr += `${d.date} | ${d.emoji} ${d.mood} | Score: ${d.score}/5\n`;
            });

            const templateParams = {
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
            };

            try {
              await emailjs.send("service_0bjz9tp", "template_4fx97tr", templateParams, "OEW3zqMBAL7Qg1og0");
              localStorage.setItem(lastSentKey, today.toISOString());
            } catch (emailErr) {
              console.error("EmailJS failed:", emailErr);
            }
          }
        }

      } catch (err) {
        console.error("Error generating Weekly Aaina:", err);
        setWeeklyData(null); // CRITICAL: Fallback clear on general error
      } finally {
        setLoading(false);
      }
    };

    generateWeeklyAaina();

    const handleUpdate = () => {
      // Clear ONLY V3 Current Week Cache when diary is updated
      localStorage.removeItem(`aaina_date_v3_${currentUser.uid}_offset_0`);
      localStorage.removeItem(`aaina_data_v3_${currentUser.uid}_offset_0`);
      if (weekOffset === 0) {
        generateWeeklyAaina();
      }
    };
    window.addEventListener("diaryUpdated", handleUpdate);
    return () => window.removeEventListener("diaryUpdated", handleUpdate);
    
  }, [currentUser, weekOffset]);

  if (loading) return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#06060A] text-[#A8C87E] font-mono tracking-widest text-xs gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-[#A8C87E] border-t-transparent animate-spin" />
      <span>ANALYZING {weekOffset > 0 ? "PAST" : "THIS"} WEEK...</span>
    </div>
  );

  return (
    <div className="bg-[#06060A] text-[#E8E4DC] pt-28 md:pt-32 pb-20 px-4 sm:px-6 md:px-12 min-h-screen font-serif">

      {showDailyModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex justify-center items-center z-[9999] p-4 animate-fade-in">
          <div className="bg-[#0A0A0F] p-6 sm:p-10 rounded-2xl max-w-lg w-full border border-[#A8C87E]/40 text-center shadow-[0_0_40px_rgba(168,200,126,0.15)] relative">
            <h2 className="text-[#A8C87E] text-2xl md:text-3xl font-serif font-bold mt-0 mb-2">🌙 Evening Check-in</h2>
            <p className="text-[#A09A95] text-base md:text-lg mb-4">It's time for your daily reflection. Here is what you captured today:</p>
            {dailyDiaryToday ? (
              <div className="italic my-6 text-[#E8E4DC] text-lg md:text-xl border-l-2 border-[#A8C87E] pl-4 text-left bg-white/[0.02] p-4 rounded-r-xl">
                "Today you felt <strong className="not-italic text-2xl">{dailyDiaryToday.moodEmoji || "😐"}</strong>: {dailyDiaryToday.content}"
              </div>
            ) : (
              <p className="text-[#C8A97E] my-6 text-base md:text-lg bg-[#C8A97E]/5 p-4 rounded-xl border border-[#C8A97E]/20">
                You haven't logged any thoughts or moods today yet. Take a moment to write in your midnight diary now!
              </p>
            )}
            <button 
              type="button"
              onClick={() => setShowDailyModal(false)} 
              className="bg-[#A8C87E] text-black border-none px-8 py-3 rounded-xl font-bold font-mono uppercase tracking-widest text-xs hover:bg-white transition-all cursor-pointer shadow-[0_0_20px_rgba(168,200,126,0.3)]"
            >
              Close Reflection
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto animate-fade-in">

        {/* Date Navigation Header */}
        <div className="flex justify-between items-center mb-10 p-4 sm:p-5 bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-2xl shadow-lg">
          <button 
            type="button"
            onClick={() => setWeekOffset(prev => prev + 1)} 
            className="flex items-center gap-1 sm:gap-2 text-[#C8A97E] hover:text-white transition-colors cursor-pointer font-mono uppercase text-[11px] sm:text-xs tracking-wider"
          >
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Past</span> Week
          </button>
          
          <div className="text-center px-2">
            <div className="font-mono text-[10px] sm:text-xs tracking-[0.2em] text-[#A8C87E] uppercase font-semibold">
              {weekOffset === 0 ? "Current Week" : `${weekOffset} Week(s) Ago`}
            </div>
            <div className="text-base sm:text-lg md:text-xl text-[#E8E4DC] font-bold mt-1">{dateRangeText}</div>
          </div>

          <button 
            type="button"
            onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))} 
            disabled={weekOffset === 0}
            className={`flex items-center gap-1 sm:gap-2 font-mono uppercase text-[11px] sm:text-xs tracking-wider transition-colors ${
              weekOffset === 0 ? "text-[#5A5550] cursor-not-allowed" : "text-[#C8A97E] hover:text-white cursor-pointer"
            }`}
          >
            <span className="hidden sm:inline">Next</span> Week <ChevronRight size={16} />
          </button>
        </div>

        {!weeklyData ? (
          <div className="text-center text-[#A09A95] my-24 text-xl sm:text-2xl bg-[#0A0A0F]/50 border border-white/5 rounded-3xl p-12">
            <div className="text-5xl mb-4">📓</div>
            <p className="font-serif">
              {weekOffset > 0 ? "No entries found for this period." : "No entries logged yet this week. Your Darpan journey is waiting in My Diary!"}
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-12">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-light leading-tight">
                Reflections from <br />
                <strong className="text-[#A8C87E] font-bold">your past 7 days.</strong>
              </h1>
              <p className="text-lg sm:text-xl italic mt-4 text-[#A09A95] max-w-2xl mx-auto">{weeklyData.greeting}</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 my-10">
              {[
                { label: "Avg Score", value: `${weeklyData.averageScore} / 5`, color: "#A8C87E", border: "rgba(168,200,126,0.3)" },
                { label: "📈 Best Day",  value: weeklyData.bestDay,  color: "#E8E4DC", border: "rgba(255,255,255,0.1)" },
                { label: "📉 Tough Day", value: weeklyData.toughDay, color: "#E8E4DC", border: "rgba(255,255,255,0.1)" },
              ].map((stat, i) => (
                <div key={i} className="bg-[#0A0A0F]/80 backdrop-blur-xl p-6 rounded-2xl border" style={{ borderColor: stat.border }}>
                  <div className="text-[#A09A95] text-xs font-mono uppercase tracking-widest">{stat.label}</div>
                  <div className="text-2xl sm:text-3xl font-bold mt-2 truncate" style={{ color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Email Summary Extra Card (Only visible for Past Weeks) */}
            {weekOffset > 0 && (
              <div className="bg-[#C8A97E]/5 p-6 sm:p-8 rounded-2xl mb-8 border border-dashed border-[#C8A97E]/30">
                <h3 className="mb-3 text-[#C8A97E] font-mono uppercase tracking-widest text-xs sm:text-sm flex items-center gap-2">
                  <Mail size={16} /> Past Week's Full Review (Sent to Email)
                </h3>
                <p className="text-[#E8E4DC] text-lg sm:text-xl leading-relaxed whitespace-pre-line italic">
                  "{weeklyData.pattern}"
                </p>
              </div>
            )}

            {/* Mood Graph */}
            <div className="bg-[#0A0A0F]/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl mb-8 border border-[#A8C87E]/20 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
              <h3 className="mb-6 text-[#A8C87E] font-mono uppercase tracking-widest text-xs sm:text-sm">
                📊 Your Mood Graph
              </h3>
              <div className="flex items-flex-end justify-between items-end h-[220px] gap-1 sm:gap-3 md:gap-4 pt-4 overflow-x-auto pb-2">
                {weeklyData.graph.map((item, i) => (
                  <div key={i} className="flex flex-col items-center flex-1 min-w-[36px]">
                    <div className="text-2xl sm:text-3xl mb-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                      {item.emoji}
                    </div>
                    <div 
                      className="w-full max-w-[36px] rounded-t-lg transition-all duration-700 opacity-85 hover:opacity-100"
                      style={{
                        height: `${Math.max((item.score / 5) * 110, 12)}px`,
                        backgroundColor: item.score >= 4 ? "#A8C87E" : item.score === 3 ? "#C8A97E" : "#ef4444"
                      }} 
                    />
                    <div className="mt-2 font-mono text-[11px] sm:text-xs text-[#E8E4DC] font-bold">{item.score}/5</div>
                    <div className="mt-1 text-center">
                      <div className="text-[10px] sm:text-[11px] text-[#A8C87E] font-mono uppercase">{item.day}</div>
                      <div className="text-[9px] sm:text-[10px] text-[#A09A95]">{item.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mood Pattern (Visible in Current Week) */}
            {weekOffset === 0 && (
              <div className="bg-[#0A0A0F]/80 backdrop-blur-xl p-6 sm:p-8 rounded-2xl mb-8 border border-white/5">
                <h3 className="mb-3 text-[#C8A97E] font-mono uppercase tracking-widest text-xs sm:text-sm">🧩 Your Mood Pattern</h3>
                <p className="text-[#E8E4DC] text-lg sm:text-xl leading-relaxed whitespace-pre-line">{weeklyData.pattern}</p>
              </div>
            )}

            {/* Tip + Sathi Note */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
              <div className="bg-[#A8C87E]/5 p-6 sm:p-8 rounded-2xl border border-dashed border-[#A8C87E]/30">
                <h4 className="mb-3 text-[#A8C87E] font-mono uppercase tracking-widest text-xs sm:text-sm">💡 Actionable Tip</h4>
                <p className="text-lg sm:text-xl text-[#E8E4DC] italic leading-relaxed whitespace-pre-line">"{weeklyData.oneTip}"</p>
              </div>
              <div className="bg-[#0A0A0F]/80 backdrop-blur-xl p-6 sm:p-8 rounded-2xl border border-[#C8A97E]/20">
                <h4 className="mb-3 text-[#C8A97E] font-mono uppercase tracking-widest text-xs sm:text-sm">🤖 Sathi's Note</h4>
                <p className="text-base sm:text-lg leading-relaxed text-[#A09A95] whitespace-pre-line">{weeklyData.sathiNote}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}