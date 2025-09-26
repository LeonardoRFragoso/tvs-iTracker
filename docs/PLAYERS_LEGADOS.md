# Implementação de Suporte a Players Legados

## Visão Geral

O sistema TVs iTracker agora suporta diferentes tipos de dispositivos para exibição de conteúdo:

1. **Modern** (padrão): Players modernos baseados em React/WebView com suporte completo a todos os recursos
2. **Tizen**: Players para TVs Samsung com sistema operacional Tizen
3. **Legacy**: Players para dispositivos legados com navegadores antigos ou limitados

## Correções Implementadas

### 1. Erro de Contexto de Aplicação no Scheduler

**Problema**: O scheduler estava tentando acessar o contexto da aplicação Flask fora do contexto da aplicação.
**Solução**: Modificamos a função `setup_scheduler_jobs()` para garantir que ela seja executada dentro do contexto da aplicação Flask usando `with app.app_context()`.

### 2. Erro de Formato de Data

**Problema**: O campo `status` do modelo Player estava sendo tratado como uma data ao tentar converter para ISO format.
**Solução**: Modificamos o método `to_dict()` do modelo Player para garantir que o campo `status` seja sempre uma string.

### 3. Migração de Colunas de Tipo de Dispositivo

**Implementação**: Adicionamos colunas para suportar diferentes tipos de dispositivos:
- `device_type` na tabela `players` (padrão: 'modern')
- `device_type_compatibility` na tabela `schedules` (padrão: 'modern,tizen,legacy')

## Como Funciona

### Detecção Automática de Tipo de Dispositivo

O sistema detecta automaticamente o tipo de dispositivo com base no User-Agent:
- **Tizen**: Detectado pela presença de "tizen" no User-Agent
- **Legacy**: Detectado pela presença de "msie", "trident" ou versões antigas do Edge
- **Modern**: Todos os outros navegadores (padrão)

### Redirecionamento Inteligente

Quando um player acessa o sistema via código curto (/k/:code), ele é redirecionado para a interface apropriada:
- **Tizen**: Redirecionado para `/tizen-player/index.html?id={player.id}`
- **Legacy**: Temporariamente redirecionado para o player Tizen (até que uma interface específica seja implementada)
- **Modern**: Redirecionado para o player React padrão `/kiosk/player/{player.id}?fullscreen=true`

### Compatibilidade de Agendamentos

Os agendamentos agora podem ser configurados para serem compatíveis apenas com certos tipos de dispositivos:
- Campo `device_type_compatibility` na tabela `schedules` contém uma lista separada por vírgulas dos tipos compatíveis
- Método `is_compatible_with_device_type()` verifica se um agendamento é compatível com o tipo de dispositivo do player

## Como Usar

### Criação de Players

Ao criar um player, você pode especificar o tipo de dispositivo:
- **Modern**: Para navegadores modernos e WebViews (padrão)
- **Tizen**: Para TVs Samsung com sistema operacional Tizen
- **Legacy**: Para dispositivos com navegadores antigos ou limitados

### Criação de Agendamentos

Ao criar um agendamento, você pode especificar com quais tipos de dispositivos ele é compatível:
- **device_type_compatibility**: Lista separada por vírgulas dos tipos compatíveis (padrão: 'modern,tizen,legacy')

### Acesso via Código Curto

Os players podem acessar o sistema via código curto:
- URL: `/k/:code` (ex: http://192.168.0.100:5000/k/123456)
- O sistema detecta automaticamente o tipo de dispositivo e redireciona para a interface apropriada

## Próximos Passos

1. Implementar uma interface específica para players legados
2. Melhorar a detecção de dispositivos Tizen e Legacy
3. Adicionar suporte a mais tipos de dispositivos (Android TV, LG WebOS, etc.)
