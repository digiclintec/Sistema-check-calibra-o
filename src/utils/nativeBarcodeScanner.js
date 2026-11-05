import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * Verifica se a aplicação está rodando dentro do APK Android Nativo (Capacitor)
 */
export const isNativeAndroidApp = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Dispara o Google Code Scanner Nativo do Android (Google Play Services)
 * Abre a interface nativa do Google com foco automático, IA e zoom óptico sem travar o navegador.
 */
export const scanWithNativeGoogleScanner = async () => {
  if (!isNativeAndroidApp()) {
    return { success: false, isNative: false, error: 'Não está rodando em ambiente nativo' };
  }

  try {
    // 1. Garante que o módulo do Google Barcode Scanner do Play Services está instalado
    const moduleAvailable = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!moduleAvailable.available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    }

    // 2. Executa a leitura oficial do Google
    const result = await BarcodeScanner.scan({
      formats: [
        BarcodeFormat.Code128,
        BarcodeFormat.Code39,
        BarcodeFormat.Code93,
        BarcodeFormat.Ean13,
        BarcodeFormat.Ean8,
        BarcodeFormat.Itf,
        BarcodeFormat.QrCode,
        BarcodeFormat.DataMatrix,
        BarcodeFormat.UpcA,
        BarcodeFormat.UpcE
      ]
    });

    if (result && result.barcodes && result.barcodes.length > 0) {
      const code = result.barcodes[0].rawValue || result.barcodes[0].displayValue;
      return {
        success: true,
        isNative: true,
        code: code,
        format: result.barcodes[0].format
      };
    }

    return { success: false, isNative: true, error: 'Nenhum código lido' };
  } catch (err) {
    console.warn('[NativeScanner] Erro no Google Code Scanner:', err);
    return { success: false, isNative: true, error: err.message || 'Cancelado ou erro no scanner' };
  }
};

/**
 * Abre a Câmera Nativa do Android via Plugin Capacitor
 * Tira a foto em alta resolução e retorna o arquivo/URI
 */
export const takeNativePhoto = async () => {
  if (!isNativeAndroidApp()) {
    return { success: false, isNative: false };
  }

  try {
    const photo = await Camera.getPhoto({
      quality: 95,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera
    });

    return {
      success: true,
      isNative: true,
      webPath: photo.webPath,
      format: photo.format
    };
  } catch (err) {
    console.warn('[NativeCamera] Erro ao tirar foto nativa:', err);
    return { success: false, isNative: true, error: err.message };
  }
};

