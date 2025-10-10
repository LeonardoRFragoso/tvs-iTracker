# 🔄 Áudio de Fundo Sincronizado com Ciclo de Imagens

## 🎯 Comportamento Implementado

O áudio de fundo agora **reinicia** sempre que o ciclo de imagens/vídeos **recomeça do início**.

### Timeline de Exemplo

```
Campanha com 3 imagens de 20s cada (total: 60s)
Áudio de fundo com 45s de duração

Ciclo 1:
[0s────20s] Imagem 1  │ 🎵 Áudio 0s→20s
[20s───40s] Imagem 2  │ 🎵 Áudio 20s→40s
[40s───60s] Imagem 3  │ 🎵 Áudio 40s→45s (termina) → Loop para 0s
                      │ 🎵 Áudio 0s→15s

🔄 Ciclo recomeça (volta para Imagem 1)
                      ↓
                   REINICIA ÁUDIO!
                      
Ciclo 2:
[60s───80s] Imagem 1  │ 🎵 Áudio 0s→20s (REINICIADO)
[80s──100s] Imagem 2  │ 🎵 Áudio 20s→40s
[100s─120s] Imagem 3  │ 🎵 Áudio 40s→45s → Loop para 0s
                      │ 🎵 Áudio 0s→15s

🔄 Ciclo recomeça novamente
                      ↓
                   REINICIA ÁUDIO!
...e assim por diante
```

## ✅ Vantagens da Sincronização

1. ✅ **Previsibilidade** - Áudio sempre começa no mesmo ponto com a primeira imagem
2. ✅ **Consistência** - Cada ciclo tem a mesma experiência
3. ✅ **Narrativa** - Permite criar "capítulos" sincronizados
4. ✅ **Debugging** - Mais fácil identificar problemas de timing

## 🔧 Implementação Técnica

### Tizen Player (JavaScript Puro)

```javascript
// tizen-player/player.js - linha ~826

function nextContent() {
  // ... determina nextIndex ...
  
  // Sincronizar áudio quando voltar ao início do ciclo
  if (nextIndex === 0 && STATE.backgroundAudioElement) {
    log('🔄 Ciclo recomeçou, sincronizando áudio de fundo');
    STATE.backgroundAudioElement.currentTime = 0; // ← REINICIA!
  }
  
  // ... aplica transição e muda conteúdo ...
}
```

### WebPlayer React (Modo Web)

```javascript
// src/components/Player/WebPlayer.js - linha ~780

const determineNextContent = () => {
  // ... determina nextIndex ...
  
  if (nextIndex === 0) {
    // Ciclo recomeçou
    if (backgroundAudioRef.current) {
      console.log('🔄 Ciclo recomeçou, sincronizando áudio');
      backgroundAudioRef.current.currentTime = 0; // ← REINICIA!
    }
  }
  
  // ... continua ...
}
```

## 🎵 Comportamento do Loop do Áudio

### Durante o Ciclo (Áudio NÃO reinicia)

```javascript
audio.loop = true; // ← IMPORTANTE!
```

Se o áudio (45s) terminar **durante** a exibição de imagens:
- ✅ Ele dá **loop automático** e continua tocando
- ✅ **NÃO interrompe** a reprodução das imagens
- ✅ Continua fluido até o fim do ciclo

### No Fim do Ciclo (Áudio REINICIA)

```javascript
// Apenas quando nextIndex volta para 0
audio.currentTime = 0; // ← SINCRONIZA!
```

Quando a **última imagem termina** e volta para a **primeira**:
- ✅ Áudio é **reiniciado** para 0 segundos
- ✅ **Sincronização perfeita** com o ciclo
- ✅ Experiência **consistente** em cada loop

## 📊 Logs Esperados

### Início (Primeira Imagem)

```javascript
[TizenPlayer] Playlist carregada
[TizenPlayer] Áudio de fundo detectado: http://...
[TizenPlayer] Criando elemento de áudio de fundo
[TizenPlayer] Áudio de fundo carregado e pronto
[TizenPlayer] Imagem carregada
[TizenPlayer] Iniciando áudio de fundo...
[TizenPlayer] 🎵 Áudio de fundo iniciado
```

### Troca de Conteúdo (Imagem 2, 3...)

