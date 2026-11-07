import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Car, Shield, Settings, BarChart3, Eye, EyeOff, User, Mail, Lock } from "lucide-react";
import { Link } from "wouter";
import { post, handleApiError } from "@/lib/apiUtils";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Validações do frontend
    if (password !== confirmPassword) {
      setError("As palavras-passe não coincidem");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("A palavra-passe deve ter pelo menos 6 caracteres");
      setLoading(false);
      return;
    }

    try {
      const data = await post<{ token: string }>("/api/register", { name, email, password });
      localStorage.setItem("token", data.token);
      setSuccess("Conta criada com sucesso! A abrir o dashboard...");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(handleApiError(err, "Erro ao criar a conta."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero Section */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-green-900 via-blue-800 to-purple-900 relative overflow-hidden">
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
              Junte-se a milhares de utilizadores que já confiam no Logicar
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Controlo Total</h3>
                <p className="text-blue-200 text-sm">Faça a gestão de todos os seus veículos num só lugar</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Segurança Garantida</h3>
                <p className="text-blue-200 text-sm">Os seus dados estão protegidos e seguros</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Fácil de Usar</h3>
                <p className="text-blue-200 text-sm">Interface intuitiva e amigável</p>
              </div>
            </div>
          </div>
          
          <div className="mt-12 p-6 bg-white/5 rounded-xl backdrop-blur-sm">
            <p className="text-sm text-blue-100 italic">
              "O Logicar revolucionou a forma como giro os meus veículos. Agora tenho tudo controlado!"
            </p>
            <p className="text-xs text-blue-200 mt-2">- João Silva, Utilizador desde 2024</p>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/5 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-32 w-24 h-24 bg-green-300/10 rounded-full blur-lg"></div>
        <div className="absolute top-1/2 right-10 w-16 h-16 bg-blue-300/10 rounded-full blur-md"></div>
      </div>

      {/* Right side - Register Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-muted/40">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 bg-card/90 backdrop-blur-sm">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-4 lg:hidden">
                <div className="p-3 bg-green-600 rounded-xl">
                  <Car className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-foreground">Criar Conta</h2>
              <p className="text-muted-foreground mt-2">Comece a gerir os seus veículos hoje</p>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {error && (
                <Alert className="border-destructive/50 bg-destructive/10">
                  <AlertDescription className="text-destructive">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/40">
                  <AlertDescription className="text-green-800 dark:text-green-300">
                    {success}
                  </AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-foreground">
                    Nome Completo
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Seu nome completo"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="h-12 pl-10 focus:border-green-500 focus:ring-green-500/20"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="h-12 pl-10 focus:border-green-500 focus:ring-green-500/20"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                                        Palavra-passe

                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="h-12 pl-10 pr-12 focus:border-green-500 focus:ring-green-500/20"
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
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                                        Confirmar Palavra-passe

                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="h-12 pl-10 pr-12 focus:border-green-500 focus:ring-green-500/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                  <p>A palavra-passe deve conter:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li className={password.length >= 6 ? "text-green-700 dark:text-green-400" : ""}>
                      Pelo menos 6 caracteres
                    </li>
                    <li className={password === confirmPassword && password ? "text-green-700 dark:text-green-400" : ""}>
                      Confirmação deve coincidir
                    </li>
                  </ul>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-12 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Criando conta...
                    </div>
                  ) : (
                    "Criar Conta"
                  )}
                </Button>
              </form>
              
              <div className="text-center pt-4">
                <p className="text-sm text-muted-foreground">
                  Já tem uma conta?{" "}
                  <Link href="/login" className="font-medium text-green-700 dark:text-green-400 hover:underline">
                    Entrar
                  </Link>
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Os seus dados são usados apenas para gerir os seus veículos e pode eliminar a conta a qualquer momento no Perfil.
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
