// Use this component to render each notification inside your panel
export default function NotificationCard({ notification }) {
  const isUnread = !notification.isRead;
  return (
    <div className={`p-3 mb-1 rounded-xl border ${isUnread ? "bg-[#151515] border-[#333]" : "bg-transparent border-transparent"}`}>
      <p className="text-[13px] text-gray-300">
        <span className="font-bold text-white">{notification.senderName}</span> 
        {notification.type === 'like_comment' ? ' liked your comment.' : ' replied to you.'}
      </p>
    </div>
  );
}