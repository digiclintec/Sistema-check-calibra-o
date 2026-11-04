import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  FileText, 
  Search, 
  RefreshCw, 
  Check, 
  Eye, 
  EyeOff, 
  SlidersHorizontal,
  ChevronRight,
  Layers,
  Cpu,
  Image as ImageIcon
} from 'lucide-react';
import { processPhotoTextWithAgent } from '../utils/serialAgent';
import { playSuccessSound, playWarningSound, playErrorSound } from '../utils/audio';

export default function SerialScanModal({
  isOpen,
  onClose,
  equipments = [],
  onBatchCheck,
  soundEnabled = true,
  hospitalName = '',
  planTitle = ''
}) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [extractedRawText, setExtractedRawText] = useState('');
  const [matchedResults, setMatchedResults] = useState([]);
  const [unmatchedCandidates, setUnmatchedCandidates] = useState([]);
  const [selectedIdsToConfirm, setSelectedIdsToConfirm] = useState(new Set());
  const [showRawText, setShowRawText] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputCameraRef = useRef(null);
  const fileInputGalleryRef = useRef(null);
  const canvasRef = useRef(null);

  // Reset modal state when closed or opened
  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);
      setImagePreview(null);
      setIsProcessing(false);
      setOcrProgress(0);
      setOcrStatusText('');
      setExtractedRawText('');
      setMatchedResults([]);
      setUnmatchedCandidates([]);
      setSelectedIdsToConfirm(new Set());
      setShowRawText(false);
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle selected image file (from camera or gallery)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setSelectedImage(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);

    // Inicia processamento OCR
    await processImageFile(file);
    e.target.value = '';
  };

  /**
   * Pré-processa a imagem para otimizar OCR:
   * Redimensiona para max 1600px e aplica contraste/escala de cinza
   */
  const preprocessImage = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDimension = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(img, 0, 0, width, height);

        // Ajuste de contraste simples no canvas
        try {
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          const contrast = 1.25; // 25% mais contraste
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

          for (let i = 0; i < data.length; i += 4) {
            // Escala de cinza
            const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            const adjusted = factor * (gray - 128) + 128;
            const clamped = Math.max(0, Math.min(255, adjusted));
            data[i] = clamped;
            data[i + 1] = clamped;
            data[i + 2] = clamped;
          }
          ctx.putImageData(imgData, 0, 0);
        } catch (e) {
          // fallback sem filtro se canvas der cors
        }

        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(url);
      img.src = url;
    });
  };

  // Process image using client Tesseract or backend fallback
  const processImageFile = async (file) => {
    setIsProcessing(true);
    setOcrProgress(10);
    setOcrStatusText('Otimizando nitidez e contraste da imagem...');

    try {
      const optimizedDataUrl = await preprocessImage(file);
      setOcrProgress(30);
      setOcrStatusText('Agente OCR reconhecendo caracteres da etiqueta...');

      let textResult = '';

      // Tenta reconhecer com Tesseract.js no cliente
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('por+eng', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text' && m.progress) {
              const p = Math.round(30 + m.progress * 50);
              setOcrProgress(p);
              setOcrStatusText(`Lendo texto da etiqueta (${Math.round(m.progress * 100)}%)...`);
            }
          }
        });

        const ret = await worker.recognize(optimizedDataUrl);
        textResult = ret.data.text || '';
        await worker.terminate();
      } catch (clientErr) {
        console.warn('Fallback para OCR no servidor:', clientErr);
        setOcrStatusText('Processando via Inteligência no Servidor...');
        setOcrProgress(60);

        const res = await fetch('/api/ocr-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: optimizedDataUrl })
        });
        const data = await res.json();
        if (data.success) {
          textResult = data.text || '';
        } else {
          throw new Error(data.message || 'Erro ao processar imagem.');
        }
      }

      setOcrProgress(85);
      setOcrStatusText('Cruzando Números de Série (NS) e IDEC com a planilha...');
      setExtractedRawText(textResult);

      // Processa o texto com nosso Agente
      const agentResult = processPhotoTextWithAgent(textResult, equipments);

      setMatchedResults(agentResult.matchedEquipments);
      setUnmatchedCandidates(agentResult.unmatchedTokens);

      // Pré-seleciona todos os pendentes para check
      const pendingIds = new Set(
        agentResult.matchedEquipments
          .filter(m => !m.alreadyChecked)
          .map(m => m.equipment.id)
      );
      setSelectedIdsToConfirm(pendingIds);

      setOcrProgress(100);
      setOcrStatusText('Concluído!');

      if (agentResult.matchedEquipments.length > 0) {
        if (soundEnabled) playSuccessSound();
      } else {
        if (soundEnabled) playWarningSound();
        setErrorMessage('Nenhum número de série coincidente com a planilha foi encontrado nesta foto. Tente tirar uma foto mais aproximada e focada na etiqueta de número de série (NS) ou IDEC.');
      }

    } catch (err) {
      console.error('Erro no OCR:', err);
      if (soundEnabled) playErrorSound();
      setErrorMessage(`Erro ao digitalizar foto: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle individual item in confirmation selection
  const handleToggleSelectId = (id) => {
    setSelectedIdsToConfirm(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all or deselect all
  const handleSelectAllFound = () => {
    if (selectedIdsToConfirm.size === matchedResults.length) {
      setSelectedIdsToConfirm(new Set());
    } else {
      const all = new Set(matchedResults.map(m => m.equipment.id));
      setSelectedIdsToConfirm(all);
    }
  };

  // Confirm check for selected items
  const handleConfirmBatch = async () => {
    const ids = Array.from(selectedIdsToConfirm);
    if (ids.length === 0) return;

    if (onBatchCheck) {
      await onBatchCheck(ids);
      if (soundEnabled) playSuccessSound();
      onClose();
    }
  };

  const pendingCount = matchedResults.filter(m => !m.alreadyChecked).length;
  const alreadyCheckedCount = matchedResults.filter(m => m.alreadyChecked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputCameraRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputGalleryRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                  Agente Digitalizador de Série (OCR)
                </h3>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  IA de Visão
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Identifica siglas <strong className="text-slate-700 dark:text-slate-300">NS, S/N, IDEC</strong> e números direto da foto da etiqueta
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Action Buttons to capture/upload */}
          {!imagePreview ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6">
              
              {/* Option 1: Tirar Foto com a Câmera */}
              <button
                type="button"
                onClick={() => fileInputCameraRef.current?.click()}
                className="group p-6 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800/70 hover:border-indigo-500 dark:hover:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition flex flex-col items-center justify-center text-center gap-3"
              >
                <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-110 transition-transform">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    Tirar Foto da Etiqueta
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                    Abre a câmera do celular para fotografar a placa de série da bomba
                  </p>
                </div>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>Abrir Câmera</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              </button>

              {/* Option 2: Escolher da Galeria */}
              <button
                type="button"
                onClick={() => fileInputGalleryRef.current?.click()}
                className="group p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition flex flex-col items-center justify-center text-center gap-3"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    Escolher da Galeria
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                    Selecione uma foto já tirada no rolo de fotos do seu celular ou PC
                  </p>
                </div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>Procurar Imagem</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              </button>

            </div>
          ) : (
            /* Image Preview & Processing States */
            <div className="space-y-4">
              
              {/* Image banner & Actions */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center gap-4 p-3 sm:p-4">
                <div className="relative w-full sm:w-44 h-36 rounded-xl overflow-hidden shrink-0 border border-slate-700">
                  <img
                    src={imagePreview}
                    alt="Foto Digitalizada"
                    className="w-full h-full object-cover"
                  />
                  {isProcessing && (
                    <div className="absolute inset-0 bg-indigo-900/60 backdrop-blur-xs flex items-center justify-center">
                      <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 w-full text-left">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                      Foto Carregada
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setMatchedResults([]);
                        setUnmatchedCandidates([]);
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Trocar Foto</span>
                    </button>
                  </div>

                  {isProcessing ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white font-medium">{ocrStatusText}</span>
                        <span className="text-indigo-400 font-mono font-bold">{ocrProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${ocrProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                          {matchedResults.length} identificados na planilha
                        </span>
                        {unmatchedCandidates.length > 0 && (
                          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                            {unmatchedCandidates.length} outros códigos lidos
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        {pendingCount > 0 ? `${pendingCount} equipamentos prontos para confirmação imediata.` : 'Todos os itens detectados já estavam conferidos.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Error message */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Aviso do Agente:</strong>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Matched Results List */}
              {matchedResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Equipamentos Identificados na Planilha ({matchedResults.length})</span>
                    </h4>

                    <button
                      type="button"
                      onClick={handleSelectAllFound}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {selectedIdsToConfirm.size === matchedResults.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {matchedResults.map((matchItem) => {
                      const eq = matchItem.equipment;
                      const isSelected = selectedIdsToConfirm.has(eq.id);

                      return (
                        <div
                          key={eq.id}
                          onClick={() => handleToggleSelectId(eq.id)}
                          className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-sm'
                              : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'border-2 border-slate-300 dark:border-slate-600'
                            }`}>
                              {isSelected && <Check className="w-4 h-4" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white text-sm">
                                  {eq.equipamento || 'Equipamento Hospitalar'}
                                </span>
                                {matchItem.alreadyChecked ? (
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-semibold">
                                    Já Conferido
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                                    Pendente de Check
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                                <span className="font-mono bg-slate-100 dark:bg-slate-700/80 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200">
                                  <strong>NS:</strong> {eq.serie || matchItem.matchedToken}
                                </span>
                                {eq.tag && (
                                  <span className="font-mono text-blue-600 dark:text-blue-400">
                                    <strong>IDEC:</strong> {eq.tag}
                                  </span>
                                )}
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  {matchItem.isExact ? '100% Exato' : matchItem.reason}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Raw Extracted Text Viewer Toggle */}
              {extractedRawText && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowRawText(!showRawText)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1.5 font-medium"
                  >
                    {showRawText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showRawText ? 'Ocultar Texto Bruto do OCR' : 'Ver Texto Bruto Extraído da Imagem'}</span>
                  </button>

                  {showRawText && (
                    <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-mono text-slate-700 dark:text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {extractedRawText}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            {selectedIdsToConfirm.size > 0 ? (
              <span><strong>{selectedIdsToConfirm.size}</strong> equipamentos selecionados para confirmação</span>
            ) : (
              <span>Selecione uma foto da etiqueta para digitalizar</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {imagePreview && (
              <button
                type="button"
                onClick={() => fileInputCameraRef.current?.click()}
                disabled={isProcessing}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
              >
                Tirar Outra Foto
              </button>
            )}

            <button
              type="button"
              disabled={isProcessing || selectedIdsToConfirm.size === 0}
              onClick={handleConfirmBatch}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition disabled:opacity-40"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar Check em Todos da Lista ({selectedIdsToConfirm.size})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

