import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, Sparkles, Brain, Shield, ArrowRight, Play, Check, LogOut, 
  Send, RefreshCw, Loader2, User, BarChart, Calendar, Lightbulb, TrendingUp,
  Mic, MicOff, Volume2, VolumeX, Star, MessageCircle, X, ChevronLeft, ChevronRight,
  Camera, Mail, BookOpen, Building , Lock, Globe, Trash2 , Share2 ,Heart, Eye, EyeOff, Menu, Copy, Search
} from "lucide-react";
import emailjs from '@emailjs/browser';
import WeeklyAaina from './WeeklyAaina';
import NotificationBell from './NotificationBell.jsx';
import DarpanMirror3D from './DarpanMirror3D.jsx'; // Extention (.jsx) lagana compulsory hai
// --- FIREBASE IMPORTS ---
import { auth, googleProvider, db ,messaging,storage} from './firebase';
import { updateProfile } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInWithPopup, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { 
  collection, addDoc, getDocs, query, where, orderBy, serverTimestamp , deleteDoc, doc , updateDoc ,arrayUnion, arrayRemove, onSnapshot, limit, setDoc ,getDoc
} from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';

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
        cursorRef.current.style.opacity = '1';
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        dotRef.current.style.opacity = '1';
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        
        const ringElement = cursorRef.current.firstChild;
        if (ringElement) {
          if (isHovering) {
             ringElement.style.transform = 'scale(1.8)';
             ringElement.style.backgroundColor = 'rgba(200,169,126,0.15)';
             ringElement.style.borderColor = 'rgba(200,169,126,0.9)';
          } else {
             ringElement.style.transform = 'scale(1)';
             ringElement.style.backgroundColor = 'transparent';
             ringElement.style.borderColor = 'rgba(200,169,126,0.6)';
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
    const handleMouseLeave = () => {
      if (cursorRef.current && dotRef.current) {
        cursorRef.current.style.opacity = '0';
        dotRef.current.style.opacity = '0';
      }
    };
    const handleMouseEnter = () => {
      if (cursorRef.current && dotRef.current) {
        cursorRef.current.style.opacity = '1';
        dotRef.current.style.opacity = '1';
      }
    };

    window.addEventListener("mousemove", handleMouse);
    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);
    
    return () => {
      window.removeEventListener("mousemove", handleMouse);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <>
      <div ref={cursorRef} className="fixed top-0 left-0 z-[99999] opacity-0 transition-opacity duration-150" style={{ pointerEvents: 'none' }}>
         <div className="rounded-full border border-[#C8A97E]/60 w-8 h-8 -ml-4 -mt-4 transition-all duration-200 ease-out" style={{ pointerEvents: 'none', animation: "cursorPulse 2s ease-in-out infinite" }} />
      </div>
      <div ref={dotRef} className="fixed top-0 left-0 z-[99999] opacity-0 transition-opacity duration-150" style={{ pointerEvents: 'none' }}>
         <div className="rounded-full bg-[#C8A97E] w-2 h-2 -ml-1 -mt-1 shadow-[0_0_8px_rgba(200,169,126,0.8)]" style={{ pointerEvents: 'none' }} />
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// ─── Foreground FCM Push Toast — WhatsApp-style slide-in notification ───
// Shows when app IS open and receives a push (OS can't show it then)
// ─────────────────────────────────────────────────────────────
const ForegroundPushToast = ({ toast, onDismiss }) => {
  if (!toast) return null;
  return (
    <div
      className="fixed top-5 right-4 z-[99998] max-w-[340px] w-full"
      style={{ animation: 'slideInFromRight 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
    >
      <style>{`
        @keyframes slideInFromRight {
          from { opacity: 0; transform: translateX(120%); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div className="relative flex items-start gap-3 p-4 rounded-2xl border border-[#C8A97E]/30 shadow-2xl backdrop-blur-xl"
        style={{ background: 'linear-gradient(135deg, rgba(10,9,15,0.97) 0%, rgba(20,18,28,0.97) 100%)' }}>
        {/* DARPAN icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#C8A97E]/20 border border-[#C8A97E]/30 flex items-center justify-center text-xl">
          🪬
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-serif text-[#C8A97E] text-sm font-semibold leading-tight truncate">{toast.title}</p>
          <p className="font-mono text-[#E8E4DC]/80 text-xs mt-0.5 line-clamp-2 leading-relaxed">{toast.body}</p>
          <a
            href={toast.link || '/'}
            onClick={onDismiss}
            className="inline-block mt-1.5 font-mono text-[10px] text-[#A8C87E] hover:text-white uppercase tracking-widest transition-colors cursor-pointer"
          >
            View →
          </a>
        </div>
        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-[#8A8580] hover:text-[#E8E4DC] transition-colors cursor-pointer p-0.5"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
        {/* Progress bar auto-dismiss */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl bg-[#C8A97E]/20 overflow-hidden">
          <div
            className="h-full bg-[#C8A97E]"
            style={{ animation: 'shrinkWidth 6s linear forwards' }}
          />
        </div>
        <style>{`
          @keyframes shrinkWidth {
            from { width: 100%; }
            to   { width: 0%;   }
          }
        `}</style>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ─── PWA Install Banner — "Add to Home Screen" like WhatsApp ───
// Shows a native-style banner on Android Chrome browsers
// ─────────────────────────────────────────────────────────────
const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Don't show if user already dismissed it
    if (localStorage.getItem('pwa_banner_dismissed')) return;

    const handler = (e) => {
      e.preventDefault();           // Stop Chrome's default mini-infobar
      setDeferredPrompt(e);         // Save for later use
      setShowBanner(true);          // Show our custom banner
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Also listen for notification-click messages from service worker
  useEffect(() => {
    const handleSWMessage = (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const url = event.data.url || '';
        // Extract page name from URL and dispatch navigation event
        const match = url.match(/[?&]page=([^&]+)/);
        if (match) {
          window.dispatchEvent(new CustomEvent('sw_navigate', { detail: { page: match[1] } }));
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowBanner(false);
    localStorage.setItem('pwa_banner_dismissed', '1');
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_banner_dismissed', '1');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-[200] animate-fade-in">
      <div className="bg-[#141419] border border-[#C8A97E]/40 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] p-4 flex items-center gap-4">
        <img src="/icon-192.png" alt="DARPAN" className="w-12 h-12 rounded-xl flex-shrink-0 object-cover" />
        <div className="flex-1 min-w-0">
          <p className="font-serif text-[#E8E4DC] text-sm font-bold leading-tight">Install DARPAN App</p>
          <p className="font-mono text-[10px] text-[#8A8580] mt-0.5 tracking-wide">Get notifications like WhatsApp. Works offline too!</p>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 bg-[#C8A97E] text-black font-mono text-[10px] font-bold tracking-widest uppercase rounded-lg hover:bg-white transition-colors cursor-pointer"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1 font-mono text-[10px] text-[#8A8580] hover:text-[#E8E4DC] transition-colors cursor-pointer text-center"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};

const Navbar = ({ currentPage, setPage, isLoggedIn, setIsLoggedIn, profile, notifications = [] }) => {
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPage]);

  const handleLogout = async () => {
    try {
      setMobileMenuOpen(false);
      await signOut(auth);
      setIsLoggedIn(false);
      setPage("landing");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      <nav className={`fixed top-0 inset-x-0 z-[100] px-4 sm:px-8 md:px-12 lg:px-20 h-20 flex items-center justify-between transition-all duration-300 ${
        scrollY > 20 || mobileMenuOpen ? "bg-[#06060A]/95 backdrop-blur-xl border-b border-[#C8A97E]/15 shadow-lg" : "bg-transparent py-4"
      }`}>
        <div 
          className="font-serif text-2xl font-bold tracking-[0.2em] text-[#E8E4DC] cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-2" 
          onClick={() => setPage(isLoggedIn ? "home" : "landing")}
        >
          <span>DARP<span className="text-[#C8A97E]">AN</span></span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {isLoggedIn ? (
            <>
              {NAV_LINKS.map(link => (
                <button key={link.id} onClick={() => setPage(link.id)}
                  className={`font-mono text-[11px] tracking-widest uppercase transition-all duration-300 cursor-pointer ${
                    link.id === "chat" ? "font-bold text-[#C8A97E] bg-[#C8A97E]/10 px-4 py-2 rounded-md hover:bg-[#C8A97E] hover:text-black shadow-[0_0_15px_rgba(200,169,126,0.15)] border border-[#C8A97E]/30"
                    : link.id === "report" ? "font-bold text-[#A8C87E] bg-[#A8C87E]/5 px-4 py-2 rounded-md hover:bg-[#A8C87E] hover:text-black shadow-[0_0_15px_rgba(168,200,126,0.1)] border border-[#A8C87E]/30"
                    : currentPage === link.id ? "text-[#C8A97E] font-bold" : "text-[#8A8580] hover:text-[#C8A97E]"
                  }`}
                >
                  {link.label}
                </button>
              ))}
              
              <div className="flex items-center gap-4 border-l border-white/10 pl-6">
                <div onClick={() => setPage("profile")} className="w-8 h-8 rounded-full border border-[#C8A97E]/40 overflow-hidden cursor-pointer hover:border-[#C8A97E] transition-all shadow-sm" title="My Profile">
                  {profile.photoURL ? (
                    <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#141419] flex items-center justify-center font-serif font-bold text-xs text-[#C8A97E]">
                      {profile.name ? profile.name.charAt(0).toUpperCase() : "S"}
                    </div>
                  )}
                </div>

                <NotificationBell notifications={notifications} />

                <button onClick={handleLogout} className="font-mono flex items-center gap-2 text-[10px] tracking-widest px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-black transition-all duration-300 uppercase cursor-pointer rounded-lg">
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>
            </>
          ) : (
            currentPage !== "login" && (
              <button onClick={() => setPage("login")} className="font-mono flex items-center gap-2 text-[11px] font-bold tracking-widest px-6 py-2.5 bg-white/5 border border-white/10 text-white hover:border-[#C8A97E] hover:text-[#C8A97E] rounded-lg transition-all duration-300 uppercase cursor-pointer shadow-sm">
                 Log In!
              </button>
            )
          )}
        </div>

        {/* Mobile Header Right (Bell + Profile + Hamburger) */}
        <div className="flex md:hidden items-center gap-3">
          {isLoggedIn ? (
            <>
              <NotificationBell notifications={notifications} />

              <div onClick={() => setPage("profile")} className="w-8 h-8 rounded-full border border-[#C8A97E]/50 overflow-hidden cursor-pointer">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#141419] flex items-center justify-center font-serif font-bold text-xs text-[#C8A97E]">
                    {profile.name ? profile.name.charAt(0).toUpperCase() : "S"}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-[#E8E4DC] hover:text-[#C8A97E] transition-colors focus:outline-none cursor-pointer"
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </>
          ) : (
            currentPage !== "login" && (
              <button onClick={() => setPage("login")} className="font-mono text-[10px] font-bold tracking-widest px-4 py-2 bg-[#C8A97E] text-black rounded-lg uppercase cursor-pointer">
                 Log In
              </button>
            )
          )}
        </div>
      </nav>

      {/* Mobile Slide-down Menu Drawer */}
      {isLoggedIn && mobileMenuOpen && (
        <div className="fixed inset-x-0 top-20 z-[95] bg-[#0A0A0F]/95 backdrop-blur-2xl border-b border-[#C8A97E]/20 p-6 shadow-2xl flex flex-col gap-4 animate-fade-in md:hidden">
          <div className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5">
            <div className="w-10 h-10 rounded-full border border-[#C8A97E]/60 overflow-hidden shrink-0">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#141419] flex items-center justify-center font-serif font-bold text-sm text-[#C8A97E]">
                  {profile.name ? profile.name.charAt(0).toUpperCase() : "S"}
                </div>
              )}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="font-serif text-[#E8E4DC] text-base font-semibold truncate">{profile.name || "Student"}</div>
              <div className="font-mono text-[10px] text-[#8A8580] truncate">{profile.email || "Darpan Space"}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {NAV_LINKS.map(link => (
              <button
                key={link.id}
                onClick={() => { setPage(link.id); setMobileMenuOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-xl font-mono text-xs uppercase tracking-widest transition-all flex items-center justify-between cursor-pointer ${
                  currentPage === link.id
                    ? "bg-[#C8A97E]/20 text-[#C8A97E] border border-[#C8A97E]/40 font-bold"
                    : "text-[#A09A95] hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>{link.label}</span>
                {link.id === "chat" && <span className="text-[10px] text-[#C8A97E] bg-[#C8A97E]/10 px-2 py-0.5 rounded-full border border-[#C8A97E]/30">AI</span>}
                {link.id === "report" && <span className="text-[10px] text-[#A8C87E] bg-[#A8C87E]/10 px-2 py-0.5 rounded-full border border-[#A8C87E]/30">Insights</span>}
              </button>
            ))}

            <button
              onClick={() => { setPage("profile"); setMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-xl font-mono text-xs uppercase tracking-widest transition-all cursor-pointer ${
                currentPage === "profile" ? "bg-[#C8A97E]/20 text-[#C8A97E] font-bold" : "text-[#A09A95] hover:bg-white/5 hover:text-white"
              }`}
            >
              My Profile & Settings
            </button>
          </div>

          <div className="pt-3 border-t border-white/5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/30 text-red-400 font-mono text-xs uppercase tracking-widest hover:bg-red-500 hover:text-black transition-colors cursor-pointer"
            >
              <LogOut size={14} /> Log Out
            </button>
          </div>
        </div>
      )}
    </>
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
                Google Verified <span className="text-[8px] opacity-70">✔</span>
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

// ─── CRISIS KEYWORDS — detect if student needs urgent help ───
const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'end my life', 'want to die', 'self harm',
  'hurt myself', 'khatam kar lun', 'mar jaun', 'marna chahta', 'nahi rehna',
  'khud ko hurt', 'jeena nahi', 'zindagi nahi chahiye'
];

// ─── MOOD DETECTION — from user text ─────────────────────────
const detectMood = (text) => {
  const t = text.toLowerCase();
  if (/happy|khush|amazing|wonderful|great|excited|blessed|acha lag/.test(t)) return 'happy';
  if (/anxious|anxiety|nervous|darr|ghabra|panic|worried|tension/.test(t)) return 'anxious';
  if (/angry|gussa|frustrated|irritat|annoyed/.test(t)) return 'angry';
  if (/sad|dukhi|lonely|akela|cry|ro|depressed|udaas|hurt|broken/.test(t)) return 'sad';
  if (/stress|pressure|exam|overload|burden|thak|tired|exhaust/.test(t)) return 'stressed';
  if (/grateful|thankful|shukriya|content|peaceful|calm|santi/.test(t)) return 'peaceful';
  return 'neutral';
};

const MOOD_STYLES = {
  happy:    { bg: 'from-amber-900/20 to-yellow-900/10',  dot: 'bg-yellow-400',  label: 'Feeling happy ✨' },
  anxious:  { bg: 'from-purple-900/20 to-violet-900/10', dot: 'bg-purple-400',  label: 'Feeling anxious 😰' },
  angry:    { bg: 'from-red-900/20 to-orange-900/10',    dot: 'bg-red-400',     label: 'Feeling frustrated 😤' },
  sad:      { bg: 'from-blue-900/20 to-indigo-900/10',   dot: 'bg-blue-400',    label: 'Feeling low 💙' },
  stressed: { bg: 'from-orange-900/20 to-amber-900/10',  dot: 'bg-orange-400',  label: 'Feeling stressed 😣' },
  peaceful: { bg: 'from-green-900/20 to-teal-900/10',    dot: 'bg-green-400',   label: 'Feeling calm 🍃' },
  neutral:  { bg: 'from-[#0A0A0F] to-[#06060A]',         dot: 'bg-[#8A8580]',   label: 'Sathi is listening' },
};

// ─── QUICK EMOTION PROMPTS ────────────────────────────────────
const QUICK_PROMPTS = [
  { emoji: '😓', label: 'Stressed',    text: 'I am feeling very stressed and overwhelmed right now.' },
  { emoji: '😰', label: 'Anxious',     text: 'I am feeling anxious and nervous. I cannot stop worrying.' },
  { emoji: '😢', label: 'Lonely',      text: 'I am feeling very lonely and nobody understands me.' },
  { emoji: '😤', label: 'Angry',       text: 'I am feeling really angry and frustrated right now.' },
  { emoji: '😴', label: 'Exhausted',   text: 'I am completely exhausted, physically and mentally.' },
  { emoji: '💔', label: 'Heartbroken', text: 'I am heartbroken and sad. Things feel hopeless.' },
  { emoji: '🤯', label: 'Overwhelmed', text: 'Everything feels too much right now. I am overwhelmed.' },
  { emoji: '✨',       label: 'Good today',  text: 'I am feeling okay today! Just want to talk and share my day.' },
];

const ChatPage = ({ messages, setMessages }) => {
  const [inputValue, setInputValue]           = useState("");
  const [isTyping, setIsTyping]               = useState(false);
  const [isRecording, setIsRecording]         = useState(false);
  const [isAudioOutputEnabled, setIsAudioOutputEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking]           = useState(false);
  const [currentMood, setCurrentMood]         = useState('neutral');
  const [showCrisisPanel, setShowCrisisPanel] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const messagesEndRef  = useRef(null);
  const recognitionRef  = useRef(null);
  const audioSourceRef  = useRef(null);
  const textareaRef     = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  // Hide quick prompts once first user message is sent
  useEffect(() => {
    if (messages.length > 1) setShowQuickPrompts(false);
  }, [messages.length]);

  // Clean up TTS / STT on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
      if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
      if (audioSourceRef.current) { try { audioSourceRef.current.stop(); } catch (e) {} }
    };
  }, []);

  // Safe HTML sanitation to prevent XSS while allowing markdown formatting
  const formatMessageText = (text) => {
    if (!text) return "";
    const sanitized = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    return sanitized
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  // Text-to-Speech Logic with voice safety
  const speakText = (text) => {
    if (!isAudioOutputEnabled) return;

    if (!window.speechSynthesis) {
      console.warn("Browser does not support Text-to-Speech functionality.");
      return;
    }

    window.speechSynthesis.cancel();

    setTimeout(() => {
      const cleanText = text
        .replace(/\*/g, '')
        .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      const bestVoice = voices.find(v => v.lang === 'hi-IN') || voices.find(v => v.lang === 'en-IN') || voices.find(v => v.lang.startsWith('en'));

      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      utterance.rate = 0.95;   
      utterance.pitch = 1.0;  
      utterance.lang = 'hi-IN'; 

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (event) => {
        console.warn("Voice synthesis error:", event.error);
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    }, 120); 
  };

  // Unified Speech-to-Text Toggle
  const toggleRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please try Google Chrome or Microsoft Edge.");
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsRecording(false);
      return;
    }

    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) {}
    }
    setIsSpeaking(false);

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN'; 
      recognition.continuous = false; 
      recognition.interimResults = false; 

      recognition.onstart = () => setIsRecording(true);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(prev => prev ? `${prev} ${transcript}` : transcript);
      };

      recognition.onerror = (event) => {
        console.error("Microphone error:", event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          alert("Microphone access was blocked. Please allow microphone permissions in your browser URL bar.");
        }
      };

      recognition.onend = () => setIsRecording(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsRecording(false);
    }
  };

  const handleSendMessage = async (overrideText = null) => {
    const currentText = (overrideText || inputValue).trim();
    if (!currentText || isTyping) return;

    // Stop recording if active
    if (isRecording && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsRecording(false);
    }

    // ── Mood detection — update dynamic background ──
    const detectedMood = detectMood(currentText);
    setCurrentMood(detectedMood);

    // ── Crisis detection — show helpline panel ──
    const isCrisis = CRISIS_KEYWORDS.some(kw => currentText.toLowerCase().includes(kw));
    if (isCrisis) setShowCrisisPanel(true);

    const userMessage = { role: "user", parts: [{ text: currentText }], ts: Date.now() };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInputValue("");
    setIsTyping(true);

    if (auth.currentUser) {
      try {
        await addDoc(collection(db, "chats"), {
          text: currentText, role: "user",
          userId: auth.currentUser.uid,
          userName: auth.currentUser.displayName || "Unknown User",
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
      let finalApiMessages = formattedMessages.slice(-14); // Keep last 14 msgs for rich memory

      if (finalApiMessages.length > 0 && finalApiMessages[0].role === "model") finalApiMessages.shift();

      const response = await fetch("https://dapan-api-secure.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: finalApiMessages })
      });
      const data = await response.json();

      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const botReplyText = data.candidates[0].content.parts[0].text;
        setMessages(prev => [...prev, { role: "model", parts: [{ text: botReplyText }], ts: Date.now() }]);
        if (isAudioOutputEnabled) speakText(botReplyText);
        if (auth.currentUser) {
          try {
            await addDoc(collection(db, "chats"), {
              text: botReplyText, role: "model",
              userId: auth.currentUser.uid, createdAt: serverTimestamp(),
            });
          } catch (err) { console.error("Error saving AI message:", err); }
        }
      } else {
        const fallback = "There seems to be a connection issue. Could you please share that again?";
        setMessages(prev => [...prev, { role: "model", parts: [{ text: fallback }], ts: Date.now() }]);
        if (isAudioOutputEnabled) speakText(fallback);
      }
    } catch (err) {
      console.error("Gemini error:", err);
      setMessages(prev => [...prev, { role: "model", parts: [{ text: "Unable to reach Sathi right now. Please try again in a moment." }], ts: Date.now() }]);
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
    
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch(e) {}
    }
    setIsSpeaking(false);
  };

  const moodStyle = MOOD_STYLES[currentMood] || MOOD_STYLES.neutral;

  return (
    <div className={`animate-fade-in pt-24 pb-6 px-3 sm:px-6 md:px-12 lg:px-20 min-h-screen flex flex-col relative overflow-hidden transition-all duration-1000 bg-gradient-to-br ${moodStyle.bg}`}>
      {/* Dynamic ambient orbs — shift color with mood */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-40">
        <div className={`absolute rounded-full blur-[120px] w-[500px] h-[500px] -left-[10%] -top-[10%] transition-all duration-1000 ${
          currentMood === 'sad' ? 'bg-blue-600/20' : currentMood === 'anxious' ? 'bg-purple-600/20' :
          currentMood === 'angry' ? 'bg-red-600/20' : currentMood === 'stressed' ? 'bg-orange-600/20' :
          currentMood === 'happy' ? 'bg-yellow-500/20' : currentMood === 'peaceful' ? 'bg-green-600/20' : 'bg-[#C8A97E]/15'
        }`} />
        <div className="absolute rounded-full blur-[100px] w-[400px] h-[400px] right-[-5%] top-[40%] bg-[#7EB8C8]/10" />
      </div>

      {/* Crisis Helpline Panel */}
      {showCrisisPanel && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0A0A0F] border border-red-500/40 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_60px_rgba(239,68,68,0.2)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-xl">🆘</div>
              <div>
                <p className="font-serif font-bold text-[#E8E4DC] text-lg">Sathi is here with you</p>
                <p className="font-mono text-[10px] text-red-400 tracking-widest uppercase">You are not alone</p>
              </div>
            </div>
            <p className="font-serif text-[#C4C0BB] text-sm leading-relaxed mb-5">
              It sounds like you're going through something very heavy. Please know you matter deeply. If you're in crisis, please reach out to these helplines immediately:
            </p>
            <div className="space-y-2 mb-5">
              {[
                { name: 'iCall (TISS)', number: '9152987821', desc: 'Mon–Sat, 8am–10pm' },
                { name: 'Vandrevala Foundation', number: '1860-2662-345', desc: '24/7 Free helpline' },
                { name: 'iMind (NIMHANS)', number: '080-46110007', desc: 'Free counseling' },
              ].map(h => (
                <a key={h.name} href={`tel:${h.number.replace(/-/g,'')}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-red-400/40 hover:bg-red-500/5 transition-all group cursor-pointer">
                  <div>
                    <p className="font-mono text-xs font-bold text-[#E8E4DC] group-hover:text-red-300 transition-colors">{h.name}</p>
                    <p className="font-mono text-[10px] text-[#8A8580]">{h.desc}</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-[#C8A97E] group-hover:text-red-300 transition-colors">{h.number}</p>
                </a>
              ))}
            </div>
            <button onClick={() => setShowCrisisPanel(false)}
              className="w-full py-3 font-mono text-xs tracking-widest uppercase font-bold bg-[#C8A97E]/15 border border-[#C8A97E]/30 text-[#C8A97E] hover:bg-[#C8A97E]/25 rounded-xl transition-all cursor-pointer">
              I'm okay, continue with Sathi
            </button>
          </div>
        </div>
      )}

      <div className="flex-grow w-full max-w-4xl mx-auto flex flex-col z-10 h-[calc(100dvh-130px)] min-h-[500px]">

        {/* ── HEADER ── */}
        <div className="bg-[#0A0A0F]/90 backdrop-blur-xl border border-[#C8A97E]/20 rounded-t-2xl p-4 sm:p-5 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-3">
            {/* Sathi avatar — pulses when speaking */}
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 shrink-0">
              <div className={`w-full h-full rounded-full bg-gradient-to-br from-[#C8A97E] to-[#8A724E] flex items-center justify-center shadow-inner ${isSpeaking ? 'ring-2 ring-[#C8A97E]/60 ring-offset-2 ring-offset-[#0A0A0F] animate-pulse' : ''}`}>
                <span className="font-serif text-xl sm:text-2xl font-bold text-black leading-none pt-0.5">S</span>
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[#0A0A0F] rounded-full" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#E8E4DC] leading-none">Sathi</h2>
              {/* Mood indicator badge */}
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${moodStyle.dot} transition-colors duration-700`} />
                <p className="font-mono text-[9px] tracking-widest uppercase transition-all duration-700"
                  style={{ color: currentMood === 'neutral' ? '#8A8580' : currentMood === 'happy' ? '#fbbf24' : currentMood === 'sad' ? '#60a5fa' : currentMood === 'stressed' ? '#fb923c' : currentMood === 'anxious' ? '#a78bfa' : currentMood === 'angry' ? '#f87171' : '#4ade80' }}>
                  {isSpeaking ? 'Speaking…' : moodStyle.label}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Voice toggle */}
            <button type="button"
              onClick={() => {
                const ns = !isAudioOutputEnabled;
                setIsAudioOutputEnabled(ns);
                if (!ns && window.speechSynthesis) window.speechSynthesis.cancel();
                if (!ns && audioSourceRef.current) { try { audioSourceRef.current.stop(); } catch(e) {} }
                if (!ns) setIsSpeaking(false);
              }}
              className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5 border transition-all cursor-pointer ${
                isAudioOutputEnabled ? 'bg-[#C8A97E]/10 border-[#C8A97E]/30 text-[#C8A97E] hover:bg-[#C8A97E]/20' : 'bg-white/5 border-white/10 text-[#8A8580] hover:bg-white/10'
              }`} title={isAudioOutputEnabled ? 'Mute voice' : 'Unmute voice'}>
              {isAudioOutputEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Voice</span>
            </button>
            {/* Reset */}
            <button type="button" onClick={() => {
                setMessages([{ role: 'model', parts: [{ text: "Namaste! Fresh start. How are you feeling right now?" }], ts: Date.now() }]);
                setCurrentMood('neutral');
                setShowCrisisPanel(false);
                setShowQuickPrompts(true);
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                if (audioSourceRef.current) { try { audioSourceRef.current.stop(); } catch(e) {} }
                setIsSpeaking(false);
              }}
              className="text-[#8A8580] hover:text-[#C8A97E] transition-colors p-2 rounded-full hover:bg-white/5 cursor-pointer" title="Reset conversation">
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* ── MESSAGES ── */}
        <div className="flex-grow bg-[#06060A]/60 backdrop-blur-md border-x border-[#C8A97E]/15 p-4 sm:p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">

          {/* Quick Emotion Prompts — shown only before first message */}
          {showQuickPrompts && (
            <div className="animate-fade-in mb-2">
              <p className="font-mono text-[10px] tracking-widest text-[#8A8580] uppercase text-center mb-3">How are you feeling right now?</p>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {QUICK_PROMPTS.map(p => (
                  <button key={p.label} onClick={() => { setInputValue(p.text); handleSendMessage(p.text); }}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/[0.04] border border-white/10 hover:border-[#C8A97E]/40 hover:bg-[#C8A97E]/5 transition-all cursor-pointer group">
                    <span className="text-xl group-hover:scale-110 transition-transform">{p.emoji}</span>
                    <span className="font-mono text-[9px] text-[#8A8580] group-hover:text-[#C8A97E] transition-colors tracking-wide">{p.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 h-px bg-gradient-to-r from-transparent via-[#C8A97E]/20 to-transparent" />
            </div>
          )}

          {messages.map((msg, index) => {
            const isUser  = msg.role === 'user';
            const isLast  = index === messages.length - 1;
            const time    = msg.ts ? new Date(msg.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                {/* Sathi avatar */}
                {!isUser && (
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#141419] border flex items-center justify-center mr-2 mt-auto shrink-0 relative overflow-hidden transition-all duration-500 ${isLast && isSpeaking ? 'border-[#C8A97E]/70 shadow-[0_0_12px_rgba(200,169,126,0.4)]' : 'border-[#C8A97E]/25'}`}>
                    <span className="font-serif text-xs font-bold text-[#C8A97E] relative z-10">S</span>
                    {isLast && isSpeaking && <div className="absolute inset-0 bg-[#C8A97E]/15 animate-pulse" />}
                  </div>
                )}

                <div className="flex flex-col gap-1 max-w-[85%] sm:max-w-[75%]">
                  <div className={`p-3.5 sm:p-4 text-[14px] sm:text-[15px] font-serif leading-relaxed shadow-sm ${
                    isUser
                      ? 'bg-gradient-to-br from-[#C8A97E]/15 to-[#8A724E]/20 border border-[#C8A97E]/40 rounded-2xl rounded-br-sm text-[#E8E4DC]'
                      : 'bg-white/[0.04] border border-white/10 rounded-2xl rounded-bl-sm text-[#C4C0BB]'
                  }`}>
                    <span dangerouslySetInnerHTML={{ __html: formatMessageText(msg.parts[0]?.text) }} />
                  </div>
                  {/* Timestamp */}
                  {time && <p className={`font-mono text-[9px] text-[#5A5550] ${isUser ? 'text-right pr-1' : 'pl-1'}`}>{time}</p>}
                </div>

                {/* User avatar */}
                {isUser && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#1A1A24] border border-white/10 flex items-center justify-center ml-2 mt-auto shrink-0">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8A8580]" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Sathi typing indicator */}
          {isTyping && (
            <div className="flex justify-start animate-fade-in">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#141419] border border-[#C8A97E]/30 flex items-center justify-center mr-2 mt-auto shrink-0">
                <span className="font-serif text-xs font-bold text-[#C8A97E]">S</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-1.5">
                {[0, 150, 300].map(delay => (
                  <div key={delay} className="w-2 h-2 rounded-full bg-[#C8A97E]/60"
                    style={{ animation: `pulse 1.2s ease-in-out ${delay}ms infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── INPUT BAR ── */}
        <div className="bg-[#0A0A0F]/90 backdrop-blur-xl border border-[#C8A97E]/20 rounded-b-2xl p-3 sm:p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="relative flex items-center gap-2">
            {/* Mic button */}
            <button type="button" onClick={toggleRecording}
              className={`p-3 sm:p-3.5 rounded-xl border transition-all duration-300 cursor-pointer shrink-0 ${
                isRecording
                  ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse'
                  : 'bg-[#141419] border-white/10 text-[#C8A97E] hover:bg-white/5 hover:border-[#C8A97E]/30'
              }`} title={isRecording ? 'Stop' : 'Speak'}>
              {isRecording ? <Mic className="w-5 h-5 animate-bounce" /> : <MicOff className="w-5 h-5" />}
            </button>

            {/* Text input */}
            <textarea ref={textareaRef} value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              placeholder={isRecording ? 'Listening… speak now' : 'Type in Hindi, English or Hinglish…'}
              className={`flex-grow bg-[#141419] border rounded-xl py-3.5 pl-4 pr-12 text-[#E8E4DC] placeholder:text-[#5A5550] font-serif text-[15px] focus:outline-none transition-all resize-none custom-scrollbar ${
                isRecording ? 'border-[#C8A97E]/80 border-dashed bg-[#C8A97E]/5' : 'border-white/10 focus:border-[#C8A97E]/50'
              }`} rows={1} style={{ minHeight: '52px', maxHeight: '120px' }} />

            {/* Send button */}
            <button type="button" onClick={() => handleSendMessage()} disabled={isTyping || !inputValue.trim()}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-[#C8A97E] text-black p-2.5 rounded-lg hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md">
              {isTyping ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>

          {/* Quick re-prompt hint after first message */}
          {!showQuickPrompts && messages.length > 2 && (
            <button onClick={() => setShowQuickPrompts(true)}
              className="mt-2 w-full font-mono text-[9px] tracking-widest uppercase text-[#5A5550] hover:text-[#C8A97E] transition-colors cursor-pointer text-center">
              ↑ Show emotion shortcuts
            </button>
          )}
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
  const miniChatEndRef = useRef(null);

  const RATING_LABELS = {
    1: "Could be better 😢",
    2: "Needs improvement 😕",
    3: "Helpful & good 🙂",
    4: "Really comforting! 😊",
    5: "Life-changing / loved it! 🌟"
  };

  // Auto-scroll mini-chat
  useEffect(() => {
    miniChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [miniChatHistory, isMiniChatLoading]);

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
    
    const newMessages = [...miniChatHistory, { from: "user", text: miniChatInput.trim() }];
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

      let finalApiMessages = geminiFormatMessages.slice(-10);
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
      setMiniChatHistory((prev) => [...prev, { from: "sathi", text: "Unable to connect to the server right now. Please try again in a moment." }]);
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
            <div className="bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/30 rounded-2xl py-6 px-8 sm:px-12 md:px-16 shadow-[0_0_40px_rgba(200,169,126,0.1)] relative overflow-hidden group flex flex-col items-center justify-center text-center">
              
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

              <p className="relative z-10 font-serif text-lg sm:text-xl md:text-3xl text-[#E8E4DC] leading-relaxed max-w-4xl mx-auto font-medium" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
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
                <div ref={miniChatEndRef} />
              </div>
              
              {/* Quick conversation starters */}
              <div className="px-3 pt-2 pb-1 bg-[#0A0A0F]/90 border-t border-white/5 flex gap-1.5 overflow-x-auto custom-scrollbar">
                {[
                  "Exams stress ho raha hai 😓",
                  "Feeling calm today ✨",
                  "Tell me something peaceful 🌿"
                ].map((pill, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setMiniChatInput(pill); handleMiniChatSend(pill); }}
                    className="text-[9px] font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[#A09A95] hover:border-[#C8A97E]/50 hover:text-[#C8A97E] whitespace-nowrap transition-colors cursor-pointer"
                  >
                    {pill}
                  </button>
                ))}
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
                  title="Send message to Sathi"
                >
                  <Send className="w-4 h-4 -ml-0.5" />
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Floating feedback button */}
        <button 
          onClick={() => setIsFeedbackModalOpen(true)} 
          className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[80] bg-[#141419]/90 backdrop-blur-md border border-[#C8A97E]/40 text-[#C8A97E] p-3.5 sm:p-4 rounded-full shadow-[0_0_25px_rgba(200,169,126,0.25)] hover:bg-[#C8A97E] hover:text-black transition-all duration-300 cursor-pointer flex items-center justify-center group"
          title="Share Feedback"
        >
          <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
        </button>

        {isFeedbackModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
            <div className="bg-[#0A0A0F] border border-[#C8A97E]/30 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
              <button 
                onClick={() => setIsFeedbackModalOpen(false)} 
                className="absolute top-4 right-4 text-[#8A8580] hover:text-[#C8A97E] transition-colors cursor-pointer p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-mono text-[11px] tracking-widest text-[#8A8580] uppercase mb-4">Rate Your Experience</h3>
              {feedbackStatus === "success" ? (
                 <div className="flex items-center gap-3 text-[#A8C87E] font-serif py-8 text-lg">
                    <div className="w-10 h-10 rounded-full bg-[#A8C87E]/20 flex items-center justify-center shrink-0"><Check className="w-5 h-5" /></div>
                    Thank you for sharing your thoughts with us.
                 </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="flex gap-2 justify-center py-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          className={`w-8 h-8 cursor-pointer transition-all duration-200 ${
                            (hoverRating || rating) >= star 
                              ? "fill-[#C8A97E] text-[#C8A97E] scale-110" 
                              : "text-[#5A5550] hover:text-[#C8A97E]/50"
                          }`} 
                          onMouseEnter={() => setHoverRating(star)} 
                          onMouseLeave={() => setHoverRating(0)} 
                          onClick={() => setRating(star)} 
                        />
                      ))}
                    </div>
                    {(hoverRating || rating) > 0 && (
                      <p className="text-center font-mono text-[11px] text-[#C8A97E] tracking-wider mt-1">
                        {RATING_LABELS[hoverRating || rating]}
                      </p>
                    )}
                  </div>

                  <textarea 
                    value={feedback} 
                    onChange={(e) => setFeedback(e.target.value)} 
                    placeholder="Tell us how Darpan makes you feel... and share any suggestions to make it better." 
                    className="w-full bg-[#141419] border border-white/10 rounded-xl p-4 text-[#E8E4DC] placeholder:text-[#5A5550] font-serif text-[15px] focus:outline-none focus:border-[#C8A97E]/50 transition-colors resize-none shadow-inner min-h-[120px] custom-scrollbar" 
                  />
                  <button 
                    type="button"
                    onClick={handleFeedbackSubmit} 
                    disabled={(!rating && !feedback.trim()) || feedbackStatus === "submitting"} 
                    className="w-full py-3.5 bg-[#C8A97E] text-black font-mono text-xs tracking-widest uppercase font-bold hover:bg-white transition-colors rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(200,169,126,0.2)]"
                  >
                    {feedbackStatus === "submitting" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Feedback"}
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
  const [viewingAuthorId, setViewingAuthorId] = useState(null);
  const [showingAllStories, setShowingAllStories] = useState(true);

  const BACKEND_URL = "https://dapan-api-secure.onrender.com";
  const ADMIN_EMAIL = "dhidna9090@gmail.com";

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenLikePopupId(null);
    };
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
      // Check content moderation
      let passedCheck = true;
      try {
        const checkResponse = await fetch(`${BACKEND_URL}/api/save-story`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyText: newStory })
        });
        if (!checkResponse.ok) {
          const checkData = await checkResponse.json();
          alert(checkData.error || "Inappropriate words detected!");
          passedCheck = false;
        }
      } catch (backendErr) {
        console.warn("Backend moderation service unavailable or waking up:", backendErr);
        // Continue gracefully if backend server is sleeping on Render free tier
      }

      if (!passedCheck) {
        setIsSubmitting(false);
        return;
      }

      const now = new Date();
      const timeString = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const dateString = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      
      const storyData = {
        quote: newStory.trim(),
        name: profile?.name || "Student",
        college: profile?.college || "",
        branch: profile?.branch || "",
        initial: profile?.name ? profile.name.charAt(0).toUpperCase() : "S",
        photoURL: profile?.photoURL || null,
        userId: auth.currentUser.uid,
        isAdminPost: auth.currentUser.email === ADMIN_EMAIL,
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
            senderName: profile?.name || "Student",
            senderUid: auth.currentUser.uid
          })
        }).catch(err => console.error("Broadcast push failed:", err));
      }

    } catch (error) { 
      console.error("Error saving story:", error); 
      alert("Something went wrong while posting. Please try again.");
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
            currentUserName: profile?.name || "Student",
            snippet: newComment.text.slice(0, 100)
          })
        }).catch(err => console.error("Backend push failed:", err));
      }
      
      setCommentText(""); 
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

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

  const handleDeleteComment = async (story, commentId) => {
    if (!auth.currentUser) return;
    if (!window.confirm("Delete this comment?")) return;
    const updatedComments = (story.comments || []).filter(c => c.id !== commentId);
    setUserStories(userStories.map(s => s.id === story.id ? { ...s, comments: updatedComments } : s));
    try {
      await updateDoc(doc(db, "stories", story.id), { comments: updatedComments });
    } catch (err) {
      console.error("Error deleting comment:", err);
    }
  };

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

  const baseVisibleStories = userStories.filter(t => 
    (!t.isPrivate || t.userId === auth.currentUser?.uid) &&
    !blockedUserIds.includes(t.userId)
  );

  const authorsList = [];
  const seenAuthorIds = new Set();

  baseVisibleStories.forEach(story => {
    if (!seenAuthorIds.has(story.userId)) {
      seenAuthorIds.add(story.userId);
      const isMyOwn = story.userId === auth.currentUser?.uid;
      authorsList.push({
        userId: story.userId,
        name: isMyOwn ? (profile?.name || "Student") : story.name,
        photoURL: isMyOwn ? profile?.photoURL : story.photoURL,
        initial: isMyOwn ? (profile?.name ? profile.name.charAt(0).toUpperCase() : "S") : (story.initial || "S"),
        isAdmin: story.isAdminPost === true,
        storyCount: baseVisibleStories.filter(s => s.userId === story.userId).length
      });
    }
  });

  const sortedAuthorsList = [...authorsList].sort((a, b) => {
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    return 0;
  });

  const feedStories = showingAllStories
    ? baseVisibleStories
    : baseVisibleStories.filter(s => s.userId === viewingAuthorId);

  const sortedFeedStories = showingAllStories
    ? [...feedStories].sort((a, b) => {
        const aIsAdmin = a.isAdminPost === true;
        const bIsAdmin = b.isAdminPost === true;
        if (aIsAdmin && !bIsAdmin) return -1;
        if (!aIsAdmin && bIsAdmin) return 1;
        return 0;
      })
    : feedStories;

  const handleSelectAuthor = (authorId) => {
    setViewingAuthorId(authorId);
    setShowingAllStories(false);
  };

  const handleShowAllStories = () => {
    setViewingAuthorId(null);
    setShowingAllStories(true);
  };

  const viewingAuthorInfo = sortedAuthorsList.find(a => a.userId === viewingAuthorId);

  return (
    <div className="animate-fade-in pt-28 md:pt-32 pb-20 px-4 sm:px-8 md:px-12 lg:px-20 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <FadeInSection>
          <div className="text-center mb-12 sm:mb-16">
            <div className="font-mono text-xs tracking-[0.3em] text-[#C8A97E] uppercase mb-3">Real Stories</div>
            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-light">
              Their words. <br />
              <em className="font-bold text-[#C8A97E] not-italic">Their lives, changed.</em>
            </h1>
          </div>

          <div className="max-w-3xl mx-auto mb-16 bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-3xl p-5 sm:p-8 md:p-10 shadow-[0_0_40px_rgba(200,169,126,0.05)]">
            <h3 className="font-serif text-xl sm:text-2xl text-[#E8E4DC] mb-1">Share your journey</h3>
            <p className="font-serif text-[#A09A95] mb-5 text-sm">
              Your story might be exactly what someone else needs to hear today.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <textarea
                rows={5}
                value={newStory}
                onChange={(e) => setNewStory(e.target.value)}
                placeholder="A safe space to share your thoughts, lessons and little victories. Write freely... someone might find hope in your story."
                className="w-full bg-[#141419] border border-white/10 rounded-2xl p-4 sm:p-5 text-[#E8E4DC] placeholder:text-[#5A5550] font-serif text-base sm:text-lg focus:outline-none focus:border-[#C8A97E]/50 transition-colors resize-y shadow-inner min-h-[160px]"
              />
              
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsPrivatePost(!isPrivatePost)}
                  className={`font-mono text-[10px] tracking-widest uppercase flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all border cursor-pointer ${
                    isPrivatePost ? "bg-white/10 border-white/20 text-[#E8E4DC]" : "bg-[#C8A97E]/10 border-[#C8A97E]/30 text-[#C8A97E] hover:bg-[#C8A97E]/20"
                  }`}
                >
                  {isPrivatePost ? <><Lock className="w-3.5 h-3.5" /> Private Note</> : <><Globe className="w-3.5 h-3.5" /> Share Publicly</>}
                </button>

                {!isPrivatePost && (
                  <button 
                    type="button" 
                    onClick={() => setAllowCommentsPost(!allowCommentsPost)}
                    className={`font-mono text-[10px] tracking-widest uppercase flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all border cursor-pointer ${
                      !allowCommentsPost ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-[#C8A97E]/10 border-[#C8A97E]/30 text-[#C8A97E] hover:bg-[#C8A97E]/20"
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> {allowCommentsPost ? "Comments: ON" : "Comments: OFF"}
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
        
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="w-full lg:w-[300px] shrink-0">
              <div className="bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-3xl p-5 sm:p-6 lg:sticky lg:top-28 shadow-[0_0_40px_rgba(200,169,126,0.05)]">
                <button
                  type="button"
                  onClick={handleShowAllStories}
                  className={`w-full text-left px-5 py-3 rounded-2xl font-mono text-[11px] tracking-widest uppercase mb-4 transition-all cursor-pointer ${
                    showingAllStories ? "bg-[#C8A97E] text-black font-bold shadow-[0_0_20px_rgba(200,169,126,0.25)]" : "bg-white/5 text-[#8A8580] hover:bg-white/10"
                  }`}
                >
                  All Stories
                </button>

                <div className="font-mono text-[10px] tracking-[0.2em] text-[#5A5550] uppercase px-2 mb-3">
                  Authors
                </div>

                <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                  {sortedAuthorsList.map((author) => (
                    <button
                      key={author.userId}
                      type="button"
                      onClick={() => handleSelectAuthor(author.userId)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all cursor-pointer text-left border ${
                        viewingAuthorId === author.userId ? "bg-[#C8A97E]/15 border-[#C8A97E]/40" : "border-transparent hover:bg-white/5"
                      }`}
                    >
                      {author.photoURL ? (
                        <img src={author.photoURL} alt={author.name} className="w-9 h-9 rounded-full object-cover border-2 border-[#C8A97E]/40 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#141419] border-2 border-[#C8A97E]/40 flex items-center justify-center shrink-0">
                          <span className="font-serif text-sm font-bold text-[#C8A97E]">{author.initial}</span>
                        </div>
                      )}
                      <div className="flex flex-col overflow-hidden flex-1">
                        <span className="font-serif text-[14px] text-[#E8E4DC] truncate flex items-center gap-1.5">
                          {author.name}
                          {author.isAdmin && (
                            <span className="font-mono text-[8px] tracking-wider text-[#C8A97E] bg-[#C8A97E]/15 border border-[#C8A97E]/30 rounded-full px-1.5 py-0.5 shrink-0">
                              ADMIN
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-[9px] text-[#8A8580] uppercase tracking-wider">
                          {author.storyCount} {author.storyCount === 1 ? "story" : "stories"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 w-full">
              {!showingAllStories && viewingAuthorInfo && (
                <div className="bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-2xl p-4 sm:p-5 mb-6 flex items-center gap-4">
                  {viewingAuthorInfo.photoURL ? (
                    <img src={viewingAuthorInfo.photoURL} alt={viewingAuthorInfo.name} className="w-12 h-12 rounded-full object-cover border-2 border-[#C8A97E]/60" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#141419] border-2 border-[#C8A97E]/60 flex items-center justify-center">
                      <span className="font-serif text-lg font-bold text-[#C8A97E]">{viewingAuthorInfo.initial}</span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-serif text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                      {viewingAuthorInfo.name}
                      {viewingAuthorInfo.isAdmin && (
                        <span className="font-mono text-[8px] tracking-wider text-[#C8A97E] bg-[#C8A97E]/15 border border-[#C8A97E]/30 rounded-full px-2 py-0.5">
                          ADMIN
                        </span>
                      )}
                    </h3>
                    <p className="font-mono text-[10px] tracking-widest text-[#8A8580] uppercase">
                      {viewingAuthorInfo.storyCount} {viewingAuthorInfo.storyCount === 1 ? "story" : "stories"} shared
                    </p>
                  </div>
                </div>
              )}

              {sortedFeedStories.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-[#C8A97E]/20 rounded-3xl bg-white/[0.01]">
                  <div className="w-16 h-16 mx-auto bg-[#C8A97E]/10 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-[#C8A97E]" />
                  </div>
                  <h3 className="font-serif text-2xl text-[#E8E4DC] mb-2">The canvas is blank</h3>
                  <p className="font-serif text-[#A09A95]">Be the first to share your journey and inspire others.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
                  {sortedFeedStories.map((t, i) => {
                    const isMyPost = t.userId === auth.currentUser?.uid;
                    const displayPhoto = isMyPost ? profile?.photoURL : t.photoURL;
                    const displayName = isMyPost ? (profile?.name || "Student") : t.name;
                    const displayInitial = isMyPost ? (profile?.name ? profile.name.charAt(0).toUpperCase() : "S") : (t.initial || 'S');
                    
                    const allowsComments = t.allowComments !== false; 

                    const quoteLength = t.quote.length;
                    let textSizeClass = "text-2xl sm:text-3xl md:text-4xl leading-[1.3]"; 
                    if (quoteLength > 180) { textSizeClass = "text-base sm:text-lg md:text-xl leading-[1.6]"; } 
                    else if (quoteLength > 80) { textSizeClass = "text-xl sm:text-2xl md:text-3xl leading-[1.4]"; }
                    
                    return (
                      <div key={t.id || i} className={`relative bg-[#0A0A0F] border rounded-3xl p-6 sm:p-8 flex flex-col transition-all duration-300 group ${t.isPrivate ? 'border-white/10 opacity-85' : 'border-[#C8A97E]/30 hover:border-[#C8A97E] hover:shadow-[0_0_40px_rgba(200,169,126,0.1)]'}`}>
                        
                        <div className="flex items-start justify-between relative z-10 mb-6 border-b border-[#C8A97E]/10 pb-4">
                          <div className="flex items-center gap-3 sm:gap-4">
                            {displayPhoto ? (
                              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-[#C8A97E]/80 p-0.5 shadow-sm shrink-0">
                                 <img src={displayPhoto} alt={displayName} className="w-full h-full rounded-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-[#C8A97E]/80 p-0.5 shadow-sm flex items-center justify-center bg-[#141419] shrink-0">
                                <span className="font-serif text-xl font-bold text-[#C8A97E]">{displayInitial}</span>
                              </div>
                            )}
                            <div>
                              <div className="font-serif text-lg sm:text-xl font-bold text-white tracking-wide">{displayName}</div>
                              <span className="font-mono text-[9px] tracking-widest text-[#C8A97E] uppercase block mt-0.5">
                                 {t.displayTime ? `SHARED ON ${t.displayTime.toUpperCase()}` : "SHARED JUST NOW"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {t.isPrivate && <span className="hidden sm:inline-block font-mono text-[9px] uppercase tracking-widest text-[#8A8580] bg-white/5 px-2.5 py-1 rounded-full border border-white/10 mr-1">Private</span>}
                            {isMyPost && (
                              <>
                                {!t.isPrivate && (
                                  <button 
                                    type="button"
                                    onClick={() => toggleLikesVisibility(t.id, t.showLikesPublicly)} 
                                    className={`p-2 rounded-full border transition-all cursor-pointer ${t.showLikesPublicly ? 'bg-[#C8A97E]/10 border-[#C8A97E]/50 text-[#C8A97E]' : 'bg-[#141419] border-white/10 text-[#8A8580] hover:text-[#C8A97E]'}`} 
                                    title={t.showLikesPublicly ? "Hide Likers from Others" : "Show Likers to Everyone"}
                                  >
                                    {t.showLikesPublicly ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                                
                                {!t.isPrivate && (
                                  <button 
                                    type="button"
                                    onClick={() => toggleCommentsStatus(t.id, allowsComments)} 
                                    className={`p-2 rounded-full border transition-all cursor-pointer ${!allowsComments ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-[#141419] border-white/10 text-[#8A8580] hover:text-[#C8A97E]'}`} 
                                    title={allowsComments ? "Turn Comments Off" : "Turn Comments On"}
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button 
                                  type="button"
                                  onClick={() => togglePrivacy(t.id, t.isPrivate)} 
                                  className="p-2 rounded-full bg-[#141419] border border-white/10 text-[#8A8580] hover:text-[#C8A97E] transition-all cursor-pointer" 
                                  title={t.isPrivate ? "Make Public" : "Make Private"}
                                >
                                  {t.isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => deleteStory(t.id)} 
                                  className="p-2 rounded-full bg-[#141419] border border-white/10 text-[#8A8580] hover:text-red-400 hover:border-red-400/50 transition-all cursor-pointer" 
                                  title="Delete Story"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            {!isMyPost && (
                              <button 
                                type="button"
                                onClick={() => handleBlockUser(t.userId, displayName)} 
                                className="p-2 rounded-full bg-[#141419] border border-white/10 text-[#8A8580] hover:text-red-400 hover:border-red-400/50 transition-all cursor-pointer" 
                                title="Block this user"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10 px-2 sm:px-6 py-4">
                          <div className="font-serif text-4xl text-[#C8A97E] leading-none mb-2 opacity-60">"</div>
                          <p className={`font-serif text-[#E8E4DC] font-light ${textSizeClass}`}>"{t.quote}"</p>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5 relative z-10">
                          <div className="font-mono text-[9px] sm:text-[10px] tracking-widest text-[#8A8580] uppercase truncate max-w-[50%]">
                            {t.college && t.branch ? `${t.branch}, ${t.college}` : 'Darpan Student'}
                          </div>
                          
                          {!t.isPrivate && (
                            <div className="relative flex items-center gap-2">
                              {/* Comments trigger */}
                              <button
                                type="button"
                                onClick={() => { 
                                  setOpenCommentPopupId(openCommentPopupId === t.id ? null : t.id); 
                                  setReplyingTo(null); 
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-mono cursor-pointer ${
                                  openCommentPopupId === t.id 
                                    ? "bg-[#C8A97E]/20 border-[#C8A97E]/60 text-[#C8A97E]" 
                                    : "bg-white/5 border-white/10 text-[#8A8580] hover:text-[#C8A97E] hover:border-[#C8A97E]/40"
                                }`}
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span className="font-bold">{t.comments?.length || 0}</span>
                              </button>

                              {/* Likes trigger */}
                              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2.5 py-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleLike(t)}
                                  className="cursor-pointer group flex items-center justify-center"
                                  title="Like this story"
                                >
                                  <Heart className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
                                    t.likes?.some(like => typeof like === 'string' ? like === auth.currentUser?.uid : like.uid === auth.currentUser?.uid)
                                    ? 'fill-[#C8A97E] text-[#C8A97E]'
                                    : 'text-[#8A8580] group-hover:text-[#C8A97E]'
                                  }`} />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (openLikePopupId === t.id) {
                                      setOpenLikePopupId(null);
                                    } else if ((isMyPost || t.showLikesPublicly) && t.likes?.length > 0) {
                                      setOpenLikePopupId(t.id);
                                    }
                                  }}
                                  className={`font-mono text-[10px] font-bold ml-1 transition-all ${
                                    ((isMyPost || t.showLikesPublicly) && t.likes?.length > 0) ? 'cursor-pointer hover:underline hover:text-[#C8A97E]' : 'cursor-default'
                                  } ${
                                    t.likes?.some(like => typeof like === 'string' ? like === auth.currentUser?.uid : like.uid === auth.currentUser?.uid)
                                    ? 'text-[#C8A97E]' : 'text-[#8A8580]'
                                  }`}
                                >
                                  {t.likes?.length || 0}
                                </button>
                              </div>

                              {/* Likes popup */}
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

                                  <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
                                    {t.likes.map((likeData, idx) => {
                                      const isOldData = typeof likeData === 'string';
                                      const likeUid = isOldData ? likeData : likeData.uid;
                                      const isMyLike = likeUid === auth.currentUser?.uid;
                                      const likerName = isMyLike ? (profile?.name || "Student") : (isOldData ? "Darpan User" : likeData.name);
                                      const likerPhoto = isMyLike ? profile?.photoURL : (isOldData ? null : likeData.photoURL);

                                      return (
                                        <div key={idx} className="flex items-center gap-2.5 p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                                          {likerPhoto ? (
                                            <img src={likerPhoto} alt={likerName} className="w-7 h-7 rounded-full object-cover border border-[#C8A97E]/30" />
                                          ) : (
                                            <div className="w-7 h-7 rounded-full bg-[#141419] border border-[#C8A97E]/30 flex items-center justify-center shrink-0">
                                              <span className="font-serif text-xs font-bold text-[#C8A97E]">{likerName.charAt(0).toUpperCase()}</span>
                                            </div>
                                          )}
                                          <span className="font-serif text-[#E8E4DC] text-sm truncate">{likerName}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Inline Expandable Comments Section */}
                        {openCommentPopupId === t.id && (
                          <div className="mt-4 pt-4 border-t border-white/10 animate-fade-in flex flex-col gap-3">
                            <div className="flex justify-between items-center px-1">
                              <span className="font-serif text-[#C8A97E] text-sm font-semibold">
                                Comments ({t.comments?.length || 0})
                              </span>
                              <button 
                                type="button" 
                                onClick={() => setOpenCommentPopupId(null)} 
                                className="text-[#8A8580] hover:text-white text-xs font-mono uppercase tracking-wider"
                              >
                                Close
                              </button>
                            </div>

                            <div className="max-h-[240px] overflow-y-auto custom-scrollbar flex flex-col gap-2.5 pr-1">
                              {!t.comments || t.comments.length === 0 ? (
                                <div className="text-center font-serif text-[#5A5550] text-sm py-4">
                                  No comments yet. Be the first to share your thoughts!
                                </div>
                              ) : (
                                t.comments.map((comment) => {
                                  const canDeleteComment = isMyPost || comment.uid === auth.currentUser?.uid;
                                  return (
                                    <div key={comment.id} className="bg-white/[0.03] p-3 rounded-xl border border-white/5 flex flex-col gap-1.5">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          {comment.photoURL ? (
                                            <img src={comment.photoURL} alt={comment.name} className="w-6 h-6 rounded-full object-cover border border-[#C8A97E]/30 shrink-0" />
                                          ) : (
                                            <div className="w-6 h-6 rounded-full bg-[#141419] border border-[#C8A97E]/30 flex items-center justify-center shrink-0">
                                              <span className="font-serif text-[10px] font-bold text-[#C8A97E]">{comment.name?.charAt(0).toUpperCase()}</span>
                                            </div>
                                          )}
                                          <span className="font-serif text-[#E8E4DC] text-xs font-semibold">{comment.name}</span>
                                        </div>

                                        {canDeleteComment && (
                                          <button 
                                            type="button" 
                                            onClick={() => handleDeleteComment(t, comment.id)} 
                                            className="text-[#5A5550] hover:text-red-400 p-1 cursor-pointer"
                                            title="Delete comment"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        )}
                                      </div>

                                      <p className="font-serif text-[#C4C0BB] text-xs leading-relaxed pl-8 break-words">{comment.text}</p>

                                      <div className="flex items-center gap-4 pl-8 mt-1">
                                        <button 
                                          type="button" 
                                          onClick={() => toggleCommentLike(t, comment.id)}
                                          className="flex items-center gap-1 text-[#8A8580] hover:text-[#C8A97E] transition-colors cursor-pointer text-[10px] font-mono"
                                        >
                                          <Heart className={`w-3 h-3 ${comment.likes?.includes(auth.currentUser?.uid) ? 'fill-[#C8A97E] text-[#C8A97E]' : ''}`} />
                                          <span>{comment.likes?.length || ''}</span>
                                        </button>

                                        {allowsComments && (
                                          <button 
                                            type="button"
                                            onClick={() => setReplyingTo({ commentId: comment.id, name: comment.name })}
                                            className="font-mono text-[9px] uppercase text-[#8A8580] hover:text-[#C8A97E] font-bold tracking-wider cursor-pointer"
                                          >
                                            Reply
                                          </button>
                                        )}
                                      </div>

                                      {/* Nested replies */}
                                      {comment.replies && comment.replies.map((reply) => (
                                        <div key={reply.id} className="ml-8 mt-1.5 p-2 bg-black/30 rounded-lg border-l-2 border-[#C8A97E]/40 text-xs">
                                          <div className="flex items-center gap-1.5 mb-1">
                                            <span className="font-serif text-[#E8E4DC] font-semibold text-[11px]">{reply.name}</span>
                                          </div>
                                          <p className="font-serif text-[#A09A95]">{reply.text}</p>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {allowsComments ? (
                              <div className="pt-2 flex flex-col gap-2">
                                {replyingTo && (
                                  <div className="flex justify-between items-center bg-[#C8A97E]/10 border border-[#C8A97E]/20 px-2.5 py-1 rounded-lg">
                                    <span className="font-mono text-[9px] text-[#C8A97E] uppercase tracking-wider">Replying to {replyingTo.name}...</span>
                                    <button onClick={() => setReplyingTo(null)} className="text-red-400 hover:text-white p-0.5"><X size={12} /></button>
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder={replyingTo ? `Write a reply...` : "Write a kind comment..."}
                                    className="flex-grow bg-[#141419] border border-white/10 rounded-xl px-3 py-2 text-[#E8E4DC] text-xs font-serif focus:outline-none focus:border-[#C8A97E]/50"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && commentText.trim()) {
                                        if (replyingTo) handleAddReply(t, replyingTo.commentId);
                                        else handleAddComment(t);
                                      }
                                    }}
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      if (replyingTo) handleAddReply(t, replyingTo.commentId);
                                      else handleAddComment(t);
                                    }}
                                    disabled={!commentText.trim()}
                                    className="bg-[#C8A97E] text-black px-3 py-2 rounded-xl hover:bg-white transition-colors disabled:opacity-40 cursor-pointer text-xs"
                                  >
                                    <Send size={13} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="py-2 text-center text-[#8A8580] font-mono text-[10px] uppercase tracking-wider">
                                Comments are turned off for this story
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
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
            const todayDateStr = new Date().toLocaleDateString('en-IN', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            const isToday = formattedDate === todayDateStr;
            const currentEntry = entries.find(e => e.date === formattedDate);
            const hasEntry = !!currentEntry;
            const isSelected = selectedDate === formattedDate;
            
            const displayContent = hasEntry ? (currentEntry.moodEmoji || '📓') : day;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : formattedDate)}
                className={`p-2 w-8 h-8 mx-auto rounded-full flex items-center justify-center font-mono transition-all ${
                  isSelected ? "bg-[#C8A97E] text-black font-bold shadow-[0_0_10px_rgba(200,169,126,0.5)] text-xs"
                  : hasEntry ? "bg-[#C8A97E]/20 text-[#C8A97E] border border-[#C8A97E]/40 hover:bg-[#C8A97E]/30 text-lg hover:scale-110" 
                  : isToday ? "border border-[#C8A97E]/60 text-[#E8E4DC] font-bold hover:bg-[#C8A97E]/10 text-xs"
                  : "text-[#A09A95] hover:bg-white/5 text-xs"
                }`}
                title={hasEntry ? `Entry: ${formattedDate}` : isToday ? `Today: ${formattedDate}` : formattedDate}
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
  const [diarySearch, setDiarySearch] = useState("");
  
  const todayFormatted = new Date().toLocaleDateString('en-IN', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  const hasWrittenToday = diaryEntries.some(entry => entry.date === todayFormatted);

  const clearAainaCache = () => {
    if (auth.currentUser) {
      localStorage.removeItem(`aaina_date_${auth.currentUser.uid}`);
      localStorage.removeItem(`aaina_data_${auth.currentUser.uid}`);
      localStorage.removeItem(`aaina_date_v3_${auth.currentUser.uid}_offset_0`);
      localStorage.removeItem(`aaina_data_v3_${auth.currentUser.uid}_offset_0`);
    }
  };

  const handleDeleteToday = async () => {
    const todayEntry = diaryEntries.find(entry => entry.date === todayFormatted);
    if (todayEntry && todayEntry.id) {
      if (!window.confirm("Are you sure you want to rewrite today's entry? It will permanently delete what you wrote today.")) return;
      try {
        await deleteDoc(doc(db, "diaries", todayEntry.id));
        setDiaryEntries(diaryEntries.filter(entry => entry.id !== todayEntry.id));
        if (selectedDate === todayFormatted) setSelectedDate(null);
        clearAainaCache();
        window.dispatchEvent(new Event("diaryUpdated"));
      } catch (error) {
        console.error("Error deleting today's entry:", error);
      }
    }
  };

  const handleDeleteEntry = async (entryToDelete) => {
    if (!entryToDelete?.id) return;
    if (!window.confirm(`Delete diary entry from ${entryToDelete.date}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "diaries", entryToDelete.id));
      setDiaryEntries(diaryEntries.filter(entry => entry.id !== entryToDelete.id));
      if (selectedDate === entryToDelete.date && !diaryEntries.some(e => e.date === entryToDelete.date && e.id !== entryToDelete.id)) {
        setSelectedDate(null);
      }
      clearAainaCache();
      window.dispatchEvent(new Event("diaryUpdated"));
    } catch (error) {
      console.error("Error deleting diary entry:", error);
    }
  };

  const handleSave = async () => {
    if (!newEntry.trim() || !auth.currentUser) return;
    setIsSaving(true);
    
    let moodEmoji = "📓";
    
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
      
      clearAainaCache();
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
    <div className="animate-fade-in pt-32 pb-24 md:pb-20 px-6 md:px-12 lg:px-20 min-h-screen">
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
              <span>{selectedDate ? `Entries for ${selectedDate.split(',')[1] || selectedDate}` : "Past Pages"}</span>
              {selectedDate && (
                <button onClick={() => setSelectedDate(null)} className="font-mono text-[10px] text-[#8A8580] hover:text-[#C8A97E] uppercase transition-colors cursor-pointer mb-1">
                  Clear Filter
                </button>
              )}
            </h3>
            
            <div className="space-y-4 overflow-y-auto max-h-[400px] custom-scrollbar pr-2">
              {filteredEntries.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-[#5A5550] font-serif">
                  {selectedDate ? "No entries found for this date." : "Your diary is empty. \n Take a deep breath and start writing."}
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <div key={entry.id} className="bg-white/[0.02] border border-white/[0.05] p-5 rounded-xl hover:border-[#C8A97E]/30 transition-colors group relative cursor-default shadow-sm">
                    <div className="flex justify-between items-start mb-3 border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl bg-white/5 w-10 h-10 rounded-full flex items-center justify-center border border-white/10 group-hover:border-[#C8A97E]/40 transition-colors shadow-sm flex-shrink-0" title="AI Mood Analysis">
                          {entry.moodEmoji || "📓"}
                        </span>
                        <div>
                          <div className="font-serif text-[#C8A97E] text-base font-bold leading-tight">{entry.date}</div>
                          <div className="font-mono text-[10px] text-[#5A5550] tracking-widest mt-0.5">{entry.time}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteEntry(entry)}
                        className="text-[#8A8580] hover:text-red-400 p-1.5 rounded-md hover:bg-red-500/10 transition-colors opacity-70 sm:opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Delete entry"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
const ProfileSetupPage = ({ profile, setProfile, onComplete }) => {
  const [nameInput, setNameInput] = useState(profile.name || "");
  const [collegeInput, setCollegeInput] = useState(profile.college || "");
  const [branchInput, setBranchInput] = useState(profile.branch || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async (e) => {
    e.preventDefault();
    if (!auth.currentUser || !nameInput.trim()) return;
    setIsSaving(true);

    try {
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(userDocRef, {
        name: nameInput.trim(),
        college: collegeInput.trim(),
        branch: branchInput.trim(),
        profileComplete: true,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setProfile(prev => ({
        ...prev,
        name: nameInput.trim(),
        college: collegeInput.trim(),
        branch: branchInput.trim()
      }));

      onComplete();
    } catch (error) {
      console.error("Error saving profile setup:", error);
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in min-h-screen flex items-center justify-center pt-20 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(200,169,126,0.03)_0%,transparent_50%)] pointer-events-none" />
      <div className="w-full max-w-md bg-[#0A0A0F]/80 backdrop-blur-xl border border-[#C8A97E]/20 rounded-2xl p-8 shadow-[0_0_50px_rgba(200,169,126,0.1)] relative z-10">
        
        <div className="text-center mb-8">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[#C8A97E] uppercase mb-2">Almost there</div>
          <h2 className="font-serif text-3xl font-light text-[#E8E4DC]">Complete your profile</h2>
          <p className="mt-2 font-serif text-[#A09A95] text-sm">
            This helps Darpan personalize your space.
          </p>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full border-2 border-[#C8A97E]/50 overflow-hidden bg-[#141419] flex items-center justify-center shadow-[0_0_20px_rgba(200,169,126,0.15)]">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="font-serif text-2xl font-bold text-[#C8A97E]">
                {nameInput ? nameInput.charAt(0).toUpperCase() : "S"}
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] text-[#5A5550] mt-2">
            Synced from your Google account
          </span>
        </div>

        <form onSubmit={handleContinue} className="space-y-5">
          <div className="space-y-2">
            <label className="font-mono text-[10px] tracking-widest text-[#8A8580] uppercase block">Full name</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5550]" />
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-[#141419] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-[#E8E4DC] font-serif focus:outline-none focus:border-[#C8A97E]/50 transition-colors shadow-inner"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-mono text-[10px] tracking-widest text-[#8A8580] uppercase block">Name of College or school</label>
            <div className="relative">
              <Building className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5550]" />
              <input
                type="text"
                value={collegeInput}
                onChange={(e) => setCollegeInput(e.target.value)}
                placeholder="e.g. BCE Bakhtiyarpur"
                className="w-full bg-[#141419] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-[#E8E4DC] font-serif focus:outline-none focus:border-[#C8A97E]/50 transition-colors shadow-inner"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-mono text-[10px] tracking-widest text-[#8A8580] uppercase block">Branch or class</label>
            <div className="relative">
              <BookOpen className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5550]" />
              <input
                type="text"
                value={branchInput}
                onChange={(e) => setBranchInput(e.target.value)}
                placeholder="e.g. CSE, or Class 12"
                className="w-full bg-[#141419] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-[#E8E4DC] font-serif focus:outline-none focus:border-[#C8A97E]/50 transition-colors shadow-inner"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving || !nameInput.trim()}
            className="w-full py-4 bg-[#C8A97E] text-black font-mono text-xs tracking-widest uppercase font-bold hover:bg-white transition-colors rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_20px_rgba(200,169,126,0.2)]"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continue to Darpan"}
          </button>

          <p className="text-center font-mono text-[10px] text-[#5A5550]">
            You can edit this anytime from your profile.
          </p>
        </form>
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
                  <span className="font-mono text-[9px] uppercase tracking-widest">Google Safe <span className="opacity-60">↗</span></span>
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
  const [pushToast, setPushToast] = useState(null); // Foreground FCM toast notification
  const [pushPermission, setPushPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
  const [pushBannerDismissed, setPushBannerDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('push_banner_dismissed');
    }
    return false;
  });

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

  let fallbackUnsubscribe = null;
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
    setRealtimeNotifications(loadedNotifs);
  }, (error) => {
    console.warn("⚠️ Notification indexed query failed (likely missing composite index), attempting fallback sort:", error?.message);
    try {
      const qFallback = query(
        collection(db, "notifications"),
        where("userId", "==", auth.currentUser.uid),
        limit(20)
      );
      fallbackUnsubscribe = onSnapshot(qFallback, (fbSnapshot) => {
        const loadedNotifs = [];
        fbSnapshot.forEach((doc) => {
          loadedNotifs.push({ id: doc.id, ...doc.data() });
        });
        loadedNotifs.sort((a, b) => {
          const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt || 0);
          const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt || 0);
          return tB - tA;
        });
        setRealtimeNotifications(loadedNotifs.slice(0, 10));
      }, (fbErr) => {
        console.error("❌ Fallback notification query failed:", fbErr);
      });
    } catch (e) {
      console.error("❌ Error setting up fallback listener:", e);
    }
  });

  return () => {
    unsubscribe();
    if (fallbackUnsubscribe) fallbackUnsubscribe();
  };
}, [isLoggedIn]);
  const [userStories, setUserStories] = useState([]);
  const [diaryEntries, setDiaryEntries] = useState([]);
  
  const [profile, setProfile] = useState({
    name: "Student", email: "", photoURL: null, college: "", branch: ""
  });
const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "model",
      parts: [{ text: "Namaste! I am Sathi. I am here to listen, whether you want to talk about exams, stress, or just your day. You can type or use the microphone to speak to me in English, Hindi, or Hinglish. How are you feeling right now?" }]
    }
  ]);
// Service Worker Registration — enables background push notifications
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope);
        })
        .catch((err) => {
          console.error('❌ Service Worker registration failed:', err);
        });
    }
  }, []);

  // Listen for notification-click navigation from the service worker
  // When user taps a push notification, the SW sends a 'sw_navigate' event
  useEffect(() => {
    const handleSWNavigate = (e) => {
      const page = e.detail?.page;
      if (page && isLoggedIn) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setCurrentPage(page);
      }
    };
    window.addEventListener('sw_navigate', handleSWNavigate);
    return () => window.removeEventListener('sw_navigate', handleSWNavigate);
  }, [isLoggedIn]);

  const requestNotificationPermission = async (user, forcePrompt = false) => {
    try {
      if (!("Notification" in window)) return false;
      if (Notification.permission === "denied" && !forcePrompt) return false;

      let swReg = null;
      if ('serviceWorker' in navigator) {
        try {
          swReg = await navigator.serviceWorker.ready;
        } catch (e) {
          console.warn("SW ready check error:", e);
        }
      }

      let perm = Notification.permission;
      if (perm !== "granted") {
        perm = await Notification.requestPermission();
      }
      setPushPermission(perm);
      if (perm !== "granted") {
        console.warn("Notification permission status:", perm);
        return false;
      }

      const tokenOptions = { 
        vapidKey: "BDBEe-7SAS90LwTMU_UoA0aafej2PRiFJfbclGssYNWM0uoajoi2h1TPK_gQdOoh9s7o3fwl-sZs6F2NbR7OG5Q" 
      };
      if (swReg) {
        tokenOptions.serviceWorkerRegistration = swReg;
      }

      const currentToken = await getToken(messaging, tokenOptions);

      if (currentToken && user) {
        console.log("✅ FCM Token registered for this device:", currentToken.slice(0, 20) + "...");
        await setDoc(doc(db, "users", user.uid), {
          fcmTokens: arrayUnion(currentToken),
          fcmToken: currentToken,
          name: user.displayName || "Darpan Student",
          email: user.email,
          notificationsEnabled: true
        }, { merge: true });
        return true;
      }
      return false;
    } catch (error) {
      console.warn("FCM token registration skipped:", error?.message || error);
      return false;
    }
  };

  // Foreground FCM listener: when app is open in tab, display popup toast
  useEffect(() => {
    if (!isLoggedIn) return;
    try {
      const unsubscribeFCM = onMessage(messaging, (payload) => {
        console.log("Foreground FCM message received:", payload);
        const title = payload.notification?.title || payload.data?.title || 'DARPAN';
        const body  = payload.notification?.body  || payload.data?.body  || 'New notification on your story!';
        setPushToast({
          title,
          body,
          link: '/?page=stories'
        });
        setTimeout(() => setPushToast(null), 6000);
      });
      return () => unsubscribeFCM();
    } catch (err) {
      console.warn("FCM foreground listener failed:", err);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.matchMedia("(max-width: 768px)").matches || 'ontouchstart' in window);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

    // Real-time diaries listener with safe JS sort (keeps Diary & Mood Canvas 100% in sync without refresh)
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) return;
    const q = query(collection(db, "diaries"), where("userId", "==", auth.currentUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const loaded = [];
      snapshot.forEach((doc) => loaded.push({ id: doc.id, ...doc.data() }));
      loaded.sort((a, b) => {
        const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });
      setDiaryEntries(loaded);
    }, (err) => console.warn("Real-time diaries error:", err));
    return () => unsub();
  }, [isLoggedIn]);

  // Real-time stories listener (new stories, comments, likes sync across devices without refresh)
  useEffect(() => {
    if (!isLoggedIn) return;
    const q = query(collection(db, "stories"));
    const unsub = onSnapshot(q, (snapshot) => {
      const loaded = [];
      snapshot.forEach(doc => loaded.push({ id: doc.id, ...doc.data() }));
      loaded.sort((a, b) => {
        const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });
      setUserStories(loaded);
    }, (err) => console.warn("Real-time stories error:", err));
    return () => unsub();
  }, [isLoggedIn]);
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

        try {
          const userDocRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(userDocRef);
          const userData = docSnap.exists() ? docSnap.data() : null;

          const hasCollege = userData?.college && userData.college.trim() !== "";
          const hasBranch = userData?.branch && userData.branch.trim() !== "";

          if (hasCollege && hasBranch) {
            setProfile(prev => ({
              ...prev,
              college: userData.college,
              branch: userData.branch,
              name: userData.name || prev.name
            }));
            setNeedsProfileSetup(false);
          } else {
            if (userData?.name) {
              setProfile(prev => ({ ...prev, name: userData.name }));
            }
            setNeedsProfileSetup(true);
          }
        } catch (error) {
          console.error("Error checking profile completeness:", error);
          setNeedsProfileSetup(true);
        }

        setIsCheckingProfile(false);

        // real-time onSnapshot active for diaries
        fetchUserChats();
        // real-time onSnapshot active for stories
        await requestNotificationPermission(user);
      } else {
        setIsLoggedIn(false);
        setIsCheckingProfile(false);
      }
    });

    return () => unsubscribe();
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const params = new URLSearchParams(window.location.search);
    const targetPage = params.get('page');

    if (!isLoggedIn && currentPage !== "login") {
      setCurrentPage("landing");
    } else if (isLoggedIn && !needsProfileSetup) {
      if (targetPage && (currentPage === "login" || currentPage === "landing" || currentPage === "home")) {
        setCurrentPage(targetPage);
      } else if (currentPage === "login" || currentPage === "landing") {
        setCurrentPage("home");
      }
    }
  }, [isLoggedIn, currentPage, needsProfileSetup]);
const renderPage = () => {
    if (!isLoggedIn) {
      if (currentPage === "login") return <AuthPage setPage={setCurrentPage} setIsLoggedIn={setIsLoggedIn} />;
      return <LandingPage setPage={setCurrentPage} />;
    }

    if (isCheckingProfile) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#C8A97E] animate-spin" />
        </div>
      );
    }

    if (needsProfileSetup) {
      return (
        <ProfileSetupPage
          profile={profile}
          setProfile={setProfile}
          onComplete={() => {
            setNeedsProfileSetup(false);
            setCurrentPage("home");
          }}
        />
      );
    }
    
    switch(currentPage) {
      case "home": return <HomePage setPage={setCurrentPage} announcement={announcement} />;
      case "stories": return <StoriesPage userStories={userStories} setUserStories={setUserStories} profile={profile} />;
      case "diary": return <DiaryPage diaryEntries={diaryEntries} setDiaryEntries={setDiaryEntries} />;
     case "report": return <WeeklyAaina currentUser={auth.currentUser} diaryEntries={diaryEntries} setPage={setCurrentPage} />;
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

      {/* Mobile Bottom Navigation Bar (Thumb-friendly 1-tap navigation for mobile devices) */}
      {isLoggedIn && !needsProfileSetup && currentPage !== "landing" && currentPage !== "login" && currentPage !== "chat" && (
        <nav 
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-2xl border-t border-white/10 px-2 py-2 shadow-2xl flex items-center justify-around"
        >
          {[
            { id: "home", label: "Home", icon: Sparkles },
            { id: "stories", label: "Stories", icon: Globe },
            { id: "diary", label: "Diary", icon: BookOpen },
            { id: "report", label: "Canvas", icon: BarChart },
            { id: "chat", label: "Sathi", icon: Brain, highlight: true },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setCurrentPage(item.id);
                }}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative ${
                  isActive 
                    ? "text-[#C8A97E]" 
                    : item.highlight 
                      ? "text-[#C8A97E]/80 hover:text-[#C8A97E]" 
                      : "text-[#8A8580] hover:text-[#E8E4DC]"
                }`}
              >
                {isActive && (
                  <span className="absolute -top-1 w-6 h-0.5 bg-[#C8A97E] rounded-full shadow-[0_0_8px_#C8A97E]" />
                )}
                <div className={`p-1 rounded-lg ${item.highlight && !isActive ? "bg-[#C8A97E]/10" : ""}`}>
                  <Icon className={`w-5 h-5 ${item.highlight ? "animate-pulse" : ""}`} />
                </div>
                <span className="font-mono text-[9px] tracking-wider uppercase mt-0.5 font-medium">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
      <ForegroundPushToast toast={pushToast} onDismiss={() => setPushToast(null)} />

      {/* Background Push Notification Opt-in Prompt */}
      {isLoggedIn && !needsProfileSetup && pushPermission === 'default' && !pushBannerDismissed && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[110] max-w-md bg-[#0D0B12]/95 border border-[#C8A97E]/40 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-fade-in">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#C8A97E]/15 border border-[#C8A97E]/30 flex items-center justify-center shrink-0 text-xl">
              🔔
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-serif text-[#C8A97E] text-base font-semibold leading-tight">Turn on Background Notifications</h4>
              <p className="font-mono text-xs text-[#E8E4DC]/80 mt-1 leading-relaxed">
                Jab DARPAN band ho tab bhi comments & replies ka popup screen par aayega — ek tap me khol sakein.
              </p>
              <div className="flex items-center gap-2.5 mt-3">
                <button
                  onClick={async () => {
                    const ok = await requestNotificationPermission(auth.currentUser, true);
                    if (ok) {
                      setPushToast({
                        title: "🔔 Notifications Enabled!",
                        body: "Aapko ab DARPAN band hone par bhi popups milenge.",
                        link: "/?page=stories"
                      });
                    }
                  }}
                  className="px-3.5 py-1.5 bg-[#C8A97E] hover:bg-white text-black font-mono text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-md"
                >
                  Allow Notifications
                </button>
                <button
                  onClick={() => {
                    setPushBannerDismissed(true);
                    localStorage.setItem('push_banner_dismissed', '1');
                  }}
                  className="px-2.5 py-1.5 text-[#8A8580] hover:text-[#E8E4DC] font-mono text-[11px] transition-colors cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setPushBannerDismissed(true);
                localStorage.setItem('push_banner_dismissed', '1');
              }}
              className="text-[#8A8580] hover:text-white transition-colors cursor-pointer p-0.5"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      <PWAInstallBanner />

      {isLoggedIn && currentPage !== "chat" && <Footer />}
    </div>
  );
}

