import { Link } from "wouter";
import { Car, Bell, LineChart, LogIn, UserPlus, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FEATURES: { icon: LucideIcon; color: string; bg: string; title: string; text: string }[] = [
  { icon: Car, color: "text-primary", bg: "bg-primary/10", title: "Gestão de Veículos", text: "Registe os seus veículos e aceda a informações automáticas por matrícula" },
  { icon: Bell, color: "text-secondary", bg: "bg-secondary/10", title: "Alertas Inteligentes", text: "Receba notificações sobre manutenções, inspeções e pagamentos" },
  { icon: LineChart, color: "text-accent", bg: "bg-accent/10", title: "Relatórios", text: "Acompanhe custos e histórico de manutenções de forma detalhada" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center">
              <Car className="w-8 h-8 text-primary-foreground" aria-hidden="true" />
            </div>
          </div>

          <h1 className="md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Logicar
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Faça a gestão da manutenção dos seus veículos de forma inteligente.
            Nunca mais perca uma troca de óleo, inspeção ou pagamento importante.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              asChild
              className="bg-gradient-to-r from-primary to-secondary hover:shadow-xl transition-all duration-300"
              data-testid="button-login"
            >
              <Link href="/login">
                <LogIn className="w-4 h-4 mr-2" aria-hidden="true" />
                Entrar
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild data-testid="button-register">
              <Link href="/register">
                <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
                Criar conta
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {FEATURES.map(({ icon: Icon, color, bg, title, text }) => (
            <Card key={title} className="text-center p-6 hover-scale">
              <CardContent className="pt-6">
                <div className={`w-12 h-12 ${bg} rounded-lg flex items-center justify-center mx-auto mb-4`}>
                  <Icon className={`w-5 h-5 ${color}`} aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-muted-foreground">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
