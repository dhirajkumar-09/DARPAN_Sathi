import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, Timestamp, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import emailjs from "@emailjs/browser";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  // 2. WEEKLY AAINA (With Firestore Sync & Pagination)
  // ─────────────────────────────────────────
  useEffect(() => {
    const generateWeeklyAaina = async () => {
      if (!currentUser) { setLoading(false); return; }
      setLoading(true);

      // Calculate Date Range based on weekOffset
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      endDate.setDate(endDate.getDate() - (weekOffset * 7)); 
      
      const startDate = new Date(endDate);
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(startDate.getDate() - 6); 

      const startStr = startDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      const endStr = endDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      setDateRangeText(`${startStr} - ${endStr}`);

      // 🔥 CREATE UNIQUE FIRESTORE DOC ID FOR THIS WEEK 🔥
      const weekIdentifier = `${startDate.getFullYear()}_${startDate.getMonth() + 1}_${startDate.getDate()}`;
      const weekDocId = `${currentUser.uid}_${weekIdentifier}`;
      const weekDocRef = doc(db, "weekly_reflections", weekDocId);

      const todayString = new Date().toDateString();
      const cacheKeyDate = `aaina_date_${currentUser.uid}_offset_${weekOffset}`;
      const cacheKeyData = `aaina_data_${currentUser.uid}_offset_${weekOffset}`;

      try {
        // 1. CHECK FIRESTORE FOR PAST WEEKS FIRST
        if (weekOffset > 0) {
          const docSnap = await getDoc(weekDocRef);
          if (docSnap.exists()) {
            setWeeklyData(docSnap.data().reportResult);
            setLoading(false);
            return; // Data found in cloud, no need to recalculate!
          }
        } else {
          // For Current Week (offset=0), check local cache to save Gemini API calls for today
          const cachedDate  = localStorage.getItem(cacheKeyDate);
          const cachedData  = localStorage.getItem(cacheKeyData);
          if (cachedDate === todayString && cachedData) {
            setWeeklyData(JSON.parse(cachedData));
            setLoading(false);
            return;
          }
        }

        // 2. FETCH DIARIES IF NO CACHE OR NO FIRESTORE DOC
        const q = query(
          collection(db, "diaries"),
          where("userId",    "==", currentUser.uid),
          where("createdAt", ">=", Timestamp.fromDate(startDate)),
          where("createdAt", "<=", Timestamp.fromDate(endDate))
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) { 
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

        // Default Fallbacks
        let patternText = "Your heart felt a bit of everything this week. A very human, very normal balance.";
        let oneTipText = "Take a deep breath and give yourself some grace. You are doing better than you think.";
        let sathiNoteText = "Life felt a little heavy this week, but I am always here for you, no matter what.";

        // 🔥 GEMINI AI GENERATION 🔥
        try {
          const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
          const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
          
          const summaryText = graphArray.map(d => `${d.day} (${d.emoji}): ${d.text}`).join(" | ");

          const aiResponse = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ 
                  text: `You are Sathi, a deeply warm, empathetic, and observant AI companion for Indian students. Analyze the user's diary entries for this week.
                  Return a pure JSON object with EXACTLY 3 keys (do not wrap in markdown or backticks like \`\`\`json):
                  1. 'moodPattern': Write a comprehensive 7-8 line comprehensive weekly review summarizing how their week or their journey went. Observe their emotional shifts, highlight real situations they faced, and give them heartfelt encouragement.
                  2. 'actionableTip': Write 4-5 lines of highly specific, practical advice tailored directly to the real situations, stress, or thoughts they wrote about in their entries. 
                  3. 'sathisNote': Write 4-5 lines of a sweet, warm closing note from you (Sathi). State what you specifically noticed about their spirit or growth.`
                }]
              },
              contents: [{ role: "user", parts: [{ text: `Here are my entries for this period: ${summaryText}. Provide my unique weekly insights.` }] }]
            })
          });

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
          }
        } catch (aiErr) {
          console.error("🚨 AI Insights failed, using fallbacks:", aiErr);
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

        // SAVE TO LOCAL CACHE
        localStorage.setItem(cacheKeyDate, todayString);
        localStorage.setItem(cacheKeyData, JSON.stringify(reportResult));
        setWeeklyData(reportResult);

        // 🔥 SAVE SECURELY TO FIRESTORE 🔥
        try {
          await setDoc(weekDocRef, {
            userId: currentUser.uid,
            weekOffset: weekOffset,
            startDate: Timestamp.fromDate(startDate),
            endDate: Timestamp.fromDate(endDate),
            reportResult: reportResult,
            lastUpdated: serverTimestamp()
          }, { merge: true });
          console.log(`✅ Week offset ${weekOffset} data securely saved to Firestore!`);
        } catch (fsErr) {
          console.error("🚨 Firestore save error:", fsErr);
        }

        // 🔥 AUTOMATIC SUNDAY EMAIL FOR CURRENT WEEK 🔥
        const userEmail = currentUser.email;
        if (userEmail && weekOffset === 0) {
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
              console.log("Weekly Aaina report sent to email successfully!");
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

    // Jab diary save hogi, tab cache delete hoga taaki live update ho sake
    const handleUpdate = () => {
      console.log("Reloading Aaina data...");
      localStorage.removeItem(`aaina_date_${currentUser.uid}_offset_0`);
      localStorage.removeItem(`aaina_data_${currentUser.uid}_offset_0`);
      generateWeeklyAaina();
    };
    window.addEventListener("diaryUpdated", handleUpdate);
    return () => window.removeEventListener("diaryUpdated", handleUpdate);
    
  }, [currentUser, weekOffset]);

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#06060A", color: "#A8C87E", fontFamily: "'DM Mono', monospace", letterSpacing: "2px" }}>
      ANALYZING {weekOffset > 0 ? "PAST" : "THIS"} WEEK...
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
      <div style={{ maxWidth: "900px", margin: "0 auto", animation: "fadeIn 0.8s ease-out" }}>

        {/* Date Navigation Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", padding: "15px 20px", backgroundColor: "#0A0A0F", border: "1px solid rgba(200,169,126,0.2)", borderRadius: "16px" }}>
          <button 
            onClick={() => setWeekOffset(prev => prev + 1)} 
            style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "transparent", color: "#C8A97E", border: "none", cursor: "pointer", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", fontSize: "12px" }}>
            <ChevronLeft size={16} /> Past Week
          </button>
          
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", letterSpacing: "0.2em", color: "#A8C87E", textTransform: "uppercase" }}>
              {weekOffset === 0 ? "Current Week" : `${weekOffset} Week(s) Ago`}
            </div>
            <div style={{ fontSize: "18px", color: "#E8E4DC", fontWeight: "bold", marginTop: "4px" }}>{dateRangeText}</div>
          </div>

          <button 
            onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))} 
            disabled={weekOffset === 0}
            style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "transparent", color: weekOffset === 0 ? "#5A5550" : "#C8A97E", border: "none", cursor: weekOffset === 0 ? "not-allowed" : "pointer", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", fontSize: "12px" }}>
            Next Week <ChevronRight size={16} />
          </button>
        </div>

        {!weeklyData ? (
          <div style={{ textAlign: "center", color: "#A09A95", marginTop: "100px", fontSize: "22px" }}>
            <div style={{ fontSize: "40px", marginBottom: "20px" }}>📓</div>
            No entries found for this period. Your Darpan journey starts here!
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: "50px" }}>
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
              <p style={{ margin: 0, color: "#E8E4DC", fontSize: "20px", lineHeight: "1.6", whiteSpace: "pre-line" }}>{weeklyData.pattern}</p>
            </div>

            {/* Tip + Sathi Note */}
            <div style={{ display: "flex", gap: "20px", margin: "30px 0", flexWrap: "wrap" }}>
              <div style={{ backgroundColor: "rgba(168,200,126,0.05)", padding: "30px", borderRadius: "16px", flex: "1", minWidth: "280px", border: "1px dashed rgba(168,200,126,0.3)" }}>
                <h4 style={{ margin: "0 0 15px 0", color: "#A8C87E", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "2px", fontSize: "14px" }}>💡 Actionable Tip</h4>
                <p style={{ margin: 0, fontSize: "20px", color: "#E8E4DC", fontStyle: "italic", lineHeight: "1.5", whiteSpace: "pre-line" }}>"{weeklyData.oneTip}"</p>
              </div>
              <div style={{ backgroundColor: "#0A0A0F", padding: "30px", borderRadius: "16px", flex: "1", minWidth: "280px", border: "1px solid rgba(200,169,126,0.2)" }}>
                <h4 style={{ margin: "0 0 15px 0", color: "#C8A97E", fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "2px", fontSize: "14px" }}>🤖 Sathi's Note</h4>
                <p style={{ margin: 0, fontSize: "18px", lineHeight: "1.6", color: "#A09A95", whiteSpace: "pre-line" }}>{weeklyData.sathiNote}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}