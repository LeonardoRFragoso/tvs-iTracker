import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  ToggleButton, 
  ToggleButtonGroup, 
  LinearProgress, 
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  Stack,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';
import { 
  CalendarToday, 
  Schedule, 
  PlayArrow, 
  Pause, 
  Refresh,
  Info,
  ViewWeek,
  ViewDay,
  ViewModule,
  FilterList
} from '@mui/icons-material';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import axios from '../../config/axios';

const isoDate = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// FunÃ§Ã£o para verificar sobreposiÃ§Ã£o de horÃ¡rios entre dois agendamentos
function hasTimeOverlap(schedule1, schedule2) {
  // Verificar se os perÃ­odos de data se sobrepÃµem
  const parseBrDate = (dateStr) => {
    const [datePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    return new Date(year, month - 1, day);
  };
  
  const start1 = parseBrDate(schedule1.start_date);
  const end1 = parseBrDate(schedule1.end_date);
  const start2 = parseBrDate(schedule2.start_date);
  const end2 = parseBrDate(schedule2.end_date);
  
  // Verificar sobreposiÃ§Ã£o de datas
  if (end1 < start2 || end2 < start1) {
    return false;
  }
  
  // Verificar sobreposiÃ§Ã£o de dias da semana
  const days1 = (schedule1.days_of_week || '1,2,3,4,5').split(',').map(d => parseInt(d.trim()));
  const days2 = (schedule2.days_of_week || '1,2,3,4,5').split(',').map(d => parseInt(d.trim()));
  
  const hasCommonDays = days1.some(day => days2.includes(day));
  if (!hasCommonDays) {
    return false;
  }
  
  // Verificar sobreposiÃ§Ã£o de horÃ¡rios
  const time1Start = schedule1.start_time || '00:00:00';
  const time1End = schedule1.end_time || '23:59:59';
  const time2Start = schedule2.start_time || '00:00:00';
  const time2End = schedule2.end_time || '23:59:59';
  
  // Converter para minutos para facilitar comparaÃ§Ã£o
  const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(n => parseInt(n));
    return h * 60 + m;
  };
  
  const start1Min = timeToMinutes(time1Start);
  const end1Min = timeToMinutes(time1End);
  const start2Min = timeToMinutes(time2Start);
  const end2Min = timeToMinutes(time2End);
  
  // Verificar sobreposiÃ§Ã£o de horÃ¡rios (considerando overnight)
  if (end1Min < start1Min) { // schedule1 Ã© overnight
    if (end2Min < start2Min) { // schedule2 tambÃ©m Ã© overnight
      return true; // Ambos overnight sempre se sobrepÃµem
    } else {
      return start2Min <= end1Min || start1Min <= end2Min;
    }
  } else if (end2Min < start2Min) { // apenas schedule2 Ã© overnight
    return start1Min <= end2Min || start2Min <= end1Min;
  } else { // nenhum é overnight
    return start1Min < end2Min && start2Min < end1Min;
  }
}

// REMOVIDO: detectTimeConflicts() - usando color_index do backend


