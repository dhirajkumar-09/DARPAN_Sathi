import React from 'react';
import { Trash2, Heart, MessageSquare, MessageCircle } from 'lucide-react';

const TYPE_CONFIG = {
  comment: { icon: MessageSquare, text: "commented on your story.", color: "#C8A97E" },
  reply: { icon: MessageCircle, text: "replied to your comment.", color: "#7EB8C8" },
  like: { icon: Heart, text: "liked your story.", color: "#C8A97E" },
  comment_like: { icon: Heart, text: "liked your comment.", color: "#C8A97E" },
};

export default function NotificationCard({ notification, onMarkAsRead, onDelete }) {
  const isUnread = !notification.isRead;
  const config = TYPE_CONFIG[notification.type] || { icon: MessageSquare, text: "interacted with you.", color: "#C8A97E" };
  const Icon = config.icon;

  return (
    <div
      onClick={() => { if(isUnread) onMarkAsRead(notification.id) }}
      className={`relative p-3 mb-2 rounded-xl border transition-all cursor-pointer group ${
        isUnread 
          ? "bg-[#C8A97E]/10 border-[#C8A97E]/40" 
          : "bg-transparent border-white/5 hover:bg-white/5"
      }`}
    >
      <div className="pr-8 flex items-start gap-2">
        <Icon size={14} className="mt-1 shrink-0" style={{ color: config.color }} />
        <div>
          <p className="text-[14px] font-serif text-[#E8E4DC] leading-snug">
            <span className="font-bold text-[#C8A97E]">{notification.senderName}</span>
            {' '}{config.text}
          </p>
          {notification.snippet && (
            <p className="text-[12px] font-serif text-[#8A8580] italic mt-0.5">"{notification.snippet}"</p>
          )}
          <span className="text-[9px] text-[#5A5550] font-mono mt-1.5 block uppercase tracking-widest">
            {notification.createdAt?.toDate ? notification.createdAt.toDate().toLocaleDateString() : 'Just now'}
          </span>
        </div>
      </div>

      <button
        onClick={(e) => { 
          e.stopPropagation();
          onDelete(notification.id); 
        }}
        className="absolute top-1/2 -translate-y-1/2 right-3 text-[#5A5550] hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-red-400/10 opacity-0 group-hover:opacity-100"
        title="Delete Notification"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
