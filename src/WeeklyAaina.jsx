import React, { useEffect, useState, useMemo } from "react";
import emailjs from "@emailjs/browser";
import { ChevronLeft, ChevronRight, Mail, RefreshCw, Sparkles, BookOpen, Calendar, ArrowRight, CheckCircle2, Clock } from "lucide-react";

export default function WeeklyAaina({ currentUser, diaryEntries = [], setPage }) {
  const [weekOffset,      setWeekOffset]      = useState(0);
  const [selectedDay,     setSelectedDay]     = useState(null);
  const [aiInsights,      setAiInsights]      = useState({});    // cache AI insights per weekOffset
  const [isGeneratingAi,  setIsGeneratingAi]  = useState(false);
  const [emailStatus,     setEmailStatus]     = useState("idle"); // idle | sending | sent | error

  // ─────────────────────────────────────────
  // 1. CALCULATE 7-DAY RANGE & STRUCTURE
  // ─────────────────────────────────────────
  const { startDate, endDate, dateRangeText, days, stats, validEntriesCount } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - weekOffset * 7);

    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    const startStr = start.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    const endStr   = end.toLocaleDateString("en-IN",   { month: "short", day: "numeric" });
    const rangeText = `${startStr} – ${endStr}`;

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

    // Filter user's diary entries for this 7-day window
    const validDiaries = [];
    (diaryEntries || []).forEach((entry) => {
      let docDate = null;
      if (entry.createdAt?.toDate) {
        docDate = entry.createdAt.toDate();
      } else if (entry.createdAt?.seconds) {
        docDate = new Date(entry.createdAt.seconds * 1000);
      } else if (entry.createdAt) {
        docDate = new Date(entry.createdAt);
      }
      if (docDate && docDate >= start && docDate <= end) {
        validDiaries.push({ ...entry, _dateObj: docDate });
      }
    });

    const daySlots = [];
    let totalScore = 0;
    let logged = 0;
    let bestDayObj = null;
    let toughDayObj = null;
    let maxScore = -Infinity;
    let minScore = Infinity;

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);

      const dayName = d.toLocaleDateString("en-IN", { weekday: "short" });
      const dateNum = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      const fullDateStr = d.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" });

      const matches = validDiaries.filter((e) => {
        const ed = e._dateObj;
        return (
          ed.getFullYear() === d.getFullYear() &&
          ed.getMonth() === d.getMonth() &&
          ed.getDate() === d.getDate()
        );
      });

      if (matches.length > 0) {
        matches.sort((a, b) => b._dateObj - a._dateObj);
        const primary = matches[0];
        const emoji = primary.moodEmoji || "📓";
        const mapped = emojiDataMap[emoji] || { score: 3, label: "Reflective" };
        const score = mapped.score;

        totalScore += score;
        logged++;

        const dayData = {
          day: dayName,
          date: dateNum,
          fullDate: fullDateStr,
          rawDate: d,
          hasEntry: true,
          emoji,
          mood: mapped.label,
          score,
          content: primary.content || "No thoughts logged.",
          entryCount: matches.length,
          entries: matches.map((m) => ({
            id: m.id,
            content: m.content,
            time: m.time || m._dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
            emoji: m.moodEmoji || emoji,
          })),
        };

        daySlots.push(dayData);

        if (score > maxScore) { maxScore = score; bestDayObj = dayData; }
        if (score < minScore) { minScore = score; toughDayObj = dayData; }
      } else {
        daySlots.push({
          day: dayName,
          date: dateNum,
          fullDate: fullDateStr,
          rawDate: d,
          hasEntry: false,
          emoji: "—",
          mood: "Unlogged",
          score: 0,
          content: null,
          entryCount: 0,
          entries: [],
        });
      }
    }

    const avgScore = logged > 0 ? (totalScore / logged).toFixed(1) : "0.0";

    return {
      startDate: start,
      endDate: end,
      dateRangeText: rangeText,
      days: daySlots,
      validEntriesCount: logged,
      stats: {
        totalDays: logged,
        averageScore: avgScore,
        bestDay: bestDayObj ? `${bestDayObj.date} ${bestDayObj.emoji} (${bestDayObj.mood})` : "—",
        toughDay: toughDayObj ? `${toughDayObj.date} ${toughDayObj.emoji} (${toughDayObj.mood})` : "—",
        bestMoment: bestDayObj?.content || null,
      },
    };
  }, [diaryEntries, weekOffset]);

  // Auto-select inspected day whenever week offset changes
  useEffect(() => {
    const firstLogged = days.find((d) => d.hasEntry) || days[days.length - 1];
    setSelectedDay(firstLogged);
  }, [weekOffset, days]);

  // ─────────────────────────────────────────
  // 2. DYNAMIC HEURISTIC & AI INSIGHTS
  // ─────────────────────────────────────────
  const currentAiData = aiInsights[weekOffset];

  const smartInsights = useMemo(() => {
    if (currentAiData) return currentAiData;

    const avg = parseFloat(stats.averageScore);
    const logged = validEntriesCount;

    let pattern = "Your weekly emotional journey is ready to reflect as you log more days in your Midnight Diary.";
    let tip = "Take a deep breath and give yourself grace. Small moments of awareness add up over time.";
    let sathiNote = "Sathi is here with you every single day. Keep sharing what is on your mind.";

    if (logged > 0) {
      if (avg >= 4) {
        pattern = `You had an uplifting 7 days with ${logged} diary ${logged === 1 ? 'entry' : 'entries'}. High energy and moments of calm clearly anchored your thoughts.`;
        tip = "Hold on to what brought you joy this week. Write down the people and habits that made you feel supported.";
        sathiNote = "Seeing your days filled with light makes me genuinely happy. Keep nurturing that peace!";
      } else if (avg >= 3) {
        pattern = `A very human, balanced week across ${logged} ${logged === 1 ? 'check-in' : 'check-ins'}. You experienced normal shifts between productive moments and quieter reflections.`;
        tip = "Maintain your healthy balance. When work or studies pile up, protect at least 30 minutes of unwinding time before sleep.";
        sathiNote = "Balance is a quiet strength. You are handling things with grace, even on the long days.";
      } else {
        pattern = `This period felt emotionally demanding across ${logged} ${logged === 1 ? 'entry' : 'entries'}. You navigated through heavy thoughts and stress.`;
        tip = "When overwhelmed, reduce tomorrow's to-do list to just the single most important task. Rest is productive too.";
        sathiNote = "It takes courage to acknowledge heavy days. You do not have to carry everything alone — I am always here to listen.";
      }
    }

    return {
      pattern,
      oneTip: tip,
      sathiNote,
      isAi: false,
    };
  }, [currentAiData, stats.averageScore, validEntriesCount]);

  // Background fetch for Gemini AI insights (optional enhancement)
  const fetchAiInsights = async (force = false) => {
    if (validEntriesCount === 0 || isGeneratingAi) return;
    if (aiInsights[weekOffset] && !force) return;

    setIsGeneratingAi(true);
    try {
      const loggedDays = days.filter((d) => d.hasEntry);
      const summaryText = loggedDays
        .map((d) => `${d.day} ${d.date} (${d.emoji} ${d.mood}, score ${d.score}/5): ${d.content.slice(0, 130)}`)
        .join(" | ");

      const res = await fetch("https://dapan-api-secure.onrender.com/api/generate-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaryText }),
      });

      if (res.ok) {
        const data = await res.json();
        let raw = "";
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          raw = data.candidates[0].content.parts[0].text.trim();
        } else if (typeof data === "object" && data.moodPattern) {
          raw = JSON.stringify(data);
        }

        if (raw) {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            setAiInsights((prev) => ({
              ...prev,
              [weekOffset]: {
                pattern: parsed.moodPattern || smartInsights.pattern,
                oneTip: parsed.actionableTip || smartInsights.oneTip,
                sathiNote: parsed.sathisNote || smartInsights.sathiNote,
                isAi: true,
              },
            }));
          }
        }
      }
    } catch (err) {
      console.warn("AI insights background sync skipped, using local analysis:", err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Trigger background AI fetch when entries exist
  useEffect(() => {
    if (validEntriesCount > 0 && !aiInsights[weekOffset]) {
      fetchAiInsights(false);
    }
  }, [weekOffset, validEntriesCount]);

  // ─────────────────────────────────────────
  // 3. SEND EMAIL REPORT ON DEMAND
  // ─────────────────────────────────────────
  const handleSendEmailReport = async () => {
    if (!currentUser?.email || validEntriesCount === 0 || emailStatus === "sending") return;
    setEmailStatus("sending");

    const emailGraphStr = days
      .filter((d) => d.hasEntry)
      .map((d) => `${d.date} | ${d.emoji} ${d.mood} | Score: ${d.score}/5`)
      .join("\n");

    try {
      await emailjs.send(
        "service_0bjz9tp",
        "template_4fx97tr",
        {
          to_email: currentUser.email,
          user_name: currentUser.displayName || "there",
          total_days: validEntriesCount,
          average_mood: `${stats.averageScore}/5`,
          emoji_graph: emailGraphStr,
          best_day: stats.bestDay,
          worst_day: stats.toughDay,
          best_moment: stats.bestMoment || "Thoughts logged in diary.",
          pattern: smartInsights.pattern,
          oneTip: smartInsights.oneTip,
          sathi_tip: smartInsights.sathiNote,
        },
        "OEW3zqMBAL7Qg1og0"
      );
      setEmailStatus("sent");
      setTimeout(() => setEmailStatus("idle"), 4000);
    } catch (err) {
      console.error("Manual email send failed:", err);
      setEmailStatus("error");
      setTimeout(() => setEmailStatus("idle"), 3000);
    }
  };

  const greeting = weekOffset === 0
    ? `Hello ${currentUser?.displayName?.split(" ")[0] || "friend"}, here is your real-time reflection.`
    : `Here is your past reflection from ${dateRangeText}.`;

  return (
    <div className="bg-[#06060A] text-[#E8E4DC] pt-28 md:pt-32 pb-24 px-4 sm:px-6 md:px-12 min-h-screen font-serif">
      <div className="max-w-4xl mx-auto animate-fade-in">

        {/* ── TOP NAVIGATION & TIME CONTROLS ── */}
        <div className="flex justify-between items-center mb-6 p-4 sm:p-5 bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-2xl shadow-lg">
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="flex items-center gap-1 sm:gap-2 text-[#C8A97E] hover:text-white transition-colors cursor-pointer font-mono uppercase text-[11px] sm:text-xs tracking-wider"
          >
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Older</span>
          </button>

          <div className="text-center">
            <div className="font-mono text-[10px] sm:text-xs tracking-[0.2em] text-[#A8C87E] uppercase font-semibold">
              {weekOffset === 0 ? "Current 7 Days" : `${weekOffset} Week${weekOffset > 1 ? "s" : ""} Ago`}
            </div>
            <div className="text-base sm:text-lg text-[#E8E4DC] font-bold mt-0.5">{dateRangeText}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchAiInsights(true)}
              disabled={isGeneratingAi || validEntriesCount === 0}
              className="p-2 text-[#8A8580] hover:text-[#C8A97E] transition-colors rounded-full hover:bg-white/5 cursor-pointer disabled:opacity-40"
              title="Regenerate Sathi AI Insights"
            >
              <RefreshCw size={15} className={isGeneratingAi ? "animate-spin text-[#C8A97E]" : ""} />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
              disabled={weekOffset === 0}
              className={`flex items-center gap-1 sm:gap-2 font-mono uppercase text-[11px] sm:text-xs tracking-wider transition-colors ${
                weekOffset === 0 ? "text-[#5A5550] cursor-not-allowed" : "text-[#C8A97E] hover:text-white cursor-pointer"
              }`}
            >
              <span className="hidden sm:inline">Newer</span> <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* ── STATUS BADGES ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 px-1">
          <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full border ${
            smartInsights.isAi
              ? "bg-[#A8C87E]/10 border-[#A8C87E]/30 text-[#A8C87E]"
              : "bg-white/5 border-white/10 text-[#8A8580]"
          }`}>
            <Sparkles size={11} />
            {isGeneratingAi ? "Sathi AI is analyzing…" : smartInsights.isAi ? "Sathi AI Deep Reflection Active" : "Real-time Reflection Active"}
          </span>

          {currentUser?.email && validEntriesCount > 0 && (
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

        {/* ── EMPTY STATE IF ZERO ENTRIES IN THIS WINDOW ── */}
        {validEntriesCount === 0 ? (
          <div className="text-center text-[#A09A95] my-16 bg-[#0A0A0F]/60 border border-white/5 rounded-3xl p-10 sm:p-14">
            <div className="text-5xl mb-4">📓</div>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#E8E4DC] mb-3">No Diary Entries in This 7-Day Window</h2>
            <p className="font-serif text-base sm:text-lg max-w-md mx-auto text-[#A09A95]">
              {weekOffset > 0
                ? "No entries were written during this past week."
                : "Your Mood Canvas updates in real time with each diary entry you write."}
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
            {/* ── HEADER TITLE ── */}
            <div className="text-center mb-8">
              <h1 className="text-4xl sm:text-5xl font-light leading-tight">
                {weekOffset === 0 ? "Your" : "Past"} 7 Days,<br />
                <strong className="text-[#A8C87E] font-bold">Reflected.</strong>
              </h1>
              <p className="text-base sm:text-lg italic mt-3 text-[#A09A95] max-w-xl mx-auto">{greeting}</p>
            </div>

            {/* ── QUICK METRICS ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 my-6">
              {[
                { label: "Avg Mood", value: `${stats.averageScore} / 5`, color: "#A8C87E" },
                { label: "Consistency", value: `${validEntriesCount} / 7 Days`, color: "#7EB8C8" },
                { label: "Best Day", value: stats.bestDay.split(" ")[0] || "—", color: "#E8E4DC" },
                { label: "Tough Day", value: stats.toughDay.split(" ")[0] || "—", color: "#E8E4DC" },
              ].map((m, i) => (
                <div key={i} className="bg-[#0A0A0F]/80 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-white/5">
                  <div className="text-[#8A8580] text-[10px] font-mono uppercase tracking-widest">{m.label}</div>
                  <div className="text-lg sm:text-xl font-bold mt-1.5 truncate" style={{ color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* ── 7-DAY INTERACTIVE MOOD CANVAS CHART ── */}
            <div className="bg-[#0A0A0F]/90 backdrop-blur-xl p-6 sm:p-8 rounded-3xl mb-8 border border-[#C8A97E]/20 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[#A8C87E] font-mono uppercase tracking-widest text-xs sm:text-sm flex items-center gap-2">
                  <span>📊</span> 7-Day Mood Canvas
                </h3>
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#8A8580]">
                  Tap any day to inspect
                </span>
              </div>

              {/* 7 Columns Grid */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-3 items-end h-[220px] pt-4 pb-2">
                {days.map((d, idx) => {
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

            {/* ── DAY INSPECTOR CARD (Shown on tapping any day) ── */}
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
                      You did not write in your diary on this day.
                    </p>
                    {setPage && weekOffset === 0 && (
                      <button
                        type="button"
                        onClick={() => setPage("diary")}
                        className="inline-flex items-center gap-1.5 bg-[#C8A97E]/15 border border-[#C8A97E]/30 text-[#C8A97E] hover:bg-[#C8A97E] hover:text-black px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-semibold transition-all cursor-pointer"
                      >
                        Write Entry <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── BEST MOMENT HIGHLIGHT ── */}
            {stats.bestMoment && stats.bestMoment !== "No specific moments captured." && (
              <div className="bg-[#A8C87E]/5 border border-dashed border-[#A8C87E]/25 rounded-2xl p-6 sm:p-8 mb-8">
                <h3 className="text-[#A8C87E] font-mono uppercase tracking-widest text-xs sm:text-sm mb-2 flex items-center gap-2">
                  <span>✨</span> Best Moment This Week
                </h3>
                <p className="text-[#E8E4DC] text-lg sm:text-xl leading-relaxed italic">"{stats.bestMoment}"</p>
              </div>
            )}

            {/* ── MOOD PATTERN REFLECTION ── */}
            <div className="bg-[#0A0A0F]/80 backdrop-blur-xl p-6 sm:p-8 rounded-2xl mb-8 border border-white/5">
              <h3 className="mb-3 text-[#C8A97E] font-mono uppercase tracking-widest text-xs sm:text-sm flex items-center gap-2">
                <span>🧩</span> Sathi's Weekly Review
              </h3>
              <p className="text-[#E8E4DC] text-base sm:text-lg leading-relaxed whitespace-pre-line">{smartInsights.pattern}</p>
            </div>

            {/* ── ACTIONABLE TIP & SATHI NOTE ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-[#A8C87E]/5 p-6 sm:p-7 rounded-2xl border border-dashed border-[#A8C87E]/30">
                <h4 className="mb-2 text-[#A8C87E] font-mono uppercase tracking-widest text-xs sm:text-sm flex items-center gap-2">
                  <span>💡</span> Actionable Tip
                </h4>
                <p className="text-base sm:text-lg text-[#E8E4DC] italic leading-relaxed whitespace-pre-line">
                  "{smartInsights.oneTip}"
                </p>
              </div>
              <div className="bg-[#0A0A0F]/80 backdrop-blur-xl p-6 sm:p-7 rounded-2xl border border-[#C8A97E]/20">
                <h4 className="mb-2 text-[#C8A97E] font-mono uppercase tracking-widest text-xs sm:text-sm flex items-center gap-2">
                  <span>🤝</span> Sathi's Personal Note
                </h4>
                <p className="text-sm sm:text-base leading-relaxed text-[#A09A95] whitespace-pre-line">
                  {smartInsights.sathiNote}
                </p>
              </div>
            </div>

            {/* ── NAVIGATION FOOTNOTE ── */}
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