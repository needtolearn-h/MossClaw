/**
 * Login Page
 * User authentication entry point - state stored in memory only
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TitleBar } from '@/components/layout/TitleBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import clawxIcon from '@/assets/logo.svg';
import { Verify, type VerifyRef } from '@/pages/Login/verifition';

interface PendingLogin {
  username: string;
  password: string;
  isRemember: boolean;
}

export function Login() {
  const { t } = useTranslation('login');
  const navigate = useNavigate();
  const { login, isAuthenticated, ssoLoginStatus } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRemember, setIsRemember] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const pendingLoginRef = useRef<PendingLogin | null>(null);
  const verifyRef = useRef<VerifyRef>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      return;
    }

    // Save credentials and show captcha
    pendingLoginRef.current = {
      username: username.trim(),
      password: password.trim(),
      isRemember,
    };
    setShowCaptcha(true);
  };

  const handleCaptchaSuccess = async (result: { captchaVerification: string }) => {
    const pending = pendingLoginRef.current;
    if (!pending) return;

    setIsLoading(true);
    try {
      await login(
        pending.username,
        pending.password,
        pending.isRemember,
        result.captchaVerification
      );
    } catch (err) {
      console.error('Login failed:', err);
      toast.error(String(err));
      setShowCaptcha(false)
    } finally {
      setIsLoading(false);
      pendingLoginRef.current = null;
    }
  };

  const handleCaptchaError = () => {
    // pendingLoginRef.current = null;
  };

  const baseUrl = import.meta.env.VITE_BASE_URL;
  const [loginToken, setLoginToken] = useState('');

  // SSO登录 - 使用系统默认浏览器打开
  const handleSSOLogin = async () => {
    try {
      let returnUrl = `${baseUrl}/#/loginRedirect`;
      const encodeUrl = encodeURIComponent(returnUrl);
      const randomVal = String(Math.random());
      setLoginToken(randomVal);
      console.log(`[SSO] Login token: ${loginToken}`);
      localStorage.setItem('loginToken', randomVal);
      location.href = `${baseUrl}/sso/ssoLoginPage?returnUrl=${encodeUrl}&loginToken=${randomVal}`;
    } catch (error) {
      console.error('Failed to open external browser:', error);
      // 降级方案：在当前窗口打开
      location.href = `${baseUrl}/sso/ssoLoginPage`;
    }
  };

  const getLoginStatus = () => {
    const loginToken = localStorage.getItem('loginToken');
    if (loginToken) {
      ssoLoginStatus(loginToken).then((res: any) => {
        if (res === '1') {
          localStorage.setItem('loginToken', '');
          navigate('/');
        }
      }).catch(err => {
        localStorage.setItem('loginToken', '');
        toast.error(String(err));
      })
    }
  };
  useEffect(() => {
    getLoginStatus();
  }, [])
  
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background bg-[#f7f9fb]">
      {/* Background Spheres */}
      {/* Top-right sphere - shows bottom-left 3/4 */}
      <div
        className="absolute -top-[25%] -right-[8%] rounded-full pointer-events-none blur-3xl"
        style={{
          width: '33.33%',
          paddingBottom: '33.33%',
          backgroundColor: '#7657FF1A',
        }}
      />
      {/* Bottom-left sphere - shows top-right 3/4 */}
      <div
        className="absolute -bottom-[25%] -left-[8%] rounded-full pointer-events-none blur-3xl"
        style={{
          width: '33.33%',
          paddingBottom: '33.33%',
          backgroundColor: '#7657FF1A',
        }}
      />

      <TitleBar />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative flex flex-1 items-center justify-center p-4"
      >
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          {/* Logo */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
            <img src={clawxIcon} alt="MossClaw" className="relative h-16 w-16" />
          </div>

          {/* Title texts */}
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold text-foreground">{t('selectLoginMethod')}</h1>
            <p className="text-sm text-muted-foreground">{t('loginMethodsDescription')}</p>
          </div>

          {/* Login Card */}
          <Card className="w-full border shadow-lg min-h-[400]">
            {!showCaptcha && (
              <CardContent className="space-y-6 p-6">
                {/* SSO Login Button */}
                <Button className="w-full h-11 bg-[#7657FF] text-white" onClick={handleSSOLogin}>
                  {t('ssoLogin')}
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      {t('orDivider')}
                      {t('accountPasswordLogin')}
                    </span>
                  </div>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="flex items-center gap-2">
                      {t('usernameLabel')}
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder={t('usernamePlaceholder')}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-2">
                      {t('passwordLabel')}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder={t('passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="h-11"
                    />
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={isRemember}
                      onChange={(e) => setIsRemember(e.target.checked)}
                      className="h-4 w-4 rounded border border-primary text-primary focus:ring-primary cursor-pointer"
                    />
                    <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                      {t('rememberMe')}
                    </Label>
                  </div>

                  {/* Login Button */}
                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={!username.trim() || !password.trim() || isLoading}
                  >
                    {isLoading ? t('loggingIn') : t('loginButton')}
                  </Button>
                </form>
              </CardContent>
            )}
            {showCaptcha && (
              <CardContent className="space-y-4 p-6">
                {/* Captcha header */}
                <div className="validate-box-header flex items-center justify-between border-b pb-3">
                  <h3 className="text-base font-medium text-foreground">请完成安全验证</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="tip-text">拖动下方滑块完成拼图</span>
                    <button
                      type="button"
                      title="刷新验证"
                      onClick={() => verifyRef.current?.refresh()}
                      className="cursor-pointer rounded p-1 hover:bg-muted transition-colors"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 2v6h-6" />
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                        <path d="M3 22v-6h6" />
                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Captcha Verification */}
                <Verify
                  ref={verifyRef}
                  captchaType="blockPuzzle"
                  mode="fixed"
                  imgSize={{ width: '330px', height: '150px' }}
                  onSuccess={handleCaptchaSuccess}
                  onError={handleCaptchaError}
                />
              </CardContent>
            )}
          </Card>

          {/* Footer - Create Account */}
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t('createAccount')}，{t('contactAdmin')}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Login;
