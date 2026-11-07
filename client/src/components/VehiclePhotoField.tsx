import { useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { Image as ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { handleApiError } from "@/lib/apiUtils";
import { VehicleImagePicker, uploadVehiclePhoto, type PickedPhoto } from "@/components/VehicleImagePicker";

/** Foto do veículo no formulário de registo: envio próprio ou galeria de sugestões (form: imageUrl/imageCredit/imageCreditUrl). */
export default function VehiclePhotoField({ form }: { form: UseFormReturn<any> }) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageUrl: string = useWatch({ control: form.control, name: "imageUrl" }) ?? "";

  const applyPhoto = (photo: PickedPhoto | null) => {
    form.setValue("imageUrl", photo?.imageUrl ?? "");
    form.setValue("imageCredit", photo?.imageCredit ?? "");
    form.setValue("imageCreditUrl", photo?.imageCreditUrl ?? "");
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      applyPhoto({ imageUrl: await uploadVehiclePhoto(file), imageCredit: null, imageCreditUrl: null });
    } catch (error) {
      toast({ title: "Erro ao enviar a foto", description: handleApiError(error), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const openPicker = () => {
    if (!form.getValues("brand") || !form.getValues("model")) {
      toast({ title: "Informação em falta", description: "Preencha a marca e o modelo primeiro.", variant: "destructive" });
      return;
    }
    setPickerOpen(true);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">Imagem do Veículo</p>
      <div className="flex flex-col items-center gap-4">
        {imageUrl ? (
          <div className="relative w-full">
            <img src={imageUrl} alt="Pré-visualização do veículo" className="w-full h-40 object-cover rounded-lg border" />
            <Button type="button" variant="outline" size="sm" onClick={() => applyPhoto(null)} className="absolute top-2 right-2">
              Remover
            </Button>
          </div>
        ) : (
          <div className="w-full h-40 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center px-4">
            <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
            <p className="text-sm text-muted-foreground mb-1">Envie uma foto sua ou escolha uma sugestão</p>
            <p className="text-xs text-muted-foreground">Sem foto, é usada automaticamente a melhor sugestão.</p>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <label className="cursor-pointer">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} className="sr-only" id="image-upload" disabled={uploading} />
            <Button type="button" variant="outline" size="sm" className="flex items-center gap-2" asChild>
              <span>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Escolher Imagem
              </span>
            </Button>
          </label>
          <Button type="button" variant="secondary" size="sm" className="flex items-center gap-1" onClick={openPicker} data-testid="button-photo-picker">
            <ImageIcon className="h-3 w-3" aria-hidden="true" />
            Sugestões de fotos
          </Button>
        </div>
        {uploading && <p className="text-xs text-muted-foreground" role="status">A enviar a foto...</p>}
      </div>

      <VehicleImagePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        vehicle={{
          brand: form.getValues("brand"),
          model: form.getValues("model"),
          year: form.getValues("year"),
          engineDisplacement: form.getValues("engineDisplacement"),
          vehicleCategory: form.getValues("vehicleCategory"),
          iucCategory: form.getValues("iucCategory"),
        }}
        onSelect={applyPhoto}
      />
    </div>
  );
}
