import React, { useState } from 'react';
import { 
  X, 
  Check, 
  Crown, 
  Zap, 
  Building2, 
  ShieldCheck, 
  Sparkles, 
  PhoneCall, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

export default function PlansModal({ 
  isOpen, 
  onClose, 
  activeHospital, 
  onUpdateHospitalPlan, 
  isMaster = false 
}) {
  const currentPlanId = activeHospital?.plano || 'pro';
  const [selectedPlanId, setSelectedPlanId] = useState(currentPlanId);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const plans = [
    {
      id: 'basico',
      name: 'Básico',
      subtitle: 'Para Clínicas e Laboratórios',
      price: 'R$ 290',
      period: '/mês',
      popular: false,
      color: 'blue',
      limits: 'Até 100 equipamentos • 1 Unidade',
      features: [
        'Até 100 equipamentos cadastrados',
        '1 Unidade Hospitalar ou Clínica',
        'Até 2 operadores simultâneos',
        'Leitor de código de barras e QR Code',
        'Exportação atualizada em Excel (.xlsx)',
        'Suporte via e-mail'
      ]
    },
    {
      id: 'pro',
      name: 'Profissional',
      subtitle: 'Para Hospitais Médios',
      price: 'R$ 590',
      period: '/mês',
      popular: true,
      color: 'emerald',
      limits: 'Até 500 equipamentos • Até 3 Unidades',
      features: [
        'Até 500 equipamentos cadastrados',
        'Até 3 Hospitais / Unidades clientes',
        'Até 5 operadores simultâneos',
        'Sincronização em tempo real entre celulares',
        'Instalação como App PWA no Android & iOS',
        'Alertas de calibração vencida e a vencer',
        'Suporte prioritário via WhatsApp'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      subtitle: 'Para Redes e Grandes Hospitais',
      price: 'R$ 1.290',
      period: '/mês',
      popular: false,
      color: 'amber',
      limits: 'Equipamentos Ilimitados • Múltiplos Hospitais',
      features: [
        'Equipamentos e instrumentos ILIMITADOS',
        'Hospitais e Unidades ILIMITADAS',
        'Operadores e inspetores ILIMITADOS',
        'Painel Master completo de gestão de filiais',
        'Auditoria e rastreabilidade com nome do conferente',
        'SLA de suporte 24/7 com gerente dedicado'
      ]
    }
  ];

  const handleApplyPlan = async (planId) => {
    if (!isMaster) {
      // Direct to WhatsApp sales
      const text = encodeURIComponent(`Olá! Gostaria de contratar o plano ${planId.toUpperCase()} do CalibraCheck para meu hospital.`);
      window.open(`https://wa.me/5511999999999?text=${text}`, '_blank');
      return;
    }

    setSaving(true);
    setSuccessMsg('');
    try {
      await onUpdateHospitalPlan(activeHospital.id, planId);
      setSelectedPlanId(planId);
      setSuccessMsg(`Plano alterado para ${planId.toUpperCase()} com sucesso!`);
      setTimeout(() => {
        setSuccessMsg('');
      }, 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Crown className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-extrabold text-white">Planos Hospitalares</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Multi-Hospital SaaS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Hospital Ativo: <strong className="text-white">{activeHospital?.name || 'Hospital Selecionado'}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Intro text */}
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h4 className="text-base sm:text-lg font-bold text-white">
              Escolha o plano ideal para a sua rede ou unidade
            </h4>
            <p className="text-xs text-slate-400">
              O CalibraCheck pode ser configurado de forma independente para cada hospital ou filial.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p) => {
              const isCurrent = activeHospital?.plano === p.id;

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl p-5 border flex flex-col justify-between transition-all relative ${
                    p.popular
                      ? 'bg-gradient-to-b from-slate-800/90 to-slate-900 border-emerald-500/60 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {p.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-md">
                      Mais Escolhido
                    </span>
                  )}

                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-extrabold text-base text-white">{p.name}</h5>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          Plano Atual
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mb-4">{p.subtitle}</p>

                    {/* Price */}
                    <div className="mb-4 pb-4 border-b border-slate-800">
                      <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{p.price}</span>
                      <span className="text-xs text-slate-400">{p.period}</span>
                      <p className="text-[11px] font-semibold text-emerald-400 mt-1">{p.limits}</p>
                    </div>

                    {/* Features list */}
                    <ul className="space-y-2 text-xs text-slate-300 mb-6">
                      {p.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Button */}
                  <div>
                    {isMaster ? (
                      <button
                        onClick={() => handleApplyPlan(p.id)}
                        disabled={saving || isCurrent}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          isCurrent
                            ? 'bg-slate-800 text-slate-400 cursor-default'
                            : p.popular
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {isCurrent ? 'Plano Ativo' : `Ativar para ${activeHospital?.name || 'Hospital'}`}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApplyPlan(p.id)}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        Falar com Consultor
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>

          {/* Master note */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start gap-3 text-xs text-slate-400 leading-relaxed">
            <Building2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200">Gestão Multi-Hospitalar:</strong> Você pode cadastrar quantos hospitais clientes precisar no <strong>Painel Master</strong> e definir planos e limites diferentes para cada um deles.
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Digiclintec • Software Especializado em Metrologia e Calibração Hospitalar</span>
          <button
            onClick={onClose}
            className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
