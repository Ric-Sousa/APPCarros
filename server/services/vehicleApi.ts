export interface VehicleApiData {
  licensePlate: string;
  brand: string;
  model: string;
  fuelType: string;
  year: string;
  cylinderCapacity: string;
  powerCV: string;
  powerKW: string;
  co2Emissions: string;
  category: string;
  iucCategory: string;
  registrationDate: string;
  inspectionDate: string;
  inspectionValidity: string;
  engineDisplacement: string;
  ownerType: string;
  entity: string;
  segment: string;
  traction: string;
}

// URL do serviço PHP (vehicle_api.php). Deve ser HTTPS em produção.
const VEHICLE_API_URL = process.env.VEHICLE_API_URL || 'http://185.113.141.94/logicar/vehicle_api.php';
if (!VEHICLE_API_URL.startsWith('https://')) {
  console.warn('⚠️  VEHICLE_API_URL não usa HTTPS: as matrículas consultadas viajam sem encriptação.');
}

export async function getVehicleByLicensePlate(licensePlate: string): Promise<VehicleApiData | null> {
  try {
    const response = await fetch(`${VEHICLE_API_URL}?license_plate=${encodeURIComponent(licensePlate)}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    return result.success && result.data ? (result.data as VehicleApiData) : null;
  } catch (error) {
    console.error(`Erro ao consultar dados da matrícula ${licensePlate}:`, error);
    return null;
  }
}
