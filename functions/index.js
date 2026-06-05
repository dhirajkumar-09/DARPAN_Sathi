const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// Configure Nodemailer with your system email credentials
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "darpansathi01@gmail.com", // Replace with your app's official Gmail
    pass: "nmmk wccf ujnb fzfe"     // Replace with your 16-character App Password
  }
});

// Automated Cron Job: Triggers every Sunday at 09:00 AM
exports.sendWeeklyReport = onSchedule("every sunday 09:00", async (event) => {
  try {
    const usersSnapshot = await db.collection("users").get();
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Rays of Light collection (Motivational quotes)
    const raysOfLightCollection = [
      "Every day is a fresh start. Take a deep breath and begin again.",
      "You are much stronger than you think you are.",
      "Small steps are still progress. Be proud of yourself.",
      "Your mental peace is your biggest wealth. Protect it.",
      "Even the darkest night will end and the sun will rise."
    ];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userEmail = userData.email;
      const userName = userData.displayName || "there";
      const userId = userDoc.id;

      if (!userEmail) continue;

      // Fetch user's diary entries from the last 7 days
      const diariesSnapshot = await db.collection("diaries")
        .where("userId", "==", userId)
        .where("createdAt", ">=", oneWeekAgo)
        .get();

      // Skip if the user did not log anything this week
      if (diariesSnapshot.empty) continue;

      let bestDay = null;
      let worstDay = null;
      let maxMoodScore = -Infinity;
      let minMoodScore = Infinity;
      let totalMoodScore = 0;
      let dailyBreakdownHtml = "";
      
      const totalDaysLogged = diariesSnapshot.size;

      const moodWeight = {
        "excited": 5, "happy": 5, "good": 4, 
        "neutral": 3, 
        "sad": 2, "anxious": 1, "angry": 1
      };

      diariesSnapshot.forEach((doc) => {
        const diary = doc.data();
        const mood = diary.mood ? diary.mood.toLowerCase() : "neutral";
        const currentScore = moodWeight[mood] || 3;
        
        totalMoodScore += currentScore;

        const dateString = diary.createdAt.toDate().toLocaleDateString("en-US", { 
          weekday: "short", month: "short", day: "numeric" 
        });

        if (currentScore > maxMoodScore) {
          maxMoodScore = currentScore;
          bestDay = { date: dateString, mood: diary.mood };
        }
        
        if (currentScore < minMoodScore) {
          minMoodScore = currentScore;
          worstDay = { date: dateString, mood: diary.mood };
        }

        dailyBreakdownHtml += `
          <li style="margin-bottom: 12px; color: #cbd5e1;">
            <strong>${dateString}:</strong> Mood: <em style="color: #C8A97E;">${diary.mood}</em> 
            <br/><span style="font-size: 13px; color: #94a3b8;">"${diary.text || "No text description."}"</span>
          </li>`;
      });

      // Calculate dynamic Sathi's Tip based on average mood score
      const averageScore = totalMoodScore / totalDaysLogged;
      let sathiTip = "";

      if (averageScore >= 4) {
        sathiTip = "You had a largely positive week! Keep up the great habits, stay hydrated, and carry this beautiful energy into the next week.";
      } else if (averageScore >= 3) {
        sathiTip = "This week was quite balanced. Remember to take short breaks, prioritize your sleep, and keep doing things that bring you peace.";
      } else {
        sathiTip = "It looks like this week was a bit heavy for you. Please remember to be gentle with yourself. Take things one day at a time, and do not hesitate to rest.";
      }

      // Select a random quote for Rays of Light
      const randomRayOfLight = raysOfLightCollection[Math.floor(Math.random() * raysOfLightCollection.length)];

      // Premium Dark Gold responsive HTML email template
      const emailContentHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #333; border-radius: 12px; background-color: #141419; color: #e2e8f0;">
          
          <h2 style="color: #C8A97E; text-align: center; border-bottom: 1px solid #C8A97E; padding-bottom: 15px; margin-bottom: 25px;">Darpan Weekly Reflection</h2>
          
          <p style="font-size: 16px;">Hello ${userName},</p>
          <p style="font-size: 15px; color: #cbd5e1;">You logged your emotions for <strong>${totalDaysLogged} day(s)</strong> this week. Here is your personalized emotional summary:</p>
          
          <div style="background-color: #1e1e24; padding: 18px; border-radius: 8px; border: 1px solid #333; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #C8A97E;">🌟 Rays of Light</h3>
            <p style="font-style: italic; color: #cbd5e1; font-size: 15px;">"${randomRayOfLight}"</p>
          </div>

          <div style="background-color: #1e1e24; padding: 18px; border-radius: 8px; border: 1px solid #333; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #C8A97E;">🤖 Sathi's Tip</h3>
            <p style="color: #cbd5e1; font-size: 15px;">${sathiTip}</p>
          </div>
          
          <div style="margin: 25px 0; font-size: 15px;">
            <p><strong>📈 Best Day of the Week:</strong> ${bestDay ? `${bestDay.date} (${bestDay.mood})` : "N/A"}</p>
            <p><strong>📉 Toughest Day of the Week:</strong> ${worstDay ? `${worstDay.date} (${worstDay.mood})` : "N/A"}</p>
          </div>

          <h3 style="color: #C8A97E; border-top: 1px solid #333; padding-top: 20px;">Your Daily Breakdown</h3>
          <ul style="padding-left: 20px; list-style-type: square;">
            ${dailyBreakdownHtml}
          </ul>

          <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 40px; border-top: 1px solid #222; padding-top: 15px;">
            Sent securely by Darpan AI. To configure email settings, update your profile dashboard.
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: '"Darpan AI" <your-system-email@gmail.com>',
        to: userEmail,
        subject: "Your Darpan Weekly Reflection & Sathi's Tip",
        html: emailContentHtml
      });
    }
  } catch (error) {
    console.error("Error during scheduled weekly report job:", error);
  }
});