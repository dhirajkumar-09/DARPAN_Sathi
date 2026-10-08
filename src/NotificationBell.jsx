import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Send, Check, ShieldAlert, Sparkles } from 'lucide-react';
import NotificationCard from './NotificationCard.jsx';
import { doc, updateDoc, deleteDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { db, auth, messaging } from './firebase.js';

const BACKEND_URL = "https://dapan-api-secure.onrender.com";

export default function NotificationBell({ notifications = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const containerRef = useRef(null);
  
  // Unread count
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  // Request push notification permission
  const handleEnablePush = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support web push notifications.");
      return;
    }
    setIsEnabling(true);
    try {
      let swReg = null;
      if ('serviceWorker' in navigator) {
        swReg = await navigator.serviceWorker.ready;
      }

      const permission = await Notification.requestPermission();
      setPushStatus(permission);

      if (permission === 'granted' && auth.currentUser) {
        const tokenOpts = {
          vapidKey: "BDBEe-7SAS90LwTMU_UoA0aafej2PRiFJfbclGssYNWM0uoajoi2h1TPK_gQdOoh9s7o3fwl-sZs6F2NbR7OG5Q"
        };
        if (swReg) tokenOpts.serviceWorkerRegistration = swReg;

        const token = await getToken(messaging, tokenOpts);
        if (token) {
          await setDoc(doc(db, "users", auth.currentUser.uid), {
            fcmTokens: arrayUnion(token),
            fcmToken: token,
            name: auth.currentUser.displayName || "Darpan Student",
            email: auth.currentUser.email
          }, { merge: true });
        }
      }
    } catch (err) {
      console.error("Error enabling push:", err);
    } finally {
      setIsEnabling(false);
    }
  };

  // Trigger test push from backend
  const handleTestPush = async () => {
    if (!auth.currentUser) return;
    setIsSendingTest(true);
    setTestSuccess(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/notifications/test-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          userName: auth.currentUser.displayName || "Friend"
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestSuccess(true);
        setTimeout(() => setTestSuccess(false), 5000);
      } else {
        alert(data.error || "Please allow browser notifications first.");
      }
    } catch (err) {
      console.error("Test push failed:", err);
    } finally {
      setIsSendingTest(false);
    }
  };

  // Mark single as read
  const handleMarkAsRead = async (id) => {
    try {
      await updateDoc(doc(db, "notifications", id), { isRead: true });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      const unreadList = notifications.filter(n => !n.isRead);
      await Promise.all(
        unreadList.map(n => updateDoc(doc(db, "notifications", n.id), { isRead: true }))
      );
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  // Delete notification
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)} 
        className="relative p-2.5 rounded-xl text-[#8A8580] hover:text-[#C8A97E] hover:bg-white/5 transition-all cursor-pointer focus:outline-none"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-[#06060A] shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 sm:right-0 mt-3 w-84 max-w-[calc(100vw-2rem)] bg-[#0A0A0F]/95 backdrop-blur-2xl rounded-2xl border border-[#C8A97E]/30 p-3.5 z-[120] shadow-[0_15px_50px_rgba(0,0,0,0.9)] animate-fade-in">
          {/* Header */}
          <div className="flex justify-between items-center mb-2 px-1 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[#C8A97E] font-serif font-bold text-lg leading-none">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-[#C8A97E]/20 text-[#C8A97E] text-[10px] font-mono px-2 py-0.5 rounded-full border border-[#C8A97E]/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="font-mono text-[10px] text-[#8A8580] hover:text-[#A8C87E] flex items-center gap-1 transition-colors cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck size={13} />
                <span>All read</span>
              </button>
            )}
          </div>

          {/* Background Push Status & Test Bar */}
          <div className="mb-3 px-2 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${pushStatus === 'granted' ? 'bg-[#A8C87E] shadow-[0_0_6px_#A8C87E]' : 'bg-[#E8A87E]'}`} />
              <span className="text-[#A09A95] text-[11px]">
                {pushStatus === 'granted' ? 'Device Alerts: ON' : 'Device Alerts: OFF'}
              </span>
            </div>
            {pushStatus === 'granted' ? (
              <button
                onClick={handleTestPush}
                disabled={isSendingTest}
                className="px-2 py-0.5 rounded bg-[#C8A97E]/15 hover:bg-[#C8A97E]/30 text-[#C8A97E] text-[10px] tracking-wider uppercase transition-colors flex items-center gap-1 cursor-pointer"
                title="Send a test notification to verify your device receives popups"
              >
                {isSendingTest ? (
                  <span>Sending...</span>
                ) : testSuccess ? (
                  <span className="text-[#A8C87E] flex items-center gap-1"><Check size={11} /> Sent!</span>
                ) : (
                  <span className="flex items-center gap-1"><Send size={10} /> Test</span>
                )}
              </button>
            ) : (
              <button
                onClick={handleEnablePush}
                disabled={isEnabling}
                className="px-2 py-0.5 rounded bg-[#C8A97E] hover:bg-white text-black font-bold text-[10px] tracking-wider uppercase transition-colors cursor-pointer"
              >
                {isEnabling ? 'Enabling...' : 'Enable 🔔'}
              </button>
            )}
          </div>

          {testSuccess && (
            <div className="mb-2.5 px-2.5 py-1.5 rounded-lg bg-[#A8C87E]/10 border border-[#A8C87E]/30 text-[#A8C87E] font-mono text-[10px] flex items-center gap-1.5 animate-fade-in">
              <Sparkles size={12} />
              <span>Test push sent! Check your system notification popup.</span>
            </div>
          )}
          
          {/* Notifications List */}
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <NotificationCard 
                  key={notif.id} 
                  notification={notif} 
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                />
              ))
            ) : (
              <div className="text-center py-8 px-4">
                <Bell size={24} className="mx-auto text-[#5A5550] mb-2 opacity-60" />
                <p className="text-[#8A8580] font-serif text-sm">All caught up!</p>
                <p className="text-[#5A5550] font-mono text-[10px] uppercase tracking-wider mt-1">No new notifications</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
