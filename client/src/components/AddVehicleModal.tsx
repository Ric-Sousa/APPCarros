import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createVehicleSchema } from "@shared/schema";

import { useToast } from "@/hooks/use-toast";

import { post, get, handleApiError } from "@/lib/apiUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Image as ImageIcon, Search, Loader2, Plus } from "lucide-react";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { VehicleRecommendationsCard } from "@/components/VehicleRecommendationsCard";
import { useOilInterval } from "@/hooks/useVehicleSpecs";
import VehicleRegistrationFields from "@/components/VehicleRegistrationFields";
import { VehicleImagePicker, uploadVehiclePhoto, type PickedPhoto } from "@/components/VehicleImagePicker";
import VehicleDatesFields from "@/components/VehicleDatesFields";
import { z } from "zod";

interface SearchStatus {
  loading: boolean;
  step: string;
  progress: number;
}

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Client-side form schema with string dates
const formSchema = z.object({
  licensePlate: z.string().min(1, "Matrícula é obrigatória"),
  brand: z.string().min(1, "Marca é obrigatória"),
  model: z.string().min(1, "Modelo é obrigatório"),
  year: z.coerce.number<number>().min(1900, "Ano de Produção inválido"),
  registrationDate: z.string().min(1, "Data de Registo é obrigatória"),
  fuelType: z.string().optional(),
  iucCategory: z.string().min(1, "Categoria IUC é obrigatória"),
  certifyingEntity: z.string().min(1, "Entidade Certificadora é obrigatória"),
  vehicleCategory: z.string().min(1, "Categoria do Veículo é obrigatória"),
  currentMileage: z.coerce.number<number>().min(0, "Quilómetros Atuais são obrigatórios"),
  inspectionDue: z.string().min(1, "Próxima Inspeção é obrigatória"),
  iucDue: z.string().min(1, "Vencimento IUC é obrigatório"),
  insuranceDue: z.string().min(1, "Vencimento Seguro é obrigatório"),

  imageUrl: z.string().optional(),
  imageCredit: z.string().optional(),
  imageCreditUrl: z.string().optional(),
  originalColor: z.string().optional(),
  origin: z.string().optional(),
  registrationLocation: z.string().optional(),
  powerCV: z.coerce.number<number>().optional(),
  powerKW: z.coerce.number<number>().optional(),
  engineDisplacement: z.coerce.number<number>().optional(),
  oilBrand: z.string().optional(),
  lastOilChange: z.string().optional(),
  lastOilChangeMileage: z.coerce.number<number>().optional(),
  oilChangeInterval: z.coerce.number<number>().optional(),
  tireBrand: z.string().optional(),
  lastTireChange: z.string().optional(),
  lastTireChangeMileage: z.coerce.number<number>().optional(),
  tireChangeInterval: z.coerce.number<number>().optional(),
});