```javascript
[TizenPlayer] Reprodução finalizada
[TizenPlayer] Modo sequencial: próximo índice = 1
[TizenPlayer] Aplicando transição de 1000ms
[TizenPlayer] Imagem carregada
[TizenPlayer] Áudio de fundo já está tocando, mantendo reprodução ← IMPORTANTE!
```

### Fim do Ciclo (Volta para Imagem 1)

```javascript
[TizenPlayer] Reprodução finalizada
[TizenPlayer] Modo sequencial: próximo índice = 1
[TizenPlayer] Fim da playlist: voltando ao início (loop)
[TizenPlayer] 🔄 Ciclo recomeçou, sincronizando áudio de fundo ← SINCRONIZAÇÃO!
[TizenPlayer] Aplicando transição de 1000ms
[TizenPlayer] Imagem carregada
[TizenPlayer] Áudio de fundo já está tocando, mantendo reprodução
```

## 🎬 Exemplo Real

### Campanha de Segurança com 3 Slides

**Conteúdos:**
1. "Qual a função do EPI?" (20s)
2. "Condução de veículos" (20s)
3. "Pictogramas" (20s)

**Áudio:** Música de fundo institucional (45s)

**Resultado:**
```
00:00 ─────────────────────────────────────────────── 01:00 ─────────────────────────────────────────────── 02:00
  │      EPI      │   Veículos   │  Pictogramas  │      EPI      │   Veículos   │  Pictogramas  │
  └──────────────┴──────────────┴───────────────┘└──────────────┴──────────────┴───────────────┘
      Ciclo 1 (60s)                                     Ciclo 2 (60s)
      
🎵 [0s──────45s] Loop [0s──────15s] │ 🔄 REINICIA │ [0s──────45s] Loop [0s──────15s] │ 🔄
      └─ Música completa + parte  ─┘               └─ Música completa + parte  ─┘
```

## ⚙️ Configurações Opcionais

### Ajustar Volume do Áudio de Fundo

```javascript
// tizen-player/player.js - linha ~561
audio.volume = 0.3; // 30% (0.0 a 1.0)
```

Recomendações:
- **0.2-0.3**: Fundo musical sutil (ideal para narração)
- **0.4-0.5**: Música ambiente equilibrada
- **0.6-0.8**: Música proeminente
- **0.9-1.0**: Volume máximo (pode sobrepor vídeos)

### Desabilitar Sincronização (Voltar para Loop Contínuo)

Se quiser que o áudio **não reinicie** nos ciclos:

```javascript
// Comentar ou remover estas linhas em nextContent():

// if (nextIndex === 0 && STATE.backgroundAudioElement) {
//   STATE.backgroundAudioElement.currentTime = 0;
// }
```

## 🚀 Deploy e Testes

### 1. Build e Deploy

```bash
# Local (Windows)
npm run build

# Servidor (Linux)
cd ~/projetos/tvs-iTracker
git pull
npm run build
sudo systemctl restart tvs-itracker.service
```

### 2. Criar Nova Campanha

1. **Selecionar áudio de fundo**
2. **Adicionar 3 imagens de 20s**
3. **Salvar campanha**
4. **Criar agendamento** vinculando ao player

### 3. Testar na TV

Abrir player:
```
http://192.168.0.45/kiosk/player/[ID]?fullscreen=true
```

Procurar nos logs:
```javascript
✅ [TizenPlayer] Áudio de fundo detectado
✅ [TizenPlayer] 🎵 Áudio de fundo iniciado
...
✅ [TizenPlayer] 🔄 Ciclo recomeçou, sincronizando áudio
```

### 4. Verificar Sincronização

1. **Cronometrar**:
   - Ciclo 1: Áudio começa em 0:00
   - Ciclo 2: Áudio reinicia em 1:00 (após 60s)
   - Ciclo 3: Áudio reinicia em 2:00 (após 120s)

2. **Confirmar**:
   - ✅ Áudio sempre começa no mesmo ponto
   - ✅ Primeira imagem sempre sincroniza com início do áudio
   - ✅ Não há cortes abruptos (loop é suave)

## 🎯 Diferenças Entre Modos

| Aspecto | Vídeo Compilado | Reprodução Sequencial |
|---------|-----------------|----------------------|
| **Áudio de fundo** | Mixado no MP4 | Elemento `<audio>` separado |
| **Sincronização** | Sempre sincronizado | Reinicia a cada ciclo |
| **Loop** | Duração exata do vídeo | Loop infinito + sync |
| **Volume** | 192k AAC fixo | 30% ajustável |
| **Uso** | Download/distribuição | Reprodução nas TVs |

