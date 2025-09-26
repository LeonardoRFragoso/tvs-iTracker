# Template Padrão

|  |
| --- |
| I |

| RIO BRASIL TERMINAL |  |  |  |  |
| --- | --- | --- | --- | --- |
| PROTOCOLO GESTÃO DE MUDANÇAS | PROTOCOLO GESTÃO DE MUDANÇAS | PROTOCOLO GESTÃO DE MUDANÇAS | PROTOCOLO GESTÃO DE MUDANÇAS | PROTOCOLO GESTÃO DE MUDANÇAS |

| Elaborador: | Leonardo R. Fragoso | Desenvolvedor Senior |
| --- | --- | --- |
| Revisor: | Neuza Maria Balassiano Hauben | Coordenadora de Sistemas |
| Aprovador: | Rodrigo Almeida de Abreu | Gerente de TI |

# OBJETIVO

Este documento estabelece o protocolo de gestão de mudanças para o sistema iTracker - Sistema de Gestão de Conteúdo Digital para TVs Corporativas, definindo processos, responsabilidades, critérios de aprovação e procedimentos para implementação segura de mudanças no ambiente de produção.

# ESCOPO

Este protocolo aplica-se a todas as mudanças no sistema iTracker:
- **Aplicação**: Código frontend e backend
- **Banco de Dados**: Estrutura, dados, configurações
- **Infraestrutura**: Servidor, rede, sistema operacional
- **Configurações**: Parâmetros de sistema e aplicação
- **Integrações**: APIs, serviços externos, dispositivos

# TIPOS DE MUDANÇA

## 1. Mudança Padrão (Standard Change)
**Definição**: Mudanças pré-aprovadas, baixo risco, procedimento estabelecido
**Exemplos**: Reinicialização de serviços, patches de segurança, backup/restore
**Aprovação**: Pré-aprovada pelo CAB
**Implementação**: Imediata

## 2. Mudança Normal (Normal Change)
**Definição**: Mudanças planejadas que requerem avaliação
**Exemplos**: Novas funcionalidades, correções de bugs, atualizações
**Aprovação**: CAB (Change Advisory Board)
**Implementação**: Conforme cronograma

## 3. Mudança Emergencial (Emergency Change)
**Definição**: Mudanças urgentes para resolver incidentes críticos
**Exemplos**: Correção de falha crítica, restauração de serviço
**Aprovação**: ECAB (Emergency CAB)
**Implementação**: Imediato

# COMITÊ DE GESTÃO DE MUDANÇAS (CAB)

## Composição
- **Presidente**: Gerente de TI (Rodrigo Almeida de Abreu)
- **Coordenador**: Neuza Maria Balassiano Hauben
- **Desenvolvedor**: Leonardo R. Fragoso
- **Infraestrutura**: [A definir]
- **Segurança**: [A definir]

## ECAB (Emergency CAB)
- Gerente de TI
- Coordenador de Sistemas  
- Desenvolvedor Senior (24x7)

# PROCESSO DE MUDANÇA

## Fluxo Geral
```
Solicitação → Avaliação → Aprovação → Implementação → Revisão
```

## Etapas

### 1. Solicitação (RFC)
- Abertura no Jira Service Management
- Preenchimento completo do formulário
- Anexo de documentação técnica
- Submissão para avaliação

### 2. Avaliação
- **Triagem**: Classificação do tipo
- **Análise de Impacto**: Sistemas e usuários afetados
- **Análise de Risco**: Probabilidade e impacto de falhas
- **Plano de Implementação**: Passos detalhados
- **Plano de Rollback**: Procedimento de reversão

### 3. Aprovação
- **CAB Review**: Reunião de avaliação
- **Decisão**: Aprovação, rejeição ou ajustes
- **Cronograma**: Agendamento de implementação
- **Condições**: Pré-requisitos definidos

### 4. Implementação
- **Preparação**: Verificação de pré-requisitos
- **Execução**: Implementação conforme plano
- **Monitoramento**: Acompanhamento em tempo real
- **Validação**: Testes de aceitação

### 5. Revisão
- **Validação**: Confirmação de sucesso
- **Métricas**: Coleta de dados
- **Lições Aprendidas**: Melhorias identificadas
- **Fechamento**: Encerramento formal

# ANÁLISE DE RISCO

## Matriz de Risco

| Probabilidade | Impacto Baixo | Impacto Médio | Impacto Alto |
|---------------|---------------|---------------|--------------|
| **Baixa**     | Verde         | Verde         | Amarelo      |
| **Média**     | Verde         | Amarelo       | Vermelho     |
| **Alta**      | Amarelo       | Vermelho      | Vermelho     |

- **Verde**: Risco aceitável
- **Amarelo**: Risco moderado, análise adicional
- **Vermelho**: Risco alto, mitigação obrigatória