export default function AddVehicleModal({ isOpen, onClose }: AddVehicleModalProps) {
  // Helper para limpar campos se vierem como 'Não encontrado' ou undefined
  type FormFieldKeys =
    | 'brand'
    | 'model'
    | 'year'
    | 'registrationDate'
    | 'fuelType'
    | 'originalColor'
    | 'origin'
    | 'registrationLocation'
    | 'iucCategory'
    | 'powerCV'
    | 'powerKW'
    | 'engineDisplacement'
    | 'certifyingEntity'
    | 'vehicleCategory'
    | 'inspectionDue'
    | 'iucDue'
    | 'insuranceDue';
  const setOrClear = (field: FormFieldKeys, value: any) => {
    if (value && value !== 'Não encontrado') {
      form.setValue(field, value);
    } else {
      // Para campos numéricos, definir como 0 em vez de string vazia
      if (field === 'powerCV' || field === 'powerKW' || field === 'engineDisplacement') {
        form.setValue(field, 0);
      } else {
        form.setValue(field, '');
      }
    }
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [vehicleDataLoading, setVehicleDataLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>({
    loading: false,
    step: '',
    progress: 0
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Estados para recomendações
  const [oilRecommendations, setOilRecommendations] = useState<string[]>([]);
  const [tireRecommendations, setTireRecommendations] = useState<string[]>([]);
  const { fetchOilInterval } = useOilInterval();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      licensePlate: "",
      brand: "",
      model: "",
      year: new Date().getFullYear(),
      registrationDate: "",
      fuelType: "",
      currentMileage: 0,

      // InformAtrículas data
      originalColor: "",
      origin: "",
      registrationLocation: "",
      iucCategory: "",
      powerCV: 0,
      powerKW: 0,
      engineDisplacement: 0,
  
      certifyingEntity: "",
      vehicleCategory: "",

      // Oil and maintenance
      oilBrand: "",
      lastOilChange: "",
      lastOilChangeMileage: 0,
      oilChangeInterval: 15000,
      tireBrand: "",
      lastTireChange: "",
      lastTireChangeMileage: 0,
      tireChangeInterval: 50000,
      inspectionDue: "",
      iucDue: "",
      insuranceDue: "",
      imageUrl: "",
      imageCredit: "",
      imageCreditUrl: "",
    },
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Foto escolhida (galeria ou envio próprio); null limpa e volta à foto automática ao submeter
  const applyPhoto = (photo: PickedPhoto | null) => {
    setImagePreview(photo?.imageUrl ?? null);
    setSelectedImage(photo?.imageUrl ?? null);
    form.setValue('imageUrl', photo?.imageUrl ?? '');
    form.setValue('imageCredit', photo?.imageCredit ?? '');
    form.setValue('imageCreditUrl', photo?.imageCreditUrl ?? '');
  };

  // Função para lidar com o upload de imagem
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Verificar se é uma imagem
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Erro",
          description: "Por favor, selecione um ficheiro de imagem válido.",
          variant: "destructive",
        });
        return;
      }

      // Verificar tamanho do ficheiro (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "A imagem deve ter menos de 5MB.",
          variant: "destructive",
        });
        return;
      }

      // Envia já o ficheiro e guarda só o URL (antes ia em base64 dentro do pedido e excedia os limites)
      event.target.value = '';
      setPhotoUploading(true);
      uploadVehiclePhoto(file)
        .then((url) => applyPhoto({ imageUrl: url, imageCredit: null, imageCreditUrl: null }))
        .catch((error) => toast({ title: "Erro ao enviar a foto", description: handleApiError(error), variant: "destructive" }))
        .finally(() => setPhotoUploading(false));
    }
  };

  const createVehicleMutation = useMutation({
    mutationFn: async (data: any) => {
            return post("/api/vehicles", data);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Veículo adicionado",
        description: "O veículo foi adicionado com sucesso!",
      });
      form.reset();
      setImagePreview(null);
      setSelectedImage(null);
      onClose();
    },
        onError: (error) => {
      toast({
        title: "Erro",
        description: handleApiError(error, "Erro ao adicionar veículo. Tente novamente."),
        variant: "destructive",
      });
    },
  });


  // Refs para lock e progressInterval
  const vehicleDataFetchLockRef = useRef(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchVehicleData = async (licensePlate: string) => {
    if (licensePlate.length < 8) return;
    if (vehicleDataFetchLockRef.current) return; // Evita concorrência
    vehicleDataFetchLockRef.current = true;

    // Limpa qualquer intervalo antigo
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setVehicleDataLoading(true);
    setSearchStatus({
      loading: true,
      step: 'Iniciando pesquisa...',
      progress: 0
    });

    let progressInterval: NodeJS.Timeout | null = null;
    try {
      progressInterval = setInterval(() => {
        setSearchStatus(prev => {
          if (prev.progress < 90) {
            const steps = [
              { progress: 20, step: 'Verificando cache...' },
              { progress: 30, step: 'Conectando ao site...' },
              { progress: 40, step: 'Procurando campo de matrícula...' },
              { progress: 50, step: 'Preenchendo matrícula...' },
              { progress: 60, step: 'Pesquisando dados...' },
              { progress: 70, step: 'Extraindo informações...' },
              { progress: 80, step: 'A processar resultados...' }
            ];
            const currentStep = steps.find(s => s.progress > prev.progress);
            if (currentStep) {
              return {
                loading: true,
                step: currentStep.step,
                progress: currentStep.progress
              };
            }
          }
          return prev;
        });
      }, 800);
      progressIntervalRef.current = progressInterval;

      const data = await get(`/api/vehicle-data/${licensePlate}`) as any;

      setSearchStatus({
        loading: false,
        step: 'Dados preenchidos com sucesso!',
        progress: 100
      });

      setOrClear('brand', data.brand);
      setOrClear('model', data.model);
      // Extract only the first 4 digits from year format like "1987 -"
      if (data.year && data.year !== 'Não encontrado') {
        const yearStr = data.year.toString();
        const yearMatch = yearStr.match(/^(\d{4})/);
        if (yearMatch) {
          form.setValue('year', parseInt(yearMatch[1]));
        } else {
          // Fallback: try to extract any 4 consecutive digits
          const fallbackMatch = yearStr.match(/(\d{4})/);
          if (fallbackMatch) {
            form.setValue('year', parseInt(fallbackMatch[1]));
          } else {
            form.setValue('year', new Date().getFullYear());
          }
        }
      } else {
        form.setValue('year', new Date().getFullYear());
      }
      // Keep registrationDate in MM/yyyy format
      if (data.registrationDate && data.registrationDate !== 'Não encontrado') {
        // Check if it's already in MM/yyyy format
        const dateMatch = data.registrationDate.match(/^(\d{2})\/(\d{4})$/);
        if (dateMatch) {
          form.setValue('registrationDate', data.registrationDate);
        } else {
          // Try to convert from other formats if needed
          const reverseMatch = data.registrationDate.match(/^(\d{4})-(\d{2})$/);
          if (reverseMatch) {
            const [, year, month] = reverseMatch;
            form.setValue('registrationDate', `${month}/${year}`);
          } else {
            form.setValue('registrationDate', data.registrationDate);
          }
        }
      } else {
        form.setValue('registrationDate', '');
      }
      setOrClear('fuelType', data.fuelType);
      setOrClear('originalColor', data.originalColor);
      setOrClear('origin', data.origin);
      setOrClear('registrationLocation', data.registrationLocation);
      setOrClear('iucCategory', data.iucCategory);
      setOrClear('powerCV', data.powerCV);
      setOrClear('powerKW', data.powerKW);
      setOrClear('engineDisplacement', data.engineDisplacement);
      setOrClear('certifyingEntity', data.certifyingEntity);
      setOrClear('vehicleCategory', data.vehicleCategory);
      setOrClear('inspectionDue', data.inspectionDue);
      setOrClear('iucDue', data.iucDue);
      setOrClear('insuranceDue', data.insuranceDue);

      toast({
        title: "Dados encontrados",
        description: "Informações do veículo carregadas automaticamente!",
      });

      setTimeout(() => {
        setSearchStatus({ loading: false, step: '', progress: 0 });
      }, 2000);
    } catch (error: any) {
      console.error('Error fetching vehicle data:', error);
      setSearchStatus({
        loading: false,
        step: 'Nenhum dado encontrado',
        progress: 0
      });
      setOrClear('brand', '');
      setOrClear('model', '');
      setOrClear('year', '');

      setOrClear('fuelType', '');
      setOrClear('originalColor', '');
      setOrClear('origin', '');
      setOrClear('registrationLocation', '');
      setOrClear('iucCategory', '');
      setOrClear('powerCV', '');
      setOrClear('powerKW', '');
      setOrClear('engineDisplacement', '');
      setOrClear('certifyingEntity', '');
      setOrClear('vehicleCategory', '');
      setOrClear('inspectionDue', '');
      setOrClear('iucDue', '');
      setOrClear('insuranceDue', '');
      setTimeout(() => {
        setSearchStatus({ loading: false, step: '', progress: 0 });
      }, 3000);
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setVehicleDataLoading(false);
      vehicleDataFetchLockRef.current = false;
    }
  };

  // Format license plate as user types
  const formatLicensePlate = (value: string) => {
    let formatted = value.replace(/[^0-9A-Za-z]/g, '');
    if (formatted.length > 2) {
      formatted = formatted.slice(0, 2) + '-' + formatted.slice(2);
    }
    if (formatted.length > 5) {
      formatted = formatted.slice(0, 5) + '-' + formatted.slice(5, 7);
    }
    return formatted.toUpperCase();
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {

    const serverData = {
      ...data,
      fuelType: data.fuelType || undefined,
      imageUrl: data.imageUrl || undefined,
      imageCredit: data.imageCredit || undefined,
      imageCreditUrl: data.imageCreditUrl || undefined,
      originalColor: data.originalColor || undefined,
      origin: data.origin || undefined,
      registrationLocation: data.registrationLocation || undefined,
      iucCategory: data.iucCategory || undefined,
      powerCV: data.powerCV || undefined,
      powerKW: data.powerKW || undefined,
      engineDisplacement: data.engineDisplacement || undefined,
      
      certifyingEntity: data.certifyingEntity || undefined,
      vehicleCategory: data.vehicleCategory || undefined,
      oilBrand: data.oilBrand || undefined,
      lastOilChange: data.lastOilChange || undefined,
      lastOilChangeMileage: data.lastOilChangeMileage || undefined,
      oilChangeInterval: data.oilChangeInterval || undefined,
      tireBrand: data.tireBrand || undefined,
      lastTireChange: data.lastTireChange || undefined,
      lastTireChangeMileage: data.lastTireChangeMileage || undefined,
      tireChangeInterval: data.tireChangeInterval || undefined,
      inspectionDue: data.inspectionDue || undefined,
      iucDue: data.iucDue || undefined,
      insuranceDue: data.insuranceDue || undefined,
    };

    createVehicleMutation.mutate(serverData);
  };

  // Callbacks para recomendações
  const handleOilRecommendation = (recommendations: string[]) => {
    setOilRecommendations(recommendations);
  };

  const handleTireRecommendation = (recommendations: string[]) => {
    setTireRecommendations(recommendations);
  };

  const handleOilIntervalUpdate = (intervalKm: number, intervalMonths: number) => {
    form.setValue('oilChangeInterval', intervalKm);
  };

  const handleTireIntervalUpdate = (intervalKm: number) => {
    form.setValue('tireChangeInterval', intervalKm);
  };

  // Atualizar intervalo quando marca de óleo muda
  const handleOilBrandChange = async (oilBrand: string) => {
    const brand = form.getValues('brand');
    const model = form.getValues('model');

    if (brand && model && oilBrand) {
      const intervalInfo = await fetchOilInterval(oilBrand, brand, model);
      if (intervalInfo) {
        form.setValue('oilChangeInterval', intervalInfo.intervalKm);
        toast({
          title: "Intervalo atualizado",
          description: intervalInfo.description,
        });
      }
    }
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setImagePreview(null);
      setSelectedImage(null);
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Adicionar Veículo</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário */}
          <div className="space-y-6">
            <Form {...form}>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  form.handleSubmit(onSubmit, (errors) => {
                    toast({
                      title: "Erro de validação",
                      description: "Por favor, verifique os campos obrigatórios.",
                      variant: "destructive",
                    });
                  })(e);
                }}
                className="space-y-6"
              >
                {/* Image Upload Section */}
                <div className="space-y-4">
                  <FormLabel>Imagem do Veículo</FormLabel>
                  <div className="flex flex-col items-center gap-4">
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview do veículo"
                          className="w-full h-40 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => applyPhoto(null)}
                          className="absolute top-2 right-2"
                        >
                          Remover
                        </Button>
                      </div>
                    ) : (
                      <div className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 mb-1">Upload de imagem personalizada</p>
                        <p className="text-xs text-gray-400">ou deixe em branco para procurar automaticamente</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label htmlFor="image-upload" className="cursor-pointer">
                        <Button type="button" variant="outline" size="sm" className="flex items-center gap-2" asChild>
                          <span>
                            <Upload className="h-4 w-4" />
                            Escolher Imagem
                          </span>
                        </Button>
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => {
                          if (!form.getValues('brand') || !form.getValues('model')) {
                            toast({
                              title: "Informação em falta",
                              description: "Preencha a marca e o modelo primeiro.",
                              variant: "destructive",
                            });
                            return;
                          }
                          setPickerOpen(true);
                        }}
                        data-testid="button-photo-picker"
                      >
                        <ImageIcon className="h-3 w-3" aria-hidden="true" />
                        Sugestões de fotos
                      </Button>
                    </div>
                    {photoUploading && <p className="text-xs text-muted-foreground" role="status">A enviar a foto...</p>}
                    {!selectedImage && (
                      <p className="text-xs text-muted-foreground">Sem foto escolhida, é usada automaticamente a melhor sugestão.</p>
                    )}
                  </div>
                </div>

                {/* License Plate Input */}
                <FormField
                  control={form.control}
                  name="licensePlate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Matrícula</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="12-AB-34"
                          onChange={(e) => {
                            const formatted = formatLicensePlate(e.target.value);
                            field.onChange(formatted);
                            if (formatted.length === 8) {
                              fetchVehicleData(formatted);
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') e.preventDefault();
                          }}
                          data-testid="input-license-plate"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Search Status Loader */}
                {(searchStatus.loading || searchStatus.step) && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center space-x-3">
                      {searchStatus.loading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      ) : searchStatus.progress === 100 ? (
                        <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <Search className="h-5 w-5 text-orange-500" />
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        {searchStatus.step}
                      </span>
                    </div>

                    {searchStatus.loading && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Progresso</span>
                          <span>{searchStatus.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${searchStatus.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <VehicleRegistrationFields form={form} />

                {/* Current Mileage */}
                <FormField
                  control={form.control}
                  name="currentMileage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quilómetros Atuais</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="123000"
                          data-testid="input-current-mileage"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Oil Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Informações do Óleo
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="oilBrand"
                      render={({ field }) => (
                        <FormItem>
                          <AutocompleteInput
                            value={field.value ?? ""}
                            onChange={(value) => {
                              field.onChange(value);
                              handleOilBrandChange(value);
                            }}
                            type="oil"
                            placeholder="Escreva para pesquisar (ex: ipo...)"
                            label="Marca do Óleo"
                            recommendations={oilRecommendations}
                            onRecommendationSelect={(rec) => {
                              field.onChange(rec);
                              handleOilBrandChange(rec);
                            }}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastOilChange"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Última Troca</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="date"
                              data-testid="input-last-oil-change"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Tire Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Informações dos Pneus
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tireBrand"
                      render={({ field }) => (
                        <FormItem>
                          <AutocompleteInput
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            type="tire"
                            placeholder="Escreva para pesquisar (ex: mich...)"
                            label="Marca dos Pneus"
                            recommendations={tireRecommendations}
                            onRecommendationSelect={field.onChange}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastTireChange"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Última Troca</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="date"
                              data-testid="input-last-tire-change"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <VehicleDatesFields form={form} />

                <div className="flex space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-primary to-secondary hover:shadow-lg transition-all duration-300"
                    disabled={createVehicleMutation.isPending || vehicleDataLoading}
                    data-testid="button-submit"
                    
                  >
                    {(createVehicleMutation.isPending || vehicleDataLoading) ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    ) : (
                      <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                    )}
                    {vehicleDataLoading ? 'A obter dados...' : 'Adicionar'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {/* Recomendações */}
          <div className="space-y-4">
            <VehicleRecommendationsCard
              brand={form.watch('brand')}
              model={form.watch('model')}
              onOilRecommendation={handleOilRecommendation}
              onTireRecommendation={handleTireRecommendation}
              onOilIntervalUpdate={handleOilIntervalUpdate}
              onTireIntervalUpdate={handleTireIntervalUpdate}
            />
          </div>
        </div>
      <VehicleImagePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        vehicle={{
          brand: form.getValues('brand'),
          model: form.getValues('model'),
          year: form.getValues('year'),
          engineDisplacement: form.getValues('engineDisplacement'),
          vehicleCategory: form.getValues('vehicleCategory'),
          iucCategory: form.getValues('iucCategory'),
        }}
        onSelect={applyPhoto}
      />
      </DialogContent>
    </Dialog>
  );
}
