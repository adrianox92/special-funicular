import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loginWithGoogle, requestPasswordReset } = useAuth();
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (searchParams.get('register') === 'true') {
      setActiveTab('register');
    }
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      await requestPasswordReset(formData.email);
      setInfoMessage(
        'Si existe una cuenta con ese correo, recibirás un enlace para elegir una contraseña nueva.'
      );
    } catch (err) {
      setError(err.message ?? 'No se pudo enviar el correo');
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
          throw new Error('Las contraseñas no coinciden');
        }
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password
        });
        if (error) throw error;
        if (data?.user) {
          setError('Por favor, verifica tu correo electrónico para completar el registro');
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
      setError(err.message ?? 'No se pudo iniciar sesión con Google');
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

  return (
    <div className="flex justify-center items-center min-h-screen py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Slot Collection</CardTitle>
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
              <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="register">Registrarse</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              {showForgotPassword ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Introduce tu correo y te enviaremos un enlace para establecer una contraseña nueva.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
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
                    {loading ? 'Enviando…' : 'Enviar enlace'}
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
                      Volver a iniciar sesión
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
                      aria-label="Iniciar sesión con Google"
                      tabIndex={0}
                    >
                      {googleLoading ? 'Conectando con Google…' : 'Continuar con Google'}
                    </Button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">o con email</span>
                      </div>
                    </div>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
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
                        <Label htmlFor="password">Contraseña</Label>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground shrink-0"
                          onClick={() => {
                            setShowForgotPassword(true);
                            setError(null);
                            setInfoMessage(null);
                          }}
                        >
                          ¿Olvidaste la contraseña?
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
                      {loading ? 'Cargando...' : 'Iniciar Sesión'}
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
                  aria-label="Registrarse con Google"
                  tabIndex={0}
                >
                  {googleLoading ? 'Conectando con Google…' : 'Continuar con Google'}
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">o con email</span>
                  </div>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
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
                  <Label htmlFor="reg-password">Contraseña</Label>
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
                  <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
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
                  {loading ? 'Cargando...' : 'Registrarse'}
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
