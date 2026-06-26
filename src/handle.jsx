const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;      // ← double-send guard

    const currentText  = inputValue.trim();
    const userMessage  = { role: "user", parts: [{ text: currentText }] };
    const newMessages  = [...messages, userMessage];

    setMessages(newMessages);
    setInputValue("");
    setIsTyping(true);

    // Save user message to Firestore
    if (auth.currentUser) {
      try {
        await addDoc(collection(db, "chats"), {
          text:      currentText,
          role:      "user",
          userId:    auth.currentUser.uid,
          userName:  auth.currentUser.displayName || "Unknown User",
          userEmail: auth.currentUser.email || "No Email",
          createdAt: serverTimestamp(),
        });
      } catch (err) { console.error("Error saving user message:", err); }
    }

    try {
      // Strip leading model message if present (Gemini requires user first)
      let apiMessages = [...newMessages];
      if (apiMessages.length > 0 && apiMessages[0].role === "model") {
        apiMessages = apiMessages.slice(1);
      }

      const response = await fetch(GEMINI_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: SATHI_SYSTEM_INSTRUCTION, contents: apiMessages }),
      });

      const data = await response.json();

      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const botReplyText = data.candidates[0].content.parts[0].text;

        // Append bot reply ONCE
        setMessages(prev => [...prev, { role: "model", parts: [{ text: botReplyText }] }]);

        // Speak (strip markdown & emoji)
        speakText(
          botReplyText
            .replace(/\*/g, '')
            .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        );

        // Save AI reply to Firestore
        if (auth.currentUser) {
          try {
            await addDoc(collection(db, "chats"), {
              text:      botReplyText,
              role:      "model",
              userId:    auth.currentUser.uid,
              createdAt: serverTimestamp(),
            });
          } catch (err) { console.error("Error saving AI message:", err); }
        }
      } else {
        const fallback = "I'm sorry, I didn't quite catch that. Could you share it again?";
        setMessages(prev => [...prev, { role: "model", parts: [{ text: fallback }] }]);
        speakText(fallback);
      }
    } catch (err) {
      console.error("Gemini error:", err);
      setMessages(prev => [...prev, { role: "model", parts: [{ text: "There seems to be a connection issue. Please try again in a moment." }] }]);
    } finally {
      setIsTyping(false);
    }
  };