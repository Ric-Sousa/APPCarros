import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calculator, Fuel, TrendingUp, TrendingDown, Target } from 'lucide-react';

interface CalculatorResult {
  consumption: number;
  costPer100km: number;
  costPerKm: number;
  efficiency: 'excellent' | 'good' | 'average' | 'poor';
}

const FuelEfficiencyCalculator: React.FC = () => {
  const [distance, setDistance] = useState<number>(0);
  const [fuelUsed, setFuelUsed] = useState<number>(0);
  const [fuelCost, setFuelCost] = useState<number>(1.65);
  const [fuelType, setFuelType] = useState<string>('gasoline');
  const [result, setResult] = useState<CalculatorResult | null>(null);

  const calculateEfficiency = () => {
    if (distance <= 0 || fuelUsed <= 0) {
      alert('Por favor, insira valores válidos para distância e combustível.');
      return;
    }

    const consumption = (fuelUsed / distance) * 100; // L/100km
    const totalCost = fuelUsed * fuelCost;
    const costPer100km = (totalCost / distance) * 100;
    const costPerKm = totalCost / distance;

    let efficiency: 'excellent' | 'good' | 'average' | 'poor';
    if (consumption < 5) efficiency = 'excellent';
    else if (consumption < 7) efficiency = 'good';
    else if (consumption < 9) efficiency = 'average';
    else efficiency = 'poor';

    setResult({
      consumption,
      costPer100km,
      costPerKm,
      efficiency
    });
  };

  const getEfficiencyColor = (efficiency: string) => {
    switch (efficiency) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'average': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getEfficiencyIcon = (efficiency: string) => {
    switch (efficiency) {
      case 'excellent': return <TrendingDown className="h-5 w-5 text-green-600" />;
      case 'good': return <Target className="h-5 w-5 text-blue-600" />;
      case 'average': return <TrendingUp className="h-5 w-5 text-yellow-600" />;
      case 'poor': return <TrendingUp className="h-5 w-5 text-red-600" />;
      default: return <Calculator className="h-5 w-5" />;
    }
  };

  const getFuelTypeRecommendations = (fuelType: string) => {
    const recommendations = {
      gasoline: {
        average: '6-8 L/100km',
        tips: ['Manter velocidade constante', 'Evitar acelerações bruscas', 'Verificar pressão dos pneus']
      },
      gasoline_98: {
        average: '6-8 L/100km',
        tips: ['Gasolina 98 pode melhorar performance', 'Ideal para motores turbo', 'Menor consumo em autoestrada']
      },
      diesel: {
        average: '4-6 L/100km',
        tips: ['Ideal para viagens longas', 'Aquecimento do motor importante', 'RPM baixas são mais eficientes']
      },
      hybrid: {
        average: '3-5 L/100km',
        tips: ['Usar modo elétrico em cidade', 'Condução suave maximiza eficiência', 'Regenerar energia na travagem']
      },
      electric: {
        average: '15-20 kWh/100km',
        tips: ['Pré-aquecer com cabo ligado', 'Condução eficiente', 'Planear carregamentos']
      }
    };

    return recommendations[fuelType as keyof typeof recommendations] || recommendations.gasoline;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Calculadora de Eficiência de Combustível
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="distance">Distância Percorrida (km)</Label>
            <Input
              id="distance"
              type="number"
              step="0.1"
              placeholder="100"
              value={distance || ''}
              onChange={(e) => setDistance(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fuel">Combustível Usado (L)</Label>
            <Input
              id="fuel"
              type="number"
              step="0.1"
              placeholder="7.5"
              value={fuelUsed || ''}
              onChange={(e) => setFuelUsed(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost">Preço por Litro (€)</Label>
            <Input
              id="cost"
              type="number"
              step="0.001"
              placeholder="1.650"
              value={fuelCost || ''}
              onChange={(e) => setFuelCost(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fuelType">Tipo de Combustível</Label>
            <Select value={fuelType} onValueChange={setFuelType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gasoline">Gasolina 95</SelectItem>
                <SelectItem value="gasoline_98">Gasolina 98</SelectItem>
                <SelectItem value="diesel">Gasóleo</SelectItem>
                <SelectItem value="hybrid">Híbrido</SelectItem>
                <SelectItem value="electric">Elétrico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={calculateEfficiency} className="w-full">
          <Calculator className="h-4 w-4 mr-2" />
          Calcular Eficiência
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Fuel className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">Consumo</p>
                      <p className="text-xl font-bold">{result.consumption.toFixed(1)} L/100km</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm text-gray-600">Custo/100km</p>
                      <p className="text-xl font-bold">€{result.costPer100km.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="text-sm text-gray-600">Custo/km</p>
                      <p className="text-xl font-bold">€{result.costPerKm.toFixed(3)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Efficiency Assessment */}
            <div className={`p-4 rounded-lg border ${getEfficiencyColor(result.efficiency)}`}>
              <div className="flex items-center gap-2 mb-2">
                {getEfficiencyIcon(result.efficiency)}
                <h3 className="font-semibold capitalize">
                  Eficiência: {result.efficiency === 'excellent' ? 'Excelente' : 
                              result.efficiency === 'good' ? 'Boa' : 
                              result.efficiency === 'average' ? 'Média' : 'Baixa'}
                </h3>
              </div>
              <p className="text-sm">
                {result.efficiency === 'excellent' && 'Parabéns! O seu consumo está excelente.'}
                {result.efficiency === 'good' && 'Bom consumo! Está acima da média.'}
                {result.efficiency === 'average' && 'Consumo na média. Há margem para melhorar.'}
                {result.efficiency === 'poor' && 'Consumo elevado. Considere uma revisão ao veículo.'}
              </p>
            </div>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recomendações para {fuelType === 'gasoline' ? 'Gasolina' : 
                                                                   fuelType === 'diesel' ? 'Gasóleo' : 
                                                                   fuelType === 'hybrid' ? 'Híbrido' : 'Elétrico'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">
                      Consumo médio esperado: {getFuelTypeRecommendations(fuelType).average}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Dicas para melhorar a eficiência:</h4>
                    <ul className="space-y-1">
                      {getFuelTypeRecommendations(fuelType).tips.map((tip, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FuelEfficiencyCalculator;