function expandScheduleToEvents(schedule, rangeStart, rangeEnd) {
  // Gera eventos diÃ¡rios dentro do intervalo com base em days_of_week e horÃ¡rios (suporta overnight)
  console.log(`[SchedulesCalendar] Expanding schedule "${schedule.name}":`, {
    start_date: schedule.start_date,
    end_date: schedule.end_date,
    days_of_week: schedule.days_of_week,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    conflict_type: schedule.conflict_type,
    overlap_priority: schedule.overlap_priority,
    color_index: schedule.color_index,
    content_type: schedule.content_type,
    rangeStart,
    rangeEnd
  });
  
  console.log(`[SchedulesCalendar] Color logic for "${schedule.name}":`, {
    start_date: schedule.start_date,
    end_date: schedule.end_date,
    days_of_week: schedule.days_of_week,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    rangeStart,
    rangeEnd
  });
  
  const events = [];
  const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 0, 0, 0);
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59);

  // Converter datas do formato brasileiro para Date
  const parseBrDate = (dateStr) => {
    // Formato: "09/10/2025 00:00:00" ou "16/10/2025 23:59:59"
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    const [hour, minute, second] = timePart.split(':');
    return new Date(year, month - 1, day, hour, minute, second);
  };

  const schedStart = parseBrDate(schedule.start_date);
  const schedEnd = parseBrDate(schedule.end_date);
  const effectiveStart = new Date(Math.max(start.getTime(), schedStart.getTime()));
  const effectiveEnd = new Date(Math.min(end.getTime(), schedEnd.getTime()));
  
  console.log(`[SchedulesCalendar] Date ranges:`, {
    start,
    end,
    schedStart,
    schedEnd,
    effectiveStart,
    effectiveEnd
  });
  
  if (isNaN(effectiveStart) || isNaN(effectiveEnd) || effectiveStart > effectiveEnd) {
    console.log(`[SchedulesCalendar] No overlap or invalid dates, returning empty events`);
    return events;
  }

  // Converter dias da semana do formato do banco (1=Segunda, 2=TerÃ§a, etc.) 
  // para o formato JavaScript (0=Domingo, 1=Segunda, etc.)
  const allowedDays = (schedule.days_of_week || '1,2,3,4,5')
    .split(',')
    .map((d) => {
      const day = parseInt(d.trim(), 10);
      // Converter do formato Python (0=Segunda) para JavaScript (0=Domingo)
      // Python: 0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex, 5=Sab, 6=Dom
      // JavaScript: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
      if (day === 0) return 6; // Domingo
      return day; // Segunda=1, TerÃ§a=2, etc.
    })
    .filter((n) => !isNaN(n));

  console.log(`[SchedulesCalendar] Allowed days:`, allowedDays);

  // FullCalendar usa 0=Dom..6=Sab. Nosso schedule tambÃ©m (UI). JÃ¡ vindo como 0..6.
  const isAllDay = schedule.start_time === '00:00:00' && schedule.end_time === '23:59:59';
  const [sh, sm, ss] = (schedule.start_time || '00:00:00').split(':').map((v) => parseInt(v, 10) || 0);
  const [eh, em, es] = (schedule.end_time || '23:59:59').split(':').map((v) => parseInt(v, 10) || 0);

  console.log(`[SchedulesCalendar] Time settings:`, {
    isAllDay,
    startTime: `${sh}:${sm}:${ss}`,
    endTime: `${eh}:${em}:${es}`
  });

  for (let d = new Date(effectiveStart); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay();
    console.log(`[SchedulesCalendar] Checking day ${d.toDateString()}, weekday: ${weekday}, allowed: ${allowedDays.includes(weekday)}`);
    
    if (!allowedDays.includes(weekday)) continue;

    if (isAllDay) {
      events.push({
        id: `${schedule.id}-${isoDate(d)}-allday`,
        title: `${schedule.name} (${schedule.player_name})`,
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        allDay: true,
        backgroundColor: (() => {
          console.log(`[DEBUG] Aplicando cores para "${schedule.name}" - color_index:`, schedule.color_index, 'conflict_type:', schedule.conflict_type);
          
          // Array de cores para diferenciar agendamentos conflitantes
          const conflictColors = [
            { bg: '#1976d2', border: '#1565c0', text: '#ffffff', name: 'Azul' },
            { bg: '#e91e63', border: '#c2185b', text: '#ffffff', name: 'Rosa' },
            { bg: '#4caf50', border: '#388e3c', text: '#ffffff', name: 'Verde' },
            { bg: '#ff9800', border: '#f57c00', text: '#000000', name: 'Laranja' },
            { bg: '#9c27b0', border: '#7b1fa2', text: '#ffffff', name: 'Roxo' },
            { bg: '#00bcd4', border: '#0097a7', text: '#ffffff', name: 'Ciano' },
            { bg: '#795548', border: '#5d4037', text: '#ffffff', name: 'Marrom' },
            { bg: '#607d8b', border: '#455a64', text: '#ffffff', name: 'Cinza' },
            { bg: '#ff5722', border: '#e64a19', text: '#ffffff', name: 'Vermelho' },
            { bg: '#8bc34a', border: '#689f38', text: '#000000', name: 'Lima' },
            { bg: '#ffc107', border: '#ffa000', text: '#000000', name: 'Âmbar' },
            { bg: '#673ab7', border: '#512da8', text: '#ffffff', name: 'Índigo' }
          ];
          
          // Overlay sempre roxo
          if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
            console.log(`[DEBUG] Aplicando cor overlay para "${schedule.name}"`);
            return '#6c63ff';
          }
          
          // Se tem color_index do backend (agendamentos sobrepostos), usar cores diferenciadas
          if (schedule.color_index !== undefined && schedule.color_index > 0) {
            const colorObj = conflictColors[schedule.color_index % conflictColors.length];
            console.log(`[DEBUG] Aplicando cor de conflito para "${schedule.name}":`, colorObj.name, colorObj.bg);
            return colorObj.bg;
          }
          
          // Conflitos críticos sempre vermelho (só se não tem color_index)
          if (schedule.conflict_type === 'conflict') {
            console.log(`[DEBUG] Aplicando cor de conflito crítico para "${schedule.name}"`);
            return '#ff5722';
          }
          
          // Cores baseadas na prioridade de sobreposição
          if (schedule.overlap_priority === 'overlap_top') {
            console.log(`[DEBUG] Aplicando cor de prioridade alta para "${schedule.name}"`);
            return '#4caf50'; // Verde para prioridade alta
          }
          
          if (schedule.overlap_priority === 'overlap_bottom') {
            console.log(`[DEBUG] Aplicando cor de prioridade baixa para "${schedule.name}"`);
            return '#ff9800'; // Laranja para prioridade baixa
          }
          
          // Cor padrão
          console.log(`[DEBUG] Usando cor padrão para "${schedule.name}"`);
          return '#1976d2';
        })(),
        borderColor: (() => {
          const conflictColors = [
            { bg: '#1976d2', border: '#1565c0', text: '#ffffff', name: 'Azul' },
            { bg: '#e91e63', border: '#c2185b', text: '#ffffff', name: 'Rosa' },
            { bg: '#4caf50', border: '#388e3c', text: '#ffffff', name: 'Verde' },
            { bg: '#ff9800', border: '#f57c00', text: '#000000', name: 'Laranja' },
            { bg: '#9c27b0', border: '#7b1fa2', text: '#ffffff', name: 'Roxo' },
            { bg: '#00bcd4', border: '#0097a7', text: '#ffffff', name: 'Ciano' },
            { bg: '#795548', border: '#5d4037', text: '#ffffff', name: 'Marrom' },
            { bg: '#607d8b', border: '#455a64', text: '#ffffff', name: 'Cinza' },
            { bg: '#ff5722', border: '#e64a19', text: '#ffffff', name: 'Vermelho' },
            { bg: '#8bc34a', border: '#689f38', text: '#000000', name: 'Lima' },
            { bg: '#ffc107', border: '#ffa000', text: '#000000', name: 'Âmbar' },
            { bg: '#673ab7', border: '#512da8', text: '#ffffff', name: 'Índigo' }
          ];
          
          if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
            return '#5a4fcf';
          }
          
          if (schedule.color_index !== undefined && schedule.color_index > 0) {
            const colorObj = conflictColors[schedule.color_index % conflictColors.length];
            return colorObj.border;
          }
          
          if (schedule.conflict_type === 'conflict') {
            return '#e64a19';
          }
          
          if (schedule.overlap_priority === 'overlap_top') {
            return '#388e3c';
          }
          
          if (schedule.overlap_priority === 'overlap_bottom') {
            return '#f57c00';
          }
          
          return '#1565c0';
        })(),
        extendedProps: {
          player_id: schedule.player_id,
          player_name: schedule.player_name,
          content_type: schedule.content_type,
          has_conflicts: schedule.has_conflicts,
          conflict_type: schedule.conflict_type,
          campaign_name: schedule.campaign_name,
          start_date: schedule.start_date,
          end_date: schedule.end_date,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          days_of_week: schedule.days_of_week,
          priority: schedule.priority,
          is_persistent: schedule.is_persistent,
          location_name: schedule.location_name,
          colorIndex: schedule.color_index
        },
        classNames: schedule.color_index > 0 ? [`color-index-${schedule.color_index}`] : []
      });
    } else if (sh <= eh) {
      // Janela no mesmo dia
      events.push({
        id: `${schedule.id}-${isoDate(d)}`,
        title: `${schedule.name} (${schedule.player_name})`,
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm, ss),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em, es),
        allDay: false,
        backgroundColor: (() => {
          console.log(`[DEBUG] Aplicando cores para "${schedule.name}" - color_index:`, schedule.color_index, 'conflict_type:', schedule.conflict_type);
          
          // Array de cores para diferenciar agendamentos conflitantes
          const conflictColors = [
            { bg: '#1976d2', border: '#1565c0', text: '#ffffff', name: 'Azul' },
            { bg: '#e91e63', border: '#c2185b', text: '#ffffff', name: 'Rosa' },
            { bg: '#4caf50', border: '#388e3c', text: '#ffffff', name: 'Verde' },
            { bg: '#ff9800', border: '#f57c00', text: '#000000', name: 'Laranja' },
            { bg: '#9c27b0', border: '#7b1fa2', text: '#ffffff', name: 'Roxo' },
            { bg: '#00bcd4', border: '#0097a7', text: '#ffffff', name: 'Ciano' },
            { bg: '#795548', border: '#5d4037', text: '#ffffff', name: 'Marrom' },
            { bg: '#607d8b', border: '#455a64', text: '#ffffff', name: 'Cinza' },
            { bg: '#ff5722', border: '#e64a19', text: '#ffffff', name: 'Vermelho' },
            { bg: '#8bc34a', border: '#689f38', text: '#000000', name: 'Lima' },
            { bg: '#ffc107', border: '#ffa000', text: '#000000', name: 'Âmbar' },
            { bg: '#673ab7', border: '#512da8', text: '#ffffff', name: 'Índigo' }
          ];
          
          // Overlay sempre roxo
          if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
            console.log(`[DEBUG] Aplicando cor overlay para "${schedule.name}"`);
            return '#6c63ff';
          }
          
          // Se tem color_index do backend (agendamentos sobrepostos), usar cores diferenciadas
          if (schedule.color_index !== undefined && schedule.color_index > 0) {
            const colorObj = conflictColors[schedule.color_index % conflictColors.length];
            console.log(`[DEBUG] Aplicando cor de conflito para "${schedule.name}":`, colorObj.name, colorObj.bg);
            return colorObj.bg;
          }
          
          // Conflitos críticos sempre vermelho (só se não tem color_index)
          if (schedule.conflict_type === 'conflict') {
            console.log(`[DEBUG] Aplicando cor de conflito crítico para "${schedule.name}"`);
            return '#ff5722';
          }
          
          // Cores baseadas na prioridade de sobreposição
          if (schedule.overlap_priority === 'overlap_top') {
            console.log(`[DEBUG] Aplicando cor de prioridade alta para "${schedule.name}"`);
            return '#4caf50'; // Verde para prioridade alta
          }
          
          if (schedule.overlap_priority === 'overlap_bottom') {
            console.log(`[DEBUG] Aplicando cor de prioridade baixa para "${schedule.name}"`);
            return '#ff9800'; // Laranja para prioridade baixa
          }
          
          // Cor padrão
          console.log(`[DEBUG] Usando cor padrão para "${schedule.name}"`);
          return '#1976d2';
        })(),
        borderColor: (() => {
          const conflictColors = [
            { bg: '#1976d2', border: '#1565c0', text: '#ffffff', name: 'Azul' },
            { bg: '#e91e63', border: '#c2185b', text: '#ffffff', name: 'Rosa' },
            { bg: '#4caf50', border: '#388e3c', text: '#ffffff', name: 'Verde' },
            { bg: '#ff9800', border: '#f57c00', text: '#000000', name: 'Laranja' },
            { bg: '#9c27b0', border: '#7b1fa2', text: '#ffffff', name: 'Roxo' },
            { bg: '#00bcd4', border: '#0097a7', text: '#ffffff', name: 'Ciano' },
            { bg: '#795548', border: '#5d4037', text: '#ffffff', name: 'Marrom' },
            { bg: '#607d8b', border: '#455a64', text: '#ffffff', name: 'Cinza' },
            { bg: '#ff5722', border: '#e64a19', text: '#ffffff', name: 'Vermelho' },
            { bg: '#8bc34a', border: '#689f38', text: '#000000', name: 'Lima' },
            { bg: '#ffc107', border: '#ffa000', text: '#000000', name: 'Âmbar' },
            { bg: '#673ab7', border: '#512da8', text: '#ffffff', name: 'Índigo' }
          ];
          
          if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
            return '#5a4fcf';
          }
          
          if (schedule.color_index !== undefined && schedule.color_index > 0) {
            const colorObj = conflictColors[schedule.color_index % conflictColors.length];
            return colorObj.border;
          }
          
          if (schedule.conflict_type === 'conflict') {
            return '#e64a19';
          }
          
          if (schedule.overlap_priority === 'overlap_top') {
            return '#388e3c';
          }
          
          if (schedule.overlap_priority === 'overlap_bottom') {
            return '#f57c00';
          }
          
          return '#1565c0';
        })(),
        extendedProps: {
          player_id: schedule.player_id,
          player_name: schedule.player_name,
          content_type: schedule.content_type,
          has_conflicts: schedule.has_conflicts,
          conflict_type: schedule.conflict_type,
          campaign_name: schedule.campaign_name,
          start_date: schedule.start_date,
          end_date: schedule.end_date,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          days_of_week: schedule.days_of_week,
          priority: schedule.priority,
          is_persistent: schedule.is_persistent,
          location_name: schedule.location_name,
          colorIndex: schedule.color_index
        },
        classNames: schedule.color_index > 0 ? [`color-index-${schedule.color_index}`] : []
      });
    } else {
      // Overnight: parte 1 no dia D
      events.push({
        id: `${schedule.id}-${isoDate(d)}-p1`,
        title: `${schedule.name} (${schedule.player_name})`,
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm, ss),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59),
        allDay: false,
        backgroundColor: (() => {
          console.log(`[DEBUG] Aplicando cores para "${schedule.name}" - color_index:`, schedule.color_index, 'conflict_type:', schedule.conflict_type);
          
          // Array de cores para diferenciar agendamentos conflitantes
          const conflictColors = [
            { bg: '#1976d2', border: '#1565c0', text: '#ffffff', name: 'Azul' },
            { bg: '#e91e63', border: '#c2185b', text: '#ffffff', name: 'Rosa' },
            { bg: '#4caf50', border: '#388e3c', text: '#ffffff', name: 'Verde' },
            { bg: '#ff9800', border: '#f57c00', text: '#000000', name: 'Laranja' },
            { bg: '#9c27b0', border: '#7b1fa2', text: '#ffffff', name: 'Roxo' },
            { bg: '#00bcd4', border: '#0097a7', text: '#ffffff', name: 'Ciano' },
            { bg: '#795548', border: '#5d4037', text: '#ffffff', name: 'Marrom' },
            { bg: '#607d8b', border: '#455a64', text: '#ffffff', name: 'Cinza' },
            { bg: '#ff5722', border: '#e64a19', text: '#ffffff', name: 'Vermelho' },
            { bg: '#8bc34a', border: '#689f38', text: '#000000', name: 'Lima' },
            { bg: '#ffc107', border: '#ffa000', text: '#000000', name: 'Âmbar' },
            { bg: '#673ab7', border: '#512da8', text: '#ffffff', name: 'Índigo' }
          ];
          
          // Overlay sempre roxo
          if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
            console.log(`[DEBUG] Aplicando cor overlay para "${schedule.name}"`);
            return '#6c63ff';
          }
          
          // Se tem color_index do backend (agendamentos sobrepostos), usar cores diferenciadas
          if (schedule.color_index !== undefined && schedule.color_index > 0) {
            const colorObj = conflictColors[schedule.color_index % conflictColors.length];
            console.log(`[DEBUG] Aplicando cor de conflito para "${schedule.name}":`, colorObj.name, colorObj.bg);
            return colorObj.bg;
          }
          
          // Conflitos críticos sempre vermelho (só se não tem color_index)
          if (schedule.conflict_type === 'conflict') {
            console.log(`[DEBUG] Aplicando cor de conflito crítico para "${schedule.name}"`);
            return '#ff5722';
          }
          
          // Cores baseadas na prioridade de sobreposição
          if (schedule.overlap_priority === 'overlap_top') {
            console.log(`[DEBUG] Aplicando cor de prioridade alta para "${schedule.name}"`);
            return '#4caf50'; // Verde para prioridade alta
          }
          
          if (schedule.overlap_priority === 'overlap_bottom') {
            console.log(`[DEBUG] Aplicando cor de prioridade baixa para "${schedule.name}"`);
            return '#ff9800'; // Laranja para prioridade baixa
          }
          
          // Cor padrão
          console.log(`[DEBUG] Usando cor padrão para "${schedule.name}"`);
          return '#1976d2';
        })(),
        borderColor: (() => {
          const conflictColors = [
            { bg: '#1976d2', border: '#1565c0', text: '#ffffff', name: 'Azul' },
            { bg: '#e91e63', border: '#c2185b', text: '#ffffff', name: 'Rosa' },
            { bg: '#4caf50', border: '#388e3c', text: '#ffffff', name: 'Verde' },
            { bg: '#ff9800', border: '#f57c00', text: '#000000', name: 'Laranja' },
            { bg: '#9c27b0', border: '#7b1fa2', text: '#ffffff', name: 'Roxo' },
            { bg: '#00bcd4', border: '#0097a7', text: '#ffffff', name: 'Ciano' },
            { bg: '#795548', border: '#5d4037', text: '#ffffff', name: 'Marrom' },
            { bg: '#607d8b', border: '#455a64', text: '#ffffff', name: 'Cinza' },
            { bg: '#ff5722', border: '#e64a19', text: '#ffffff', name: 'Vermelho' },
            { bg: '#8bc34a', border: '#689f38', text: '#000000', name: 'Lima' },
            { bg: '#ffc107', border: '#ffa000', text: '#000000', name: 'Âmbar' },
            { bg: '#673ab7', border: '#512da8', text: '#ffffff', name: 'Índigo' }
          ];
          
          if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
            return '#5a4fcf';
          }
          
          if (schedule.color_index !== undefined && schedule.color_index > 0) {
            const colorObj = conflictColors[schedule.color_index % conflictColors.length];
            return colorObj.border;
          }
          
          if (schedule.conflict_type === 'conflict') {
            return '#e64a19';
          }
          
          if (schedule.overlap_priority === 'overlap_top') {
            return '#388e3c';
          }
          
          if (schedule.overlap_priority === 'overlap_bottom') {
            return '#f57c00';
          }
          
          return '#1565c0';
        })(),
        extendedProps: {
          player_id: schedule.player_id,
          player_name: schedule.player_name,
          content_type: schedule.content_type,
          has_conflicts: schedule.has_conflicts,
          conflict_type: schedule.conflict_type,
          campaign_name: schedule.campaign_name,
          start_date: schedule.start_date,
          end_date: schedule.end_date,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          days_of_week: schedule.days_of_week,
          priority: schedule.priority,
          is_persistent: schedule.is_persistent,
          location_name: schedule.location_name,
          colorIndex: schedule.color_index
        },
        classNames: schedule.color_index > 0 ? [`color-index-${schedule.color_index}`] : []
      });
      // Parte 2 no dia D+1
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0);
      if (next <= effectiveEnd) {
        events.push({
          id: `${schedule.id}-${isoDate(next)}-p2`,
          title: `${schedule.name} (${schedule.player_name})`,
          start: new Date(next.getFullYear(), next.getMonth(), next.getDate(), 0, 0, 0),
          end: new Date(next.getFullYear(), next.getMonth(), next.getDate(), eh, em, es),
          allDay: false,
          backgroundColor: (() => {
          console.log(`[DEBUG] Aplicando cores para "${schedule.name}" - color_index:`, schedule.color_index, 'conflict_type:', schedule.conflict_type);
          
          // Array de cores para diferenciar agendamentos conflitantes
          const conflictColors = [
            { bg: '#1976d2', border: '#1565c0', text: '#ffffff', name: 'Azul' },
            { bg: '#e91e63', border: '#c2185b', text: '#ffffff', name: 'Rosa' },
            { bg: '#4caf50', border: '#388e3c', text: '#ffffff', name: 'Verde' },
            { bg: '#ff9800', border: '#f57c00', text: '#000000', name: 'Laranja' },
            { bg: '#9c27b0', border: '#7b1fa2', text: '#ffffff', name: 'Roxo' },
            { bg: '#00bcd4', border: '#0097a7', text: '#ffffff', name: 'Ciano' },
            { bg: '#795548', border: '#5d4037', text: '#ffffff', name: 'Marrom' },
            { bg: '#607d8b', border: '#455a64', text: '#ffffff', name: 'Cinza' },
            { bg: '#ff5722', border: '#e64a19', text: '#ffffff', name: 'Vermelho' },
            { bg: '#8bc34a', border: '#689f38', text: '#000000', name: 'Lima' },
            { bg: '#ffc107', border: '#ffa000', text: '#000000', name: 'Âmbar' },
            { bg: '#673ab7', border: '#512da8', text: '#ffffff', name: 'Índigo' }
          ];
          
          // Overlay sempre roxo
          if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
            console.log(`[DEBUG] Aplicando cor overlay para "${schedule.name}"`);
            return '#6c63ff';
          }
          
          // Se tem color_index do backend (agendamentos sobrepostos), usar cores diferenciadas
          if (schedule.color_index !== undefined && schedule.color_index > 0) {
            const colorObj = conflictColors[schedule.color_index % conflictColors.length];
            console.log(`[DEBUG] Aplicando cor de conflito para "${schedule.name}":`, colorObj.name, colorObj.bg);
            return colorObj.bg;
          }
          
          // Conflitos críticos sempre vermelho (só se não tem color_index)
          if (schedule.conflict_type === 'conflict') {
            console.log(`[DEBUG] Aplicando cor de conflito crítico para "${schedule.name}"`);
            return '#ff5722';
          }
          
          // Cores baseadas na prioridade de sobreposição
          if (schedule.overlap_priority === 'overlap_top') {
            console.log(`[DEBUG] Aplicando cor de prioridade alta para "${schedule.name}"`);
            return '#4caf50'; // Verde para prioridade alta
          }
          
          if (schedule.overlap_priority === 'overlap_bottom') {
            console.log(`[DEBUG] Aplicando cor de prioridade baixa para "${schedule.name}"`);
            return '#ff9800'; // Laranja para prioridade baixa
          }
          
          // Cor padrão
          console.log(`[DEBUG] Usando cor padrão para "${schedule.name}"`);
          return '#1976d2';
        })(),
        borderColor: (() => {
          const conflictColors = [
            { bg: '#1976d2', border: '#1565c0', text: '#ffffff', name: 'Azul' },
            { bg: '#e91e63', border: '#c2185b', text: '#ffffff', name: 'Rosa' },
            { bg: '#4caf50', border: '#388e3c', text: '#ffffff', name: 'Verde' },
            { bg: '#ff9800', border: '#f57c00', text: '#000000', name: 'Laranja' },
            { bg: '#9c27b0', border: '#7b1fa2', text: '#ffffff', name: 'Roxo' },
            { bg: '#00bcd4', border: '#0097a7', text: '#ffffff', name: 'Ciano' },
            { bg: '#795548', border: '#5d4037', text: '#ffffff', name: 'Marrom' },
            { bg: '#607d8b', border: '#455a64', text: '#ffffff', name: 'Cinza' },
            { bg: '#ff5722', border: '#e64a19', text: '#ffffff', name: 'Vermelho' },
            { bg: '#8bc34a', border: '#689f38', text: '#000000', name: 'Lima' },
            { bg: '#ffc107', border: '#ffa000', text: '#000000', name: 'Âmbar' },
            { bg: '#673ab7', border: '#512da8', text: '#ffffff', name: 'Índigo' }
          ];
          
          if (schedule.content_type === 'overlay' || schedule.overlap_priority === 'overlay') {
            return '#5a4fcf';
          }
          
          if (schedule.color_index !== undefined && schedule.color_index > 0) {
            const colorObj = conflictColors[schedule.color_index % conflictColors.length];
            return colorObj.border;
          }
          
          if (schedule.conflict_type === 'conflict') {
            return '#e64a19';
          }
          
          if (schedule.overlap_priority === 'overlap_top') {
            return '#388e3c';
          }
          
          if (schedule.overlap_priority === 'overlap_bottom') {
            return '#f57c00';
          }
          
          return '#1565c0';
        })(),
          extendedProps: {
            player_id: schedule.player_id,
            player_name: schedule.player_name,
            content_type: schedule.content_type
          }
        });
      }
    }
  }

  console.log(`[SchedulesCalendar] Generated ${events.length} events for schedule "${schedule.name}"`);
  return events;
}

