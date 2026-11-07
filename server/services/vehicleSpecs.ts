// Serviço para especificações técnicas de veículos
export interface VehicleSpecs {
  brand: string;
  model: string;
  year?: number;
  oilSpecs: {
    type: string; // 5W-30, 10W-40, etc.
    brands: string[]; // Marcas recomendadas
    capacity: string; // Capacidade em litros
    intervalKm: number; // Intervalo em km
    intervalMonths: number; // Intervalo em meses
  };
  tireSpecs: {
    size: string; // 225/45R17, etc.
    brands: string[]; // Marcas recomendadas
    intervalKm: number; // Durabilidade média
  };
  engineSpecs?: {
    displacement: string;
    power: string;
    fuel: string;
  };
}

// Base de dados de especificações (expansível)
const VEHICLE_SPECS: VehicleSpecs[] = [
  // Motos
  {
    brand: "Suzuki",
    model: "GSXR 600",
    oilSpecs: {
      type: "10W-40",
      brands: ["Motul", "Castrol", "Ipone", "Shell", "Repsol"],
      capacity: "3.0L",
      intervalKm: 6000,
      intervalMonths: 12
    },
    tireSpecs: {
      size: "120/70ZR17 (front), 180/55ZR17 (rear)",
      brands: ["Michelin", "Pirelli", "Bridgestone", "Dunlop"],
      intervalKm: 15000
    },
    engineSpecs: {
      displacement: "599cc",
      power: "126 HP",
      fuel: "Gasolina"
    }
  },
  {
    brand: "Yamaha",
    model: "YZF-R6",
    oilSpecs: {
      type: "10W-40",
      brands: ["Yamalube", "Motul", "Castrol", "Shell"],
      capacity: "3.4L",
      intervalKm: 6000,
      intervalMonths: 12
    },
    tireSpecs: {
      size: "120/70ZR17 (front), 180/55ZR17 (rear)",
      brands: ["Michelin", "Pirelli", "Bridgestone"],
      intervalKm: 12000
    }
  },
  // Carros
  {
    brand: "Volkswagen",
    model: "Golf",
    oilSpecs: {
      type: "5W-30",
      brands: ["Castrol", "Mobil 1", "Total", "Shell", "Motul"],
      capacity: "4.2L",
      intervalKm: 15000,
      intervalMonths: 12
    },
    tireSpecs: {
      size: "205/55R16",
      brands: ["Continental", "Michelin", "Bridgestone", "Pirelli"],
      intervalKm: 60000
    }
  },
  {
    brand: "Volkswagen",
    model: "Tiguan",
    oilSpecs: {
      type: "5W-30",
      brands: ["Castrol", "Mobil 1", "Total", "Shell"],
      capacity: "4.8L",
      intervalKm: 15000,
      intervalMonths: 12
    },
    tireSpecs: {
      size: "215/65R17",
      brands: ["Continental", "Michelin", "Bridgestone"],
      intervalKm: 50000
    }
  },
  {
    brand: "BMW",
    model: "X3",
    oilSpecs: {
      type: "5W-30",
      brands: ["BMW", "Castrol", "Mobil 1", "Shell"],
      capacity: "5.2L",
      intervalKm: 15000,
      intervalMonths: 12
    },
    tireSpecs: {
      size: "245/50R19",
      brands: ["Continental", "Michelin", "Pirelli"],
      intervalKm: 45000
    }
  },
  {
    brand: "Peugeot",
    model: "208",
    oilSpecs: {
      type: "5W-30",
      brands: ["Total", "Castrol", "Mobil 1", "Shell"],
      capacity: "3.25L",
      intervalKm: 15000,
      intervalMonths: 12
    },
    tireSpecs: {
      size: "195/55R16",
      brands: ["Michelin", "Continental", "Bridgestone"],
      intervalKm: 50000
    }
  },
  {
    brand: "Audi",
    model: "A4",
    oilSpecs: {
      type: "5W-30",
      brands: ["Castrol", "Mobil 1", "Total", "Shell"],
      capacity: "4.8L",
      intervalKm: 15000,
      intervalMonths: 12
    },
    tireSpecs: {
      size: "225/50R17",
      brands: ["Continental", "Michelin", "Pirelli"],
      intervalKm: 55000
    }
  }
];

// Listas para autocomplete
const OIL_BRANDS = [
  "Castrol", "Mobil 1", "Shell", "Total", "Motul", "Ipone", "Repsol", 
  "Valvoline", "Liqui Moly", "BMW", "Yamalube", "Honda", "Fuchs"
];

const TIRE_BRANDS = [
  "Michelin", "Continental", "Bridgestone", "Pirelli", "Dunlop", 
  "Goodyear", "Hankook", "Yokohama", "Toyo", "Kumho", "Falken"
];

export interface AutocompleteResult {
  value: string;
  label: string;
  category: 'oil' | 'tire';
}

export interface VehicleRecommendations {
  oilRecommendations: {
    recommendedType: string;
    recommendedBrands: string[];
    capacity: string;
    intervalKm: number;
    intervalMonths: number;
    description: string;
  };
  tireRecommendations: {
    recommendedSize: string;
    recommendedBrands: string[];
    intervalKm: number;
    description: string;
  };
  found: boolean;
}

