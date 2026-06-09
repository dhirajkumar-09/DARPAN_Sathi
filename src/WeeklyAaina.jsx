import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, Timestamp, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import emailjs from "@emailjs/browser";

export default function WeeklyAaina({ currentUser }) {
  const [weeklyData,      setWeeklyData]      = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [showDailyModal,  setShowDailyModal]  = useState(false);
  const [dailyDiaryToday, setDailyDiaryToday] = useState(null);

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
      if (now.getHours() < 21) return;           // Only after 9 PM

      const todayStr   = now.toDateString();
      const lastChecked = localStorage.getItem("lastDailyPopupDate");
      if (lastChecked === todayStr) return;       // Already shown today — stop here

      // Mark as shown BEFORE async work to prevent duplicate triggers
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
  // 2. WEEKLY AAINA  (With Gemini AI Brain)
  // ─────────────────────────────────────────
  useEffect(() => {
    const generateWeeklyAaina = async () => {
      if (!currentUser) { setLoading(false); return; }

      // Serve from cache if generated today
      const todayString = new Date().toDateString();
      const cachedDate  = localStorage.getItem(`aaina_date_${currentUser.uid}`);
      const cachedData  = localStorage.getItem(`aaina_data_${currentUser.uid}`);

      if (cachedDate === todayString && cachedData) {
        setWeeklyData(JSON.parse(cachedData));
        setLoading(false);
        return;
      }

      try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const q = query(
          collection(db, "diaries"),
          where("userId",    "==", currentUser.uid),
          where("createdAt", ">=", Timestamp.fromDate(oneWeekAgo))
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) { setLoading(false); return; }

        // ── Emoji score map ──────────────────────
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

        querySnapshot.forEach((docSnap) => {
          const diary       = docSnap.data();
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

        const totalDays    = querySnapshot.size;
        const exactAverage = (totalMoodScore / totalDays).toFixed(1);
        const bestMomentText = bestDayObj ? bestDayObj.text : "No specific moments captured.";

        // 🔥🔥🔥 MAIN FIX: GEMINI AI INTEGRATION 🔥🔥🔥
        let patternText = "Your heart felt a bit of everything this week. A very human, very normal balance.";
        let oneTipText = "Take a deep breath and give yourself some grace. You are doing better than you think.";
        let sathiNoteText = "Life felt a little heavy this week, but I am always here for you, no matter what.";

        try {
          const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
          const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
          
          // AI ko samajhne ke liye weekly data banaya
          const summaryText = graphArray.map(d => `${d.day}: Mood was ${d.emoji}, Diary: ${d.text}`).join(" | ");

          const aiResponse = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ 
                  text: "You are Sathi, a highly empathetic, caring, and emotionally intelligent human friend. Analyze the user's weekly mood data. Return a pure JSON object with EXACTLY 3 keys: 'moodPattern' (observe their week's emotion), 'actionableTip' (one practical self-care advice), and 'sathisNote' (a sweet, supportive closing note). Do not use markdown like ```json." 
                }]
              },
              contents: [{ role: "user", parts: [{ text: `Here is my weekly diary data: ${summaryText}. Please give me my insights in JSON.` }] }]
            })
          });

          const aiData = await aiResponse.json();
          
          if (aiData.candidates && aiData.candidates[0]?.content?.parts[0]?.text) {
            let rawText = aiData.candidates[0].content.parts[0].text.trim();
            if (rawText.startsWith("```json")) {
              rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
            }
            
            const parsedData = JSON.parse(rawText);
            
            // Asli AI data ko set karna (Agar AI kuch miss kare toh fallback use hoga)
            patternText = parsedData.moodPattern || patternText;
            oneTipText = parsedData.actionableTip || oneTipText;
            sathiNoteText = parsedData.sathisNote || sathiNoteText;
            console.log("✅ AI Insights Generated Successfully!");
          }
        } catch (aiErr) {
          console.error("🚨 AI Insights failed, using fallback static texts:", aiErr);
        }
        // 🔥🔥🔥 END GEMINI INTEGRATION 🔥🔥🔥

        const reportResult = {
          greeting:     `Hello ${currentUser.displayName || "my friend"}, here is your reflection.`,
          graph:        graphArray,
          averageScore: exactAverage,
          bestDay:      bestDayObj  ? `${bestDayObj.date} (${bestDayObj.mood})`  : "N/A",
          toughDay:     toughDayObj ? `${toughDayObj.date} (${toughDayObj.mood})` : "N/A",
          bestMoment:   bestMomentText,
          pattern:      patternText,   // Ab yeh AI generated hai
          oneTip:       oneTipText,    // Ab yeh AI generated hai
          sathiNote:    sathiNoteText, // Ab yeh AI generated hai
        };

        // Cache for today (Ab AI ka reply cache ho jayega taaki baar baar load na ho)
        localStorage.setItem(`aaina_date_${currentUser.uid}`, todayString);
        localStorage.setItem(`aaina_data_${currentUser.uid}`, JSON.stringify(reportResult));
        setWeeklyData(reportResult);

        // ── Weekly email via EmailJS ──────────────
        const userEmail = currentUser.email;
        if (userEmail) {
          const lastSentKey  = `aaina_lastEmail_${currentUser.uid}`;
          const lastSentStr  = localStorage.getItem(lastSentKey);
          const lastSentDate = lastSentStr ? new Date(lastSentStr) : null;
          const today        = new Date();
          const daysSinceLast = lastSentDate ? (today - lastSentDate) / (1000 * 60 * 60 * 24) : Infinity;

          if (daysSinceLast >= 7) {
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
              pattern:     reportResult.pattern,   // Email me bhi AI message jayega!
              oneTip:      reportResult.oneTip,    // Email me bhi AI message jayega!
              sathi_tip:   reportResult.sathiNote, // Email me bhi AI message jayega!
            };

            try {
              await emailjs.send("service_0bjz9tp", "template_4fx97tr", templateParams, "OEW3zqMBAL7Qg1og0");
              localStorage.setItem(lastSentKey, today.toISOString());
              console.log("Weekly Aaina report emailed successfully!");
            } catch (emailErr) {
              console.error("EmailJS failed:", emailErr);
            }
          }
        }

      } catch (err) {
        console.error("Error generating Weekly Aaina:", err);
      } finally {
        setLoading(false);
      }
    };

    generateWeeklyAaina();

    // Live update jab bhi tum diary save karo
    const handleUpdate = () => {
      console.log("Reloading Aaina data...");
      generateWeeklyAaina();
    };
    window.addEventListener("diaryUpdated", handleUpdate);
    return () => window.removeEventListener("diaryUpdated", handleUpdate);
    
  }, [currentUser]);

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#06060A", color: "#A8C87E", fontFamily: "'DM Mono', monospace", letterSpacing: "2px" }}>
      ANALYZING YOUR WEEK...
    </div>
  );

  return (
    <div style={{ backgroundColor: "#06060A", color: "#E8E4DC", padding: "120px 20px 80px", fontFamily: "'Cormorant Garamond', serif", minHeight: "100vh" }}>

      {/* ── Daily Evening Modal ───────────────── */}
      {showDailyModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999, backdropFilter: "blur(5px)" }}>
          <div style={{ backgroundColor: "#0A0A0F", padding: "40px", borderRadius: "16px", maxWidth: "500px", width: "90%", border: "1px solid #A8C87E", textAlign: "center", boxShadow: "0 0 30px rgba(168,200,126,0.15)" }}>
            <h2 style={{ color: "#A8C87E", marginTop: 0, fontSize: "28px" }}>🌙 Evening Check-in</h2>
            <p style={{ color: "#A09A95", fontSize: "18px" }}>It's time for your daily reflection. Here is what you captured today:</p>
            {dailyDiaryToday ? (
              <div style={{ fontStyle: "italic", margin: "25px 0", color: "#E8E4DC", fontSize: "20px", borderLeft: "2px solid #A8C87E", paddingLeft: "15px", textAlign: "left" }}>
                "Today you felt <strong>{dailyDiaryToday.moodEmoji || "😐"}</strong>: {dailyDiaryToday.content}"
              </div>
            ) : (
              <p style={{ color: "#C8A97E", margin: "25px 0", fontSize: "18px" }}>
                You haven't logged any thoughts or moods today yet. Take a moment to write in your diary now!
              </p>
            )}
            <button onClick={() => setShowDailyModal(false)} style={{ backgroundColor: "#A8C87E", color: "#000", border: "none", padding: "12px 30px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "1px" }}>
              Close Reflection
            </button>
          </div>
        </div>
      )}

      {/* ── Main Dashboard ────────────────────── */}
      {!weeklyData ? (
        <div style={{ textAlign: "center", color: "#A09A95", marginTop: "100px", fontSize: "22px" }}>
          <div style={{ fontSize: "40px", marginBottom: "20px" }}>📓</div>
          No entries found yet. Start writing your Midnight Diary to see your reflections here.
        </div>
      ) : (
        <div style={{ maxWidth: "900px", margin: "0 auto", animation: "fadeIn 0.8s ease-out" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "50px" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", letterSpacing: "0.3em", color: "#A8C87E", textTransform: "uppercase", marginBottom: "16px" }}>Your Mood Canvas</div>
            <h1 style={{ fontSize: "48px", fontWeight: "300", margin: 0 }}>
              Reflections from <br />
              <strong style={{ color: "#A8C87E", fontWeight: "bold" }}>your past 7 days.</strong>
            </h1>
            <p style={{ fontSize: "20px", fontStyle: "italic", margin: "20px 0 0 0", color: "#A09A95" }}>{weeklyData.greeting}</p>
          </div>

          {/* Stats Row */}
          <div style={{ display: "flex", gap: "20px", justifyContent: "space-between", margin: "40px 0", flexWrap: "wrap" }}>
            {[
              { label: "Avg Score", value: `${weeklyData.averageScore} / 5`, color: "#A8C87E", border: "rgba(168,200,126,0.2)" },
              { label: "📈 Best Day",  value: weeklyData.bestDay,  color: "#E8E4DC", border: "rgba(255,255,255,0.1)" },
              { label: "📉 Tough Day", value: weeklyData.toughDay, color: "#E8E4DC", border: "rgba(255,255,255,0.1)" },
            ].map((stat, i) => (
              <div key={i} style={{ backgroundColor: "#0A0A0F", padding: "25px", borderRadius: "16px", flex: "1", minWidth: "150px", border: `1px solid ${stat.border}` }}>
                <div style={{ color: "#A09A95", fontSize: "16px", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "1px" }}>{stat.label}</div>
                <div style={{ fontSize: i === 0 ? "36px" : "22px", fontWeight: "bold", color: stat.color, marginTop: "10px" }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Mood Graph */}
          <div style={{ backgroundColor: "#0A0A0F", padding: "30px", borderRadius: "16px", marginBottom: "30px", border: "1px solid rgba(168,200,126,0.2)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
            <h3 style={{ margin: "0 0 30px 0", color: "#A8C87E", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "2px", fontSize: "14px" }}>
              📊 Your Mood Graph
            </h3>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: "220px", gap: "10px", paddingTop: "20px" }}>
              {weeklyData.graph.map((item, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                  <div style={{ fontSize: "28px", marginBottom: "10px", filter: "drop-shadow(0 0 5px rgba(255,255,255,0.2))" }}>
                    {item.emoji}
                  </div>
                  <div style={{
                    width: "100%", maxWidth: "35px",
                    height: `${Math.max((item.score / 5) * 120, 10)}px`,
                    backgroundColor: item.score >= 4 ? "#A8C87E" : item.score === 3 ? "#C8A97E" : "#ef4444",
                    opacity: 0.8, borderRadius: "6px 6px 0 0",
                    transition: "height 1s ease-out"
                  }} />
                  <div style={{ marginTop: "12px", fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "#E8E4DC", fontWeight: "bold" }}>{item.score}/5</div>
                  <div style={{ marginTop: "4px", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "#A8C87E", fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>{item.day}</div>
                    <div style={{ fontSize: "11px", color: "#A09A95" }}>{item.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mood Pattern */}
          <div style={{ backgroundColor: "#0A0A0F", padding: "30px", borderRadius: "16px", marginBottom: "30px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#C8A97E", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "2px", fontSize: "14px" }}>🧩 Your Mood Pattern</h3>
            <p style={{ margin: 0, color: "#E8E4DC", fontSize: "20px", lineHeight: "1.6" }}>{weeklyData.pattern}</p>
          </div>

          {/* Tip + Sathi Note */}
          <div style={{ display: "flex", gap: "20px", margin: "30px 0", flexWrap: "wrap" }}>
            <div style={{ backgroundColor: "rgba(168,200,126,0.05)", padding: "30px", borderRadius: "16px", flex: "1", minWidth: "280px", border: "1px dashed rgba(168,200,126,0.3)" }}>
              <h4 style={{ margin: "0 0 15px 0", color: "#A8C87E", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "2px", fontSize: "14px" }}>💡 Actionable Tip</h4>
              <p style={{ margin: 0, fontSize: "20px", color: "#E8E4DC", fontStyle: "italic", lineHeight: "1.5" }}>"{weeklyData.oneTip}"</p>
            </div>
            <div style={{ backgroundColor: "#0A0A0F", padding: "30px", borderRadius: "16px", flex: "1", minWidth: "280px", border: "1px solid rgba(200,169,126,0.2)" }}>
              <h4 style={{ margin: "0 0 15px 0", color: "#C8A97E", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "2px", fontSize: "14px" }}>🤖 Sathi's Note</h4>
              <p style={{ margin: 0, fontSize: "18px", lineHeight: "1.6", color: "#A09A95" }}>{weeklyData.sathiNote}</p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}