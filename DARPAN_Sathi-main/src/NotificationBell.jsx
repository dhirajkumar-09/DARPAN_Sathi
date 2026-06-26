import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import NotificationCard from './NotificationCard'; 

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  
  // 🔥 YAHAN ARRAY KHALI (Empty) KAR DO
  const notifications = []; 

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="relative p-2 text-gray-300 hover:text-white transition cursor-pointer"
      >
        <Bell size={24} />
        {/* Agar notifications 0 hain, toh lal bindi bhi nahi dikhegi */}
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border border-black"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-[#0a0a0a] rounded-xl border border-[#333] p-2 z-50 shadow-lg">
          <h3 className="text-white font-bold p-2 text-sm border-b border-[#333] mb-2">
            Notifications
          </h3>
          
          {/* 🔥 AB YAHAN KUCH NAHI DIKHEGA, SIRF "No new notifications" AAYEGA */}
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