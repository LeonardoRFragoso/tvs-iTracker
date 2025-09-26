# Template Padrão

|  |
| --- |
| I |

| RIO BRASIL TERMINAL |  |  |  |  |
| --- | --- | --- | --- | --- |
| PLANO DE MANUTENÇÃO E SUPORTE | PLANO DE MANUTENÇÃO E SUPORTE | PLANO DE MANUTENÇÃO E SUPORTE | PLANO DE MANUTENÇÃO E SUPORTE | PLANO DE MANUTENÇÃO E SUPORTE |

| Elaborador: | Leonardo R. Fragoso | Desenvolvedor Senior |
| --- | --- | --- |
| Revisor: | Neuza Maria Balassiano Hauben | Coordenadora de Sistemas |
| Aprovador: | Rodrigo Almeida de Abreu | Gerente de TI |

# OBJETIVO

Este documento estabelece o plano de manutenção e suporte para o sistema iTracker - Sistema de Gestão de Conteúdo Digital para TVs Corporativas, definindo estrutura de suporte, procedimentos, SLAs, responsabilidades e processos para garantir a operação contínua e eficiente da solução.

# ESTRUTURA DE SUPORTE

## 1. Níveis de Suporte

### 1.1 Nível 1 - Help Desk
**Responsabilidades:**
- Primeiro contato com usuários
- Triagem e classificação de chamados
- Resolução de problemas básicos
- Escalação para Nível 2 quando necessário

**Equipe:** 2 Analistas Jr. + 1 Coordenador
**Horário:** Segunda a Sexta 08:00-18:00, Sábado 08:00-12:00
**Canal:** Jira Service Management, Email, Telefone

### 1.2 Nível 2 - Suporte Técnico
**Responsabilidades:**
- Problemas técnicos complexos
- Análise de logs e diagnósticos
- Configurações avançadas
- Integrações com terceiros

**Equipe:** 2 Analistas Sr. + 1 Especialista
**Horário:** Segunda a Sexta 07:00-19:00, Plantão 24x7 críticos
**Especialidades:** Infraestrutura, BD, Chromecast, Performance

### 1.3 Nível 3 - Especialistas
**Responsabilidades:**
- Problemas arquiteturais complexos
- Desenvolvimento de correções
- Análise de causa raiz
- Melhorias e evoluções

**Equipe:** 1 Dev Senior + 1 Arquiteto + DBA compartilhado
**Horário:** Sob demanda, Plantão 24x7 para Sev1

# CLASSIFICAÇÃO DE INCIDENTES

## Severidade 1 (CRÍTICA)
- **Definição**: Sistema completamente indisponível
- **SLA Resposta**: 1 hora
- **SLA Resolução**: 4 horas
- **Exemplos**: App não carrega, BD corrompido, perda de dados

## Severidade 2 (ALTA)
- **Definição**: Funcionalidade crítica indisponível
- **SLA Resposta**: 2 horas
- **SLA Resolução**: 8 horas
- **Exemplos**: Upload falha, players não respondem, agendamentos não executam

## Severidade 3 (MÉDIA)
- **Definição**: Problema específico ou usuário individual
- **SLA Resposta**: 4 horas
- **SLA Resolução**: 24 horas
- **Exemplos**: Erro em relatório, bug em funcionalidade secundária

## Severidade 4 (BAIXA)
- **Definição**: Problema cosmético ou melhoria
- **SLA Resposta**: 8 horas
- **SLA Resolução**: 5 dias úteis
- **Exemplos**: Layout, documentação, solicitações

# MANUTENÇÃO PREVENTIVA

## 1. Atividades Diárias (Automatizadas)
- **02:00**: Backup de dados
- **03:00**: Limpeza de logs
- **A cada 5min**: Verificação de saúde
- **A cada hora**: Sincronização de players
- **Contínua**: Coleta de métricas

## 2. Atividades Semanais
- **Segunda 09:00**: Análise de performance
- **Segunda 10:00**: Verificação de espaço
- **Domingo 22:00**: Atualização de dependências
- **Domingo 23:00**: Teste de backup

## 3. Atividades Mensais
- **1º Domingo 01:00**: Otimização de BD
- **1º Domingo 02:00**: Limpeza de arquivos órfãos
- **1ª Segunda 14:00**: Revisão de logs de segurança
- **1º Domingo 03:00**: Teste de recuperação

## 4. Atividades Trimestrais
- **1ª semana**: Atualização do SO
- **2ª semana**: Revisão de configurações
- **3ª semana**: Auditoria de segurança
- **4ª semana**: Teste de disaster recovery

# GESTÃO DE ACESSOS

## 1. Perfis de Suporte

### Nível 1: Apenas leitura
- Visualização de dados e logs básicos
- Não pode alterar configurações

