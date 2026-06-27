import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import NotificationCard from './NotificationCard.jsx'; 

// 🔥 Array hardcoded hatakar ab props se data le rha hai
export default function NotificationBell({ notifications = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Jo notifications abhi tak padhi nahi gayi hain (Unread count)
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="relative p-2 text-gray-300 hover:text-white transition cursor-pointer"
      >
        <Bell size={24} />
        {/* Agar unread notification hain, tabhi laal bindi dikhegi */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border border-black"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-[#0a0a0a] rounded-xl border border-[#333] p-2 z-50 shadow-lg">
          <h3 className="text-white font-bold p-2 text-sm border-b border-[#333] mb-2">
            Notifications
          </h3>
          
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <NotificationCard key={notif.id} notification={notif} />
            ))
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">No new notifications</p>
          )}
        </div>
      )}
    </div>
  );
}