const SchedulesCalendar = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [view, setView] = useState('timeGridWeek'); // dayGridMonth | timeGridWeek | timeGridDay
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [totalSchedules, setTotalSchedules] = useState(0);
  const calendarRef = useRef(null);

  const initialDate = useMemo(() => new Date(), []);

  // Buscar lista de players
  const fetchPlayers = async () => {
    try {
      const res = await axios.get('/players?per_page=1000');
      setPlayers(res.data.players || []);
    } catch (err) {
      console.error('[SchedulesCalendar] Error fetching players:', err);
    }
  };

  const fetchRange = async (start, end) => {
    try {
      setLoading(true);
      setError('');
      setCurrentDate(start);
      
      const params = new URLSearchParams({
        start: `${start.getDate().toString().padStart(2,'0')}/${(start.getMonth()+1).toString().padStart(2,'0')}/${start.getFullYear()}`,
        end: `${end.getDate().toString().padStart(2,'0')}/${(end.getMonth()+1).toString().padStart(2,'0')}/${end.getFullYear()}`,
        is_active: 'true'
      });

      // Se um player especÃ­fico foi selecionado, filtrar por ele
      if (selectedPlayer) {
        params.append('player_id', selectedPlayer);
      }

      console.log(`[SchedulesCalendar] Fetching schedules with params:`, params.toString());
      const res = await axios.get(`/schedules/range?${params.toString()}`);
      const schedules = res.data.schedules || [];
      console.log(`[SchedulesCalendar] Received ${schedules.length} schedules:`, schedules);
      
      setTotalSchedules(schedules.length);

      // Expandir schedules em eventos do calendário (usando color_index do backend)
      const expanded = schedules.flatMap((s) => {
        console.log(`[DEBUG] Schedule "${s.name}" color_index do backend:`, s.color_index);
        const events = expandScheduleToEvents(s, start, end);
        console.log(`[SchedulesCalendar] Schedule "${s.name}" expanded to ${events.length} events:`, events);
        return events;
      });
      console.log(`[SchedulesCalendar] Total events generated: ${expanded.length}`, expanded);
      setEvents(expanded);
    } catch (err) {
      console.error('[SchedulesCalendar] Error fetching schedules:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao carregar calendÃ¡rio');
    } finally {
      setLoading(false);
    }
  };

  // FullCalendar callback quando muda de intervalo
  const handleDatesSet = (arg) => {
    const start = new Date(arg.start);
    const end = new Date(arg.end);
    console.log(`[SchedulesCalendar] handleDatesSet called with:`, { start, end, argStart: arg.start, argEnd: arg.end });
    // Ajuste: reduzir 1 dia do end porque o FullCalendar usa fim exclusivo
    end.setDate(end.getDate() - 1);
    console.log(`[SchedulesCalendar] Adjusted end date:`, end);
    fetchRange(start, end);
  };

  // FunÃ§Ã£o para mudar a visualizaÃ§Ã£o do calendÃ¡rio
  const handleViewChange = (newView) => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(newView);
    }
    setView(newView);
  };

  // FunÃ§Ã£o para filtrar por player
  const handlePlayerFilter = (playerId) => {
    setSelectedPlayer(playerId);
    // Recarregar dados com o novo filtro
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const start = calendarApi.view.activeStart;
      const end = calendarApi.view.activeEnd;
      end.setDate(end.getDate() - 1);
      fetchRange(start, end);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    fetchPlayers();
  }, []);

  return (
    <Box sx={{ p: 2, backgroundColor: theme.palette.background.default, minHeight: '100vh' }}>
      {/* CabeÃ§alho Principal */}
      <Paper elevation={2} sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent sx={{ pb: 1.5, pt: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4" component="h1" sx={{ 
                fontWeight: 600, 
                color: theme.palette.primary.main,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <CalendarToday sx={{ fontSize: 32 }} />
                CalendÃ¡rio Global de Agendamentos
              </Typography>
              
              <Box sx={{ mt: 1 }}>
                <Typography variant="h6" sx={{ color: theme.palette.text.secondary, fontWeight: 500 }}>
                  Visualize agendamentos de todos os players ou filtre por player especÃ­fico
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <Chip 
                    label={`${totalSchedules} agendamentos`} 
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                  {selectedPlayer && (
                    <Chip 
                      label={`Filtrado por: ${players.find(p => p.id === selectedPlayer)?.name || 'Player'}`} 
                      color="secondary"
                      variant="outlined"
                      size="small"
                      onDelete={() => handlePlayerFilter('')}
                    />
                  )}
                </Stack>
              </Box>
            </Box>

            <Stack direction="row" spacing={1}>
              <Tooltip title="Atualizar calendÃ¡rio">
                <IconButton 
                  onClick={() => window.location.reload()} 
                  color="primary"
                  sx={{ 
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.1)' : '#e3f2fd',
                    '&:hover': { 
                      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.2)' : '#bbdefb' 
                    }
                  }}
                >
                  <Refresh />
                </IconButton>
              </Tooltip>
              
              <Button
                variant="contained"
                startIcon={<Schedule />}
                onClick={() => navigate('/schedules')}
                sx={{ 
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600
                }}
              >
                Gerenciar Agendamentos
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Paper>

      {/* Filtros */}
      <Paper elevation={1} sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Filtrar por Player</InputLabel>
                <Select
                  value={selectedPlayer}
                  onChange={(e) => handlePlayerFilter(e.target.value)}
                  label="Filtrar por Player"
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">Todos os Players</MenuItem>
                  {players.map(player => (
                    <MenuItem key={player.id} value={player.id}>
                      {player.name} {player.is_online ? '(Online)' : '(Offline)'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip 
                  label={
                    view === 'dayGridMonth' ? 'VisualizaÃ§Ã£o Mensal' :
                    view === 'timeGridWeek' ? 'VisualizaÃ§Ã£o Semanal' :
                    'VisualizaÃ§Ã£o DiÃ¡ria'
                  }
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={{ 
                    fontSize: '0.75rem',
                    height: 24
                  }}
                />
                
                {/* Legenda de cores */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: 1,
                    background: 'linear-gradient(135deg, #1976d2, #1565c0)',
                    border: '1px solid rgba(255,255,255,0.3)'
                  }} />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    Normal
                  </Typography>
                  
                  <Box sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: 1,
                    background: 'linear-gradient(135deg, #6c63ff, #5a52ff)',
                    border: '1px solid rgba(255,255,255,0.3)'
                  }} />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    Overlay
                  </Typography>
                  
                  <Box sx={{ 
                    width: 12, 
                    height: 12, 
                    borderRadius: 1,
                    background: 'linear-gradient(135deg, #ff9800, #f57c00)',
                    border: '2px solid #ffcdd2'
                  }} />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    SobreposiÃ§Ã£o
                  </Typography>
                </Box>
                
                <ToggleButtonGroup
                  value={view}
                  exclusive
                  onChange={(e, v) => v && handleViewChange(v)}
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 500,
                      px: 2,
                      py: 1
                    }
                  }}
                >
                  <ToggleButton value="dayGridMonth">
                    <ViewModule sx={{ mr: 1 }} />
                    MÃªs
                  </ToggleButton>
                  <ToggleButton value="timeGridWeek">
                    <ViewWeek sx={{ mr: 1 }} />
                    Semana
                  </ToggleButton>
                  <ToggleButton value="timeGridDay">
                    <ViewDay sx={{ mr: 1 }} />
                    Dia
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Paper>

      {/* Estados de Loading e Erro */}
      {loading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress 
            sx={{ 
              height: 4, 
              borderRadius: 2,
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.1)' : '#e3f2fd',
              '& .MuiLinearProgress-bar': {
                backgroundColor: theme.palette.primary.main
              }
            }} 
          />
          <Typography variant="body2" sx={{ mt: 1, textAlign: 'center', color: theme.palette.text.secondary }}>
            Carregando agendamentos...
          </Typography>
        </Box>
      )}
      
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 2, 
            borderRadius: 2,
            '& .MuiAlert-message': {
              fontWeight: 500
            }
          }}
        >
          {error}
        </Alert>
      )}

      {/* CalendÃ¡rio Principal */}
      <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          headerToolbar={{ 
            left: 'prev,next today', 
            center: 'title', 
            right: '' 
          }}
          datesSet={handleDatesSet}
          events={events}
          height="calc(100vh - 400px)"
          locale="pt-br"
          allDaySlot={true}
          nowIndicator={true}
          slotMinTime={'00:00:00'}
          slotMaxTime={'24:00:00'}
          slotDuration={view === 'timeGridDay' ? '00:15:00' : '00:30:00'}
          firstDay={1}
          expandRows={true}
          dayMaxEvents={view === 'dayGridMonth' ? 3 : false}
          moreLinkClick={view === 'dayGridMonth' ? 'popover' : undefined}
          eventClick={(info) => {
            const playerId = info.event.extendedProps?.player_id;
            if (playerId) {
              navigate(`/players/${playerId}/calendar`);
            } else {
              navigate('/schedules');
            }
          }}
          // Estilos customizados
          eventClassNames={(info) => {
            const classes = ['custom-event'];
            const conflictType = info.event.extendedProps?.conflict_type;
            if (conflictType === 'conflict') {
              classes.push('conflict-event');
            } else if (conflictType === 'overlay') {
              classes.push('overlay-event');
            }
            return classes;
          }}
          // Conteúdo customizado com tooltip rico
          eventContent={(arg) => {
            const props = arg.event.extendedProps;
            const formatDays = (daysStr) => {
              const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
              return (daysStr || '').split(',').map(d => dayNames[parseInt(d)] || d).join(', ');
            };
            
            const tooltipContent = `
              ${props.is_persistent ? '📌 Persistente' : ''}
              ${props.has_conflicts ? '⚠️ TEM CONFLITOS' : '✅ Sem conflitos'}
              📅 ${arg.event.title}
              🎯 Campanha: ${props.campaign_name || 'N/A'}
              📍 Local: ${props.location_name || 'N/A'}
              🖥️ Player: ${props.player_name || 'N/A'}
              📺 Tipo: ${props.content_type === 'overlay' ? 'Overlay' : 'Principal'}
              ⏰ Horário: ${props.start_time} - ${props.end_time}
              📆 Dias: ${formatDays(props.days_of_week)}
              🔄 Período: ${props.start_date} até ${props.end_date}
              ⚡ Prioridade: ${props.priority || 'Normal'}
            `.trim();

            return (
              <div 
                style={{ 
                  padding: '4px 6px', 
                  overflow: 'hidden',
                  height: '100%',
                  position: 'relative',
                  cursor: 'pointer'
                }}
                title={tooltipContent}
              >
                <div style={{ 
                  fontWeight: props.has_conflicts ? '700' : '600', 
                  fontSize: '0.8rem',
                  lineHeight: '1.2',
                  color: 'inherit'
                }}>
                  {arg.event.title}
                </div>
                {!arg.event.allDay && (
                  <div style={{ 
                    fontSize: '0.7rem', 
                    opacity: 0.9,
                    marginTop: '1px'
                  }}>
                    {arg.timeText}
                  </div>
                )}
                {props.has_conflicts && (
                  <div style={{ 
                    fontSize: '0.65rem', 
                    marginTop: '1px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    ⚠️ Conflito
                  </div>
                )}
                {props.content_type === 'overlay' && (
                  <div style={{ 
                    fontSize: '0.65rem', 
                    marginTop: '1px',
                    fontWeight: '600',
                    opacity: 0.8
                  }}>
                    📌 Overlay
                  </div>
                )}
              </div>
            );
          }}
          // Configurações de tema
          themeSystem="standard"
          // Configurações de texto
          buttonText={{
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia'
          }}
          // Configurações de dia da semana
          dayHeaderFormat={{ weekday: 'short' }}
          // ConfiguraÃ§Ãµes de slot
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }}
        />
      </Paper>

      {/* Estilos CSS customizados */}
      <style jsx global>{`
        .fc {
          font-family: 'Roboto', sans-serif;
        }
        
        .fc-header-toolbar {
          padding: 16px;
          background: ${theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #ff9800, #f57c00)' 
            : 'linear-gradient(135deg, #1976d2, #1565c0)'};
          color: white;
          border-radius: 8px 8px 0 0;
        }
        
        .fc-toolbar-title {
          font-size: 1.5rem !important;
          font-weight: 600 !important;
        }
        
        .fc-button {
          background-color: rgba(255, 255, 255, 0.2) !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          color: white !important;
          font-weight: 500 !important;
          border-radius: 6px !important;
          padding: 8px 16px !important;
        }
        
        .fc-button:hover {
          background-color: rgba(255, 255, 255, 0.3) !important;
        }
        
        .fc-button:focus {
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5) !important;
        }
        
        .fc-daygrid-day-number {
          font-weight: 500;
          color: ${theme.palette.text.primary};
        }
        
        .fc-timegrid-slot-label {
          font-weight: 500;
          color: ${theme.palette.text.secondary};
        }
        
        .fc-timegrid-axis {
          color: ${theme.palette.text.secondary};
        }
        
        .fc-daygrid-day {
          background-color: ${theme.palette.background.paper};
          color: ${theme.palette.text.primary};
        }
        
        .fc-timegrid-slot {
          background-color: ${theme.palette.background.paper};
          color: ${theme.palette.text.primary};
        }
        
        .fc-timegrid-slot-minor {
          border-color: ${theme.palette.divider};
        }
        
        .fc-timegrid-slot-label {
          color: ${theme.palette.text.secondary};
        }
        
        .fc-daygrid-day-number {
          color: ${theme.palette.text.primary};
        }
        
        .fc-daygrid-day-events {
          color: ${theme.palette.text.primary};
        }
        
        .fc-daygrid-day-top {
          color: ${theme.palette.text.primary};
        }
        
        .custom-event {
          border-radius: 6px !important;
          border: none !important;
          font-weight: 500 !important;
          font-size: 0.85rem !important;
          padding: 4px 8px !important;
          box-shadow: ${theme.palette.mode === 'dark' 
            ? '0 2px 4px rgba(0, 0, 0, 0.3)' 
            : '0 2px 4px rgba(0, 0, 0, 0.1)'} !important;
        }
        
        .overlay-event {
          background: linear-gradient(135deg, #6c63ff, #5a52ff) !important;
          color: white !important;
        }
        
        .conflict-event {
          background: ${theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #ff5722, #d32f2f)' 
            : 'linear-gradient(135deg, #ff5722, #f44336)'} !important;
          color: white !important;
          border: 2px solid ${theme.palette.mode === 'dark' ? '#ff8a65' : '#ffcdd2'} !important;
        }
        
        .fc-event:not(.overlay-event):not(.conflict-event) {
          background: ${theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #ff9800, #f57c00)' 
            : 'linear-gradient(135deg, #1976d2, #1565c0)'} !important;
          color: white !important;
        }
        
        /* Cores suaves e harmoniosas para conflitos - Paleta profissional */
        .fc .fc-event.color-index-1,
        .fc-daygrid-event.color-index-1,
        .fc-timegrid-event.color-index-1 {
          background-color: #64b5f6 !important;
          background: linear-gradient(135deg, #64b5f6, #42a5f5) !important;
          border-color: #1976d2 !important;
          color: white !important;
          box-shadow: 0 2px 4px rgba(25, 118, 210, 0.3) !important;
        }
        
        .fc .fc-event.color-index-2,
        .fc-daygrid-event.color-index-2,
        .fc-timegrid-event.color-index-2 {
          background-color: #81c784 !important;
          background: linear-gradient(135deg, #81c784, #66bb6a) !important;
          border-color: #388e3c !important;
          color: white !important;
          box-shadow: 0 2px 4px rgba(56, 142, 60, 0.3) !important;
        }
        
        .fc .fc-event.color-index-3,
        .fc-daygrid-event.color-index-3,
        .fc-timegrid-event.color-index-3 {
          background-color: #ffb74d !important;
          background: linear-gradient(135deg, #ffb74d, #ffa726) !important;
          border-color: #f57c00 !important;
          color: white !important;
          box-shadow: 0 2px 4px rgba(245, 124, 0, 0.3) !important;
        }
        
        .fc .fc-event.color-index-4,
        .fc-daygrid-event.color-index-4,
        .fc-timegrid-event.color-index-4 {
          background-color: #ba68c8 !important;
          background: linear-gradient(135deg, #ba68c8, #ab47bc) !important;
          border-color: #7b1fa2 !important;
          color: white !important;
          box-shadow: 0 2px 4px rgba(123, 31, 162, 0.3) !important;
        }
        
        .fc .fc-event.color-index-5,
        .fc-daygrid-event.color-index-5,
        .fc-timegrid-event.color-index-5 {
          background-color: #4dd0e1 !important;
          background: linear-gradient(135deg, #4dd0e1, #26c6da) !important;
          border-color: #0097a7 !important;
          color: white !important;
          box-shadow: 0 2px 4px rgba(0, 151, 167, 0.3) !important;
        }
        
        .fc .fc-event.color-index-6,
        .fc-daygrid-event.color-index-6,
        .fc-timegrid-event.color-index-6 {
          background-color: #a1887f !important;
          background: linear-gradient(135deg, #a1887f, #8d6e63) !important;
          border-color: #5d4037 !important;
          color: white !important;
          box-shadow: 0 2px 4px rgba(93, 64, 55, 0.3) !important;
        }
        
        .fc .fc-event.color-index-7,
        .fc-daygrid-event.color-index-7,
        .fc-timegrid-event.color-index-7 {
          background-color: #90a4ae !important;
          background: linear-gradient(135deg, #90a4ae, #78909c) !important;
          border-color: #455a64 !important;
          color: white !important;
          box-shadow: 0 2px 4px rgba(69, 90, 100, 0.3) !important;
        }
        
        /* Sobrescrever elementos internos dos eventos com gradientes suaves */
        .fc-event.color-index-1 .fc-event-main,
        .fc-event.color-index-1 .fc-event-title {
          background: linear-gradient(135deg, #64b5f6, #42a5f5) !important;
        }
        
        .fc-event.color-index-2 .fc-event-main,
        .fc-event.color-index-2 .fc-event-title {
          background: linear-gradient(135deg, #81c784, #66bb6a) !important;
        }
        
        .fc-event.color-index-3 .fc-event-main,
        .fc-event.color-index-3 .fc-event-title {
          background: linear-gradient(135deg, #ffb74d, #ffa726) !important;
        }
        
        .fc-event.color-index-4 .fc-event-main,
        .fc-event.color-index-4 .fc-event-title {
          background: linear-gradient(135deg, #ba68c8, #ab47bc) !important;
        }
        
        .fc-event.color-index-5 .fc-event-main,
        .fc-event.color-index-5 .fc-event-title {
          background: linear-gradient(135deg, #4dd0e1, #26c6da) !important;
        }
        
        .fc-event:hover {
          transform: translateY(-1px);
          box-shadow: ${theme.palette.mode === 'dark' 
            ? '0 4px 8px rgba(0, 0, 0, 0.4)' 
            : '0 4px 8px rgba(0, 0, 0, 0.15)'} !important;
          transition: all 0.2s ease;
        }
        
        .fc-daygrid-event {
          margin: 1px 0 !important;
        }
        
        .fc-timegrid-event {
          margin: 1px 2px !important;
        }
        
        .fc-now-indicator-line {
          border-color: #f44336 !important;
          border-width: 2px !important;
        }
        
        .fc-day-today {
          background-color: ${theme.palette.mode === 'dark' 
            ? 'rgba(255, 152, 0, 0.1)' 
            : 'rgba(25, 118, 210, 0.05)'} !important;
        }
        
        .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
          background-color: ${theme.palette.primary.main} !important;
          color: white !important;
          border-radius: 50% !important;
          width: 28px !important;
          height: 28px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-weight: 600 !important;
        }
        
        .fc-scrollgrid {
          border: none !important;
          background-color: ${theme.palette.background.paper};
        }
        
        .fc-scrollgrid-section > * {
          border-color: ${theme.palette.divider} !important;
        }
        
        .fc-timegrid-slot {
          height: 2.5em !important;
        }
        
        .fc-timegrid-slot-minor {
          border-color: ${theme.palette.divider} !important;
        }
        
        .fc-col-header-cell {
          background-color: ${theme.palette.background.paper};
          color: ${theme.palette.text.primary};
        }
        
        .fc-daygrid-day-frame {
          background-color: ${theme.palette.background.paper};
        }
        
        .fc-timegrid-body {
          background-color: ${theme.palette.background.paper};
        }
        
        .fc-timegrid-axis {
          background-color: ${theme.palette.background.paper};
          color: ${theme.palette.text.secondary};
        }
        
        /* Estilos especÃ­ficos para visualizaÃ§Ã£o de mÃªs */
        .fc-daygrid-day-frame {
          background-color: ${theme.palette.background.paper};
          border-color: ${theme.palette.divider};
        }
        
        .fc-daygrid-day-number {
          color: ${theme.palette.text.primary};
          font-weight: 500;
        }
        
        .fc-daygrid-day-events {
          margin-top: 2px;
        }
        
        .fc-daygrid-event {
          margin: 1px 0;
          border-radius: 4px;
          font-size: 0.7rem;
          padding: 1px 3px;
        }
        
        .fc-daygrid-event-harness {
          margin: 1px 0;
        }
        
        /* Estilos especÃ­ficos para visualizaÃ§Ã£o de dia */
        .fc-timegrid-slot {
          height: ${view === 'timeGridDay' ? '1.8em' : '2.2em'} !important;
        }
        
        .fc-timegrid-slot-minor {
          border-color: ${theme.palette.divider};
        }
        
        .fc-timegrid-slot-label {
          font-size: ${view === 'timeGridDay' ? '0.75rem' : '0.85rem'};
          color: ${theme.palette.text.secondary};
        }
        
        /* Melhorar aparÃªncia dos eventos em todas as visualizaÃ§Ãµes */
        .fc-event-title {
          font-weight: 500;
          font-size: 0.8rem;
        }
        
        .fc-event-time {
          font-weight: 400;
          font-size: 0.75rem;
        }
        
        /* Estilos para popover de eventos extras no mÃªs */
        .fc-popover {
          background-color: ${theme.palette.background.paper};
          border: 1px solid ${theme.palette.divider};
          box-shadow: ${theme.palette.mode === 'dark' 
            ? '0 4px 12px rgba(0, 0, 0, 0.4)' 
            : '0 4px 12px rgba(0, 0, 0, 0.15)'};
        }
        
        .fc-popover-header {
          background-color: ${theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5'};
          color: ${theme.palette.text.primary};
          border-bottom: 1px solid ${theme.palette.divider};
        }
        
        .fc-popover-body {
          background-color: ${theme.palette.background.paper};
          color: ${theme.palette.text.primary};
        }
        
        .fc-popover-close {
          color: ${theme.palette.text.secondary};
        }
        
        .fc-popover-close:hover {
          color: ${theme.palette.text.primary};
        }
      `}</style>
    </Box>
  );
};

export default SchedulesCalendar;