### Nível 2: Leitura e configuração
- Restart de serviços, configurações básicas
- Não pode alterar código ou banco

### Nível 3: Acesso completo
- Alteração de código, banco, infraestrutura
- Deve seguir processo de mudança

## 2. Processo de Gestão
1. **Solicitação** via Jira
2. **Aprovação** do gestor + Coordenação
3. **Criação** pelo administrador
4. **Revisão** trimestral
5. **Revogação** conforme política

# DADOS PESSOAIS E LGPD

## 1. Dados Tratados
- **Identificação**: Nome, email, empresa
- **Técnicos**: IP, logs de acesso
- **Base Legal**: Legítimo interesse operacional
- **Retenção**: 2 anos para logs, dados ativos mantidos

## 2. Direitos dos Titulares
- **Acesso**: 15 dias úteis via Jira
- **Correção**: Imediato via sistema ou 15 dias
- **Exclusão**: 15 dias úteis (anonimização)
- **Portabilidade**: 15 dias úteis (formato JSON)

## 3. Medidas de Proteção
- **Criptografia**: TLS 1.3, bcrypt para senhas
- **Controle**: Acesso baseado em roles
- **Auditoria**: Log de todos os acessos
- **Treinamento**: Equipe treinada em LGPD

# ARQUIVAMENTO E EXPURGO

## 1. Política de Retenção
- **Dados de usuários**: 2 anos após inativação
- **Logs operacionais**: 90 dias online, 2 anos arquivados
- **Logs de segurança**: 2 anos online, 5 anos arquivados
- **Conteúdo órfão**: 30 dias para recuperação
- **Métricas**: 1 ano histórico

## 2. Processo de Expurgo
- **Automático**: Mensal conforme política
- **LGPD**: 15 dias úteis após solicitação
- **Backup final**: Antes da exclusão
- **Log**: Registro completo de expurgos

# CRESCIMENTO E CAPACIDADE

## Projeção 5 Anos
- **Ano 1**: 50 usuários, 15 players, 30GB
- **Ano 2**: 100 usuários, 30 players, 75GB
- **Ano 3**: 200 usuários, 60 players, 150GB
- **Ano 4**: 350 usuários, 100 players, 270GB
- **Ano 5**: 500 usuários, 150 players, 450GB

## Adequação de Infraestrutura
- **Atual**: 8 cores, 16GB RAM, 1TB storage
- **Ano 3**: 16 cores, 32GB RAM, 2TB storage
- **Ano 5**: 32 cores, 64GB RAM, 5TB storage

# REAVALIAÇÃO ANUAL

## Processo
- **Janeiro**: Coleta de métricas
- **Fevereiro**: Análise de performance
- **Março**: Avaliação de tecnologias
- **Abril**: Planejamento de melhorias
- **Maio**: Aprovação de orçamento

## Critérios
- **Performance**: Tempo resposta, disponibilidade
- **Segurança**: Vulnerabilidades, conformidade
- **Tecnologia**: Obsolescência, roadmap
- **Custo**: TCO, ROI, eficiência

# CONTATOS

## Equipe de Suporte
- **Coordenadora**: Neuza Maria Balassiano Hauben
- **Email**: neuza.hauben@ictsi.com
- **Service Desk**: servicedesk.itracker@ictsi.com
- **Suporte Técnico**: suporte.tecnico.itracker@ictsi.com
- **Desenvolvedor**: Leonardo R. Fragoso
- **Plantão Crítico**: +55 11 99999-0001

## Stakeholders
- **Gerente TI**: Rodrigo Almeida de Abreu
- **Segurança**: security@ictsi.com
- **Infraestrutura**: infra@ictsi.com

# MÉTRICAS E KPIs

## Disponibilidade
- **Meta**: 99.5% uptime mensal
- **Medição**: Monitoramento 24x7

## Performance
- **Meta**: < 2s resposta (95% requests)
- **Medição**: APM contínuo

## SLA de Resolução
- **Sev1**: 95% em 4h
- **Sev2**: 90% em 8h
- **Sev3**: 85% em 24h
- **Sev4**: 80% em 5 dias

## Satisfação
- **Meta**: NPS > 8.0
- **Medição**: Pesquisa pós-resolução

# APROVAÇÃO

**Data de Elaboração**: 26/09/2025
**Versão**: 1.0
**Vigência**: 12 meses
**Próxima Revisão**: 01/10/2026

---

**Assinaturas**:

**Elaborador**: _________________ Data: ___/___/___
Leonardo R. Fragoso - Desenvolvedor Senior

**Revisor**: _________________ Data: ___/___/___
Neuza Maria Balassiano Hauben - Coordenadora de Sistemas

**Aprovador**: _________________ Data: ___/___/___
Rodrigo Almeida de Abreu - Gerente de TI
