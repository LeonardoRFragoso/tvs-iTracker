import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Joyride from 'react-joyride';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../config/axios';
import { useAuth } from './AuthContext';

const OnboardingContext = createContext({ start: () => {}, skip: () => {}, status: 'idle' });

const FLOW_ID = 'gettingStarted@1';

export function OnboardingProvider({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completedServer, setCompletedServer] = useState(false);

  const isKioskPath = useMemo(() => {
    const p = location.pathname || '';
    return p.startsWith('/kiosk') || p.startsWith('/k/') || p.startsWith('/tv');
  }, [location.pathname]);

  const steps = useMemo(() => ([
    { target: '[data-tour="menu-content"]', content: 'Aqui você gerencia a sua biblioteca de mídias (vídeos, imagens e áudios).', disableBeacon: true },
    { target: '[data-tour="btn-new-content"]', content: 'Clique em "Novo Conteúdo" para enviar seus arquivos e começar.', disableBeacon: true },
    { target: '[data-tour="menu-campaigns"]', content: 'Campanhas agrupam conteúdos e definem a ordem de exibição.', disableBeacon: true },
    { target: '[data-tour="btn-new-campaign"]', content: 'Crie uma nova campanha. Depois, acesse a aba Preview para compilar o vídeo final.', disableBeacon: true },
    { target: '[data-tour="menu-schedules"]', content: 'Agendamentos definem quando e onde as campanhas serão exibidas.', disableBeacon: true },
    { target: '[data-tour="btn-new-schedule"]', content: 'Crie um novo agendamento, selecionando o player, horários e dias.', disableBeacon: true },
    { target: '[data-tour="menu-players"]', content: 'Monitore e gerencie os players (TVs) conectados.', disableBeacon: true },
    { target: '[data-tour="btn-new-player"]', content: 'Registre um novo player. Para Web/Android/Windows use o link curto do player.', disableBeacon: true },
    { target: '[data-tour="menu-calendar"]', content: 'Acompanhe todos os agendamentos no calendário unificado.', disableBeacon: true },
  ]), []);

  const pathForTarget = useCallback((targetSelector) => {
    if (!targetSelector) return null;
    if (targetSelector.includes('menu-content') || targetSelector.includes('btn-new-content')) return '/content';
    if (targetSelector.includes('menu-campaigns') || targetSelector.includes('btn-new-campaign')) return '/campaigns';
    if (targetSelector.includes('menu-schedules') || targetSelector.includes('btn-new-schedule')) return '/schedules';
    if (targetSelector.includes('menu-players') || targetSelector.includes('btn-new-player')) return '/players';
    if (targetSelector.includes('menu-calendar')) return '/calendar';
    if (targetSelector.includes('menu-dashboard')) return '/dashboard';
    return null;
  }, []);

  useEffect(() => {
    if (!user || isKioskPath) return;
    let cancelled = false;
    const loadState = async () => {
      try {
        const res = await axios.get('/onboarding/state');
        const data = res?.data || {};
        const done = Boolean(data.completed);
        setCompletedServer(done);
        if (!done) {
          setStepIndex(Number(data.step_index || 0));
          setRun(true);
        }
      } catch (_) {
        // silencioso
      }
    };
    loadState();
    return () => { cancelled = true; };
  }, [user, isKioskPath]);

  useEffect(() => {
    if (!run) return;
    const step = steps[stepIndex];
    const target = step && step.target;
    const requiredPath = pathForTarget(target);
    if (requiredPath && !location.pathname.startsWith(requiredPath)) {
      navigate(requiredPath);
    }
  }, [run, stepIndex, steps, pathForTarget, location.pathname, navigate]);

  const handleCallback = useCallback(async (data) => {
    const { status, type, index } = data || {};

    if (type === 'step:after') {
      const i = Number(index || 0);
      const next = i + 1;
      setStepIndex(next);
      axios.post('/onboarding/progress', { step_index: next }).catch(() => {});
    }

    if (status === 'finished' || status === 'skipped') {
      try {
        await axios.post('/onboarding/complete', {});
      } catch (_) { /* no-op */ }
      setRun(false);
    }
  }, []);

  const start = useCallback(() => {
    if (isKioskPath) return;
    setCompletedServer(false);
    setStepIndex(0);
    setRun(true);
    axios.post('/onboarding/progress', { step_index: 0 }).catch(() => {});
  }, [isKioskPath]);

  const skip = useCallback(async () => {
    try { await axios.post('/onboarding/complete', {}); } catch (_) { /* no-op */ }
    setRun(false);
  }, []);

  const value = useMemo(() => ({ start, skip, status: run ? 'running' : (completedServer ? 'completed' : 'idle') }), [start, skip, run, completedServer]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {!isKioskPath && (
        <Joyride
          run={run}
          steps={steps}
          stepIndex={stepIndex}
          continuous
          showSkipButton
          showProgress
          scrollToFirstStep
          disableOverlayClose
          locale={{
            back: 'Voltar',
            close: 'Fechar',
            last: 'Concluir',
            next: 'Próximo',
            open: 'Abrir',
            skip: 'Pular'
          }}
          styles={{
            options: {
              zIndex: 2000,
              primaryColor: '#1976d2'
            }
          }}
          callback={handleCallback}
        />
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
