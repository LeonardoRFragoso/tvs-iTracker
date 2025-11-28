# Guia de Testes - Simplificação Chromecast 4

**Versão:** 1.1.0  
**Data:** 28/11/2024

---

## 🎯 Objetivo

Validar que todas as alterações de simplificação para Chromecast 4 estão funcionando corretamente sem quebrar funcionalidades existentes.

---

## ✅ Checklist de Testes

### 1. **Criação de Novo Player**

#### Passos:
1. Acesse `/players`
2. Clique em "Novo Player"
3. Preencha os campos:
   - Nome do Player
   - Empresa (Location)
   - Ambiente/Sala (opcional)
4. Observe o alerta informativo: "Plataforma: Chromecast 4 (Google TV)"
5. Clique em "Criar"

#### Validações:
- ✅ Formulário não exibe campos de plataforma/tipo de dispositivo
- ✅ Alerta informativo está visível
- ✅ Player é criado com sucesso
- ✅ Valores padrão corretos no banco:
  ```json
  {
    "platform": "chromecast",
    "device_type": "modern",
    "resolution": "1920x1080",
    "orientation": "landscape",
    "volume_level": 100,
    "storage_capacity_gb": 8
  }
  ```

---

### 2. **Edição de Player Existente**

#### Passos:
1. Acesse `/players`
2. Clique em um player existente
3. Clique em "Editar"
4. Altere o nome ou descrição
5. Clique em "Atualizar"

#### Validações:
- ✅ Formulário não exibe campos de plataforma/tipo de dispositivo
- ✅ Alerta informativo está visível
- ✅ Alterações são salvas
- ✅ Valores fixos permanecem inalterados (verificar no banco)

---

### 3. **Visualização de Detalhes**

#### Passos:
1. Acesse `/players`
2. Clique em um player
3. Navegue pelas abas:
   - **Informações Gerais**
   - **Configurações**
   - **Performance** (se existir)

#### Validações:
- ✅ Aba "Configurações" exibe alerta sobre Chromecast 4
- ✅ Informações corretas sobre streaming direto
- ✅ Não exibe campos editáveis de resolução/volume
- ✅ Exibe "Detectada automaticamente" para resolução
- ✅ Exibe "Controlado pelo controle remoto" para volume

---

### 4. **Configurações do Player**

#### Passos:
1. Acesse um player
2. Clique em "Configurações" ou acesse `/players/:id/settings`
3. Observe os campos disponíveis
4. Altere "Duração padrão do conteúdo"
5. Clique em "Salvar Configurações"

#### Validações:
- ✅ Não exibe campos de orientação, resolução, volume
- ✅ Não exibe campo de efeito de transição
- ✅ Não exibe campo de limite de armazenamento
- ✅ Exibe alertas informativos sobre Chromecast 4
- ✅ Campos de rede e sistema funcionam normalmente
- ✅ Alterações são salvas corretamente

---

### 5. **API - Criação via POST**

#### Teste com cURL/Postman:
```bash
POST /api/players
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Player Teste API",
  "location_id": "<location_id>",
  "room_name": "Sala de Testes"
}
```

#### Validações:
- ✅ Player criado com sucesso (status 201)
- ✅ Resposta contém valores fixos corretos
- ✅ Banco de dados contém valores padrão de Chromecast 4

---

### 6. **API - Atualização via PUT**

#### Teste com cURL/Postman:
```bash
PUT /api/players/<player_id>
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Player Atualizado",
  "platform": "web",  # Tentar forçar outro valor
  "resolution": "800x600"  # Tentar forçar outro valor
}
```

#### Validações:
- ✅ Player atualizado com sucesso (status 200)
- ✅ Nome foi alterado
- ✅ `platform` permanece como `'chromecast'` (ignorado)
- ✅ `resolution` permanece como `'1920x1080'` (ignorado)
- ✅ Valores fixos não foram alterados

---

### 7. **Sincronização com Chromecast**

