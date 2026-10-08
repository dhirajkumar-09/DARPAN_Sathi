const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "darpansathi01@gmail.com",
    pass: "nmmk wccf ujnb fzfe"
  }
});

// ═══════════════════════════════════════════════════════════════
// HELPER: Send FCM push notifications to a list of FCM tokens
// ═══════════════════════════════════════════════════════════════
async function sendPushNotifications(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) return;

  // FCM allows max 500 tokens per multicast batch
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    const message = {
      notification: { title, body },
      data: { ...data, click_action: "FLUTTER_NOTIFICATION_CLICK" },
      webpush: {
        notification: {
          title,
          body,
          icon: "/logo2.png",
          badge: "/logo2.png",
          vibrate: [200, 100, 200],
          requireInteraction: false,
        },
        fcmOptions: { link: "https://darpan-sathi.vercel.app/" }
      },
      tokens: chunk,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`✅ Push sent: ${response.successCount} success, ${response.failureCount} failures`);

      // Remove invalid / expired tokens automatically
      const staleTokens = [];
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const code = res.error?.code;
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            staleTokens.push(chunk[idx]);
          }
        }
      });

      if (staleTokens.length > 0) {
        console.log(`🗑️ Removing ${staleTokens.length} stale token(s)...`);
        const snapshot = await db.collection("users")
          .where("fcmTokens", "array-contains-any", staleTokens)
          .get();

        const batch = db.batch();
        snapshot.forEach(docSnap => {
          const currentTokens = docSnap.data().fcmTokens || [];
          const cleanedTokens = currentTokens.filter(t => !staleTokens.includes(t));
          batch.update(docSnap.ref, { fcmTokens: cleanedTokens });
        });
        await batch.commit();
      }
    } catch (err) {
      console.error("❌ FCM send error:", err);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Collect FCM tokens from all users, excluding blocked ones
// ═══════════════════════════════════════════════════════════════
async function getAllTokensExcludingBlocked(senderUid) {
  const usersSnap = await db.collection("users").get();

  // Fetch who has blocked the sender
  const blockedSnap = await db.collection("blockedUsers")
    .where("blockedUserId", "==", senderUid)
    .get();
  const blockerUids = new Set(blockedSnap.docs.map(d => d.data().blockedBy));

  // Also fetch whom the sender has blocked
  const senderBlockedSnap = await db.collection("blockedUsers")
    .where("blockedBy", "==", senderUid)
    .get();
  const senderBlockedUids = new Set(senderBlockedSnap.docs.map(d => d.data().blockedUserId));

  const tokens = [];
  usersSnap.forEach(userDoc => {
    const uid = userDoc.id;
    // Skip: the sender themselves, anyone who blocked sender, anyone sender blocked
    if (uid === senderUid) return;
    if (blockerUids.has(uid)) return;
    if (senderBlockedUids.has(uid)) return;

    const userTokens = userDoc.data().fcmTokens || [];
    tokens.push(...userTokens);
  });

  return [...new Set(tokens)]; // deduplicate
}

// ═══════════════════════════════════════════════════════════════
// CLOUD FUNCTION 1: New Public Story → Broadcast push to everyone
// Trigger: when a new document is created in "stories" collection
// ═══════════════════════════════════════════════════════════════
exports.onNewStory = onDocumentCreated("stories/{storyId}", async (event) => {
  const story = event.data.data();
  if (!story) return;

  // Only notify for public stories
  if (story.isPrivate === true) {
    console.log("Private story posted, skipping broadcast.");
    return;
  }

  const senderUid = story.userId;
  const senderName = story.name || "A DARPAN student";
  const preview = story.quote
    ? (story.quote.length > 80 ? story.quote.slice(0, 80) + "…" : story.quote)
    : "";

  console.log(`📢 New public story by ${senderName} (${senderUid}). Broadcasting push...`);

  // Write an in-app Firestore notification for all users (non-blocked) too
  const tokens = await getAllTokensExcludingBlocked(senderUid);

  if (tokens.length === 0) {
    console.log("No eligible push tokens found. Skipping.");
    return;
  }

  await sendPushNotifications(
    tokens,
    `📖 New Story by ${senderName}`,
    preview || "Someone shared their experience on DARPAN. Come read it!",
    { type: "new_story", storyId: event.params.storyId, senderUid }
  );
});

// ═══════════════════════════════════════════════════════════════
// CLOUD FUNCTION 2: Reaction (Heart/Like) on a story
// Trigger: when "stories/{storyId}" document is updated
// We detect a new like by comparing before/after likes array length
// ═══════════════════════════════════════════════════════════════
exports.onStoryReaction = onDocumentUpdated("stories/{storyId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!before || !after) return;

  const beforeLikes = before.likes || [];
  const afterLikes = after.likes || [];

  // Only act if someone added a new like (not removed)
  if (afterLikes.length <= beforeLikes.length) return;

  // Find the new like entry
  const beforeUids = new Set(beforeLikes.map(l => (typeof l === "string" ? l : l.uid)));
  const newLike = afterLikes.find(l => {
    const uid = typeof l === "string" ? l : l.uid;
    return !beforeUids.has(uid);
  });

  if (!newLike) return;

  const reactorUid = typeof newLike === "string" ? newLike : newLike.uid;
  const reactorName = typeof newLike === "string" ? "Someone" : (newLike.name || "Someone");
  const storyOwnerId = after.userId;

  // Don't notify if they reacted to their own story
  if (reactorUid === storyOwnerId) return;

  console.log(`❤️ ${reactorName} reacted to story ${event.params.storyId}. Notifying owner ${storyOwnerId}...`);

  // Get the story owner's FCM tokens
  const ownerDoc = await db.collection("users").doc(storyOwnerId).get();
  if (!ownerDoc.exists) {
    console.log("Story owner user doc not found.");
    return;
  }

  const ownerTokens = ownerDoc.data().fcmTokens || [];
  if (ownerTokens.length === 0) {
    console.log("Story owner has no FCM tokens. Skipping push.");
    return;
  }

  // Check if the reactor is blocked by the owner
  const blockCheck = await db.collection("blockedUsers")
    .where("blockedBy", "==", storyOwnerId)
    .where("blockedUserId", "==", reactorUid)
    .get();

  if (!blockCheck.empty) {
    console.log("Reactor is blocked by story owner. Skipping notification.");
    return;
  }

  const storyPreview = after.quote
    ? (after.quote.length > 50 ? after.quote.slice(0, 50) + "…" : after.quote)
    : "your story";

  await sendPushNotifications(
    ownerTokens,
    `❤️ ${reactorName} reacted to your story!`,
    `"${storyPreview}"`,
    { type: "reaction", storyId: event.params.storyId, reactorUid }
  );

  // Also write an in-app Firestore notification for the story owner
  try {
    await db.collection("notifications").add({
      userId: storyOwnerId,
      type: "reaction",
      message: `❤️ ${reactorName} reacted to your story: "${storyPreview}"`,
      storyId: event.params.storyId,
      reactorUid,
      reactorName,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Error writing in-app notification:", err);
  }
});

// ═══════════════════════════════════════════════════════════════
// CLOUD FUNCTION 3: Automated Weekly Report Email (unchanged)
// ═══════════════════════════════════════════════════════════════
exports.sendWeeklyReport = onSchedule("every sunday 09:00", async (event) => {
  try {
    const usersSnapshot = await db.collection("users").get();
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

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

      const diariesSnapshot = await db.collection("diaries")
        .where("userId", "==", userId)
        .where("createdAt", ">=", oneWeekAgo)
        .get();

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

      const averageScore = totalMoodScore / totalDaysLogged;
      let sathiTip = "";

      if (averageScore >= 4) {
        sathiTip = "You had a largely positive week! Keep up the great habits, stay hydrated, and carry this beautiful energy into the next week.";
      } else if (averageScore >= 3) {
        sathiTip = "This week was quite balanced. Remember to take short breaks, prioritize your sleep, and keep doing things that bring you peace.";
      } else {
        sathiTip = "It looks like this week was a bit heavy for you. Please remember to be gentle with yourself. Take things one day at a time, and do not hesitate to rest.";
      }

      const randomRayOfLight = raysOfLightCollection[Math.floor(Math.random() * raysOfLightCollection.length)];

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
        from: '"Darpan AI" <darpansathi01@gmail.com>',
        to: userEmail,
        subject: "Your Darpan Weekly Reflection & Sathi's Tip",
        html: emailContentHtml
      });
    }
  } catch (error) {
    console.error("Error during scheduled weekly report job:", error);
  }
});