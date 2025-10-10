# Implementação de Áudio de Fundo no Player (TVs Tizen)

## 🎯 Objetivo

Permitir que campanhas tenham **áudio de fundo** que toca **continuamente em loop** durante a reprodução sequencial de imagens/vídeos nas TVs.

## 🔧 Como Funciona

### Fluxo Completo

```
1. Usuário seleciona áudio de fundo ao criar campanha
   ↓
2. Backend salva background_audio_content_id na campanha
   ↓
3. Agendamento criado para o player
   ↓
4. Player solicita playlist via /players/{id}/playlist
   ↓
5. Backend envia background_audio_url na resposta
   ↓
6. Player Tizen cria elemento <audio> em loop
   ↓
7. Áudio inicia quando primeiro conteúdo começar
   ↓
8. Áudio CONTINUA TOCANDO durante trocas de imagem/vídeo
   ↓
9. Áudio em loop infinito até fim do agendamento
```

## 📊 Implementação

### Backend

#### 1. Modelo Campaign
```python
# backend/models/campaign.py
background_audio_content_id = db.Column(db.String(36), db.ForeignKey('contents.id'))
background_audio = db.relationship('Content', foreign_keys=[background_audio_content_id])
```

#### 2. Rota Playlist
```python
# backend/routes/player.py - get_player_playlist()
{
  "contents": [...],
  "playback_config": {...},
  "background_audio_content_id": "uuid",
  "background_audio_url": "http://server/api/content/media/audio.mp3"
}
```

### Frontend (Tizen Player - JavaScript Puro)

#### 1. Estado Global
```javascript
STATE = {
  ...
  backgroundAudioUrl: null,
  backgroundAudioElement: null,
  backgroundAudioLoaded: false
}
```

#### 2. Funções de Gerenciamento
```javascript
// Configurar áudio
setupBackgroundAudio() {
  audio = document.createElement('audio');
  audio.src = backgroundAudioUrl;
  audio.loop = true;
  audio.volume = 0.3;
  audio.load();
}

// Iniciar reprodução
startBackgroundAudio() {
  if (backgroundAudioLoaded) {
    backgroundAudioElement.play();
  }
}

// Limpar
cleanupBackgroundAudio() {
  backgroundAudioElement.pause();
  backgroundAudioElement.remove();
}
```

#### 3. Integração com Reprodução
```javascript
onVideoCanPlay() {
  STATE.isPlaying = true;
  startBackgroundAudio(); // ← INICIA ÁUDIO
  ...
}

onImageLoad() {
  STATE.isPlaying = true;
  startBackgroundAudio(); // ← INICIA ÁUDIO
  ...
}
```

## ⚡ Características

### ✅ Loop Contínuo
- Áudio **NÃO para** entre trocas de imagem/vídeo
- Toca em **loop infinito** (`audio.loop = true`)
- Continua durante todo o agendamento

### ✅ Compatibilidade Total
- **JavaScript puro** - sem frameworks
- Compatível com **TVs Samsung Tizen antigas**
- Usa apenas APIs nativas do navegador
- **XMLHttpRequest** para requisições (não fetch)
- **createElement** para criar elemento (não JSX)

### ✅ Volume Inteligente
```javascript
audio.volume = 0.3; // 30%
```
- Volume mais baixo que conteúdos de vídeo
- Evita sobrepor narração de vídeos com áudio

### ✅ Gestão de Erros
- Se áudio falhar ao carregar, continua reprodução normalmente
- Logs detalhados para debug
- Não bloqueia reprodução de imagens/vídeos

## 🎬 Exemplo de Uso

### Campanha com 3 Imagens de 20s

```
Timeline de Reprodução:

00:00 ──────────────────── 00:20 ──────────────────── 00:40 ──────────────────── 01:00
  │         Imagem 1         │         Imagem 2         │         Imagem 3         │ Loop
  └─────────────────────────────────────────────────────────────────────────────────┘
  
🎵 Áudio: ♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪
         └─ Loop infinito (3min, 5min, tempo total do agendamento) ─┘
```

### O Áudio NÃO Recomeça

❌ **ERRADO**:
```
Imagem 1 (20s) → [áudio toca] → STOP → Silêncio
Imagem 2 (20s) → [áudio toca] → STOP → Silêncio
Imagem 3 (20s) → [áudio toca] → STOP → Silêncio
```

