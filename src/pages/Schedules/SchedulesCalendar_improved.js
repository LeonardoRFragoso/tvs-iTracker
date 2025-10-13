// Melhorias no sistema de cores e apresentação visual para conflitos de agendamentos

// 1. SISTEMA DE CORES MELHORADO
const CONFLICT_COLORS = [
  { bg: '#1976d2', border: '#1565c0', text: '#ffffff', name: 'Azul Principal', pattern: 'solid' },
  { bg: '#e91e63', border: '#c2185b', text: '#ffffff', name: 'Rosa Vibrante', pattern: 'diagonal' },
  { bg: '#4caf50', border: '#388e3c', text: '#ffffff', name: 'Verde Sucesso', pattern: 'dots' },
  { bg: '#ff9800', border: '#f57c00', text: '#000000', name: 'Laranja Alerta', pattern: 'waves' },
  { bg: '#9c27b0', border: '#7b1fa2', text: '#ffffff', name: 'Roxo Overlay', pattern: 'grid' },
  { bg: '#00bcd4', border: '#0097a7', text: '#ffffff', name: 'Ciano Água', pattern: 'stripes' },
  { bg: '#795548', border: '#5d4037', text: '#ffffff', name: 'Marrom Terra', pattern: 'cross' },
  { bg: '#607d8b', border: '#455a64', text: '#ffffff', name: 'Cinza Neutro', pattern: 'zigzag' },
  { bg: '#ff5722', border: '#e64a19', text: '#ffffff', name: 'Vermelho Crítico', pattern: 'solid' },
  { bg: '#8bc34a', border: '#689f38', text: '#000000', name: 'Verde Lima', pattern: 'diagonal' },
  { bg: '#ffc107', border: '#ffa000', text: '#000000', name: 'Âmbar Dourado', pattern: 'dots' },
  { bg: '#673ab7', border: '#512da8', text: '#ffffff', name: 'Índigo Profundo', pattern: 'waves' }
];

// 2. FUNÇÃO PARA GERAR CORES COM PADRÕES VISUAIS
function getConflictColor(conflictInfo, schedule) {
  if (!conflictInfo || !conflictInfo.hasConflict) {
    // Cor padrão para agendamentos sem conflito
    return {
      backgroundColor: '#1976d2',
      borderColor: '#1565c0',
      textColor: '#ffffff',
      pattern: 'solid',
      opacity: 1.0
    };
  }

  const colorIndex = conflictInfo.colorIndex % CONFLICT_COLORS.length;
  const colorObj = CONFLICT_COLORS[colorIndex];
  
  return {
    backgroundColor: colorObj.bg,
    borderColor: colorObj.border,
    textColor: colorObj.text,
    pattern: colorObj.pattern,
    name: colorObj.name,
    opacity: 0.9, // Ligeiramente transparente para conflitos
    conflictLevel: conflictInfo.conflictLevel || 1
  };
}

// 3. FUNÇÃO PARA DETECTAR CONFLITOS MELHORADA
function detectTimeConflictsImproved(schedules) {
  const conflictAssignments = new Map();
  const playerGroups = new Map();
  
  // Agrupar schedules por player_id
  schedules.forEach(schedule => {
    const playerId = schedule.player_id;
    if (!playerGroups.has(playerId)) {
      playerGroups.set(playerId, []);
    }
    playerGroups.get(playerId).push(schedule);
  });

  // Para cada player, detectar conflitos de horário
  playerGroups.forEach((playerSchedules, playerId) => {
    const conflictGroups = [];
    
    playerSchedules.forEach((schedule, index) => {
      let assignedToGroup = false;
      
      // Verificar se este schedule conflita com algum grupo existente
      for (let groupIndex = 0; groupIndex < conflictGroups.length; groupIndex++) {
        const group = conflictGroups[groupIndex];
        
        // Verificar se há conflito com qualquer schedule do grupo
        const hasConflict = group.some(existingSchedule => 
          schedulesHaveTimeConflict(schedule, existingSchedule)
        );
        
        if (hasConflict) {
          group.push(schedule);
          assignedToGroup = true;
          break;
        }
      }
      
      // Se não foi atribuído a nenhum grupo, criar novo grupo
      if (!assignedToGroup) {
        conflictGroups.push([schedule]);
      }
    });
    
    // Atribuir cores e níveis de conflito para cada grupo
    conflictGroups.forEach((group, groupIndex) => {
      if (group.length > 1) {
        // Há conflito neste grupo
        group.forEach((schedule, colorIndex) => {
          conflictAssignments.set(schedule.id, {
            hasConflict: true,
            colorIndex: (groupIndex * 3 + colorIndex) % CONFLICT_COLORS.length, // Distribuir cores
            conflictLevel: group.length,
            groupId: `${playerId}-${groupIndex}`,
            conflictingWith: group.filter(s => s.id !== schedule.id).map(s => s.id)
          });
        });
      } else {
        // Sem conflito
        conflictAssignments.set(group[0].id, {
          hasConflict: false,
          colorIndex: 0,
          conflictLevel: 0
        });
      }
    });
  });

  return conflictAssignments;
}

