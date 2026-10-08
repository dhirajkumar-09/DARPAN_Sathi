import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import NotificationCard from './NotificationCard.jsx';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase.js';

export default function NotificationBell({ notifications = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  
  // Unread count
  const unreadCount = notifications.filter(n => !n.isRead).length;

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
        <div className="absolute right-0 sm:right-0 mt-3 w-80 max-w-[calc(100vw-2rem)] bg-[#0A0A0F]/95 backdrop-blur-2xl rounded-2xl border border-[#C8A97E]/30 p-3.5 z-[120] shadow-[0_15px_50px_rgba(0,0,0,0.9)] animate-fade-in">
          <div className="flex justify-between items-center mb-3 px-1 border-b border-white/10 pb-2.5">
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
          
          <div className="max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
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