# JANELAS DE MUDANÇA

## Mudanças de Baixo Risco
- **Horário**: 22:00 às 06:00 (dias úteis)
- **Duração**: Até 2 horas
- **Comunicação**: 24h antecedência

## Mudanças de Médio Risco
- **Horário**: Sábados 22:00 às Domingos 06:00
- **Duração**: Até 4 horas
- **Comunicação**: 48h antecedência

## Mudanças de Alto Risco
- **Horário**: Domingos 01:00 às 05:00
- **Duração**: Até 4 horas
- **Comunicação**: 1 semana antecedência

## Períodos de Congelamento
- **Black Friday**: Novembro (última semana)
- **Fim de Ano**: 15 dez a 15 jan
- **Eventos Corporativos**: Conforme calendário

# DOCUMENTAÇÃO OBRIGATÓRIA

## RFC (Request for Change)
- **Informações Básicas**: ID, título, solicitante, prioridade
- **Descrição**: Justificativa, descrição técnica, benefícios
- **Impacto**: Sistemas afetados, usuários, downtime
- **Implementação**: Passos detalhados, recursos, cronograma
- **Rollback**: Critérios de falha, passos de reversão
- **Testes**: Pré e pós implementação, critérios de sucesso

## Anexos Técnicos
- Diagramas de arquitetura
- Scripts de implementação
- Arquivos de configuração
- Evidências de testes

# COMUNICAÇÃO

## Stakeholders
- **Internos**: Equipe TI, usuários, gerência
- **Externos**: Fornecedores, parceiros, clientes

## Canais
- **Email**: Notificação formal
- **Portal**: Avisos no sistema
- **Teams/Slack**: Comunicação rápida
- **Telefone**: Emergências

## Templates
- Notificação de mudança planejada
- Notificação de mudança emergencial
- Status de implementação
- Confirmação de conclusão

# MÉTRICAS E KPIs

## Taxa de Sucesso
- **Meta**: 95% de mudanças bem-sucedidas
- **Medição**: Mensal

## Taxa de Rollback
- **Meta**: Menos de 5% revertidas
- **Medição**: Mensal

## Tempo de Implementação
- **Meta**: 90% dentro do prazo
- **Medição**: Por mudança

## Impacto não Planejado
- **Meta**: Menos de 2% com impacto não previsto
- **Medição**: Incidentes causados por mudanças

# FERRAMENTAS

## Sistema Principal
- **Jira Service Management**: RFCs e workflows
- **Git**: Controle de versão
- **Alembic**: Migrações de banco
- **Grafana**: Monitoramento

## Integração
- Dashboards em tempo real
- Alertas automáticos
- Relatórios mensais/trimestrais
- Correlação com incidentes

# RESPONSABILIDADES

## Change Manager
- Coordenar processo de mudanças
- Facilitar reuniões do CAB
- Manter métricas atualizadas
- Comunicar com stakeholders

## Implementadores
- Executar mudanças conforme plano
- Monitorar implementação
- Executar rollback se necessário
- Documentar resultados

## CAB Members
- Avaliar RFCs
- Aprovar ou rejeitar mudanças
- Definir condições de implementação
- Revisar processo periodicamente

# CONFORMIDADE

## Políticas ICTSI
- Aderência às políticas globais de TI
- Conformidade com ITIL
- Alinhamento com COBIT
- Seguir diretrizes de segurança

## Auditoria
- Logs completos de mudanças
- Evidências de aprovação
- Documentação de rollbacks
- Relatórios de conformidade

# MELHORIA CONTÍNUA

## Revisão Mensal
- Análise de métricas
- Identificação de problemas
- Propostas de melhoria
- Atualização de procedimentos

## Revisão Trimestral
- Eficácia do processo
- Satisfação dos stakeholders
- Benchmarking com mercado
- Planejamento de melhorias

## Lições Aprendidas
- Documentação de falhas
- Análise de causa raiz
- Compartilhamento de conhecimento
- Atualização de templates

# APROVAÇÃO E VIGÊNCIA

**Data de Elaboração**: 26/09/2025
**Versão**: 1.0
**Vigência**: 12 meses
**Próxima Revisão**: 26/09/2026

Este protocolo foi elaborado seguindo as diretrizes da Política de Governança de Sistemas PLTI-012 e deve ser aprovado pelo Comitê de Governança de Sistemas.

---

**Assinaturas**:

**Elaborador**: _________________ Data: ___/___/___
Leonardo R. Fragoso - Desenvolvedor Senior

**Revisor**: _________________ Data: ___/___/___
Neuza Maria Balassiano Hauben - Coordenadora de Sistemas

**Aprovador**: _________________ Data: ___/___/___
Rodrigo Almeida de Abreu - Gerente de TI