#### Passos:
1. Acesse um player
2. Clique em "Sincronizar"
3. Aguarde o processo

#### Validações:
- ✅ Sincronização funciona normalmente
- ✅ Status do player é atualizado
- ✅ IP e MAC são detectados (se disponível)
- ✅ Chromecast é encontrado na rede

---

### 8. **Reprodução de Conteúdo**

#### Passos:
1. Crie/edite uma campanha
2. Associe conteúdo à campanha
3. Atribua a campanha a um player
4. Inicie a reprodução

#### Validações:
- ✅ Conteúdo é reproduzido no Chromecast
- ✅ Transições funcionam normalmente
- ✅ Duração padrão é respeitada
- ✅ Player reporta status corretamente

---

## 🔍 Verificações no Banco de Dados

### Query para Verificar Players:
```sql
SELECT 
  id, 
  name, 
  platform, 
  device_type, 
  resolution, 
  orientation, 
  volume_level, 
  storage_capacity_gb,
  created_at
FROM players
ORDER BY created_at DESC
LIMIT 10;
```

### Valores Esperados:
- `platform`: `'chromecast'`
- `device_type`: `'modern'`
- `resolution`: `'1920x1080'`
- `orientation`: `'landscape'`
- `volume_level`: `100`
- `storage_capacity_gb`: `8`

---

## 🐛 Testes de Regressão

### Funcionalidades que NÃO devem ser afetadas:

1. ✅ Dashboard principal
2. ✅ Gestão de conteúdo
3. ✅ Gestão de campanhas
4. ✅ Agendamentos
5. ✅ Gestão de localizações
6. ✅ Usuários e permissões
7. ✅ WebSocket e tempo real
8. ✅ Logs e auditoria

---

## 📊 Critérios de Aceitação

### ✅ Aprovado se:
- Todos os testes passarem
- Nenhuma funcionalidade existente quebrou
- Interface está mais limpa e intuitiva
- Valores padrão estão corretos
- API mantém retrocompatibilidade

### ❌ Reprovar se:
- Qualquer teste falhar
- Funcionalidade existente quebrar
- Valores incorretos no banco
- Erros no console do navegador
- Erros no log do backend

---

## 🔧 Troubleshooting

### Problema: "Player não é criado"
**Solução:** Verificar logs do backend, validar token JWT, verificar permissões do usuário

### Problema: "Valores não são fixados"
**Solução:** Verificar código em `routes/player.py`, reiniciar servidor backend

### Problema: "Interface não atualizada"
**Solução:** Limpar cache do navegador, rebuild do frontend (`npm run build`)

### Problema: "Erro ao editar player existente"
**Solução:** Verificar se player tem todos os campos necessários no banco

---

## 📝 Relatório de Testes

### Template:
```
Data: ___/___/______
Testador: _________________
Ambiente: [ ] Dev [ ] Homologação [ ] Produção

TESTES REALIZADOS:
[ ] 1. Criação de Novo Player
[ ] 2. Edição de Player Existente
[ ] 3. Visualização de Detalhes
[ ] 4. Configurações do Player
[ ] 5. API - Criação via POST
[ ] 6. API - Atualização via PUT
[ ] 7. Sincronização com Chromecast
[ ] 8. Reprodução de Conteúdo

RESULTADO GERAL:
[ ] ✅ Aprovado
[ ] ❌ Reprovado

OBSERVAÇÕES:
_________________________________________________
_________________________________________________
_________________________________________________

BUGS ENCONTRADOS:
_________________________________________________
_________________________________________________
_________________________________________________
```

---

## 🚀 Próximos Passos Após Aprovação

1. ✅ Deploy em produção
2. ✅ Monitorar logs por 24h
3. ✅ Coletar feedback dos usuários
4. ✅ Documentar lições aprendidas
5. ✅ Planejar Fase 2 (se necessário)

---

**Documento preparado por:** Leonardo Fragoso  
**Última atualização:** 28/11/2024
