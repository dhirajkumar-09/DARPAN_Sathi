import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, Sparkles, Brain, Shield, ArrowRight, Play, Check, LogOut, 
  Send, RefreshCw, Loader2, User, BarChart, Calendar, Lightbulb, TrendingUp,
  Mic, MicOff, Volume2, VolumeX, Star, MessageCircle, X, ChevronLeft, ChevronRight,
  Camera, Mail, BookOpen, Building , Lock, Globe, Trash2 , Share2 ,Heart, Eye, EyeOff
} from "lucide-react";
import emailjs from '@emailjs/browser';
import WeeklyAaina from './WeeklyAaina';
import NotificationBell from './NotificationBell.jsx'; // Extention (.jsx) lagana compulsory hai
// --- FIREBASE IMPORTS ---
import { auth, googleProvider, db ,messaging,storage} from './firebase';
import { updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInWithPopup, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { 
  collection, addDoc, getDocs, query, where, orderBy, serverTimestamp , deleteDoc, doc , updateDoc ,arrayUnion, arrayRemove, onSnapshot, limit, setDoc ,getDoc
} from 'firebase/firestore';
import { getToken } from 'firebase/messaging';

// --- Data Constants ---
const NAV_LINKS = [
  { id: "stories", label: "Stories" },
  { id: "diary", label: "My Diary" },
  { id: "report", label: "Mood Canvas" },
  { id: "chat", label: "Talk to Sathi" }
];

const FadeInSection = ({ children, delay = 0 }) => {
  const [isVisible, setVisible] = useState(false);
  const domRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    if (domRef.current) observer.observe(domRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={domRef}
      className={`transition-all duration-1000 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const CustomCursor = ({ isMobile }) => {
  const cursorRef = useRef(null);
  const dotRef = useRef(null);

  useEffect(() => {
    if (isMobile) return;
    let isHovering = false;
    
    const handleMouse = (e) => {
      if (cursorRef.current && dotRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        
        const ringElement = cursorRef.current.firstChild;
        if (ringElement) {
          if (isHovering) {
             ringElement.style.transform = 'scale(1.8)';
             ringElement.style.backgroundColor = 'rgba(200,169,126,0.1)';
          } else {
             ringElement.style.transform = 'scale(1)';
             ringElement.style.backgroundColor = 'transparent';
          }
        }
      }
    };
    const handleMouseOver = (e) => {
      if (e.target && (e.target.closest('button') || e.target.closest('a') || (e.target.classList && e.target.classList.contains('cursor-pointer')) || e.target.closest('.cursor-pointer'))) {
        isHovering = true;
      }
    };
    const handleMouseOut = () => isHovering = false;

    window.addEventListener("mousemove", handleMouse);
    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    
    return () => {
      window.removeEventListener("mousemove", handleMouse);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
    };
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <>
      <div ref={cursorRef} className="fixed top-0 left-0 z-[99999]" style={{ pointerEvents: 'none' }}>
         <div className="rounded-full border border-[#C8A97E]/60 w-8 h-8 -ml-4 -mt-4 transition-all duration-200 ease-out" style={{ pointerEvents: 'none', animation: "cursorPulse 2s ease-in-out infinite" }} />
      </div>
      <div ref={dotRef} className="fixed top-0 left-0 z-[99999]" style={{ pointerEvents: 'none' }}>
         <div className="rounded-full bg-[#C8A97E] w-2 h-2 -ml-1 -mt-1" style={{ pointerEvents: 'none' }} />
      </div>
    </>
  );
};

const Navbar = ({ currentPage, setPage, isLoggedIn, setIsLoggedIn, profile,notifications = [] }) => {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
      setPage("landing");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <nav className={`fixed top-0 inset-x-0 z-[100] px-6 md:px-12 lg:px-20 h-20 flex items-center justify-between transition-all duration-300 ${
      scrollY > 50 ? "bg-[#06060A]/90 backdrop-blur-md border-b border-[#C8A97E]/10 py-0" : "bg-transparent py-4"
    }`}>
      <div className="font-serif text-2xl font-bold tracking-[0.2em] text-[#E8E4DC] cursor-pointer" onClick={() => setPage(isLoggedIn ? "home" : "landing")}>
        DARP<span className="text-[#C8A97E]">AN</span>
      </div>
      <div className="hidden md:flex items-center gap-8">
        {isLoggedIn ? (
          <>
            {NAV_LINKS.map(link => (
              <button key={link.id} onClick={() => setPage(link.id)}
                className={`font-mono text-[11px] tracking-widest uppercase transition-all duration-300 cursor-pointer ${
                  link.id === "chat" ? "font-bold text-[#C8A97E] bg-[#C8A97E]/10 px-4 py-2 rounded-md hover:bg-[#C8A97E] hover:text-black shadow-[0_0_15px_rgba(200,169,126,0.15)] border border-[#C8A97E]/30"
                  : link.id === "report" ? "font-bold text-[#A8C87E] bg-[#A8C87E]/5 px-4 py-2 rounded-md hover:bg-[#A8C87E] hover:text-black shadow-[0_0_15px_rgba(168,200,126,0.1)] border border-[#A8C87E]/30"
                  : currentPage === link.id ? "text-[#C8A97E]" : "text-[#8A8580] hover:text-[#C8A97E]"
                }`}
              >
                {link.label}
              </button>
            ))}
            
            {/* Yahan se tumhare Profile, Logout aur Bell wala section hai */}
            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              <div onClick={() => setPage("profile")} className="w-8 h-8 rounded-full border border-[#C8A97E]/40 overflow-hidden cursor-pointer hover:border-[#C8A97E] transition-all">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#141419] flex items-center justify-center font-serif font-bold text-xs text-[#C8A97E]">
                    {profile.name ? profile.name.charAt(0).toUpperCase() : "S"}
                  </div>
                )}
              </div>
              <button onClick={handleLogout} className="font-mono flex items-center gap-2 text-[10px] tracking-widest px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-black transition-all duration-300 uppercase cursor-pointer">
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>

              {/* 🔥 YAHAN LAGA HAI BELL ICON 🔥 */}
            {/* 🔥 YAHAN PROP PASS KARO 🔥 */}
            <NotificationBell notifications={notifications} />
              
            </div>
          </>
        ) : (
          currentPage !== "login" && (
            <button onClick={() => setPage("login")} className="font-mono flex items-center gap-2 text-[11px] font-bold tracking-widest px-6 py-2.5 bg-white/5 border border-white/10 text-white hover:border-[#C8A97E] hover:text-[#C8A97E] rounded-lg transition-all duration-300 uppercase cursor-pointer">
               Log In!
            </button>
          )
        )}
      </div>
    </nav>
  );
};
const Footer = () => {
  const [modalContent, setModalContent] = useState(null);
  const googleReportUrl = "https://transparencyreport.google.com/safe-browsing/search?url=https:%2F%2Fdarpan-sathi.vercel.app%2F";

  return (
    <>
      <footer className="py-8 px-6 md:px-12 lg:px-20 border-t border-white/5 bg-[#06060A] relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          
          {/* --- SLEEK INLINE TRUST BADGES --- */}
          <div className="flex flex-wrap justify-center md:justify-center gap-6 md:gap-12 border-b border-white/5 pb-6">
            <div className="flex items-center gap-2 text-[#8A8580]">
              <Lock className="w-4 h-4 text-[#C8A97E]" />
              <span className="font-mono text-[10px] uppercase tracking-widest">256-Bit SSL Secured</span>
            </div>
            
            <a 
              href={googleReportUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 text-[#8A8580] hover:text-[#A8C87E] transition-colors group cursor-pointer"
              title="Verify Google Safety Report"
            >
              <Shield className="w-4 h-4 text-[#A8C87E] group-hover:scale-110 transition-transform" />
              <span className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-1">
                Google Verified <span className="text-[8px] opacity-70">🔗</span>
              </span>
            </a>
            
            <div className="flex items-center gap-2 text-[#8A8580]">
              <Check className="w-4 h-4 text-[#7EB8C8]" />
              <span className="font-mono text-[10px] uppercase tracking-widest">100% Private Data</span>
            </div>
          </div>

          {/* --- BOTTOM LEGAL ROW --- */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="font-serif text-xl font-bold tracking-[0.2em] text-[#E8E4DC]">
              DARP<span className="text-[#C8A97E]/40">AN</span>
            </div>
            <div className="font-mono text-[9px] md:text-[10px] tracking-widest text-[#5A5550] uppercase text-center">
              Made with care for Indian Students · © {new Date().getFullYear()} Darpan
            </div>
            <div className="flex gap-8 font-mono text-[10px] tracking-widest text-[#8A8580] uppercase">
              <button onClick={() => setModalContent('privacy')} className="hover:text-[#C8A97E] transition-colors cursor-pointer font-bold">Privacy Policy</button>
            </div>
          </div>
          
        </div>
      </footer>

      {/* --- PRIVACY MODAL --- */}
      {modalContent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0A0A0F] border border-[#C8A97E]/20 rounded-2xl max-w-md w-full p-8 shadow-2xl relative" style={{ animation: "fadeIn 0.3s ease-out" }}>
            <button onClick={() => setModalContent(null)} className="absolute top-5 right-5 text-[#8A8580] hover:text-[#C8A97E] transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-serif text-2xl text-[#E8E4DC] mb-4">Privacy Policy</h3>
            <div className="font-serif text-[#A09A95] leading-relaxed text-sm overflow-y-auto max-h-[50vh] pr-4 space-y-4 custom-scrollbar">
              <p className="italic text-xs border-b border-[#C8A97E]/20 pb-2">Effective Date: June, 2026</p>
              <div>
                <h4 className="text-[#C8A97E] font-mono uppercase tracking-wider text-xs mb-1">1. Information We Collect</h4>
                <p><strong className="text-[#E8E4DC]">Profile & Content:</strong> Your name, email, Midnight Diary entries, Mood Canvas emojis, and private chats with Sathi.</p>
              </div>
              <div>
                <h4 className="text-[#C8A97E] font-mono uppercase tracking-wider text-xs mb-1">2. How We Use Your Data</h4>
                <p>We use your data strictly to power Darpan's core features. <strong className="text-red-400">We do not and will never sell your personal data.</strong></p>
              </div>
              <div>
                <h4 className="text-[#C8A97E] font-mono uppercase tracking-wider text-xs mb-1">3. Enterprise-Level Security</h4>
                <p><strong className="text-[#E8E4DC]">100% Private:</strong> Your diaries, chats, and private stories are locked cryptographically via Firebase Row-Level Security. No other user can read them.</p>
              </div>
              <div>
                <h4 className="text-[#C8A97E] font-mono uppercase tracking-wider text-xs mb-1">4. Contact</h4>
                <p>For questions, contact the developer:</p>
              </div>
              <div className="bg-[#C8A97E]/5 p-3 rounded-lg border border-[#C8A97E]/30 mt-2">
                <div className="text-[#E8E4DC] text-xs"><strong>Developer:</strong> Dhiraj</div>
                <div className="text-[#E8E4DC] text-xs mt-1"><strong>Email:</strong> darpansathi01@gmail.com</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
const AuthPage = ({ setPage, setIsLoggedIn }) => {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError("Google Login failed: " + err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in min-h-screen flex items-center justify-center pt-20 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(200,169,126,0.03)_0%,transparent_50%)] pointer-events-none" />
      <div className="w-full max-w-md bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-2xl p-8 shadow-[0_0_50px_rgba(200,169,126,0.1)] relative z-10">
        <div className="text-center mb-8">
          <h2 className="font-serif text-4xl font-light text-[#E8E4DC]">Welcome to Darpan</h2>
          <p className="mt-4 font-serif text-[#A09A95] text-sm leading-relaxed">
            Please log in with your Google Account to securely access the platform.
          </p>
        </div>
        <div className="space-y-6">
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-[11px] p-3 rounded text-center">{error}</div>}
          <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full py-4 bg-white text-black font-mono text-xs tracking-widest uppercase font-semibold hover:bg-gray-200 transition-all rounded-lg flex items-center justify-center gap-3 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
            {isLoading ? <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span> : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatPage = ({ messages, setMessages }) => {
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAudioOutputEnabled, setIsAudioOutputEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioSourceRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Text-to-Speech Logic
  const speakText = (text) => {
    if (!isAudioOutputEnabled) return;

    if (!window.speechSynthesis) {
      console.error("Browser does not support Text-to-Speech functionality.");
      return;
    }

    window.speechSynthesis.cancel();

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const bestVoice = voices.find(v => v.lang === 'hi-IN') || voices.find(v => v.lang === 'en-IN');

      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      utterance.rate = 0.9;   
      utterance.pitch = 1.0;  
      utterance.lang = 'hi-IN'; 

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (event) => {
        console.error("Voice synthesis error:", event.error);
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    }, 100); 
  };

  // Speech-to-Text Logic
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Your browser does not support Voice Input. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; 
    recognition.continuous = false; 
    recognition.interimResults = false; 

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Microphone error:", event.error);
      setIsRecording(false);
      if (event.error === 'not-allowed') {
        alert("Microphone access blocked. Please allow microphone permissions in your browser URL bar.");
      }
    };

    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Voice input is not supported in your browser. Please try Chrome or Edge.");
      return;
    }
    if (isRecording) {
      try { recognitionRef.current.stop(); } catch(e) {}
      setIsRecording(false);
    } else {
      if (audioSourceRef.current) audioSourceRef.current.stop();
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Microphone already active", e);
      }
    }
  };

  const playSathiVoice = async (text) => {
    if (!isAudioOutputEnabled) return;
    if (audioSourceRef.current) audioSourceRef.current.stop();
    
    try {
      setIsSpeaking(true);
      const response = await fetch("https://dapan-api-secure.onrender.com/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text })
      });
      const data = await response.json();
      const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      
      if (inlineData) {
        const base64PCM = inlineData.data;
        const binaryString = window.atob(base64PCM);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = audioCtx.createBuffer(1, bytes.buffer.byteLength / 2, 24000);
        const channelData = audioBuffer.getChannelData(0);
        const dataView = new DataView(bytes.buffer);
        for (let i = 0; i < channelData.length; i++) channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
        
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => setIsSpeaking(false);
        
        audioSourceRef.current = source;
        source.start();
      } else {
         setIsSpeaking(false);
      }
    } catch (error) {
      console.error("TTS generation failed:", error);
      setIsSpeaking(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;      

    const currentText  = inputValue.trim();
    const userMessage  = { role: "user", parts: [{ text: currentText }] };
    const newMessages  = [...messages, userMessage];

    setMessages(newMessages);
    setInputValue("");
    setIsTyping(true);

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
      const formattedMessages = [];
      for (const msg of newMessages) {
        const lastMsg = formattedMessages[formattedMessages.length - 1];
        if (lastMsg && lastMsg.role === msg.role) {
          lastMsg.parts[0].text += " | " + msg.parts[0].text;
        } else {
          formattedMessages.push({ role: msg.role, parts: [{ text: msg.parts[0].text }] });
        }
      }

      let finalApiMessages = formattedMessages.slice(-6);
      if (finalApiMessages.length > 0 && finalApiMessages[0].role === "model") {
        finalApiMessages.shift();
      }

      const response = await fetch("https://dapan-api-secure.onrender.com/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: finalApiMessages }) 
      });
      
      const data = await response.json();

      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const botReplyText = data.candidates[0].content.parts[0].text;
        setMessages(prev => [...prev, { role: "model", parts: [{ text: botReplyText }] }]);
        speakText(
          botReplyText.replace(/\*/g, '').replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        );

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
        console.error("Gemini rejected the payload:", data);
        const fallback = "There seems to be a network issue. Could you please say that again?";
        setMessages(prev => [...prev, { role: "model", parts: [{ text: fallback }] }]);
        speakText(fallback);
      }
    } catch (err) {
      console.error("Gemini error:", err);
      setMessages(prev => [...prev, { role: "model", parts: [{ text: "Connection error. Please try again in a minute." }] }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
        role: "model",
        parts: [{ text: "Namaste! I am Sathi. We've started a fresh session. How are you feeling right now?" }]
    }]);
    
    // 🔥 FIX: Stop synthesis on chat clear
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch(e) {}
    }
    setIsSpeaking(false);
  };

  return (
    <div className="animate-fade-in pt-24 pb-8 px-4 md:px-12 lg:px-20 min-h-screen flex flex-col relative overflow-hidden">
       <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute rounded-full blur-[100px] w-[500px] h-[500px] -left-[10%] -top-[10%] bg-[#C8A97E]/20" />
        <div className="absolute rounded-full blur-[100px] w-[400px] h-[400px] right-[-5%] top-[40%] bg-[#7EB8C8]/20" />
      </div>

      <div className="flex-grow w-full max-w-4xl mx-auto flex flex-col z-10 h-[calc(100vh-140px)]">
        <div className="bg-[#0A0A0F]/90 backdrop-blur-xl border border-[#C8A97E]/20 rounded-t-2xl p-6 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C8A97E] to-[#8A724E] flex items-center justify-center shadow-inner relative overflow-hidden">
              <span className="font-serif text-2xl font-bold text-black leading-none pt-1 relative z-10">S</span>
              {isSpeaking && <div className="absolute bottom-0 left-0 w-full bg-black/20 h-full animate-pulse z-0 rounded-full"></div>}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0A0A0F] rounded-full z-20"></div>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#E8E4DC] leading-none mb-1">Sathi</h2>
              <p className="font-mono text-[10px] tracking-widest text-[#A8C87E] uppercase flex items-center gap-2">
                {isSpeaking ? "Speaking aloud..." : "AI Companion"} 
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                  const newState = !isAudioOutputEnabled;
                  setIsAudioOutputEnabled(newState);
                  
                  // 🔥 THE FIX: Properly stop both browser speech and custom API audio
                  if (!newState && window.speechSynthesis) {
                      window.speechSynthesis.cancel();
                  }
                  if (!newState && audioSourceRef.current) {
                      try { audioSourceRef.current.stop(); } catch(e) {}
                  }
                  if (!newState) {
                      setIsSpeaking(false);
                  }
              }}
              className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-2 border transition-colors cursor-pointer ${
                  isAudioOutputEnabled 
                  ? "bg-[#C8A97E]/10 border-[#C8A97E]/30 text-[#C8A97E] hover:bg-[#C8A97E]/20" 
                  : "bg-white/5 border-white/10 text-[#8A8580] hover:bg-white/10"
              }`}
              title={isAudioOutputEnabled ? "Mute Sathi" : "Unmute Sathi"}
            >
              {isAudioOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">Voice Out</span>
            </button>
            <button onClick={clearChat} className="text-[#8A8580] hover:text-[#C8A97E] transition-colors p-2 rounded-full hover:bg-white/5 cursor-pointer ml-2" title="Reset Session">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-grow bg-[#06060A]/60 backdrop-blur-md border-x border-[#C8A97E]/20 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "model" && (
                <div className="w-8 h-8 rounded-full bg-[#141419] border border-[#C8A97E]/30 flex items-center justify-center mr-3 mt-auto shrink-0 shadow-sm relative overflow-hidden">
                  <span className="font-serif text-sm font-bold text-[#C8A97E] relative z-10">S</span>
                  {index === messages.length - 1 && isSpeaking && <div className="absolute bottom-0 w-full bg-[#C8A97E]/30 h-full animate-pulse z-0"></div>}
                </div>
              )}
              
              <div className={`max-w-[80%] md:max-w-[70%] p-4 text-[15px] md:text-[16px] font-serif leading-relaxed shadow-sm ${
                msg.role === "user" 
                  ? "bg-gradient-to-br from-[#C8A97E]/10 to-[#8A724E]/20 border border-[#C8A97E]/40 rounded-2xl rounded-br-sm text-[#E8E4DC]" 
                  : "bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm text-[#C4C0BB]"
              }`}>
                <span dangerouslySetInnerHTML={{ __html: msg.parts[0].text.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-[#1A1A24] border border-white/10 flex items-center justify-center ml-3 mt-auto shrink-0">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
               <div className="w-8 h-8 rounded-full bg-[#141419] border border-[#C8A97E]/30 flex items-center justify-center mr-3 mt-auto shrink-0 shadow-sm">
                  <span className="font-serif text-sm font-bold text-[#C8A97E]">S</span>
                </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm p-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#C8A97E]/40 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-[#C8A97E]/40 animate-pulse delay-150" />
                <div className="w-2 h-2 rounded-full bg-[#C8A97E]/40 animate-pulse delay-300" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-[#0A0A0F]/90 backdrop-blur-xl border border-[#C8A97E]/20 rounded-b-2xl p-4 md:p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`p-3.5 rounded-xl border transition-all duration-300 cursor-pointer shadow-inner shrink-0 ${
                isRecording 
                  ? "bg-red-500/20 border-red-500/50 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]" 
                  : "bg-[#141419] border-white/10 text-[#C8A97E] hover:bg-white/5 hover:border-[#C8A97E]/30"
              }`}
              title={isRecording ? "Listening to your voice..." : "Click to speak"}
            >
              {isRecording ? <Mic className="w-5 h-5 animate-bounce" /> : <MicOff className="w-5 h-5" />}
            </button>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={isRecording ? "Listening carefully..." : "Type your thoughts or use the microphone..."}
              className={`flex-grow bg-[#141419] border rounded-xl py-4 pl-4 pr-14 text-[#E8E4DC] placeholder:text-[#5A5550] font-serif text-[16px] focus:outline-none transition-colors resize-none shadow-inner ${
                  isRecording ? "border-[#C8A97E]/80 border-dashed bg-[#C8A97E]/5" : "border-white/10 focus:border-[#C8A97E]/50"
              }`}
              rows={1}
              style={{ minHeight: '56px', maxHeight: '150px' }}
            />
            
            <button onClick={handleSendMessage} disabled={isTyping || !inputValue.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#C8A97E] text-black p-2.5 rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md">
              {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
const HomePage = ({ setPage, announcement }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("idle");
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Mini-Chat States
  const [miniChatHistory, setMiniChatHistory] = useState([
    { from: "sathi", text: "Hey — how was today? Feel free to speak freely." }
  ]);
  const [miniChatInput, setMiniChatInput] = useState("");
  const [isMiniChatLoading, setIsMiniChatLoading] = useState(false);

  // Smooth Typing States
  const phrases = React.useMemo(() => [ "Speak your mind.", "Find your calm.", "Hear a warm voice.", "Know yourself better." ], []);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(80);

  useEffect(() => {
    let timer;
    const handleTyping = () => {
      const currentFullText = phrases[currentPhraseIndex];
      setCharIndex(prev => isDeleting ? prev - 1 : prev + 1);

      if (!isDeleting && charIndex === currentFullText.length) {
        setTypingSpeed(1500); 
        setIsDeleting(true);
      } else if (isDeleting && charIndex === 0) {
        setIsDeleting(false);
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length); 
        setTypingSpeed(300); 
      } else {
        setTypingSpeed(isDeleting ? 40 : 80); 
      }
    };
    timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer); 
  }, [charIndex, isDeleting, currentPhraseIndex, phrases, typingSpeed]);

  const displayText = phrases[currentPhraseIndex].substring(0, charIndex);

  const handleMiniChatSend = async () => {
    if (!miniChatInput.trim() || isMiniChatLoading) return;
    
    const newMessages = [...miniChatHistory, { from: "user", text: miniChatInput }];
    setMiniChatHistory(newMessages);
    setMiniChatInput(""); 
    setIsMiniChatLoading(true);

    try {
      const geminiFormatMessages = [];
      for (const msg of newMessages) {
        const role = msg.from === "sathi" ? "model" : "user";
        const lastMsg = geminiFormatMessages[geminiFormatMessages.length - 1];
        
        if (lastMsg && lastMsg.role === role) {
          lastMsg.parts[0].text += " | " + msg.text;
        } else {
          geminiFormatMessages.push({ role: role, parts: [{ text: msg.text }] });
        }
      }

      let finalApiMessages = geminiFormatMessages.slice(-6);
      if (finalApiMessages.length > 0 && finalApiMessages[0].role === "model") {
         finalApiMessages.shift();
      }

      const response = await fetch("https://dapan-api-secure.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: finalApiMessages })
      });

      const data = await response.json();

      if (data && data.candidates && data.candidates[0].content) {
        const sathiReply = data.candidates[0].content.parts[0].text;
        setMiniChatHistory((prev) => [...prev, { from: "sathi", text: sathiReply }]);
      } else {
        console.error("Mini Chat Rejected:", data);
        setMiniChatHistory((prev) => [...prev, { from: "sathi", text: "Oops, I didn't quite catch that. Could you say it again?" }]);
      }
    } catch (error) {
      console.error("Mini Chat Error:", error);
      setMiniChatHistory((prev) => [...prev, { from: "sathi", text: "Unable to connect to the server right now. Please try again." }]);
    } finally {
      setIsMiniChatLoading(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!rating && !feedback.trim()) return;
    setFeedbackStatus("submitting");
    try {
      const feedbackData = {
        rating: rating,                    
        comment: feedback,                 
        createdAt: serverTimestamp()       
      };
      if (auth.currentUser) {
        feedbackData.userId = auth.currentUser.uid;
        feedbackData.userName = auth.currentUser.displayName || "Unknown User";
        feedbackData.userEmail = auth.currentUser.email || "No Email";
      } else {
        feedbackData.userId = "anonymous";
      }
      await addDoc(collection(db, "feedbacks"), feedbackData);
      setFeedbackStatus("success");
      setTimeout(() => {
         setFeedbackStatus("idle");
         setRating(0);
         setFeedback("");
         setIsFeedbackModalOpen(false);
      }, 2000);
    } catch (error) {
      console.error("Feedback save error:", error);
      setFeedbackStatus("idle");
    }
  };

  return (
    <div className="animate-fade-in">
      <section className="relative min-h-[90vh] flex flex-col justify-center pt-32 pb-12 px-6 md:px-12 lg:px-20 overflow-hidden">
        {announcement && (
          <div className="max-w-7xl mx-auto w-full mb-10 relative z-10 animate-fade-in px-4 sm:px-0">
            <div className="bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/30 rounded-2xl py-6 px-12 md:px-16 shadow-[0_0_40px_rgba(200,169,126,0.1)] relative overflow-hidden group flex flex-col items-center justify-center text-center">
              
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(200,169,126,0.15)_0%,transparent_70%)] pointer-events-none transition-opacity duration-700 group-hover:opacity-100 opacity-70" />
              
              <div className="relative z-10 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#C8A97E]/10 border border-[#C8A97E]/20 mb-3 shadow-inner">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="font-mono text-[10px] tracking-[0.2em] text-[#C8A97E] uppercase font-bold">
                  Darpan Bulletin
                </span>
              </div>

              <p className="relative z-10 font-serif text-xl md:text-3xl text-[#E8E4DC] leading-relaxed max-w-4xl mx-auto font-medium" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
                {announcement}
              </p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-60">
          {[
            { size: "w-[400px] h-[400px] md:w-[600px] md:h-[600px]", x: "-left-[10%]", y: "top-[-10%]", color: "#C8A97E", delay: "0s" },
            { size: "w-[300px] h-[300px] md:w-[450px] md:h-[450px]", x: "right-[-5%]", y: "top-[15%]", color: "#7EB8C8", delay: "2s" }
          ].map((orb, i) => (
            <div key={i} className={`absolute rounded-full blur-[100px] ${orb.size} ${orb.x} ${orb.y}`} style={{ background: `radial-gradient(circle, ${orb.color}20 0%, transparent 70%)`, animation: `orbFloat 10s ease-in-out infinite`, animationDelay: orb.delay }} />
          ))}
        </div>

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center relative z-10">
          <div className="space-y-8">
            <div className="flex items-center gap-3 font-mono text-[10px] md:text-xs tracking-[0.3em] text-[#C8A97E] uppercase">
              <div className="w-8 h-px bg-[#C8A97E]" />
              AI Voice Companion for Indian Students
            </div>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-[5rem] font-light leading-[1.05] tracking-tight">
              The mirror <br />
              <em className="font-bold text-[#C8A97E] not-italic">your mind</em> <br />
              needs most.
            </h1>
            <p className="font-serif text-lg md:text-xl text-[#A09A95] font-light leading-relaxed max-w-md">
              Darpan is an AI that listens without judgment, finds patterns in your emotions, and helps you finally understand what's going on inside — in your language, for your world.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button onClick={() => setPage("chat")} className="cursor-pointer px-8 py-4 bg-[#C8A97E] text-black font-mono text-xs tracking-widest uppercase font-medium hover:bg-white transition-colors flex items-center justify-center gap-2 group shadow-[0_0_40px_rgba(200,169,126,0.3)] rounded-lg">
                <Volume2 className="w-4 h-4" /> Chat with SATHI<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-[420px]">
            <div className="bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-2xl flex flex-col shadow-2xl overflow-hidden" style={{ animation: "borderGlow 4s ease-in-out infinite" }}>
              
              {/* Widget Header */}
              <div className="flex items-center gap-4 bg-[#141419]/50 p-5 border-b border-[#C8A97E]/10">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#C8A97E] to-[#8A724E] flex items-center justify-center font-serif text-xl font-bold text-black shadow-inner">
                  S
                </div>
                <div>
                  <div className="font-serif text-lg font-semibold tracking-wide flex items-center gap-2 text-[#E8E4DC]">
                    Sathi <Volume2 className="w-4 h-4 text-[#C8A97E] opacity-70" />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#A8C87E] animate-pulse" />
                    <span className="font-mono text-[9px] tracking-widest text-[#8A8580] uppercase">Online</span>
                  </div>
                </div>
              </div>
              
              {/* Chat History */}
              <div className="space-y-4 h-[260px] overflow-y-auto custom-scrollbar p-5">
                {miniChatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`} style={{ animation: `fadeIn 0.4s ease both` }}>
                    <div className={`max-w-[85%] p-4 text-[14px] md:text-[15px] font-serif leading-relaxed flex items-start gap-2 ${msg.from === "user" ? "bg-[#C8A97E]/10 border border-[#C8A97E]/30 rounded-2xl rounded-tr-sm text-[#E8E4DC]" : "bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm text-[#C4C0BB]"}`}>
                      {msg.text.includes("(Voice Message)") ? <Mic className="w-4 h-4 mt-0.5 text-[#C8A97E] shrink-0" /> : null}
                      <span>{msg.text.replace("(Voice Message) ", "")}</span>
                    </div>
                  </div>
                ))}
                
                {isMiniChatLoading && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm text-[#C4C0BB] p-4 text-[14px] flex gap-2 items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#C8A97E]/40 animate-pulse" />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#C8A97E]/40 animate-pulse delay-150" />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#C8A97E]/40 animate-pulse delay-300" />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Widget Input */}
              <div className="bg-[#06060A] p-3 border-t border-[#C8A97E]/20 flex items-center gap-3">
                <input 
                  type="text" 
                  value={miniChatInput}
                  onChange={(e) => setMiniChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleMiniChatSend()}
                  placeholder={`${displayText}|`}
                  className="flex-grow bg-transparent border-none outline-none text-[#E8E4DC] placeholder:text-[#C8A97E]/70 font-mono text-[11px] md:text-xs pl-2"
                  disabled={isMiniChatLoading}
                />
                <button 
                  onClick={handleMiniChatSend} 
                  disabled={isMiniChatLoading || !miniChatInput.trim()} 
                  className="w-9 h-9 rounded-full bg-[#C8A97E]/10 flex items-center justify-center text-[#C8A97E] hover:bg-[#C8A97E] hover:text-black transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Send className="w-4 h-4 -ml-0.5" />
                </button>
              </div>

            </div>
          </div>
        </div>

        <button 
          onClick={() => setIsFeedbackModalOpen(true)} 
          className="fixed bottom-8 right-8 md:bottom-10 md:right-10 z-[100] bg-[#141419] border border-[#C8A97E]/30 text-[#C8A97E] p-4 rounded-full shadow-[0_0_25px_rgba(200,169,126,0.2)] hover:bg-[#C8A97E] hover:text-black transition-all duration-300 cursor-pointer flex items-center justify-center group"
        >
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>

        {isFeedbackModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#0A0A0F] border border-[#C8A97E]/20 rounded-2xl max-w-md w-full p-8 shadow-2xl relative">
              <button onClick={() => setIsFeedbackModalOpen(false)} className="absolute top-5 right-5 text-[#8A8580] hover:text-[#C8A97E] transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-mono text-[11px] tracking-widest text-[#8A8580] uppercase mb-6">Rate Your Experience</h3>
              {feedbackStatus === "success" ? (
                 <div className="flex items-center gap-3 text-[#A8C87E] font-serif py-8 text-lg">
                    <div className="w-10 h-10 rounded-full bg-[#A8C87E]/20 flex items-center justify-center shrink-0"><Check className="w-5 h-5" /></div>
                    Thank you for sharing your thoughts with us.
                 </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-8 h-8 cursor-pointer transition-all duration-200 ${(hoverRating || rating) >= star ? "fill-[#C8A97E] text-[#C8A97E] scale-110" : "text-[#5A5550] hover:text-[#C8A97E]/50"}`} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(star)} />
                    ))}
                  </div>
                  <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Tell us how Darpan makes you feel...and share your suggestions to make it even better." className="w-full bg-[#141419] border border-white/10 rounded-xl p-4 text-[#E8E4DC] placeholder:text-[#5A5550] font-serif text-[16px] focus:outline-none focus:border-[#C8A97E]/50 transition-colors resize-none shadow-inner min-h-[120px] custom-scrollbar" />
                  <button onClick={handleFeedbackSubmit} disabled={(!rating && !feedback.trim()) || feedbackStatus === "submitting"} className="w-full py-4 bg-[#C8A97E] text-black font-mono text-[11px] tracking-widest uppercase font-bold hover:bg-white transition-colors rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(200,169,126,0.2)]">
                    {feedbackStatus === "submitting" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Quick Feedback!"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
const StoriesPage = ({ userStories, setUserStories, profile }) => {
  const [newStory, setNewStory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrivatePost, setIsPrivatePost] = useState(false);
  const [allowCommentsPost, setAllowCommentsPost] = useState(true); 
  
  const [openLikePopupId, setOpenLikePopupId] = useState(null);
  const [openCommentPopupId, setOpenCommentPopupId] = useState(null); 
  const [commentText, setCommentText] = useState(""); 
  const [replyingTo, setReplyingTo] = useState(null); 
  const [blockedUserIds, setBlockedUserIds] = useState([]);
  // 🔥 Tumhara Asli Backend URL
  const BACKEND_URL = "https://dapan-api-secure.onrender.com";

  useEffect(() => {
    const handleClickOutside = () => setOpenLikePopupId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);
   useEffect(() => {
    const fetchBlockedUsers = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, "blockedUsers"),
          where("blockedBy", "==", auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const ids = snapshot.docs.map(doc => doc.data().blockedUserId);
        setBlockedUserIds(ids);
      } catch (error) {
        console.error("Error fetching blocked users:", error);
      }
    };
    fetchBlockedUsers();
  }, []);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newStory.trim() || !auth.currentUser) return;
    setIsSubmitting(true);
    
    try {
      const checkResponse = await fetch(`${BACKEND_URL}/api/save-story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyText: newStory })
      });

      const checkData = await checkResponse.json();

      if (!checkResponse.ok) {
        alert(checkData.error || "Inappropriate words detected!");
        setIsSubmitting(false);
        return;
      }

      const now = new Date();
      const timeString = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const dateString = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      
      const storyData = {
        quote: newStory,
        name: profile?.name || "Student",
        college: profile?.college || "",
        branch: profile?.branch || "",
        initial: profile?.name ? profile.name.charAt(0).toUpperCase() : "S",
        photoURL: profile?.photoURL || null,
        userId: auth.currentUser.uid,
        isPrivate: isPrivatePost,
        showLikesPublicly: false,
        allowComments: allowCommentsPost, 
        displayTime: `${dateString}, ${timeString}`,
        likes: [],
        comments: [], 
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, "stories"), storyData);
      setUserStories([{ id: docRef.id, ...storyData }, ...userStories]);
      setNewStory("");
      setIsPrivatePost(false);
      setAllowCommentsPost(true);
    if (!isPrivatePost) {
        fetch(`${BACKEND_URL}/api/notifications/broadcast-story`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderName: profile?.name || "Student"
          })
        }).catch(err => console.error("Broadcast push failed:", err));
      }
    } catch (error) { 
      console.error("Error saving story:", error); 
      alert("Something went wrong while posting.");
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const togglePrivacy = async (storyId, currentStatus) => {
    try {
      await updateDoc(doc(db, "stories", storyId), { isPrivate: !currentStatus });
      setUserStories(userStories.map(s => s.id === storyId ? { ...s, isPrivate: !currentStatus } : s));
    } catch (error) { console.error("Error updating privacy:", error); }
  };

  const toggleLikesVisibility = async (storyId, currentStatus) => {
    try {
      await updateDoc(doc(db, "stories", storyId), { showLikesPublicly: !currentStatus });
      setUserStories(userStories.map(s => s.id === storyId ? { ...s, showLikesPublicly: !currentStatus } : s));
    } catch (error) { console.error("Error updating likes visibility:", error); }
  };

  const toggleCommentsStatus = async (storyId, currentStatus) => {
    try {
      await updateDoc(doc(db, "stories", storyId), { allowComments: !currentStatus });
      setUserStories(userStories.map(s => s.id === storyId ? { ...s, allowComments: !currentStatus } : s));
    } catch (error) { console.error("Error updating comments status:", error); }
  };

  const deleteStory = async (storyId) => {
    if(!window.confirm("Are you sure you want to delete this story?")) return;
    try {
      await deleteDoc(doc(db, "stories", storyId));
      setUserStories(userStories.filter(s => s.id !== storyId));
    } catch (error) { console.error("Error deleting story:", error); }
  };
   const handleBlockUser = async (targetUserId, targetUserName) => {
    if (!auth.currentUser || targetUserId === auth.currentUser.uid) return;
    if (!window.confirm(`Block ${targetUserName}'s posts? You won't see their stories anymore.`)) return;

    try {
      await addDoc(collection(db, "blockedUsers"), {
        blockedBy: auth.currentUser.uid,
        blockedUserId: targetUserId,
        createdAt: serverTimestamp()
      });
      setBlockedUserIds(prev => [...prev, targetUserId]);
    } catch (error) {
      console.error("Error blocking user:", error);
    }
  };
  // ✅ PERFECTED: Direct Backend Call for Story Likes
  const toggleLike = async (story) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const userName = profile?.name || "Student";
    const userPhoto = profile?.photoURL || null;
    const userCollege = profile?.college ? `${profile.college}, ${profile.branch || ''}` : "";
    
    const currentLikes = story.likes || [];
    const hasLiked = currentLikes.some(like => typeof like === 'string' ? like === uid : like.uid === uid);
    
    let newLikes = [];
    let isLiking = false;

    if (hasLiked) {
       newLikes = currentLikes.filter(like => typeof like === 'string' ? like !== uid : like.uid !== uid);
       isLiking = false;
    } else {
       newLikes = [...currentLikes, { uid: uid, name: userName, photoURL: userPhoto, college: userCollege }];
       isLiking = true;
    }

    try {
      await updateDoc(doc(db, "stories", story.id), { likes: newLikes });
      setUserStories(userStories.map(s => s.id === story.id ? { ...s, likes: newLikes } : s));

      if (isLiking && story.userId !== uid) {
        fetch(`${BACKEND_URL}/api/notifications/like-story`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId: story.id,
            storyOwnerId: story.userId,
            currentUserId: uid,
            currentUserName: userName,
            isLiking: true
          })
        }).catch(err => console.error("Backend push failed:", err));
      }
    } catch (error) { 
      console.error("Error toggling like:", error); 
    }
  };

  // ✅ PERFECTED: Direct Backend Call for Comments
  const handleAddComment = async (story) => {
    if (!auth.currentUser || !commentText.trim()) return;

    const newComment = {
      id: Date.now().toString(), 
      uid: auth.currentUser.uid,
      name: profile?.name || "Student",
      photoURL: profile?.photoURL || null,
      text: commentText.trim(),
      likes: [], 
      replies: [], 
      createdAt: new Date().toISOString()
    };

    try {
      const storyRef = doc(db, "stories", story.id);
      await updateDoc(storyRef, { comments: arrayUnion(newComment) });
      
      setUserStories(userStories.map(s => 
        s.id === story.id ? { ...s, comments: [...(s.comments || []), newComment] } : s
      ));

      if (story.userId !== auth.currentUser.uid) {
        fetch(`${BACKEND_URL}/api/notifications/comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId: story.id,
            storyOwnerId: story.userId,
            currentUserId: auth.currentUser.uid,
            currentUserName: profile?.name || "Student"
          })
        }).catch(err => console.error("Backend push failed:", err));
      }
      
      setCommentText(""); 
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  // ✅ PERFECTED: Direct Backend Call for Replies
  const handleAddReply = async (story, parentCommentId) => {
    if (!auth.currentUser || !commentText.trim()) return;

    const parentComment = (story.comments || []).find(c => c.id === parentCommentId);
    const parentCommentOwnerId = parentComment?.uid;

    const newReply = {
      id: Date.now().toString(),
      uid: auth.currentUser.uid,
      name: profile?.name || "Student",
      photoURL: profile?.photoURL || null,
      text: commentText.trim(),
      createdAt: new Date().toISOString()
    };

    const updatedComments = (story.comments || []).map(comment => {
      if (comment.id === parentCommentId) {
        return { ...comment, replies: [...(comment.replies || []), newReply] };
      }
      return comment;
    });

    setUserStories(userStories.map(s => s.id === story.id ? { ...s, comments: updatedComments } : s));

    try {
      await updateDoc(doc(db, "stories", story.id), { comments: updatedComments });

      if (parentCommentOwnerId && parentCommentOwnerId !== auth.currentUser.uid) {
        fetch(`${BACKEND_URL}/api/notifications/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId: story.id,
            parentCommentOwnerId: parentCommentOwnerId,
            currentUserId: auth.currentUser.uid,
            currentUserName: profile?.name || "Student",
            snippet: commentText.trim()
          })
        }).catch(err => console.error("Backend push failed:", err));
      }

      setCommentText("");
      setReplyingTo(null); 
    } catch (error) {
      console.error("Error adding reply:", error);
    }
  };

  // ✅ PERFECTED: Direct Backend Call for Comment Likes
  const toggleCommentLike = async (story, commentId) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const userName = profile?.name || "Student";

    let isLiking = false;
    let commentOwnerId = null;

    const updatedComments = (story.comments || []).map(comment => {
      if (comment.id === commentId) {
        commentOwnerId = comment.uid;
        const currentLikes = comment.likes || [];
        const hasLiked = currentLikes.includes(uid);
        isLiking = !hasLiked;
        const newLikes = hasLiked ? currentLikes.filter(id => id !== uid) : [...currentLikes, uid]; 
        return { ...comment, likes: newLikes };
      }
      return comment;
    });

    setUserStories(userStories.map(s => s.id === story.id ? { ...s, comments: updatedComments } : s));

    try {
      await updateDoc(doc(db, "stories", story.id), { comments: updatedComments });

      if (isLiking && commentOwnerId && commentOwnerId !== uid) {
        fetch(`${BACKEND_URL}/api/notifications/like-comment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commentId: commentId,
            commentOwnerId: commentOwnerId,
            currentUserId: uid,
            currentUserName: userName,
            isLiking: true
          })
        }).catch(err => console.error("Backend push failed:", err));
      }
    } catch (error) {
      console.error("Error toggling comment like:", error);
    }
  };

  const visibleStories = userStories.filter(t => 
    (!t.isPrivate || t.userId === auth.currentUser?.uid) &&
    !blockedUserIds.includes(t.userId)
  );

  return (
    <div className="animate-fade-in pt-32 pb-20 px-6 md:px-12 lg:px-20 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <FadeInSection>
          <div className="text-center mb-16">
            <div className="font-mono text-xs tracking-[0.3em] text-[#C8A97E] uppercase mb-4">Real Stories</div>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light">
              Their words. <br />
              <em className="font-bold text-[#C8A97E] not-italic">Their lives, changed.</em>
            </h1>
          </div>

          <div className="max-w-3xl mx-auto mb-24 bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-3xl p-6 md:p-10 shadow-[0_0_40px_rgba(200,169,126,0.05)]">
            <h3 className="font-serif text-2xl text-[#E8E4DC] mb-2">Share your journey</h3>
            <p className="font-serif text-[#A09A95] mb-6 text-sm">
              Your story might be exactly what someone else needs to hear today.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <textarea
                rows={6}
                value={newStory}
                onChange={(e) => setNewStory(e.target.value)}
                placeholder={`A safe space to share your thoughts , lessons and little victories.\nWrite freely.....!!\nSomeone might find hope in your story...✨`}
                className="w-full bg-[#141419] border border-white/10 rounded-2xl p-5 text-[#E8E4DC] placeholder:text-[#5A5550] font-serif text-lg md:text-xl focus:outline-none focus:border-[#C8A97E]/50 transition-colors resize-y shadow-inner min-h-[200px]"
              />
              
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsPrivatePost(!isPrivatePost)}
                  className={`font-mono text-[10px] tracking-widest uppercase flex items-center gap-2 px-5 py-3 rounded-xl transition-all border cursor-pointer shadow-sm ${
                    isPrivatePost ? "bg-white/10 border-white/20 text-[#E8E4DC]" : "bg-[#C8A97E]/10 border-[#C8A97E]/30 text-[#C8A97E] hover:bg-[#C8A97E]/20"
                  }`}
                >
                  {isPrivatePost ? <><Lock className="w-4 h-4" /> Keep Private Note</> : <><Globe className="w-4 h-4" /> Share Publicly</>}
                </button>

                {!isPrivatePost && (
                  <button 
                    type="button" 
                    onClick={() => setAllowCommentsPost(!allowCommentsPost)}
                    className={`font-mono text-[10px] tracking-widest uppercase flex items-center gap-2 px-5 py-3 rounded-xl transition-all border cursor-pointer shadow-sm ${
                      !allowCommentsPost ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-[#C8A97E]/10 border-[#C8A97E]/30 text-[#C8A97E] hover:bg-[#C8A97E]/20"
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" /> {allowCommentsPost ? "Comments: ON" : "Comments: OFF"}
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-2 border-t border-white/5">
                <button 
                  type="submit"
                  disabled={isSubmitting || !newStory.trim()}
                  className="px-8 py-3 bg-[#C8A97E] text-black font-mono text-xs tracking-widest uppercase font-bold hover:bg-white transition-colors rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto cursor-pointer shadow-[0_0_20px_rgba(200,169,126,0.2)]"
                >
                  {isSubmitting ? "Posting..." : "Post Story"} <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {visibleStories.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-[#C8A97E]/20 rounded-3xl bg-white/[0.01]">
              <div className="w-20 h-20 mx-auto bg-[#C8A97E]/10 rounded-full flex items-center justify-center mb-6">
                <MessageSquare className="w-10 h-10 text-[#C8A97E]" />
              </div>
              <h3 className="font-serif text-2xl text-[#E8E4DC] mb-2">The canvas is blank</h3>
              <p className="font-serif text-[#A09A95]">Be the first to share your journey and inspire others.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
              {visibleStories.map((t, i) => {
                const isMyPost = t.userId === auth.currentUser?.uid;
                const displayPhoto = isMyPost ? profile?.photoURL : t.photoURL;
                const displayName = isMyPost ? (profile?.name || "Student") : t.name;
                const displayInitial = isMyPost ? (profile?.name ? profile.name.charAt(0).toUpperCase() : "S") : (t.initial || 'S');
                
                const allowsComments = t.allowComments !== false; 

                const quoteLength = t.quote.length;
                let textSizeClass = "text-3xl md:text-4xl lg:text-5xl leading-[1.2]"; 
                if (quoteLength > 180) { textSizeClass = "text-lg md:text-xl lg:text-2xl leading-[1.6]"; } 
                else if (quoteLength > 80) { textSizeClass = "text-2xl md:text-3xl lg:text-4xl leading-[1.4]"; }
                
                return (
                  <div key={t.id || i} className={`relative bg-[#0A0A0F] border rounded-[2rem] p-8 md:p-10 flex flex-col transition-all duration-500 overflow-hidden group ${t.isPrivate ? 'border-white/10 opacity-80' : 'border-[#C8A97E]/30 hover:border-[#C8A97E] hover:shadow-[0_0_40px_rgba(200,169,126,0.1)]'}`}>
                    <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(200,169,126,0.12)_0%,transparent_70%)]" />
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "linear-gradient(#C8A97E 1px, transparent 1px), linear-gradient(90deg, #C8A97E 1px, transparent 1px)", backgroundSize: "30px 30px" }} />

                    <div className="flex items-start justify-between relative z-10 mb-10 border-b border-[#C8A97E]/10 pb-6">
                      <div className="flex items-center gap-5">
                        {displayPhoto ? (
                          <div className="w-14 h-14 rounded-full border-2 border-[#C8A97E]/80 p-0.5 shadow-[0_0_15px_rgba(200,169,126,0.2)]">
                             <img src={displayPhoto} alt={displayName} className="w-full h-full rounded-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-full border-2 border-[#C8A97E]/80 p-0.5 shadow-[0_0_15px_rgba(200,169,126,0.2)] flex items-center justify-center bg-[#141419]">
                            <span className="font-serif text-2xl font-bold text-[#C8A97E]">{displayInitial}</span>
                          </div>
                        )}
                        <div>
                          <div className="font-serif text-2xl font-bold text-white tracking-wide">{displayName}</div>
                          <div className="flex flex-col gap-1 mt-1.5">
                           <span className="font-mono text-[9px] tracking-widest text-[#C8A97E] uppercase">
                             {t.displayTime ? `SHARED ON ${t.displayTime.toUpperCase()}` : "SHARED JUST NOW"}
                           </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {t.isPrivate && <span className="hidden sm:inline-block font-mono text-[9px] uppercase tracking-widest text-[#8A8580] bg-white/5 px-3 py-1.5 rounded-full border border-white/10 mr-2">Private Note</span>}
                        {isMyPost && (
                          <>
                            {!t.isPrivate && (
                              <button onClick={() => toggleLikesVisibility(t.id, t.showLikesPublicly)} className={`p-3 rounded-full border transition-all cursor-pointer ${t.showLikesPublicly ? 'bg-[#C8A97E]/10 border-[#C8A97E]/50 text-[#C8A97E]' : 'bg-[#141419] border-white/10 text-[#8A8580] hover:text-[#C8A97E] hover:border-[#C8A97E]/50'}`} title={t.showLikesPublicly ? "Hide Likers from Others" : "Show Likers to Everyone"}>
                                {t.showLikesPublicly ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                            )}
                            
                            {!t.isPrivate && (
                                <button onClick={() => toggleCommentsStatus(t.id, allowsComments)} className={`p-3 rounded-full border transition-all cursor-pointer ${!allowsComments ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-[#141419] border-white/10 text-[#8A8580] hover:text-[#C8A97E] hover:border-[#C8A97E]/50'}`} title={allowsComments ? "Turn Comments Off" : "Turn Comments On"}>
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                            )}

                            <button onClick={() => togglePrivacy(t.id, t.isPrivate)} className="p-3 rounded-full bg-[#141419] border border-white/10 text-[#8A8580] hover:text-[#C8A97E] hover:border-[#C8A97E]/50 transition-all cursor-pointer" title={t.isPrivate ? "Make Public" : "Make Private"}>
                              {t.isPrivate ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                            </button>
                            <button onClick={() => deleteStory(t.id)} className="p-3 rounded-full bg-[#141419] border border-white/10 text-[#8A8580] hover:text-red-400 hover:border-red-400/50 transition-all cursor-pointer" title="Delete Story">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {!isMyPost && (
                          <button 
                            onClick={() => handleBlockUser(t.userId, displayName)} 
                            className="p-3 rounded-full bg-[#141419] border border-white/10 text-[#8A8580] hover:text-red-400 hover:border-red-400/50 transition-all cursor-pointer" 
                            title="Block this user"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10 px-2 sm:px-8 pb-8">
                      <div className="font-serif text-5xl md:text-6xl text-[#C8A97E] leading-none mb-4">"</div>
                      <p className={`font-serif text-[#E8E4DC] font-light ${textSizeClass}`}>"{t.quote}"</p>
                    </div>

                    <div className="flex items-end justify-between mt-auto pt-6 border-t border-white/5 relative z-10">
                      <div className="font-mono text-[10px] tracking-widest text-[#8A8580] uppercase">
                        {t.college && t.branch ? `${t.branch}, ${t.college}` : 'Darpan Student'}
                      </div>
                      
                      {!t.isPrivate && (
                        <div className="relative flex items-center gap-2">
                          
                          {/* COMMENT BUTTON */}
                          <div className="flex items-center gap-1 bg-white/5 border border-white/10 hover:border-[#C8A97E]/50 hover:bg-[#C8A97E]/10 rounded-full px-3 py-1.5 transition-all">
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setOpenLikePopupId(null);
                                setOpenCommentPopupId(openCommentPopupId === t.id ? null : t.id); 
                                setReplyingTo(null); 
                              }}
                              className="cursor-pointer group outline-none flex items-center justify-center"
                            >
                              <MessageSquare className={`w-4 h-4 transition-transform group-hover:scale-110 text-[#8A8580] group-hover:text-[#C8A97E]`} />
                            </button>
                            <span className="font-mono text-[10px] font-bold ml-1 text-[#8A8580] cursor-pointer" onClick={() => setOpenCommentPopupId(openCommentPopupId === t.id ? null : t.id)}>
                              {t.comments?.length || 0}
                            </span>
                          </div>

                          {/* LIKES BUTTON */}
                          <div className="flex items-center gap-1 bg-white/5 border border-white/10 hover:border-[#C8A97E]/50 hover:bg-[#C8A97E]/10 rounded-full px-3 py-1.5 transition-all">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleLike(t); }}
                              className="cursor-pointer group outline-none flex items-center justify-center"
                            >
                              <Heart className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                                t.likes?.some(like => typeof like === 'string' ? like === auth.currentUser?.uid : like.uid === auth.currentUser?.uid)
                                ? 'fill-[#C8A97E] text-[#C8A97E]'
                                : 'text-[#8A8580] group-hover:text-[#C8A97E]'
                              }`} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenCommentPopupId(null);
                                if (openLikePopupId === t.id) {
                                  setOpenLikePopupId(null);
                                } else if ((isMyPost || t.showLikesPublicly) && t.likes?.length > 0) {
                                  setOpenLikePopupId(t.id);
                                }
                              }}
                              className={`font-mono text-[10px] font-bold ml-1 outline-none transition-all ${
                                ((isMyPost || t.showLikesPublicly) && t.likes?.length > 0) ? 'cursor-pointer hover:underline hover:text-[#C8A97E]' : 'cursor-default'
                              } ${
                                t.likes?.some(like => typeof like === 'string' ? like === auth.currentUser?.uid : like.uid === auth.currentUser?.uid)
                                ? 'text-[#C8A97E]' : 'text-[#8A8580]'
                              }`}
                            >
                              {t.likes?.length || 0}
                            </button>
                          </div>

                          {/* LIKES POPUP */}
                          {openLikePopupId === t.id && (
                            <div 
                              className="absolute bottom-full right-0 mb-3 w-[260px] bg-[#0A0A0F] border border-[#C8A97E]/30 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 animate-fade-in"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex justify-between items-center p-3 border-b border-white/5">
                                <span className="font-serif text-[#C8A97E] text-sm tracking-wide">Liked by {t.likes.length} People</span>
                                <button onClick={() => setOpenLikePopupId(null)} className="text-[#8A8580] hover:text-white cursor-pointer transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
                                {t.likes.map((likeData, idx) => {
                                  const isOldData = typeof likeData === 'string';
                                  const likeUid = isOldData ? likeData : likeData.uid;
                                  
                                  const isMyLike = likeUid === auth.currentUser?.uid;
                                  const likerName = isMyLike ? (profile?.name || "Student") : (isOldData ? "Darpan User" : likeData.name);
                                  const likerPhoto = isMyLike ? profile?.photoURL : (isOldData ? null : likeData.photoURL);
                                  const likerCollege = isMyLike ? (profile?.college ? `${profile.college}, ${profile.branch || ''}` : "") : (isOldData ? "" : likeData.college);

                                  return (
                                    <div key={idx} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors">
                                      {likerPhoto ? (
                                        <img src={likerPhoto} alt={likerName} className="w-8 h-8 rounded-full object-cover border border-[#C8A97E]/30" />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-[#141419] border border-[#C8A97E]/30 flex items-center justify-center shrink-0">
                                          <span className="font-serif text-sm font-bold text-[#C8A97E]">{likerName.charAt(0).toUpperCase()}</span>
                                        </div>
                                      )}
                                      <div className="flex flex-col overflow-hidden">
                                        <span className="font-serif text-[#E8E4DC] text-[15px] leading-tight truncate">{likerName}</span>
                                        {likerCollege && <span className="font-mono text-[9px] text-[#8A8580] uppercase mt-0.5 truncate">{likerCollege}</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="absolute top-full right-6 -mt-[1px] border-[6px] border-transparent border-t-[#C8A97E]/30"></div>
                              <div className="absolute top-full right-6 -mt-[2px] border-[6px] border-transparent border-t-[#0A0A0F]"></div>
                            </div>
                          )}

                          {/* COMMENTS POPUP */}
                          {openCommentPopupId === t.id && (
                            <div 
                              className="absolute bottom-full right-0 mb-3 w-[300px] md:w-[350px] bg-[#0A0A0F] border border-[#C8A97E]/30 rounded-xl shadow-[0_10px_50px_rgba(0,0,0,0.9)] z-50 animate-fade-in flex flex-col"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex justify-between items-center p-4 border-b border-white/5">
                                <span className="font-serif text-[#C8A97E] text-base tracking-wide">Comments ({t.comments?.length || 0})</span>
                                <button onClick={() => setOpenCommentPopupId(null)} className="text-[#8A8580] hover:text-white cursor-pointer transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="max-h-[250px] min-h-[100px] overflow-y-auto custom-scrollbar p-3 flex flex-col gap-3">
                                {!t.comments || t.comments.length === 0 ? (
                                  <div className="text-center font-serif text-[#5A5550] text-sm py-8">
                                    No comments yet. Start the conversation!
                                  </div>
                                ) : (
                                  t.comments.map((comment) => (
                                    <div key={comment.id} className="flex flex-col bg-white/[0.02] p-3 rounded-xl border border-white/[0.02] gap-2">
                                      <div className="flex items-start gap-3">
                                        {comment.photoURL ? (
                                          <img src={comment.photoURL} alt={comment.name} className="w-7 h-7 rounded-full object-cover border border-[#C8A97E]/30 shrink-0" />
                                        ) : (
                                          <div className="w-7 h-7 rounded-full bg-[#141419] border border-[#C8A97E]/30 flex items-center justify-center shrink-0">
                                            <span className="font-serif text-xs font-bold text-[#C8A97E]">{comment.name.charAt(0).toUpperCase()}</span>
                                          </div>
                                        )}
                                        <div className="flex flex-col flex-grow">
                                          <div className="flex items-baseline gap-2 justify-between">
                                            <span className="font-serif text-[#E8E4DC] text-sm font-semibold">{comment.name}</span>
                                          </div>
                                          <span className="font-serif text-[#A09A95] text-[13px] leading-snug mt-0.5 break-words">{comment.text}</span>
                                          
                                          {/* COMMENT INTERACTIONS */}
                                          <div className="flex items-center gap-4 mt-2">
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); toggleCommentLike(t, comment.id); }}
                                              className="flex items-center gap-1 text-[#8A8580] hover:text-[#C8A97E] transition-colors cursor-pointer"
                                            >
                                              <Heart className={`w-3 h-3 ${comment.likes?.includes(auth.currentUser?.uid) ? 'fill-[#C8A97E] text-[#C8A97E]' : ''}`} />
                                              <span className="font-mono text-[9px] font-bold">{comment.likes?.length || ''}</span>
                                            </button>
                                            
                                            {allowsComments && (
                                              <button 
                                                onClick={() => setReplyingTo({ commentId: comment.id, name: comment.name })}
                                                className="font-mono text-[9px] uppercase text-[#8A8580] hover:text-[#C8A97E] font-bold tracking-wider cursor-pointer"
                                              >
                                                Reply
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* REPLIES */}
                                      {comment.replies && comment.replies.map((reply) => (
                                        <div key={reply.id} className="flex items-start gap-2 bg-white/[0.01] p-2 rounded-lg ml-6 border-l border-[#C8A97E]/20 mt-1 pl-3">
                                          {reply.photoURL ? (
                                            <img src={reply.photoURL} alt={reply.name} className="w-5 h-5 rounded-full object-cover border border-[#C8A97E]/20 shrink-0" />
                                          ) : (
                                            <div className="w-5 h-5 rounded-full bg-[#141419] border border-[#C8A97E]/20 flex items-center justify-center shrink-0">
                                              <span className="font-serif text-[10px] font-bold text-[#C8A97E]">{reply.name.charAt(0).toUpperCase()}</span>
                                            </div>
                                          )}
                                          <div className="flex flex-col">
                                            <span className="font-serif text-[#E8E4DC] text-xs font-semibold">{reply.name}</span>
                                            <span className="font-serif text-[#A09A95] text-xs leading-snug mt-0.5 break-words">{reply.text}</span>
                                          </div>
                                        </div>
                                      ))}

                                    </div>
                                  ))
                                )}
                              </div>

                              {allowsComments ? (
                                <div className="border-t border-white/5 bg-[#141419]/50 rounded-b-xl p-3 flex flex-col gap-2">
                                  {replyingTo && (
                                    <div className="flex justify-between items-center bg-[#C8A97E]/10 border border-[#C8A97E]/20 px-2 py-1 rounded-md">
                                      <span className="font-mono text-[9px] text-[#C8A97E] uppercase tracking-wider">Replying to {replyingTo.name}...</span>
                                      <button onClick={() => setReplyingTo(null)} className="text-red-400 hover:text-white"><X className="w-3 h-3" /></button>
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <input 
                                      type="text" 
                                      value={commentText}
                                      onChange={(e) => setCommentText(e.target.value)}
                                      placeholder={replyingTo ? `Write a reply...` : "Add a comment..."}
                                      className="flex-grow bg-[#1A1A24] border border-white/10 rounded-lg px-3 py-2 text-[#E8E4DC] text-sm font-serif focus:outline-none focus:border-[#C8A97E]/50"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && commentText.trim()) {
                                          if (replyingTo) handleAddReply(t, replyingTo.commentId);
                                          else handleAddComment(t);
                                        }
                                      }}
                                    />
                                    <button 
                                      onClick={() => {
                                        if (replyingTo) handleAddReply(t, replyingTo.commentId);
                                        else handleAddComment(t);
                                      }}
                                      disabled={!commentText.trim()}
                                      className="bg-[#C8A97E] text-black p-2 rounded-lg hover:bg-white transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                      <Send className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 border-t border-white/5 bg-red-500/5 rounded-b-xl text-center">
                                  <span className="font-mono text-[10px] text-red-400/80 uppercase tracking-widest">Comments are turned off</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </FadeInSection>
      </div>
    </div>
  );
};
const DiaryCalendar = ({ entries, selectedDate, setSelectedDate }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

    const getFormattedDate = (day) => {
      return new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    };

    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-2xl p-5 shadow-xl mb-8">
        <div className="flex justify-between items-center mb-4">
          <button onClick={prevMonth} className="p-1 hover:text-[#C8A97E] text-[#8A8580] transition-colors cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="font-serif text-[#E8E4DC] text-lg font-bold">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>
          <button onClick={nextMonth} className="p-1 hover:text-[#C8A97E] text-[#8A8580] transition-colors cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="font-mono text-[9px] text-[#8A8580] uppercase">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {blanks.map((_, i) => <div key={`blank-${i}`} className="p-2"></div>)}
          {days.map(day => {
            const formattedDate = getFormattedDate(day);
            
            const currentEntry = entries.find(e => e.date === formattedDate);
            const hasEntry = !!currentEntry;
            const isSelected = selectedDate === formattedDate;
            
            const displayContent = hasEntry ? (currentEntry.moodEmoji || '📝') : day;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : formattedDate)}
                className={`p-2 w-8 h-8 mx-auto rounded-full flex items-center justify-center font-mono transition-all ${
                  isSelected ? "bg-[#C8A97E] text-black font-bold shadow-[0_0_10px_rgba(200,169,126,0.5)] text-xs"
                  : hasEntry ? "bg-[#C8A97E]/20 text-[#C8A97E] border border-[#C8A97E]/40 hover:bg-[#C8A97E]/30 text-lg hover:scale-110" 
                  : "text-[#A09A95] hover:bg-white/5 text-xs"
                }`}
                title={hasEntry ? `Entry: ${formattedDate}` : formattedDate}
              >
                {displayContent}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

const DiaryPage = ({ diaryEntries, setDiaryEntries }) => {
  const [newEntry, setNewEntry] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  
  const todayFormatted = new Date().toLocaleDateString('en-IN', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  const hasWrittenToday = diaryEntries.some(entry => entry.date === todayFormatted);

 const handleDeleteToday = async () => {
    const todayEntry = diaryEntries.find(entry => entry.date === todayFormatted);
    if (todayEntry && todayEntry.id) {
      try {
        await deleteDoc(doc(db, "diaries", todayEntry.id));
        setDiaryEntries(diaryEntries.filter(entry => entry.id !== todayEntry.id));
        if (selectedDate === todayFormatted) setSelectedDate(null);
        
        if (auth.currentUser) {
          localStorage.removeItem(`aaina_date_${auth.currentUser.uid}`);
          localStorage.removeItem(`aaina_data_${auth.currentUser.uid}`);
        }
      } catch (error) {
        console.error("Error deleting today's entry:", error);
      }
    }
  };
const handleSave = async () => {
    if (!newEntry.trim() || !auth.currentUser) return;
    setIsSaving(true);
    
    let moodEmoji = "📝"; 
    
    try {
      const response = await fetch("https://dapan-api-secure.onrender.com/api/generate-emoji", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diaryEntry: newEntry }) 
      });

      if (response.ok) {
        const data = await response.json();
        if (data.emoji) {
          moodEmoji = data.emoji;
          console.log("Emoji found successfully from backend:", moodEmoji);
        }
      } else {
        console.warn("Backend returned status:", response.status);
      }
    } catch (apiError) {
      console.error("BACKEND FETCH ERROR:", apiError);
    }

    try {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      
      const todayFormatted = now.toLocaleDateString('en-IN', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      });
      
      const entryData = {
        content: newEntry,
        date: todayFormatted,
        time: timeString,
        userId: auth.currentUser.uid, 
        moodEmoji: moodEmoji, 
        feedback: "Quick Feedback!", 
        createdAt: serverTimestamp()
      };
  
      await addDoc(collection(db, "diaries"), entryData);
      
      window.dispatchEvent(new Event("diaryUpdated"));
      
      setNewEntry(""); 
      
    } catch (dbError) {
      console.error("FIRESTORE SAVE ERROR:", dbError);
    } finally {
      setIsSaving(false);
    }
  };
  const filteredEntries = selectedDate 
    ? diaryEntries.filter(e => e.date === selectedDate)
    : diaryEntries;

  return (
    <div className="animate-fade-in pt-32 pb-20 px-6 md:px-12 lg:px-20 min-h-screen">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-10">
        <div className="w-full lg:w-2/3 flex flex-col">
          <FadeInSection>
            <div className="mb-8">
              <div className="font-mono text-xs tracking-[0.3em] text-[#C8A97E] uppercase mb-4">Your Safe Space</div>
              <h1 className="font-serif text-4xl md:text-5xl font-light">
                My <em className="font-bold text-[#C8A97E] not-italic">Midnight Diary</em>
              </h1>
              <p className="font-serif text-[#A09A95] text-lg mt-4">
                Write freely. These entries are completely private and stored securely. Unload your thoughts before you sleep.
              </p>
            </div>

            <div className="bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[500px]">
              <div className="bg-[#141419] p-4 border-b border-white/5 flex justify-between items-center">
                <span className="font-mono text-xs text-[#8A8580] uppercase tracking-wider">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                
                {!hasWrittenToday && (
                  <button 
                    onClick={handleSave}
                    disabled={!newEntry.trim() || isSaving}
                    className="text-[#C8A97E] font-mono text-xs tracking-widest uppercase hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} 
                    {isSaving ? "Analyzing Mood..." : "Save Entry"}
                  </button>
                )}
              </div>
              
              {hasWrittenToday ? (
                <div className="flex-grow w-full bg-transparent p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-[#C8A97E]/10 flex items-center justify-center mb-6">
                    <Check className="w-8 h-8 text-[#C8A97E]" />
                  </div>
                  <h3 className="font-serif text-2xl text-[#E8E4DC] mb-2">Today's Page is Full</h3>
                  <p className="font-serif text-[#A09A95] max-w-sm mx-auto mb-8">
                    You have already poured your thoughts for today. Get some deep sleep, Sathi will be here tomorrow night.
                  </p>
                  
                  <button 
                    onClick={handleDeleteToday}
                    className="font-mono text-[10px] tracking-widest text-red-400 border border-red-500/30 px-5 py-2.5 rounded-lg hover:bg-red-500 hover:text-black transition-colors uppercase cursor-pointer"
                  >
                    Mistake? Rewrite Today's Entry
                  </button>
                </div>
              ) : (
                <textarea
                  value={newEntry}
                  onChange={(e) => setNewEntry(e.target.value)}
                  placeholder="Dear Diary, today I felt..."
                  className="flex-grow w-full bg-transparent p-6 text-[#E8E4DC] placeholder:text-[#5A5550] font-serif text-lg leading-relaxed focus:outline-none resize-none custom-scrollbar"
                />
              )}

            </div>
          </FadeInSection>
        </div>

        <div className="w-full lg:w-1/3">
          <FadeInSection delay={200}>
            <DiaryCalendar entries={diaryEntries} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
            
            <h3 className="font-serif text-2xl text-[#E8E4DC] mb-6 border-b border-[#C8A97E]/20 pb-4 flex justify-between items-end">
              <span>{selectedDate ? `Entries for ${selectedDate.split(',')[1]}` : "Past Pages"}</span>
              {selectedDate && (
                <button onClick={() => setSelectedDate(null)} className="font-mono text-[10px] text-[#8A8580] hover:text-[#C8A97E] uppercase transition-colors cursor-pointer mb-1">
                  Clear Filter
                </button>
              )}
            </h3>
            
            <div className="space-y-6 overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
              {filteredEntries.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-[#5A5550] font-serif">
                  {selectedDate ? "No entries found for this date." : "Your diary is empty. \n Take a deep breath and start writing."}
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <div key={entry.id} className="bg-white/[0.02] border border-white/[0.05] p-5 rounded-xl hover:border-[#C8A97E]/30 transition-colors group cursor-default shadow-sm">
                    <div className="flex justify-between items-baseline mb-4 border-b border-white/5 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl bg-white/5 w-10 h-10 rounded-full flex items-center justify-center border border-white/10 group-hover:border-[#C8A97E]/40 transition-colors shadow-sm" title="AI Mood Analysis">
                          {entry.moodEmoji || "📓"}
                        </span>
                        <div className="font-serif text-[#C8A97E] text-lg font-bold">{entry.date}</div>
                      </div>
                      <div className="font-mono text-[10px] text-[#5A5550] tracking-widest">{entry.time}</div>
                    </div>
                    <p className="font-serif text-[#C4C0BB] leading-relaxed whitespace-pre-wrap line-clamp-4 group-hover:line-clamp-none transition-all duration-300">
                      {entry.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </FadeInSection>
        </div>
      </div>
    </div>
  );
};
const ProfilePage = ({ profile, setProfile }) => {
  const [nameInput, setNameInput] = useState(profile.name || "");
  const [collegeInput, setCollegeInput] = useState(profile.college || "");
  const [branchInput, setBranchInput] = useState(profile.branch || "");
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false); 
  
  const [adminNotice, setAdminNotice] = useState("");
  const [isAdminPublishing, setIsAdminPublishing] = useState(false);

  const isWebsiteOwner = profile.email === "dhidna9090@gmail.com"; 

  useEffect(() => {
    const fetchProfileData = async () => {
      if (auth.currentUser) {
        try {
          const userDocRef = doc(db, "users", auth.currentUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const userData = docSnap.data();
            if (userData.name) setNameInput(userData.name);
            if (userData.college) setCollegeInput(userData.college);
            if (userData.branch) setBranchInput(userData.branch);

            setProfile(prev => ({
              ...prev,
              name: userData.name || prev.name,
              college: userData.college || prev.college,
              branch: userData.branch || prev.branch
            }));
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      }
    };
    fetchProfileData();
  }, [setProfile]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setIsSaving(true);
    try {
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      
      await setDoc(userDocRef, {
        name: nameInput,
        college: collegeInput,
        branch: branchInput,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setProfile(prev => ({
        ...prev,
        name: nameInput,
        college: collegeInput,
        branch: branchInput
      }));

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBroadcastNotice = async (e) => {
    e.preventDefault();
    if (!adminNotice.trim() || !isWebsiteOwner) return;
    
    setIsAdminPublishing(true);
    try {
      await addDoc(collection(db, "announcements"), {
        text: adminNotice,
        createdAt: serverTimestamp()
      });
      alert("Broadcast Live! All users can see your message instantly.");
      setAdminNotice("");
    } catch (error) {
      console.error("Failed to broadcast announcement:", error);
      alert("Database error while publishing broadcast.");
    } finally {
      setIsAdminPublishing(false);
    }
  };

  return (
    <div className="animate-fade-in pt-32 pb-20 px-6 md:px-12 lg:px-20 min-h-screen">
      <div className="max-w-3xl mx-auto space-y-12">
        <FadeInSection>
          <div className="text-center mb-12">
            <div className="font-mono text-xs tracking-[0.3em] text-[#C8A97E] uppercase mb-4">Identity Space</div>
            <h1 className="font-serif text-4xl md:text-5xl font-light">
              Your <em className="font-bold text-[#C8A97E] not-italic">Personal Sanctuary</em>
            </h1>
          </div>

          <div className="bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-2xl p-6 md:p-10 shadow-2xl relative">
            <form onSubmit={handleSave} className="space-y-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-32 h-32 rounded-full border-2 border-[#C8A97E]/40 overflow-hidden shadow-xl bg-[#141419] flex items-center justify-center">
                  {profile.photoURL ? (
                    <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-[#5A5550]" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <label className="font-mono text-[10px] tracking-widest text-[#8A8580] uppercase block">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5550]" />
                    <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Enter name" className="w-full bg-[#141419] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-[#E8E4DC] font-serif focus:outline-none focus:border-[#C8A97E]/50 transition-colors shadow-inner" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] tracking-widest text-[#8A8580] uppercase block">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5550]" />
                    <input type="email" value={profile.email || "student@darpan.in"} disabled className="w-full bg-[#06060A]/60 border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-[#5A5550] font-serif cursor-not-allowed shadow-inner" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] tracking-widest text-[#8A8580] uppercase block">Institute / College</label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5550]" />
                    <input type="text" value={collegeInput} onChange={(e) => setCollegeInput(e.target.value)} placeholder="e.g. BCE Bakhtiyarpur" className="w-full bg-[#141419] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-[#E8E4DC] font-serif focus:outline-none focus:border-[#C8A97E]/50 transition-colors shadow-inner" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[10px] tracking-widest text-[#8A8580] uppercase block">Academic Branch</label>
                  <div className="relative">
                    <BookOpen className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5550]" />
                    <input type="text" value={branchInput} onChange={(e) => setBranchInput(e.target.value)} placeholder="e.g. CSE (IoT)" className="w-full bg-[#141419] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-[#E8E4DC] font-serif focus:outline-none focus:border-[#C8A97E]/50 transition-colors shadow-inner" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-white/5 gap-4">
                <div className="font-mono text-[10px] text-[#5A5550] uppercase tracking-widest">
                  {isSaved && <span className="text-[#A8C87E] flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Profile changes saved successfully!</span>}
                </div>
                <button type="submit" disabled={isSaving} className="w-full sm:w-auto px-8 py-3.5 bg-[#C8A97E] text-black font-mono text-xs tracking-widest uppercase font-bold hover:bg-white transition-colors rounded-lg shadow-[0_0_25px_rgba(200,169,126,0.15)] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed">
                  {isSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </FadeInSection>

        {isWebsiteOwner && (
          <FadeInSection delay={150}>
            <div className="bg-[#0A0A0F]/80 backdrop-blur-xl border border-dashed border-[#C8A97E]/40 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
              <div>
                <h3 className="font-serif text-2xl text-[#C8A97E] font-bold">Darpan Broadcast Core</h3>
                <p className="font-serif text-sm text-[#8A8580] mt-1">
                  Send global notifications, system status updates, or wishes directly to every active dashboard.
                </p>
              </div>
              <form onSubmit={handleBroadcastNotice} className="space-y-4">
                <textarea
                  value={adminNotice}
                  onChange={(e) => setAdminNotice(e.target.value)}
                  placeholder="Type system alert, motivational quote, or exam wishes here... (e.g. Best of luck for the mid-sem exams, BCE Bakhtiyarpur squad!)"
                  className="w-full bg-[#141419] border border-white/10 rounded-xl p-4 text-[#E8E4DC] placeholder:text-[#5A5550] font-serif text-base focus:outline-none focus:border-[#C8A97E]/50 transition-colors resize-none shadow-inner min-h-[100px] custom-scrollbar"
                  required
                />
                <button
                  type="submit"
                  disabled={isAdminPublishing || !adminNotice.trim()}
                  className="px-6 py-3 bg-[#C8A97E] text-black font-mono text-xs tracking-widest uppercase font-bold hover:bg-white transition-colors rounded-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer ml-auto shadow-[0_0_15px_rgba(200,169,126,0.2)]"
                >
                  {isAdminPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isAdminPublishing ? "Broadcasting..." : "Transmit Notice"}
                </button>
              </form>
            </div>
          </FadeInSection>
        )}
      </div>
    </div>
  );
};

const LandingPage = ({ setPage }) => {
  return (
    <div className="min-h-screen bg-[#06060A] flex flex-col relative overflow-hidden">
      {/* --- ADVANCED ANIMATED BACKGROUND --- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Subtle moving dot pattern */}
        <div 
          className="absolute inset-0 opacity-[0.04]" 
          style={{ 
            backgroundImage: "radial-gradient(#C8A97E 2px, transparent 2px)", 
            backgroundSize: "40px 40px",
            animation: "pulse 8s ease-in-out infinite" 
          }} 
        />
        
        {/* Deep, slowly moving glowing orbs */}
        <div className="absolute rounded-full blur-[120px] w-[800px] h-[800px] -left-[10%] -top-[20%] bg-gradient-to-br from-[#C8A97E]/10 to-transparent animate-pulse" style={{ animationDuration: '7s' }} />
        <div className="absolute rounded-full blur-[150px] w-[600px] h-[600px] right-[-5%] bottom-[-10%] bg-gradient-to-tl from-[#7EB8C8]/10 to-transparent animate-pulse" style={{ animationDuration: '10s' }} />
      </div>

      {/* --- MAIN CONTAINER --- */}
      <main className="flex-grow flex flex-col justify-center relative z-10 px-6 md:px-10 lg:px-12 xl:px-16 pt-32 pb-16 w-full max-w-[1600px] mx-auto">
        
        {/* --- FLAWLESS FLEXBOX LAYOUT (Left -> Center -> Right) --- */}
        <div className="flex flex-col xl:flex-row items-center justify-between gap-12 w-full">
          
          {/* ================= LEFT COLUMN (Cards) ================= */}
          <div className="w-full xl:w-[28%] flex flex-col gap-8 order-2 xl:order-1">
            
            {/* Card 1: Sathi */}
            <div className="opacity-0 animate-fade-in" style={{ animationDelay: "600ms", animationFillMode: "forwards" }}>
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] hover:border-[#C8A97E]/40 p-8 rounded-3xl flex flex-col gap-5 shadow-2xl hover:shadow-[0_10px_40px_rgba(200,169,126,0.1)] transition-all duration-500 hover:-translate-y-2 group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#C8A97E]/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-[#C8A97E]/10 transition-colors" />
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/[0.03] border border-white/10 group-hover:bg-[#C8A97E]/10 group-hover:border-[#C8A97E]/40 flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-inner">
                  <Mic className="w-6 h-6 text-[#C8A97E]" />
                </div>
                <div className="relative z-10">
                  <h3 className="font-serif text-2xl text-[#E8E4DC] mb-3 group-hover:text-[#C8A97E] transition-colors">Talk to Sathi</h3>
                  <p className="font-serif text-[#A09A95] leading-relaxed text-[16px]">A compassionate voice AI. Speak freely in Hindi or English without any judgment. Your raw thoughts are safe here.</p>
                </div>
              </div>
            </div>

            {/* Card 2: Diary */}
            <div className="opacity-0 animate-fade-in" style={{ animationDelay: "800ms", animationFillMode: "forwards" }}>
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] hover:border-[#E8E4DC]/30 p-8 rounded-3xl flex flex-col gap-5 shadow-2xl hover:shadow-[0_10px_40px_rgba(232,228,220,0.05)] transition-all duration-500 hover:-translate-y-2 group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-white/10 transition-colors" />
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/[0.03] border border-white/10 group-hover:bg-[#E8E4DC]/10 group-hover:border-[#E8E4DC]/40 flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-inner">
                  <BookOpen className="w-6 h-6 text-[#E8E4DC]" />
                </div>
                <div className="relative z-10">
                  <h3 className="font-serif text-2xl text-[#E8E4DC] mb-3 group-hover:text-white transition-colors">Midnight Diary</h3>
                  <p className="font-serif text-[#A09A95] leading-relaxed text-[16px]">A secure digital vault for your thoughts. Unload your mind and reflect deeply before you sleep every night.</p>
                </div>
              </div>
            </div>

          </div>

          {/* ================= CENTER COLUMN (Hero Text & Insight Data) ================= */}
          <div className="w-full xl:w-[44%] flex flex-col items-center text-center px-4 order-1 xl:order-2">
            
            {/* Sparkle Badge */}
            <div 
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#C8A97E]/5 border border-[#C8A97E]/20 mb-10 shadow-[0_0_20px_rgba(200,169,126,0.1)] hover:bg-[#C8A97E]/10 transition-all cursor-default opacity-0 animate-fade-in"
              style={{ animationDelay: "0ms", animationFillMode: "forwards" }}
            >
              <Sparkles className="w-4 h-4 text-[#C8A97E] animate-pulse" />
              <span className="font-mono text-[10px] tracking-[0.25em] text-[#C8A97E] uppercase font-bold">
                Your Safe Digital Space
              </span>
            </div>

            {/* Main Heading */}
            <h1 
              className="font-serif text-6xl md:text-7xl lg:text-8xl font-light leading-[1.1] tracking-tight mb-8 opacity-0 animate-fade-in"
              style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
            >
              Reflect on <br />
              <em className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#C8A97E] via-[#E8E4DC] to-[#C8A97E] not-italic relative inline-block drop-shadow-[0_0_25px_rgba(200,169,126,0.3)] pb-2 mt-2">
                what matters most.
              </em>
            </h1>
            
            {/* Main Description */}
            <p 
              className="font-serif text-lg md:text-xl text-[#A09A95] font-light leading-relaxed max-w-lg mx-auto mb-8 opacity-0 animate-fade-in"
              style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
            >
              A sanctuary where your feelings can be expressed without hesitation. Track your mental well-being, share your untold stories, and speak to an AI companion who truly listens.
            </p>

            {/* Sleek Loneliness Data */}
            <div 
              className="w-full max-w-md mx-auto mb-10 opacity-0 animate-fade-in flex flex-col items-center" 
              style={{ animationDelay: "500ms", animationFillMode: "forwards" }}
            >
              <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#C8A97E]/50 to-transparent mb-5" />
              <p className="font-serif text-[15px] md:text-base text-[#8A8580] leading-relaxed text-center px-4 italic">
                India ranks as the <strong className="text-[#C8A97E] font-medium not-italic">second loneliest country</strong>, with <strong className="text-[#C8A97E] font-medium not-italic">~58% of the population</strong> experiencing loneliness. Darpan is here so you never have to feel alone.
              </p>
              <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#C8A97E]/50 to-transparent mt-5" />
            </div>

            {/* CTA Button & Security Badge */}
            <div className="flex flex-col items-center gap-4 opacity-0 animate-fade-in" style={{ animationDelay: "600ms", animationFillMode: "forwards" }}>
              <button 
                onClick={() => setPage("login")} 
                className="relative px-12 py-5 bg-gradient-to-r from-[#C8A97E] to-[#B3936B] text-black font-mono text-sm tracking-widest uppercase font-bold transition-all duration-500 flex items-center justify-center gap-3 group rounded-xl mx-auto cursor-pointer hover:scale-105 hover:shadow-[0_0_50px_rgba(200,169,126,0.4)] overflow-hidden"
              >
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12" />
                <span className="relative z-10">Get Started!</span> 
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1.5 transition-transform" />
              </button>
              
              {/* Ultra-Minimal Security Badges for Landing Page */}
              <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6 mt-4">
                <div className="flex items-center gap-1.5 text-[#5A5550]">
                  <Lock className="w-3.5 h-3.5 text-[#C8A97E]/70" />
                  <span className="font-mono text-[9px] uppercase tracking-widest">SSL Encrypted</span>
                </div>
                <a 
                  href="https://transparencyreport.google.com/safe-browsing/search?url=https:%2F%2Fdarpan-sathi.vercel.app%2F" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-1.5 text-[#5A5550] hover:text-[#A8C87E] transition-colors cursor-pointer group"
                  title="Verify Google Safety Report"
                >
                  <Shield className="w-3.5 h-3.5 text-[#A8C87E]/70 group-hover:text-[#A8C87E]" />
                  <span className="font-mono text-[9px] uppercase tracking-widest">Google Safe <span className="opacity-60">🔗</span></span>
                </a>
                <div className="flex items-center gap-1.5 text-[#5A5550]">
                  <Check className="w-3.5 h-3.5 text-[#7EB8C8]/70" />
                  <span className="font-mono text-[9px] uppercase tracking-widest">100% Private</span>
                </div>
              </div>
            </div>

          </div>

          {/* ================= RIGHT COLUMN (Cards) ================= */}
          <div className="w-full xl:w-[28%] flex flex-col gap-8 order-3 xl:order-3">
            
            {/* Card 3: Canvas */}
            <div className="opacity-0 animate-fade-in" style={{ animationDelay: "700ms", animationFillMode: "forwards" }}>
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] hover:border-[#A8C87E]/40 p-8 rounded-3xl flex flex-col gap-5 shadow-2xl hover:shadow-[0_10px_40px_rgba(168,200,126,0.1)] transition-all duration-500 hover:-translate-y-2 group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#A8C87E]/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-[#A8C87E]/10 transition-colors" />
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/[0.03] border border-white/10 group-hover:bg-[#A8C87E]/10 group-hover:border-[#A8C87E]/40 flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-inner">
                  <BarChart className="w-6 h-6 text-[#A8C87E]" />
                </div>
                <div className="relative z-10">
                  <h3 className="font-serif text-2xl text-[#E8E4DC] mb-3 group-hover:text-[#A8C87E] transition-colors">Mood Canvas</h3>
                  <p className="font-serif text-[#A09A95] leading-relaxed text-[16px]">Visually track your emotional patterns week over week. Gain deep insights to better understand your mind.</p>
                </div>
              </div>
            </div>

            {/* Card 4: Stories */}
            <div className="opacity-0 animate-fade-in" style={{ animationDelay: "900ms", animationFillMode: "forwards" }}>
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] hover:border-[#7EB8C8]/40 p-8 rounded-3xl flex flex-col gap-5 shadow-2xl hover:shadow-[0_10px_40px_rgba(126,184,200,0.1)] transition-all duration-500 hover:-translate-y-2 group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#7EB8C8]/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-[#7EB8C8]/10 transition-colors" />
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/[0.03] border border-white/10 group-hover:bg-[#7EB8C8]/10 group-hover:border-[#7EB8C8]/40 flex items-center justify-center group-hover:scale-110 transition-all duration-500 shadow-inner">
                  <Globe className="w-6 h-6 text-[#7EB8C8]" />
                </div>
                <div className="relative z-10">
                  <h3 className="font-serif text-2xl text-[#E8E4DC] mb-3 group-hover:text-[#7EB8C8] transition-colors">Real Stories</h3>
                  <p className="font-serif text-[#A09A95] leading-relaxed text-[16px]">Read or share profound life experiences. Find hope and courage in the journeys of others walking similar paths.</p>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* ================= BOTTOM PREMIUM QUOTE SECTION ================= */}
        <div className="mt-28 mb-8 w-full max-w-4xl mx-auto flex flex-col items-center text-center opacity-0 animate-fade-in" style={{ animationDelay: "1200ms", animationFillMode: "forwards" }}>
          
          {/* Elegant fading vertical line */}
          <div className="w-px h-32 bg-gradient-to-b from-transparent via-[#C8A97E]/50 to-transparent mb-12" />
          
          {/* Large Italic Quote */}
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#E8E4DC] font-light leading-snug mb-10 italic opacity-90">
            "The clearest reflection is found in a quiet mind."
          </h2>
          
          {/* Bottom decorative element */}
          <div className="flex items-center gap-6">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#8A8580]/60" />
            <span className="font-mono text-[10px] md:text-xs tracking-[0.4em] text-[#8A8580] uppercase">
              Discover Clarity
            </span>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#8A8580]/60" />
          </div>

        </div>

      </main>

      {/* Keyframes for the button shine effect */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
};
// --- PRIMARY APP ORCHESTRATION ---
export default function App() {
  const [currentPage, setCurrentPage] = useState("landing"); 
  const [isMobile, setIsMobile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [announcement, setAnnouncement] = useState("");
const [realtimeNotifications, setRealtimeNotifications] = useState([]);

useEffect(() => {
    // Database se sabse latest announcement nikalne ka logic
    const fetchBulletin = () => {
      const q = query(
        collection(db, "announcements"), 
        orderBy("createdAt", "desc"), 
        limit(1)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setAnnouncement(snapshot.docs[0].data().text);
        } else {
          setAnnouncement("");
        }
      });

      return unsubscribe;
    };

    const unsub = fetchBulletin();
    return () => unsub();
  }, []);
useEffect(() => {
  if (!isLoggedIn || !auth.currentUser) {
    setRealtimeNotifications([]);
    return;
  }

  const q = query(
    collection(db, "notifications"),
    where("userId", "==", auth.currentUser.uid),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const loadedNotifs = [];
    snapshot.forEach((doc) => {
      loadedNotifs.push({ id: doc.id, ...doc.data() });
    });
    console.log("🔔 Notifications fetched:", loadedNotifs);
    setRealtimeNotifications(loadedNotifs);
  }, (error) => {
    console.error("❌ Error listening to notifications:", error);
  });

  return () => unsubscribe();
}, [isLoggedIn]);
  const [userStories, setUserStories] = useState([]);
  const [diaryEntries, setDiaryEntries] = useState([]);
  
  const [profile, setProfile] = useState({
    name: "Student", email: "", photoURL: null, college: "", branch: ""
  });

  const [chatMessages, setChatMessages] = useState([
    {
      role: "model",
      parts: [{ text: "Namaste! I am Sathi. I am here to listen, whether you want to talk about exams, stress, or just your day. You can type or use the microphone to speak to me in English, Hindi, or Hinglish. How are you feeling right now?" }]
    }
  ]);
// 1. Service Worker Registration (Isse add karo)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((registration) => {
          console.log('Service Worker registered successfully:', registration.scope);
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });
    }
  }, []);
  const requestNotificationPermission = async (user) => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        
        const currentToken = await getToken(messaging, { 
          vapidKey: "BDBEe-7SAS90LwTMU_UoA0aafej2PRiFJfbclGssYNWM0uoajoi2h1TPK_gQdOoh9s7o3fwl-sZs6F2NbR7OG5Q" 
        });

        if (currentToken) {
          console.log("FCM Token Generated:", currentToken);
          
         await setDoc(doc(db, "users", user.uid), {
            fcmToken: currentToken,
            name: user.displayName || "Darpan Student",
            email: user.email
          }, { merge: true }); 
        }
      }
    } catch (error) {
      console.error("Error retrieving token:", error);
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.matchMedia("(max-width: 768px)").matches || 'ontouchstart' in window);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchUserDiaries = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, "diaries"), where("userId", "==", auth.currentUser.uid), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const loadedDiaries = [];
      querySnapshot.forEach((doc) => loadedDiaries.push({ id: doc.id, ...doc.data() }));
      setDiaryEntries(loadedDiaries); 
    } catch (error) { console.error("Failed to fetch user diaries:", error); }
  };

  const fetchUserChats = async () => {
     if (!auth.currentUser) return;
     try {
       const q = query(collection(db, "chats"), where("userId", "==", auth.currentUser.uid), orderBy("createdAt", "asc"));
       const querySnapshot = await getDocs(q);
       const loadedChats = [];
       
       querySnapshot.forEach((doc) => {
         const data = doc.data();
         loadedChats.push({
           role: data.role,
           parts: [{ text: data.text }] 
         });
       });
       
       if (loadedChats.length > 0) setChatMessages(loadedChats); 
     } catch (error) { 
       console.error("Failed to fetch user chats:", error); 
     }
  };

  const fetchPublicStories = async () => {
    try {
      const q = query(collection(db, "stories"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const loadedStories = [];
      snapshot.forEach(doc => loadedStories.push({ id: doc.id, ...doc.data() }));
      setUserStories(loadedStories);
    } catch (error) { console.error("Failed to fetch stories:", error); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async(user) => {
      if (user) {
        setIsLoggedIn(true);
        setProfile(prev => ({
          ...prev,
          name: user.displayName || prev.name,
          email: user.email || prev.email,
          photoURL: user.photoURL || prev.photoURL
        }));

        fetchUserDiaries();
        fetchUserChats();
        fetchPublicStories();
        await requestNotificationPermission(user);
      } else {
        setIsLoggedIn(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!isLoggedIn && currentPage !== "login") setCurrentPage("landing");
    else if (isLoggedIn && (currentPage === "login" || currentPage === "landing")) setCurrentPage("home");
  }, [isLoggedIn, currentPage]);

  const renderPage = () => {
    if (!isLoggedIn) {
      if (currentPage === "login") return <AuthPage setPage={setCurrentPage} setIsLoggedIn={setIsLoggedIn} />;
      return <LandingPage setPage={setCurrentPage} />;
    }
    
    switch(currentPage) {
      case "home": return <HomePage setPage={setCurrentPage} announcement={announcement} />;
      case "stories": return <StoriesPage userStories={userStories} setUserStories={setUserStories} profile={profile} />;
      case "diary": return <DiaryPage diaryEntries={diaryEntries} setDiaryEntries={setDiaryEntries} />;
     case "report": return <WeeklyAaina currentUser={auth.currentUser} />;
      case "chat": return <ChatPage messages={chatMessages} setMessages={setChatMessages} />; 
      case "profile": return <ProfilePage profile={profile} setProfile={setProfile} />;
      default: return <HomePage setPage={setCurrentPage} announcement={announcement} />;
    }
  };

  return (
    <div className={`min-h-screen bg-[#06060A] text-[#E8E4DC] overflow-x-hidden selection:bg-[#C8A97E] selection:text-black ${!isMobile ? "custom-cursor-active" : ""}`}>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,400&family=DM+Mono:wght@300;400;500&display=swap');
        
        body { margin: 0; padding: 0; background-color: #06060A; }
        .font-serif { font-family: 'Cormorant Garamond', serif; }
        .font-mono { font-family: 'DM Mono', monospace; }
        
        .custom-cursor-active, .custom-cursor-active * { cursor: none !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #06060A; }
        ::-webkit-scrollbar-thumb { background: #3a3227; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #C8A97E; }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(200, 169, 126, 0.3); border-radius: 10px; }

        @keyframes orbFloat { 0%, 100% { transform: translateY(0) scale(1) rotate(0deg); } 33% { transform: translateY(-24px) scale(1.04) rotate(2deg); } 66% { transform: translateY(12px) scale(0.97) rotate(-1deg); } }
        @keyframes cursorPulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 0.4; } }
        @keyframes borderGlow { 0%, 100% { border-color: rgba(200,169,126,0.1); } 50% { border-color: rgba(200,169,126,0.4); box-shadow: 0 0 20px rgba(200,169,126,0.05); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
      `}} />

      <CustomCursor isMobile={isMobile} />
      <Navbar currentPage={currentPage} setPage={setCurrentPage} isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} profile={profile} notifications={realtimeNotifications} />
      
      <main className="min-h-screen">
        {renderPage()}
      </main>
      {isLoggedIn && currentPage !== "chat" && <Footer />}
    </div>
  );
}
