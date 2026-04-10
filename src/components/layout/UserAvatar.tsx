import { useState, useRef, useEffect, useMemo } from 'react';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useNavigate } from "react-router-dom"

function generateAvatarDataUrl(char: string): string {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 绘制圆形背景
  ctx.fillStyle = '#31bc9f';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // 绘制文字
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, size / 2, size / 2 + 2);

  return canvas.toDataURL('image/png');
}

export function UserAvatar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const logout = useAuthStore((state) => state.logout);
  const username = useAuthStore((state) => state.username);
  const navigate = useNavigate();

  const displayChar = username ? username.charAt(0).toUpperCase() : 'A';
  const avatarSrc = useMemo(() => generateAvatarDataUrl(displayChar), [displayChar]);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate("/login")
  };

  return (
    <div ref={menuRef} className="relative">
      {/* 头像按钮 */}
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/5 dark:bg-white/5 text-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-haspopup="true"
        aria-expanded={menuOpen}
        aria-label="User menu"
      >
        <img
          src={avatarSrc}
          alt={displayChar}
          className="h-8 w-8 rounded-full object-cover"
        />
      </button>

      {/* 下拉菜单 */}
      {menuOpen && (
        <div className="absolute right-0 top-10 z-50 w-48 rounded-md bg-background p-1 shadow-lg border border-border">
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
