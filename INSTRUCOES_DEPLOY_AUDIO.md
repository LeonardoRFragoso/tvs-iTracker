# 🎵 Instruções de Deploy - Áudio de Fundo

## 🚀 Deploy no Servidor Linux

Execute os comandos abaixo **no servidor** (itk-dev-02):

```bash
cd ~/projetos/tvs-iTracker
git pull
npm run build
sudo systemctl restart tvs-itracker.service
```

---

## ✅ Verificar Deploy

```bash
# Ver status do serviço
sudo systemctl status tvs-itracker.service --no-pager

# Ver últimas linhas do log
sudo journalctl -u tvs-itracker.service -n 30 --no-pager
```

Procure por:
```
✓ Serviço ativo e rodando
✓ Sem erros de importação
✓ Porta 5000 em uso
```

---

## 🧪 Testar Áudio de Fundo

### 1. Abrir Player no Navegador

```
http://192.168.0.45/kiosk/player/13f3692a-7270-484a-90f3-feb2aaa006f3?fullscreen=true
```

### 2. Abrir Console (F12)

Procure por estes logs:

```javascript
✅ [WebPlayer] Background audio URL recebida
✅ [WebPlayer] Criando elemento de áudio de fundo
✅ [WebPlayer] Áudio de fundo carregado e pronto
✅ [WebPlayer] Iniciando áudio de fundo (playlist ativa)
```

### 3. Clicar na Tela (Primeiro Gesto)

👆 **CLIQUE em qualquer lugar da tela**

Procure por:
```javascript
✅ [WebPlayer] 👆 Gesto detectado, ativando áudio de fundo
✅ [WebPlayer] ✅ Áudio de fundo ativado com sucesso!
```

### 4. Ouvir o Áudio! 🔊

- 🎵 Música deve começar a tocar
- 🎵 Continua durante trocas de imagem
- 🔄 Reinicia a cada 30 segundos (fim do ciclo)

---

## 📊 Logs Esperados (Passo a Passo)

### Carregamento Inicial

```javascript
[WebPlayer] Playlist carregada
[WebPlayer] Background audio URL recebida: http://...
[WebPlayer] Criando elemento de áudio de fundo
[WebPlayer] Áudio de fundo carregado e pronto
[WebPlayer] Iniciando áudio de fundo (playlist ativa)
[WebPlayer] Falha ao iniciar (pode precisar de gesto) ← ESPERADO (autoplay policy)
```

### Após Clicar na Tela

```javascript
[WebPlayer] 👆 Gesto detectado, ativando áudio de fundo
[WebPlayer] ✅ Áudio de fundo ativado com sucesso!
[WebPlayer] Áudio de fundo iniciado
```

### Durante Reprodução

```javascript
[WebPlayer] Mídia pronta para reproduzir
[WebPlayer] Áudio de fundo já está tocando, mantendo reprodução ← IMPORTANTE!
[WebPlayer] Reprodução finalizada
[WebPlayer] Modo sequencial: próximo índice = 1
[WebPlayer] Áudio de fundo já está tocando, mantendo reprodução ← DE NOVO!
```

### Fim do Ciclo

```javascript
[WebPlayer] Fim da playlist: voltando ao início (loop)
[WebPlayer] 🔄 Ciclo recomeçou, sincronizando áudio de fundo ← SINCRONIZAÇÃO!
[WebPlayer] Áudio de fundo já está tocando, mantendo reprodução
```

---

## ❌ O Que NÃO Deve Aparecer

```javascript
❌ Pausando áudio de fundo (isPlaying=false)
❌ Áudio de fundo pausado
❌ 401 (UNAUTHORIZED)
```

Se aparecer, significa que precisa de outro deploy.

---

## 🎯 Teste Rápido (30 segundos)

1. **Abrir player**
2. **Clicar na tela**
3. **Ouvir música** 🎵
4. **Aguardar 30s** (3 imagens × 10s)
5. **Ver log**: "🔄 Ciclo recomeçou"
6. **Música reinicia** do início

**Se tudo isso funcionar**: ✅ **SUCESSO TOTAL!**

---

## 🐛 Troubleshooting

### Áudio não toca após clicar

**Causa**: Autoplay bloqueado pelo navegador

**Solução**: 
1. Abrir configurações do site (cadeado na barra de endereço)
2. Permitir "Som" para o site
3. Recarregar (F5)

### Áudio para entre imagens

**Causa**: Bug na lógica de pausa (não deveria acontecer mais)

**Solução**:
1. Verificar logs para "Pausando áudio de fundo"
2. Se aparecer, o deploy não foi feito corretamente

### Áudio não reinicia no ciclo

**Causa**: Log "🔄 Ciclo recomeçou" não aparece

**Solução**:
1. Verificar se há 3+ imagens na campanha
2. Verificar modo de reprodução = "sequential"
3. Verificar loop_behavior = "until_next"

---

## 📞 Comandos Úteis

### Ver logs em tempo real
```bash
sudo journalctl -u tvs-itracker.service -f
```

### Recompilar campanha
```bash
# No navegador, aba Conteúdos:
# Clicar em "Compilar" ou "Recompilar"
```

### Verificar áudio no banco
```bash
cd backend
source ../venv/bin/activate
python -c "
from app import app
from models.campaign import Campaign

with app.app_context():
    c = Campaign.query.filter(Campaign.name.like('%multi-conteudo%')).first()
    print(f'Áudio ID: {c.background_audio_content_id if c else None}')
"
```

---

## ✅ Checklist Final

- [ ] Deploy executado no servidor
- [ ] Serviço reiniciado
- [ ] Build do frontend atualizado
- [ ] Player aberto no navegador
- [ ] Console (F12) aberto
- [ ] Clicado na tela (gesto)
- [ ] Log "✅ Áudio de fundo ativado"
- [ ] **SOM AUDÍVEL** 🔊
- [ ] Áudio continua nas transições
- [ ] Áudio reinicia no ciclo

---

**Execute o deploy e teste! TUDO está implementado e pronto!** 🚀🎵

