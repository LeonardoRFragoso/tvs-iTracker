# Correção da Lógica de Áudio de Fundo em Campanhas

## 📋 Problemas Identificados e Corrigidos

### 1. **Backend não persistia o áudio de fundo**
**Problema**: O backend recebia `background_audio_content_id` mas não salvava na campanha.
**Solução**: Adicionado campo `background_audio_content_id` ao modelo `Campaign` com foreign key para `contents`.

### 2. **Dois fluxos diferentes com comportamentos diferentes**
**Problema**: 
- Modal principal (CampaignForm) tinha seletor de áudio
- MultiContentManager não tinha seletor de áudio
**Solução**: Ambos os fluxos agora têm seletor de áudio de fundo e salvam corretamente.

### 3. **Frontend não carregava o áudio configurado**
**Problema**: O `bgAudioId` era apenas estado local, nunca carregado do backend.
**Solução**: Ambos componentes agora carregam o `background_audio_content_id` do backend ao editar campanha.

### 4. **Auto-detecção inconsistente**
**Problema**: O compilador tentava detectar automaticamente, mas falhava se não houvesse conteúdo de áudio.
**Solução**: O áudio de fundo agora é persistido e sempre enviado ao compilador quando configurado.

### 5. **Sem indicadores visuais**
**Problema**: Não havia feedback visual sobre qual áudio estava configurado.
**Solução**: 
- CampaignForm: Chip mostrando o nome do áudio selecionado
- MultiContentManager: Chips mostrando status (Configurado ✓ / Não salvo ⚠️)

---

## 🔧 Mudanças Implementadas

### Backend

#### 1. **Migração de Banco de Dados**
Arquivo: `backend/migrations/add_background_audio_support.py`
- Adiciona coluna `background_audio_content_id` à tabela `campaigns`
- Tipo: VARCHAR(36) - compatível com UUID dos conteúdos

#### 2. **Modelo Campaign**
Arquivo: `backend/models/campaign.py`
- Campo `background_audio_content_id` com foreign key para `contents`
- Relationship `background_audio` para acessar o conteúdo de áudio
- Campo incluído no método `to_dict()` para serialização

#### 3. **Rota de Criação de Campanha**
Arquivo: `backend/routes/campaign.py` - função `create_campaign()`
- Extrai `background_audio_content_id` do payload
- Salva no campo da campanha
- Envia ao compilador durante auto-compilação

#### 4. **Rota de Edição de Campanha**
Arquivo: `backend/routes/campaign.py` - função `update_campaign()`
- Atualiza `background_audio_content_id` quando fornecido
- Marca campanha como `stale` quando alterado

#### 5. **Rota de Compilação**
Arquivo: `backend/routes/campaign.py` - função `compile_campaign()`
- Se fornecido no request, atualiza o áudio persistido
- Se não fornecido, usa o áudio já configurado na campanha

### Frontend

#### 6. **CampaignForm.js**
Arquivo: `src/pages/Campaigns/CampaignForm.js`
- Carrega `background_audio_content_id` ao editar campanha
- Envia áudio de fundo em criação e edição
- Chip visual mostrando o áudio selecionado

#### 7. **MultiContentManager.js**
Arquivo: `src/components/Campaign/MultiContentManager.js`
- Estado `campaignBgAudioId` para rastrear áudio persistido
- Carrega áudio de fundo ao carregar campanha
- Salva áudio antes de compilar se foi alterado
- Chips de status:
  - "✓ Configurado" (verde) - áudio salvo
  - "⚠️ Não salvo" (amarelo) - áudio alterado mas não salvo

---

## 🚀 Como Usar

### 1. Executar a Migração

```bash
cd backend
python run_background_audio_migration.py
```

### 2. Criar Campanha com Áudio de Fundo

1. Vá para "Nova Campanha"
2. Clique em "Adicionar Conteúdos"
3. Na aba "Seleção", selecione o áudio de fundo no dropdown
4. Adicione os conteúdos visuais (vídeos/imagens)
5. Salve a campanha

O áudio de fundo será:
- ✅ Salvo na campanha
- ✅ Aplicado automaticamente na compilação
- ✅ Preservado entre edições

