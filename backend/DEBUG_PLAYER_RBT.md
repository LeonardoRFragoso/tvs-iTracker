# Debug do Player RBT - Problema de Desconexão

## Problema Relatado
O player RBT está com plataforma Android e está reproduzindo corretamente em janela anônima, mas ao enviar comando sync pela rota `/api/players/<id>/sync`, ele fica marcado como desconectado.

## Scripts de Diagnóstico

### 1. Verificar Estado do Player
```bash
cd /caminho/para/tvs-iTracker/backend
python3 check_player_rbt.py
```

**O que faz:**
- Mostra todas as configurações do player RBT
- Verifica se os campos estão com tipos corretos
- Analisa a lógica que será aplicada no sync
- Detecta problemas comuns

**Saída esperada:**
- Tipo de `last_ping` (deve ser datetime, não string)
- Status atual
- Configuração de plataforma
- Se é Chromecast ou não

### 2. Corrigir Problemas Detectados
```bash
cd /caminho/para/tvs-iTracker/backend
python3 fix_player_rbt.py
```

**O que faz:**
- Corrige tipo incorreto de `last_ping` (se estiver como string)
- Ajusta plataforma se configurada incorretamente
- Garante que `device_type` está definido
- Salva alterações no banco

### 3. Testar Simulação do Sync
```bash
cd /caminho/para/tvs-iTracker/backend
python3 test_sync_rbt.py
```

**O que faz:**
- Simula exatamente o que acontece durante um sync
- Mostra qual caminho do código será executado
- Executa o sync para player não-Chromecast
- Verifica se `is_online` funciona corretamente

## Cenários Possíveis

### Cenário 1: last_ping está como string
**Sintoma:** Player aparece offline mesmo após sync

**Causa:** O campo `last_ping` foi armazenado como string (ex: "online", "modern") ao invés de datetime

**Solução:**
```bash
python3 fix_player_rbt.py  # Limpa o campo
# Aguardar próximo ping do player web
```

### Cenário 2: Player configurado como Chromecast
**Sintoma:** Sync tenta descobrir Chromecast na rede e falha

**Causa:** Campo `platform` = 'chromecast' com `chromecast_id` definido

**Solução:**
- Via interface web: Editar player e alterar plataforma para "Android"
- Via script: `python3 fix_player_rbt.py`

### Cenário 3: Condição de corrida
**Sintoma:** Player alterna entre online/offline rapidamente

**Causa:** 
1. Sync marca como offline (se for Chromecast não encontrado)
2. Player web envia ping e marca como online
3. Frontend lê status entre essas operações

**Solução:**
- Garantir que player não está configurado como Chromecast
- Verificar logs durante sync: `tail -f logs.txt`

## Passos para Executar via PuTTY

1. **Conectar via PuTTY ao servidor Linux**
   ```
   IP: 192.168.0.45
   Usuário: [seu_usuario]
   ```

2. **Navegar para o diretório do projeto**
   ```bash
   cd /opt/tvs-itracker/backend
   # ou onde quer que esteja instalado
   ```

3. **Ativar ambiente virtual (se houver)**
   ```bash
   source venv/bin/activate
   # ou
   source ../venv/bin/activate
   ```

4. **Executar diagnóstico**
   ```bash
   python3 check_player_rbt.py
   ```

5. **Se problemas forem detectados, corrigir**
   ```bash
   python3 fix_player_rbt.py
   ```

6. **Testar sync**
   ```bash
   python3 test_sync_rbt.py
   ```

7. **Monitorar logs em tempo real**
   ```bash
   # Em outro terminal/sessão PuTTY
   tail -f logs.txt | grep -i "RBT\|sync"
   ```

8. **Fazer sync via API e ver logs**
   ```bash
   # Terminal 1: Monitorar logs
   tail -f logs.txt
   
   # Terminal 2 ou via Postman: Fazer sync
   # POST http://192.168.0.45/api/players/<player_id>/sync
   ```

## Verificação da Solução

Depois de executar os scripts, verifique:

1. **Via Script:**
   ```bash
   python3 check_player_rbt.py
   ```
   - `last_ping` deve ser datetime
   - `platform` deve ser 'android' (não 'chromecast')
   - `is_online` deve retornar True (se ping recente)

2. **Via Interface Web:**
   - Abrir http://192.168.0.45/app/players
   - Player RBT deve aparecer como "Online" (bolinha verde)
   - Executar sync não deve mudar status

3. **Via Player em Reprodução:**
   - Abrir player em janela anônima
   - Deixar reproduzindo por 1-2 minutos
   - Executar sync
   - Player deve continuar mostrando como online

## Logs Importantes

Buscar nos logs (`logs.txt`):

```bash
grep -i "sync.*rbt" logs.txt
grep -i "\[sync\]" logs.txt | tail -20
```

Mensagens esperadas para player Android:
```
[SYNC] Player encontrado: RBT, Chromecast ID: None
[SYNC] Player não tem Chromecast associado
[SYNC] Status atualizado no banco: online
```

Mensagens de problema (Chromecast):
```
[SYNC] Chromecast ... não encontrado na rede
[SYNC] Status atualizado no banco: offline
```

## Contato para Suporte

Se os scripts não resolverem, compartilhe:
1. Saída de `python3 check_player_rbt.py`
2. Últimas 50 linhas de logs: `tail -50 logs.txt`
3. Screenshot da configuração do player na interface web