✅ **CORRETO**:
```
Imagem 1 (20s) → [áudio toca]
Imagem 2 (20s) → [áudio CONTINUA tocando]
Imagem 3 (20s) → [áudio CONTINUA tocando]
Loop volta p/ Imagem 1 → [áudio CONTINUA tocando]
...
```

## 🔍 Logs Esperados

```javascript
[TizenPlayer] Playlist carregada
[TizenPlayer] Áudio de fundo detectado: http://server/api/content/media/audio.mp3
[TizenPlayer] Criando elemento de áudio de fundo
[TizenPlayer] Áudio de fundo carregado e pronto para reproduzir
[TizenPlayer] Imagem carregada
[TizenPlayer] Iniciando áudio de fundo...
[TizenPlayer] 🎵 Áudio de fundo iniciado
[TizenPlayer] Reprodução de imagem iniciada
...
[TizenPlayer] Próximo conteúdo (Imagem 2)
// Áudio CONTINUA tocando aqui, NÃO há log de "iniciado" de novo
[TizenPlayer] Imagem carregada
...
```

## ⚠️ Importante

### O Áudio Toca em Loop Infinito

```javascript
audio.loop = true; // ← CRÍTICO!
```

Isso significa:
- Se o áudio tem **30 segundos**
- E a campanha tem **3 imagens × 20s = 60s**
- O áudio vai tocar **2x completo** durante um ciclo
- E vai **continuar** quando o ciclo recomeçar

### Não Há Sincronização Com Ciclo

O áudio toca **independente** do ciclo de imagens:
- Não recomeça quando volta para primeira imagem
- Toca continuamente em loop próprio
- É um "fundo musical" constante

## 🎵 Se Quiser Sincronizar

Se precisar que o áudio **reinicie** a cada ciclo completo:

```javascript
// Em nextContent(), quando voltar ao índice 0:
if (nextIndex === 0 && STATE.backgroundAudioElement) {
  STATE.backgroundAudioElement.currentTime = 0; // Reiniciar áudio
}
```

**Mas não é recomendado** - fica menos natural!

## 🚀 Deploy

1. **Modificações no backend**:
   - ✅ `backend/models/campaign.py`
   - ✅ `backend/routes/campaign.py`
   - ✅ `backend/routes/player.py`

2. **Modificações no frontend**:
   - ✅ `src/pages/Campaigns/CampaignForm.js`
   - ✅ `src/components/Campaign/MultiContentManager.js`
   - ✅ `src/components/Player/WebPlayer.js`
   - ✅ `tizen-player/player.js` ← **CRÍTICO PARA TVS**

3. **Build e deploy**:
```bash
# Build do frontend
npm run build

# No servidor
git pull
npm run build
sudo systemctl restart tvs-itracker.service
```

## ✅ Checklist de Testes

### Criar Campanha
- [ ] Selecionar áudio de fundo
- [ ] Adicionar 3+ imagens
- [ ] Salvar campanha
- [ ] Chip verde aparece "🎵 audio-fundo"

### Criar Agendamento
- [ ] Vincular campanha ao player
- [ ] Configurar horários
- [ ] Ativar agendamento

### Testar na TV
- [ ] Abrir player na TV
- [ ] Verificar logs no console (F12 na TV)
- [ ] Procurar: "🎵 Áudio de fundo iniciado"
- [ ] **OUVIR O ÁUDIO** tocando
- [ ] Áudio continua durante trocas de imagem
- [ ] Áudio em loop infinito

### Verificar Backend
```bash
# Ver logs do servidor
sudo journalctl -u tvs-itracker.service -n 100 | grep "Background audio"
```

## 🐛 Troubleshooting

### Áudio não toca na TV
1. Verificar console da TV (Remote DevTools)
2. Procurar erros de CORS
3. Verificar se arquivo de áudio existe
4. Verificar permissões do arquivo

### Áudio para entre conteúdos
- ❌ Bug: `startBackgroundAudio()` sendo chamado múltiplas vezes
- ✅ Solução: Verificar se já está tocando antes de dar play

### Volume muito alto/baixo
```javascript
audio.volume = 0.3; // Ajustar entre 0.0 - 1.0
```

---

## 🎉 Resultado Final

✅ Áudio de fundo persiste no banco  
✅ Enviado para o player via API  
✅ Carregado em JS puro (compatível com Tizen legado)  
✅ Toca em loop infinito durante reprodução  
✅ Continua tocando durante trocas de conteúdo  
✅ Não bloqueia reprodução se falhar  