export class VehicleSpecsService {
  // Buscar sugestões de autocomplete
  static getAutocomplete(query: string, type: 'oil' | 'tire' | 'both'): AutocompleteResult[] {
    const results: AutocompleteResult[] = [];
    const queryLower = query.toLowerCase();

    if (type === 'oil' || type === 'both') {
      OIL_BRANDS
        .filter(brand => brand.toLowerCase().includes(queryLower))
        .forEach(brand => {
          results.push({
            value: brand,
            label: brand,
            category: 'oil'
          });
        });
    }

    if (type === 'tire' || type === 'both') {
      TIRE_BRANDS
        .filter(brand => brand.toLowerCase().includes(queryLower))
        .forEach(brand => {
          results.push({
            value: brand,
            label: brand,
            category: 'tire'
          });
        });
    }

    return results.slice(0, 8); // Limite de 8 sugestões
  }

  // Buscar recomendações específicas por marca/modelo
  static getVehicleRecommendations(brand: string, model: string): VehicleRecommendations {
    const specs = VEHICLE_SPECS.find(spec => 
      spec.brand.toLowerCase() === brand.toLowerCase() && 
      spec.model.toLowerCase().includes(model.toLowerCase())
    );

    if (specs) {
      return {
        found: true,
        oilRecommendations: {
          recommendedType: specs.oilSpecs.type,
          recommendedBrands: specs.oilSpecs.brands,
          capacity: specs.oilSpecs.capacity,
          intervalKm: specs.oilSpecs.intervalKm,
          intervalMonths: specs.oilSpecs.intervalMonths,
          description: `Troca a cada ${specs.oilSpecs.intervalKm.toLocaleString('pt-PT')} km ou ${specs.oilSpecs.intervalMonths} ${specs.oilSpecs.intervalMonths === 1 ? 'mês' : 'meses'} (o que acontecer primeiro). Capacidade: ${specs.oilSpecs.capacity}.`
        },
        tireRecommendations: {
          recommendedSize: specs.tireSpecs.size,
          recommendedBrands: specs.tireSpecs.brands,
          intervalKm: specs.tireSpecs.intervalKm,
          description: `Medida recomendada: ${specs.tireSpecs.size}. Durabilidade média: ${specs.tireSpecs.intervalKm.toLocaleString('pt-PT')} km.`
        }
      };
    }

    // Recomendações genéricas se não encontrar específicas
    return {
      found: false,
      oilRecommendations: {
        recommendedType: "5W-30 ou 10W-40",
        recommendedBrands: ["Castrol", "Mobil 1", "Shell", "Total"],
        capacity: "Consulte manual",
        intervalKm: 10000,
        intervalMonths: 12,
        description: "Recomendação geral: Troca a cada 10.000 km ou 12 meses (o que acontecer primeiro). Consulte o manual do proprietário para especificações exatas."
      },
      tireRecommendations: {
        recommendedSize: "Consulte manual",
        recommendedBrands: ["Michelin", "Continental", "Bridgestone", "Pirelli"],
        intervalKm: 40000,
        description: "Durabilidade média: 40.000 km. Consulte o manual para medida exata dos pneus."
      }
    };
  }

  // Atualizar intervalos com base na marca do óleo selecionada
  static getOilIntervalByBrand(oilBrand: string, vehicleBrand: string, vehicleModel: string): { intervalKm: number; intervalMonths: number; description: string } {
    const specs = VEHICLE_SPECS.find(spec => 
      spec.brand.toLowerCase() === vehicleBrand.toLowerCase() && 
      spec.model.toLowerCase().includes(vehicleModel.toLowerCase())
    );

    if (specs && specs.oilSpecs.brands.includes(oilBrand)) {
      return {
        intervalKm: specs.oilSpecs.intervalKm,
        intervalMonths: specs.oilSpecs.intervalMonths,
        description: `${oilBrand} recomendado para ${vehicleBrand} ${vehicleModel}: Troca a cada ${specs.oilSpecs.intervalKm.toLocaleString('pt-PT')} km ou ${specs.oilSpecs.intervalMonths} ${specs.oilSpecs.intervalMonths === 1 ? 'mês' : 'meses'}.`
      };
    }

    // Intervalos específicos por marca de óleo (para casos genéricos)
    const oilBrandIntervals: Record<string, { km: number; months: number }> = {
      "Motul": { km: 12000, months: 12 },
      "Ipone": { km: 8000, months: 10 },
      "Castrol": { km: 15000, months: 12 },
      "Mobil 1": { km: 15000, months: 12 },
      "Shell": { km: 12000, months: 12 },
      "Total": { km: 15000, months: 12 },
      "Repsol": { km: 10000, months: 12 }
    };

    // Object.hasOwn: um nome como "constructor" não pode ir buscar propriedades do protótipo
    const interval = Object.hasOwn(oilBrandIntervals, oilBrand) ? oilBrandIntervals[oilBrand] : { km: 10000, months: 12 };
    
    return {
      intervalKm: interval.km,
      intervalMonths: interval.months,
      description: `${oilBrand}: Intervalo recomendado de ${interval.km.toLocaleString('pt-PT')} km ou ${interval.months} ${interval.months === 1 ? 'mês' : 'meses'}.`
    };
  }
}
