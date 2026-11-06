// Web Audio API Synthesizer - Hospital & Enterprise Grade Sound Design
// Produz sons elegantes, modernos e profissionais para coletores de dados e conferência clínica

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Som de Sucesso na Bipagem (Equipamento Encontrado e Registrado)
 * Tom: Chime profissional estilo coletor hospitalar Zebra / Apple Pay
 * Elegante, cristalino e de alta definição, sem parecer joguinho
 */
export function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Nota 1: 1046.5 Hz (C6) - curta e suave de entrada
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.006);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.09);

    // Nota 2: 1567.98 Hz (G6) - ressonância cristalina harmoniosa
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1567.98, now + 0.045);
    gain2.gain.setValueAtTime(0.001, now + 0.045);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.052);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.045);
    osc2.stop(now + 0.22);

    // Harmônico sutil e suave: 2093 Hz (C7)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(2093, now + 0.045);
    gain3.gain.setValueAtTime(0.001, now + 0.045);
    gain3.gain.linearRampToValueAtTime(0.06, now + 0.052);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.045);
    osc3.stop(now + 0.18);

  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

/**
 * Som de Setagem Manual de Calibração / Check na Tabela
 * Tom: Toque acústico refinado e tátil, estilo confirmação premium
 */
export function playManualCheckSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Transiente tátil inicial (clique macio de alta fidelidade)
    const oscClick = ctx.createOscillator();
    const gainClick = ctx.createGain();
    oscClick.type = 'triangle';
    oscClick.frequency.setValueAtTime(1200, now);
    oscClick.frequency.exponentialRampToValueAtTime(400, now + 0.02);
    gainClick.gain.setValueAtTime(0.12, now);
    gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    oscClick.connect(gainClick);
    gainClick.connect(ctx.destination);
    oscClick.start(now);
    oscClick.stop(now + 0.025);

    // Tom melódico suave de confirmação (G5 - 783.99 Hz subindo sutilmente para B5)
    const oscTone = ctx.createOscillator();
    const gainTone = ctx.createGain();
    oscTone.type = 'sine';
    oscTone.frequency.setValueAtTime(783.99, now + 0.008);
    oscTone.frequency.exponentialRampToValueAtTime(987.77, now + 0.065);
    gainTone.gain.setValueAtTime(0.001, now + 0.008);
    gainTone.gain.linearRampToValueAtTime(0.16, now + 0.015);
    gainTone.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    oscTone.connect(gainTone);
    gainTone.connect(ctx.destination);
    oscTone.start(now + 0.008);
    oscTone.stop(now + 0.14);

  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

/**
 * Som ao Desmarcar / Cancelar Check Manual
 * Tom: Toque discreto descendente e suave
 */
export function playUncheckSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.09); // A4
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.10);

  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

/**
 * Som de Código Não Encontrado (Erro de Leitura / Fora da Planilha)
 * Tom: Aviso profissional e discreto de recusa (dois bipes suaves e amortecidos)
 * Totalmente reformulado: NUNCA mais som de serra descendente / som de peido!
 */
export function playErrorSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Primeiro pulso: F#4 (369.99 Hz) - tom suave de alerta empresarial
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(369.99, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.006);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.08);

    // Segundo pulso: D4 (293.66 Hz) - tom grave limpo e conclusivo
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(293.66, now + 0.10);
    gain2.gain.setValueAtTime(0.001, now + 0.10);
    gain2.gain.linearRampToValueAtTime(0.20, now + 0.106);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.10);
    osc2.stop(now + 0.22);

  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

/**
 * Som de Aviso (Item já checado anteriormente / Atenção)
 * Tom: Duplo toque sutil e polido estilo sistema hospitalar
 */
export function playWarningSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Toque 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.14, now + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.06);

    // Toque 2: 587.33 Hz (D5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(587.33, now + 0.08);
    gain2.gain.setValueAtTime(0.001, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.14, now + 0.085);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.16);

  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

/**
 * Som de Desfazer / Reverter Alteração (Rewind Chime)
 * Tom: Dois tons harmônicos agradáveis indicando retorno ao estado anterior
 */
export function playUndoSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Nota 1: 880 Hz (A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.008);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.09);

    // Nota 2: 659.25 Hz (E5) descendo com ressonância suave
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.06);
    gain2.gain.setValueAtTime(0.001, now + 0.06);
    gain2.gain.linearRampToValueAtTime(0.18, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.20);

  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

/**
 * Som de Equipamento Já Bipado / Já Calibrado
 * Tom: Duplo acorde afirmativo em tom de alerta dourado (G5 784Hz -> B5 987Hz)
 */
export function playAlreadyCheckedSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tom 1: 784 Hz (G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.006);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Tom 2: 987.77 Hz (B5) com harmônico de atenção
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.07);
    gain2.gain.setValueAtTime(0.001, now + 0.07);
    gain2.gain.linearRampToValueAtTime(0.20, now + 0.076);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.24);

  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

/**
 * Som de Equipamento em Manutenção Externa (Terceirizada)
 * Tom: Tríade com ressonância profunda (A4 440Hz -> C#5 554Hz -> E5 659Hz)
 * Inconfundível no hospital para avisar que a bomba foi recolhida
 */
export function playMaintenanceAlertSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Nota 1: A4 (440 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.16, now + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.10);

    // Nota 2: C#5 (554.37 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(554.37, now + 0.06);
    gain2.gain.setValueAtTime(0.001, now + 0.06);
    gain2.gain.linearRampToValueAtTime(0.18, now + 0.066);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.16);

    // Nota 3: E5 (659.25 Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(659.25, now + 0.12);
    gain3.gain.setValueAtTime(0.001, now + 0.12);
    gain3.gain.linearRampToValueAtTime(0.22, now + 0.126);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.12);
    osc3.stop(now + 0.28);

  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

/**
 * Síntese de Voz Nativa em Português (SpeechSynthesis)
 * Avisa o operador em voz alta pelo alto-falante do celular / tablet
 */
export function speakVoiceAlert(text, isSoundEnabled = true) {
  if (!isSoundEnabled) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.15;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis feedback failed:', e);
  }
}

/**
 * Vibração Tátil no Celular / Tablet (Vibration API)
 */
export function triggerHapticAlert(type = 'warning') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    if (type === 'maintenance') {
      // 3 pulsos fortes e chamativos
      navigator.vibrate([200, 100, 200, 100, 300]);
    } else if (type === 'already_checked') {
      // 2 pulsos médios de atenção
      navigator.vibrate([150, 80, 150]);
    } else if (type === 'error') {
      navigator.vibrate([300]);
    } else {
      navigator.vibrate([60]);
    }
  } catch (e) {
    // Ignore vibration failure
  }
}
