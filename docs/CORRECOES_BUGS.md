# Correções de Bugs no TVs iTracker

## 1. Erro de Contexto de Aplicação no Scheduler

**Problema**: O scheduler estava tentando acessar o contexto da aplicação Flask fora do contexto da aplicação.

**Erro**:
```
[Scheduler] Erro ao configurar jobs: Working outside of application context.

This typically means that you attempted to use functionality that needed
the current application. To solve this, set up an application context
with app.app_context(). See the documentation for more information.
```

**Solução**: Modificamos a função `setup_scheduler_jobs()` para garantir que ela seja executada dentro do contexto da aplicação Flask usando `with app.app_context()`.

**Arquivo Modificado**: `app.py`

## 2. Erro de Formato de Data

**Problema**: O campo `status` do modelo Player estava sendo tratado como uma data ao tentar converter para ISO format.

**Erro**:
```
ValueError: Invalid isoformat string: 'offline'
```

**Solução**: Implementamos várias correções:

1. **Redesenho do campo `status` no modelo Player**:
   - Renomeamos a coluna para `_status` e criamos property getters/setters
   - Garantimos que o campo seja sempre tratado como string
   - Implementamos conversão explícita para string em todas as operações

2. **Tratamento robusto de tipos no método `to_dict()`**:
   - Garantimos que todos os campos sejam convertidos para o tipo correto
   - Tratamento especial para campos de data com try/except
   - Conversão explícita de status para string

3. **Melhoria no método `fmt_br_datetime()`**:
   - Detecção de strings que não são datas (como 'offline', 'online', etc.)
   - Suporte a múltiplos formatos de data
   - Tratamento de erros mais robusto

4. **Implementação de SQL puro na rota `list_players`**:
   - Substituição completa do ORM por SQL puro para evitar problemas de conversão de tipo
   - Construção manual das queries SQL com parâmetros seguros
   - Conversão manual dos resultados em objetos Player
   - Manutenção da mesma estrutura de resposta para compatibilidade com o frontend

**Arquivos Modificados**:
- `models/player.py`
- `routes/player.py`

## 3. Migração de Colunas de Tipo de Dispositivo

**Implementação**: Adicionamos colunas para suportar diferentes tipos de dispositivos:
- `device_type` na tabela `players` (padrão: 'modern')
- `device_type_compatibility` na tabela `schedules` (padrão: 'modern,tizen,legacy')

**Melhorias na Migração**:
- Adicionamos verificação de existência das colunas antes de tentá-las adicionar
- Implementamos função `column_exists()` para verificar se uma coluna já existe na tabela
- Evitamos erros de "duplicate column" ao executar a migração múltiplas vezes
- Adicionamos log detalhado do processo de migração

**Arquivo de Migração**: `migrations/add_device_type_columns.py`

**Integração**: Modificamos o método `create_tables()` para executar a migração durante a inicialização da aplicação.

## Recomendações para Evitar Problemas Futuros

1. **Contexto de Aplicação Flask**:
   - Sempre use `with app.app_context():` ao acessar modelos ou configurações do Flask fora de rotas
   - Evite acessar o banco de dados fora do contexto da aplicação

2. **Tratamento de Tipos**:
   - Defina explicitamente os tipos de coluna no SQLAlchemy
   - Sempre converta valores para o tipo correto antes de retorná-los em APIs
   - Use validação de tipo em campos críticos

3. **Tratamento de Datas**:
   - Padronize o formato de data em toda a aplicação
   - Use try/except ao converter strings para datas
   - Evite usar o mesmo campo para armazenar datas e strings não-data

4. **Migrações de Banco de Dados**:
   - Teste migrações em ambiente de desenvolvimento antes de aplicar em produção
   - Faça backup do banco de dados antes de aplicar migrações
   - Use transações para garantir atomicidade das migrações
