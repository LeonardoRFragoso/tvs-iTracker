# 🎵 Áudio de Fundo em Campanhas - Guia Rápido

## ⚡ Deploy Rápido (3 comandos)

No **servidor Linux**:

```bash
cd ~/projetos/tvs-iTracker && git pull && npm run build && sudo systemctl restart tvs-itracker.service
```

---

## 🎯 Teste Rápido (30 segundos)

1. Abrir: http://192.168.0.45/kiosk/player/13f3692a-7270-484a-90f3-feb2aaa006f3?fullscreen=true
2. **👆 Clicar na tela** (importante!)
3. 🔊 **Ouvir música** tocando!

---

## ✅ O Que Foi Corrigido

| Problema | Status |
|----------|--------|
| Áudio não salvava no banco | ✅ CORRIGIDO |
| Dois fluxos diferentes | ✅ UNIFICADO |
| Sem indicador visual | ✅ CHIPS ADICIONADOS |
| Áudio não tocava nas TVs | ✅ IMPLEMENTADO |
| Pausava nas transições | ✅ CORRIGIDO |
| Sem sincronização | ✅ REINICIA NO CICLO |

---

## 📝 Como Usar

### Criar Campanha com Áudio

```
1. Nova Campanha
2. Adicionar Conteúdos
3. Selecionar "Áudio de fundo" no dropdown
4. Adicionar imagens
5. Salvar
✅ Chip verde: "🎵 Áudio: [nome]"
```

### Ver Áudio na TV

```
1. Criar agendamento
2. Abrir player na TV
3. Clicar na tela
4. 🔊 Ouvir música!
```

---

## 🎬 Comportamento

```
[0s-10s] Imagem 1  🎵 Música tocando
[10s-20s] Imagem 2  🎵 Continua...
[20s-30s] Imagem 3  🎵 Continua...
[30s] 🔄 Ciclo recomeça
[30s-40s] Imagem 1  🎵 Música REINICIA!
... loop infinito
```

---

## 🐛 Se Não Ouvir Áudio

1. **Clicar na tela** (pode precisar de 2-3 cliques)
2. **Ver console** (F12):
   - Procurar: "✅ Áudio de fundo ativado"
   - Se não aparecer: dar mais cliques

3. **Verificar permissões**:
   - Chrome: Configurações do site → Permitir "Som"

---

## 📞 Arquivos Importantes

- `backend/models/campaign.py` - Campo background_audio_content_id
- `backend/routes/player.py` - Envia background_audio_url
- `src/components/Player/WebPlayer.js` - Player React
- `tizen-player/player.js` - Player TVs (JS puro)

---

**🎉 Tudo pronto! Deploy e teste!**

