import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import LanguageSelector from './LanguageSelector';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loginWithGoogle, requestPasswordReset } = useAuth();
  const { t } = useTranslation('auth');
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (searchParams.get('register') === 'true') {
      setActiveTab('register');
    }
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      await requestPasswordReset(formData.email);
      setInfoMessage(t('resetEmailSent'));
    } catch (err) {
      setError(err.message ?? t('resetEmailError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (activeTab === 'login') {
        await login(formData.email, formData.password);
        navigate('/vehicles');
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error(t('passwordMismatch'));
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });
        if (signUpError) throw signUpError;
        if (data?.user) {
          setError(t('verifyEmail'));
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message ?? t('googleError'));
      setGoogleLoading(false);
    }
  };

  const handleGoogleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!googleLoading && !loading) {
        handleGoogleSignIn();
      }
    }
  };

  const googleLabel = googleLoading ? t('connectingGoogle') : t('continueWithGoogle');

  return (
    <div className="flex justify-center items-center min-h-screen py-12 px-4">
      <Card className="w-full max-w-md relative">
        <div className="absolute top-4 right-4">
          <LanguageSelector size="compact" />
        </div>
        <CardHeader>
          <CardTitle className="text-center">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v);
              setError(null);
              setInfoMessage(null);
              setShowForgotPassword(false);
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">{t('loginTab')}</TabsTrigger>
              <TabsTrigger value="register">{t('registerTab')}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              {showForgotPassword ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className="text-sm text-muted-foreground">{t('forgotIntro')}</p>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">{t('email')}</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                    {loading ? t('sending') : t('sendLink')}
                  </Button>
                  <p className="text-center text-sm">
                    <button
                      type="button"
                      className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setError(null);
                        setInfoMessage(null);
                      }}
                    >
                      {t('backToLogin')}
                    </button>
                  </p>
                </form>
              ) : (
                <>
                  <div className="space-y-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      onKeyDown={handleGoogleKeyDown}
                      disabled={loading || googleLoading}
                      aria-label={t('signInWithGoogle')}
                      tabIndex={0}
                    >
                      {googleLabel}
                    </Button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">{t('orWithEmail')}</span>
                      </div>
                    </div>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('email')}</Label>
                      <Input
                        id="email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="password">{t('password')}</Label>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground shrink-0"
                          onClick={() => {
                            setShowForgotPassword(true);
                            setError(null);
                            setInfoMessage(null);
                          }}
                        >
                          {t('forgotPassword')}
                        </button>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                      {loading ? t('loggingIn') : t('loginButton')}
                    </Button>
                  </form>
                </>
              )}
            </TabsContent>

            <TabsContent value="register">
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  onKeyDown={handleGoogleKeyDown}
                  disabled={loading || googleLoading}
                  aria-label={t('registerWithGoogle')}
                  tabIndex={0}
                >
                  {googleLabel}
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t('orWithEmail')}</span>
                  </div>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-email">{t('email')}</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">{t('password')}</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                  {loading ? t('registering') : t('registerButton')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {infoMessage && (
            <Alert className="mt-4 border-primary/30 bg-primary/5">
              <AlertDescription>{infoMessage}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