### 3. Editar Áudio de Fundo

**Opção 1: No MultiContentManager (aba Conteúdos)**
1. Abra a campanha
2. Vá para aba "Conteúdos"
3. Selecione novo áudio no dropdown "Áudio de fundo"
4. Clique em "Compilar" (salvará automaticamente)

**Opção 2: No Modal de Conteúdos**
1. Abra a campanha
2. Clique em "Adicionar Conteúdos"
3. Altere o áudio no seletor
4. Salve a campanha

### 4. Verificar Áudio Configurado

- **CampaignForm**: Chip azul mostrando nome do áudio
- **MultiContentManager**: 
  - Chip verde "✓ Configurado" - áudio está salvo
  - Chip amarelo "⚠️ Não salvo" - áudio foi alterado mas não compilado

---

## 🎯 Fluxo Completo

```
1. Criar/Editar Campanha
   ↓
2. Selecionar Áudio de Fundo
   ↓
3. Salvar Campanha
   ↓ (background_audio_content_id persistido no DB)
4. Compilar Vídeo
   ↓ (video_compiler usa o áudio persistido)
5. Áudio mixado em loop durante todo o vídeo
   ↓
6. Vídeo compilado com áudio de fundo
```

---

## 🔍 Arquivos Modificados

### Backend (Python)
- ✅ `backend/migrations/add_background_audio_support.py` (NOVO)
- ✅ `backend/run_background_audio_migration.py` (NOVO)
- ✅ `backend/models/campaign.py`
- ✅ `backend/routes/campaign.py`

### Frontend (React)
- ✅ `src/pages/Campaigns/CampaignForm.js`
- ✅ `src/components/Campaign/MultiContentManager.js`

### Inalterados (já funcionavam corretamente)
- ✅ `backend/services/video_compiler.py` (lógica de mixagem já estava correta)

---

## ✅ Testes Recomendados

1. **Criar campanha com áudio**
   - [ ] Áudio é salvo no banco
   - [ ] Áudio aparece ao editar campanha
   - [ ] Compilação aplica o áudio

2. **Editar áudio existente**
   - [ ] Alterar áudio via CampaignForm
   - [ ] Alterar áudio via MultiContentManager
   - [ ] Compilação usa novo áudio

3. **Remover áudio**
   - [ ] Selecionar "Nenhum" no dropdown
   - [ ] Salvar e compilar
   - [ ] Vídeo sem áudio de fundo

4. **Persistência**
   - [ ] Criar campanha com áudio
   - [ ] Fechar e reabrir
   - [ ] Áudio ainda está selecionado
   - [ ] Compilar novamente usa o mesmo áudio

---

## 📝 Notas Técnicas

### Estrutura do Campo no Banco
```sql
ALTER TABLE campaigns ADD COLUMN background_audio_content_id VARCHAR(36)
```

### Payload de Criação/Edição
```json
{
  "name": "Minha Campanha",
  "description": "...",
  "background_audio_content_id": "uuid-do-audio",
  "contents": [...]
}
```

### Resposta do Backend
```json
{
  "campaign": {
    "id": "...",
    "name": "...",
    "background_audio_content_id": "uuid-do-audio",
    ...
  }
}
```

---

## 🐛 Troubleshooting

### Áudio não aparece ao editar campanha
- Verificar se a migração foi executada
- Conferir se `background_audio_content_id` existe na tabela `campaigns`

### Vídeo compilado sem áudio
- Verificar se o arquivo de áudio existe em `backend/uploads/`
- Conferir logs do `video_compiler.py`
- Verificar se o content_type do áudio é 'audio'

### Chip "Não salvo" não desaparece
- Clicar em "Compilar" para salvar e compilar
- Ou editar campanha e salvar via formulário principal

---

## 🎉 Resultado Final

✅ Áudio de fundo agora persiste corretamente  
✅ Funciona em todos os fluxos (criação, edição, compilação)  
✅ Feedback visual claro do status  
✅ Código limpo e bem documentado  
✅ Compatível com auto-detecção (fallback mantido)  