## 💡 Casos de Uso

### Música de Fundo Contínua ✅
- Música institucional durante slides informativos
- Trilha sonora ambiente para exposições
- Background musical para aguardar atendimento

### Narração Sincronizada ⚠️
- Se o áudio for **narração** dos slides
- **IMPORTANTE**: O áudio deve ter duração **igual ou menor** que o ciclo completo
- Caso contrário, será cortado e reiniciado

Exemplo:
```
❌ ERRADO:
- 3 imagens × 20s = 60s total
- Narração com 90s
- Resultado: Narração é cortada aos 60s e reinicia

✅ CORRETO:
- 3 imagens × 20s = 60s total
- Narração com 60s (ou menos)
- Resultado: Narração completa, depois reinicia suavemente
```

## 🐛 Troubleshooting

### Áudio não reinicia no ciclo
```javascript
// Verificar logs:
[TizenPlayer] 🔄 Ciclo recomeçou... ← Deve aparecer!
```

Se não aparecer:
- Verificar se `nextIndex === 0` está sendo detectado
- Verificar se `STATE.backgroundAudioElement` existe
- Ver logs de erro no console

### Áudio tem "corte seco"
- É esperado no modelo sincronizado
- Para suavizar: adicione fade in/out no arquivo de áudio
- Ou use música que loop naturalmente (fim conecta com início)

### Áudio toca 2x ao mesmo tempo
- Bug: `startBackgroundAudio()` chamado múltiplas vezes
- Solução já implementada:
```javascript
if (!STATE.backgroundAudioElement.paused) {
  return; // Já está tocando, não iniciar de novo
}
```

## 📝 Resumo da Implementação

### Arquivos Modificados

✅ **Backend:**
- `backend/models/campaign.py` - Campo background_audio_content_id
- `backend/routes/campaign.py` - Persistir áudio na criação/edição
- `backend/routes/player.py` - Enviar background_audio_url na playlist

✅ **Frontend:**
- `src/pages/Campaigns/CampaignForm.js` - UI para selecionar áudio
- `src/components/Campaign/MultiContentManager.js` - UI e gestão
- `src/components/Player/WebPlayer.js` - Suporte a áudio (React)
- `tizen-player/player.js` - Suporte a áudio (JS puro) ← **CRÍTICO**

### Funcionalidades

✅ Áudio em **loop infinito** durante reprodução  
✅ **Sincronização** quando ciclo recomeça  
✅ **JavaScript puro** (compatível com Tizen legado)  
✅ **Não bloqueia** se áudio falhar  
✅ **Autoplay** com fallback em gesto do usuário  
✅ **Volume ajustável** (30% padrão)  
✅ **Logs detalhados** para debug  

---

## 🎉 Resultado Final

```
TV Samsung Tizen exibindo campanha:

┌─────────────────────────────────────┐
│                                     │
│     [Imagem: Qual a função do EPI?] │
│                                     │
│  🎵 ♪♪♪ Música de fundo tocando ♪♪♪ │
│                                     │
└─────────────────────────────────────┘

   ↓ 20s depois ↓

┌─────────────────────────────────────┐
│                                     │
│   [Imagem: Condução de veículos]    │
│                                     │
│  🎵 ♪♪♪ MESMO áudio CONTINUA ♪♪♪    │
│                                     │
└─────────────────────────────────────┘

   ↓ 20s depois ↓

┌─────────────────────────────────────┐
│                                     │
│      [Imagem: Pictogramas]          │
│                                     │
│  🎵 ♪♪♪ MESMO áudio CONTINUA ♪♪♪    │
│                                     │
└─────────────────────────────────────┘

   ↓ 20s depois (fim do ciclo) ↓
   
   🔄 Volta para primeira imagem
   🎵 ÁUDIO REINICIA (currentTime = 0)

┌─────────────────────────────────────┐
│                                     │
│     [Imagem: Qual a função do EPI?] │
│                                     │
│  🎵 ♪♪♪ Música RECOMEÇOU ♪♪♪        │
│                                     │
└─────────────────────────────────────┘
```

---

**Deploy e teste na TV para ver funcionando!** 🚀🎵

