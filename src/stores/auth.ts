/**
 * Auth State Store
 * Manages authentication state in memory only (no persistence)
 */
import { create } from 'zustand';

interface UserInfo {
  id: string;
  userName: string;
  userAccount: string;
  logoFileId?: string;
  email?: string;
  deptName?: string;
  deptId?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  userInfo: UserInfo | null;

  // Actions
  login: (username: string, pwd: string, isRemember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  ssoLoginStatus: (loginToken: string) => Promise<void>;
  fetchUserInfo: () => Promise<void>;
}
const apiUrl = import.meta.env.VITE_API_URL;

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  username: null,
  userInfo: null,

  login: async (username, pwd, isRemember) => {
    const response = await fetch(`${apiUrl}/api/identification/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.trim(),
        password: pwd,
        loginType: 2,
        isRemember,
      }),
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    console.log('response', response);
    const data = await response.json();
    if (data.code === 0) {
      set({
        isAuthenticated: true,
      });
    } else {
      throw new Error(data.message);
    }
  },

  logout: async () => {
    await fetch('/api/identification/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log("------------")
    // 清除 AIGC_SESSION cookie
    document.cookie = 'AIGC_SESSION=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';

    set({
      isAuthenticated: false,
      username: null,
      userInfo: null,
    });
  },

  ssoLoginStatus: async (loginToken) => {
    const response = await fetch(`${apiUrl}/sso/loginStatus/${loginToken}`, {
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error('Login failed');
    }
    const data = await response.json();
    console.log('data', data);
    if (data.code === 0) {
      set({
        isAuthenticated: true,
      });
      return data.data
    } else {
      throw new Error(data.message);
    }
  },

  fetchUserInfo: async () => {
    const response = await fetch('/api/v1/user/info');

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    console.log('data', data);
    if (data.code === 0 && data.data) {
      set({
        userInfo: data.data,
        username: data.data.userName || null,
      });
    } else {
      throw new Error(data.message || 'Failed to fetch user info');
    }
  },
}));
