import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Car, Shield, Settings, BarChart3, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { post, handleApiError } from "@/lib/apiUtils";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await post<{ token: string }>("/login", { email, password });
      localStorage.setItem("token", data.token);
      window.location.href = "/dashboard";
    } catch (err) {
      // 429 → "Demasiadas tentativas…", 401 → "Credenciais inválidas." (mensagens do servidor)
      setError(handleApiError(err, "Não foi possível entrar."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero Section */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                <Car className="w-8 h-8" />
              </div>
              <h1 className="text-4xl font-bold">Logicar</h1>
            </div>
            <p className="text-xl text-blue-100 mb-8">
              Faça a gestão dos seus veículos com inteligência e simplicidade
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Análise Completa</h3>
                <p className="text-blue-200 text-sm">Monitorize consumos e despesas</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Manutenção Inteligente</h3>
                <p className="text-blue-200 text-sm">Alertas e recomendações automáticas</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Gestão Simplificada</h3>
                <p className="text-blue-200 text-sm">Todos os dados num só lugar</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/5 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-32 w-24 h-24 bg-purple-300/10 rounded-full blur-lg"></div>
        <div className="absolute top-1/2 right-10 w-16 h-16 bg-blue-300/10 rounded-full blur-md"></div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/40">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 bg-card/90 backdrop-blur-sm">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4 lg:hidden">
                <div className="p-3 bg-blue-600 rounded-xl">
                  <Car className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-foreground">Bem-vindo</h2>
              <p className="text-muted-foreground mt-2">Aceda à sua conta Logicar</p>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {error && (
                <Alert className="border-destructive/50 bg-destructive/10">
                  <AlertDescription className="text-destructive">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="o.seu@email.pt"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="h-12 focus:border-blue-500 focus:ring-blue-500/20"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                                        Palavra-passe

                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="h-12 focus:border-blue-500 focus:ring-blue-500/20 pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      A entrar...
                    </div>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </form>
              
              <div className="text-center pt-4">
                <p className="text-sm text-muted-foreground">
                  Não tem uma conta?{" "}
                  <Link href="/register" className="font-medium text-primary hover:underline">
                    Criar conta
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
          
          <p className="text-center text-xs text-muted-foreground mt-6">
            © LogiCar. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