// 4. FUNÇÃO PARA VERIFICAR CONFLITO ENTRE DOIS SCHEDULES
function schedulesHaveTimeConflict(schedule1, schedule2) {
  // Verificar se os dias da semana se sobrepõem
  const days1 = (schedule1.days_of_week || '').split(',').map(d => parseInt(d.trim()));
  const days2 = (schedule2.days_of_week || '').split(',').map(d => parseInt(d.trim()));
  
  const hasCommonDay = days1.some(day => days2.includes(day));
  if (!hasCommonDay) return false;

  // Verificar se os períodos de data se sobrepõem
  const parseDate = (dateStr) => {
    const [day, month, year] = dateStr.split('/');
    return new Date(year, month - 1, day);
  };

  const start1 = parseDate(schedule1.start_date.split(' ')[0]);
  const end1 = parseDate(schedule1.end_date.split(' ')[0]);
  const start2 = parseDate(schedule2.start_date.split(' ')[0]);
  const end2 = parseDate(schedule2.end_date.split(' ')[0]);

  const dateOverlap = start1 <= end2 && start2 <= end1;
  if (!dateOverlap) return false;

  // Verificar se os horários se sobrepõem
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(n => parseInt(n));
    return hours * 60 + minutes;
  };

  const startTime1 = timeToMinutes(schedule1.start_time);
  const endTime1 = timeToMinutes(schedule1.end_time);
  const startTime2 = timeToMinutes(schedule2.start_time);
  const endTime2 = timeToMinutes(schedule2.end_time);

  // Tratar horários overnight
  const normalizeTime = (start, end) => {
    if (end < start) {
      // Overnight: 22:00 - 06:00 vira 22:00 - 30:00 (06:00 + 24h)
      return { start, end: end + 24 * 60 };
    }
    return { start, end };
  };

  const time1 = normalizeTime(startTime1, endTime1);
  const time2 = normalizeTime(startTime2, endTime2);

  // Verificar sobreposição de horários
  return time1.start < time2.end && time2.start < time1.end;
}

// 5. COMPONENTE DE LEGENDA MELHORADA
const ConflictLegend = ({ conflictInfo, totalEvents }) => {
  const conflictingSchedules = Array.from(conflictInfo.entries())
    .filter(([_, info]) => info.hasConflict)
    .map(([scheduleId, info]) => ({
      scheduleId,
      ...info,
      color: CONFLICT_COLORS[info.colorIndex % CONFLICT_COLORS.length]
    }));

  if (conflictingSchedules.length === 0) return null;

  return (
    <Alert 
      severity="warning" 
      icon={<Warning />}
      sx={{ 
        mb: 2, 
        borderRadius: 2,
        '& .MuiAlert-message': { width: '100%' }
      }}
    >
      <Stack spacing={2}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          ⚠️ {conflictingSchedules.length} Agendamentos com Conflitos Detectados
        </Typography>
        
        <Typography variant="body2">
          Agendamentos com <strong>cores diferentes</strong> indicam conflitos de horário no mesmo player.
          Cada cor representa um agendamento diferente para facilitar a identificação visual.
        </Typography>

        {/* Legenda de Cores */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {conflictingSchedules.slice(0, 8).map((conflict, index) => (
            <Chip
              key={conflict.scheduleId}
              size="small"
              label={`${conflict.color.name} (${conflict.conflictLevel} conflitos)`}
              sx={{
                backgroundColor: conflict.color.bg,
                color: conflict.color.text,
                border: `2px solid ${conflict.color.border}`,
                fontWeight: 600,
                '& .MuiChip-label': {
                  fontSize: '0.7rem'
                }
              }}
            />
          ))}
          {conflictingSchedules.length > 8 && (
            <Chip
              size="small"
              label={`+${conflictingSchedules.length - 8} mais`}
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          )}
        </Box>

        {/* Estatísticas */}
        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          mt: 1,
          p: 1,
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
          borderRadius: 1
        }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            📊 Estatísticas:
          </Typography>
          <Typography variant="caption">
            {totalEvents} eventos totais
          </Typography>
          <Typography variant="caption">
            {conflictingSchedules.length} com conflitos
          </Typography>
          <Typography variant="caption">
            {((conflictingSchedules.length / totalEvents) * 100).toFixed(1)}% taxa de conflito
          </Typography>
        </Box>
      </Stack>
    </Alert>
  );
};

// 6. ESTILOS CSS MELHORADOS PARA CONFLITOS
const IMPROVED_CONFLICT_STYLES = `
  /* Estilos base para eventos com conflito */
  .fc-event.conflict-event {
    position: relative;
    overflow: visible !important;
    border-width: 3px !important;
    border-style: solid !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;
    font-weight: 700 !important;
    z-index: 10 !important;
  }

  /* Animação de pulso para conflitos críticos */
  .fc-event.conflict-critical {
    animation: conflictPulse 2s infinite;
  }

  @keyframes conflictPulse {
    0%, 100% {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      transform: scale(1);
    }
    50% {
      box-shadow: 0 6px 20px rgba(255, 87, 34, 0.4);
      transform: scale(1.02);
    }
  }

  /* Padrões visuais para diferentes tipos de conflito */
  .fc-event.pattern-diagonal::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.2) 2px,
      rgba(255, 255, 255, 0.2) 4px
    );
    pointer-events: none;
  }

  .fc-event.pattern-dots::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
      circle at 25% 25%,
      rgba(255, 255, 255, 0.3) 1px,
      transparent 1px
    );
    background-size: 8px 8px;
    pointer-events: none;
  }

  /* Indicador de nível de conflito */
  .fc-event.conflict-event::after {
    content: attr(data-conflict-level);
    position: absolute;
    top: -8px;
    right: -8px;
    background: #ff5722;
    color: white;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  /* Hover melhorado para conflitos */
  .fc-event.conflict-event:hover {
    transform: translateY(-3px) scale(1.05) !important;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.35) !important;
    z-index: 999 !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }

  /* Tooltip para informações de conflito */
  .conflict-tooltip {
    position: absolute;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    white-space: nowrap;
    z-index: 1000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .fc-event.conflict-event:hover .conflict-tooltip {
    opacity: 1;
  }
`;

export {
  CONFLICT_COLORS,
  getConflictColor,
  detectTimeConflictsImproved,
  schedulesHaveTimeConflict,
  ConflictLegend,
  IMPROVED_CONFLICT_STYLES
};
