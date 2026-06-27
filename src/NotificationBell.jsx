import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import NotificationCard from './NotificationCard.jsx';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase.js'; // Ensure path sahi ho

export default function NotificationBell({ notifications = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Unread count nikalna
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Mark as read function
  const handleMarkAsRead = async (id) => {
    try {
      await updateDoc(doc(db, "notifications", id), { isRead: true });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  // Delete function
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="relative p-2 text-[#8A8580] hover:text-[#C8A97E] transition cursor-pointer"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1.5 h-2 w-2 bg-red-500 rounded-full border border-[#06060A] shadow-[0_0_5px_rgba(239,68,68,0.8)]"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-[#0A0A0F] rounded-2xl border border-[#C8A97E]/30 p-3 z-50 shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-fade-in">
          <div className="flex justify-between items-center mb-3 px-1 border-b border-white/10 pb-2">
            <h3 className="text-[#C8A97E] font-serif font-bold text-lg">Notifications</h3>
            <span className="font-mono text-[10px] text-[#8A8580]">{unreadCount} New</span>
          </div>
          
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
              <p className="text-[#5A5550] font-serif text-sm text-center py-6">All caught up! No new notifications.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
