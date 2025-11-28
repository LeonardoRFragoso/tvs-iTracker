# PLANO DE MANUTENÇÃO E SUPORTE - TVS DIGITAL SIGNAGE PLATFORM
## PLTI-012d - Plano de Manutenção e Suporte da Aplicação

---

## 1. ESTRUTURA DA EQUIPE DE SUPORTE

### 1.1 Papéis e Responsabilidades

#### Gestor de TI
- **Nome:** Leonardo Fragoso
- **Responsabilidades:** Supervisão geral, aprovação de mudanças, gestão de escalações
- **Disponibilidade:** Segunda a Sexta, 8h-18h + On-call para emergências

#### Suporte N1 (Helpdesk)
- **Equipe:** 2 analistas
- **Contato:** helpdesk@empresa.com
- **Responsabilidades:** Atendimento primeiro nível, resolução de problemas básicos
- **Disponibilidade:** Segunda a Sexta, 8h-18h

#### Suporte N2/N3 (Desenvolvimento)
- **Equipe:** 1 desenvolvedor
- **Responsabilidades:** Resolução técnica complexa, correção de bugs, manutenção evolutiva
- **Disponibilidade:** Segunda a Sexta, 8h-18h + On-call 24x7 para críticos

---

## 2. NÍVEIS DE SEVERIDADE E SLA

| Severidade | Descrição | Tempo Resposta | Tempo Resolução | Disponibilidade |
|------------|-----------|----------------|-----------------|-----------------|
| **Crítica (P1)** | Sistema inoperante | 1 hora | 4 horas | 24x7 |
| **Alta (P2)** | Funcionalidade importante indisponível | 2 horas | 8 horas | Horário comercial + extensão |
| **Média (P3)** | Problema não-crítico com workaround | 4 horas | 24 horas | Horário comercial |
| **Baixa (P4)** | Dúvida ou melhoria | 8 horas | 48 horas | Horário comercial |

---

## 3. MANUTENÇÃO PREVENTIVA

### 3.1 Atividades Diárias (Automatizadas)
- **02:00 AM** - Backup completo (banco + uploads + configurações)
- **03:00 AM** - Limpeza de logs antigos (>30 dias)
- **08:00 AM** - Verificação de players offline (Suporte N1)
- **Cada hora** - Health check do sistema

### 3.2 Atividades Semanais
- **Segunda 10h** - Revisão de logs de erro (Suporte N2)
- **Quinta 14h** - Análise de performance (Suporte N2)
- **Sexta 16h** - Teste de backup (Suporte N2)

### 3.3 Atividades Mensais
- **1º Sábado 10h** - Atualização de segurança (patches)
- **2ª Segunda 02h** - Otimização de banco de dados
- **Última Sexta 15h** - Revisão de capacidade

### 3.4 Atividades Trimestrais
- Atualização de dependências (major/minor versions)
- Revisão de segurança completa
- Treinamento de usuários (workshop)
- Teste de Disaster Recovery

---

## 4. MANUTENÇÃO CORRETIVA

### 4.1 Procedimentos Comuns

#### Backend Não Responde (P1)
**Diagnóstico:**
```bash
sudo systemctl status tvs-backend
sudo journalctl -u tvs-backend -n 100
mysql -u tvs_user -p tvs_platform -e "SELECT 1;"
```

**Resolução:** Restart do serviço, verificar recursos, limpar disco se necessário

#### Player Offline (P3)
**Diagnóstico:** Verificar último heartbeat, logs WebSocket, conectividade
**Resolução:** Restart remoto, verificar rede, acesso físico se necessário

#### Upload Falha (P2)
**Diagnóstico:** Espaço em disco, permissões, tamanho do arquivo
**Resolução:** Limpar espaço, corrigir permissões, ajustar limites

---

## 5. MANUTENÇÃO EVOLUTIVA

### 5.1 Processo de Mudanças
1. **Solicitação** → Ticket com categoria "Melhoria"
2. **Análise** → Viabilidade técnica e custo-benefício
3. **Priorização** → Comitê mensal
4. **Desenvolvimento** → Sprint de 2 semanas
5. **Testes** → Dev → Staging → Produção
6. **Deploy** → Janela de manutenção
7. **Documentação** → Atualizar manuais e KB

### 5.2 Roadmap 2025

**Q1:** App Mobile, Relatórios Avançados, API Pública  
**Q2:** Multi-Idioma, Integração Redes Sociais, Analytics BI  
**Q3:** Novos Formatos de Mídia, Editor de Layouts  
**Q4:** Machine Learning, Interatividade, Sensores  

---

## 6. BACKUP E RECUPERAÇÃO

### 6.1 Estratégia de Backup
- **Banco de Dados:** Diário (mysqldump compactado)
- **Arquivos de Mídia:** Diário (tar.gz incremental)
- **Configurações:** Diário (.env versionado)
- **Código:** Git (contínuo)

**Retenção:** 30 dias (diário), 12 semanas (semanal), 12 meses (mensal)

**Localização:**
- Primário: Mesmo servidor
- Secundário: NAS interno
- Terciário: Cloud storage (offsite)

### 6.2 Procedimento de Recuperação
- **Banco de Dados:** 30-60 minutos
- **Arquivos de Mídia:** 15-30 minutos
- **Sistema Completo (DR):** 3-4 horas

**RTO:** 4 horas | **RPO:** 24 horas

---

## 7. MONITORAMENTO E ALERTAS

### 7.1 Métricas Monitoradas
- **Infraestrutura:** CPU, RAM, Disco, Rede, Status de Serviços
- **Aplicação:** Uptime, Tempo de Resposta, Taxa de Erro
- **Negócio:** Players Online, Campanhas Ativas, Conteúdo Total

### 7.2 Thresholds de Alerta
- CPU >80% por 10min → Aviso
- RAM >90% → Crítico
- Disco >85% → Aviso, >95% → Crítico
- Serviço Down → Crítico Imediato
- Taxa Erro >2% → Alerta
- Players Online <80% → Investigar

### 7.3 Canais de Alerta
- **Email:** Alertas média/baixa severidade
- **SMS:** Alertas críticos (on-call)
- **Slack/Teams:** Notificações em tempo real

---

## 8. COMUNICAÇÃO E REPORTING

### 8.1 Comunicação com Usuários
- **Manutenções Programadas:** Email + Banner (48h antecedência)
- **Incidentes:** Email + SMS imediato
- **Resolução:** Follow-up com causa raiz e ações preventivas

### 8.2 Relatórios
- **Semanal:** Tickets, resolução, problemas frequentes (Suporte N1)
- **Mensal:** Uptime, uso, performance, capacidade (Gestor TI)
- **Trimestral:** Executivo com ROI, KPIs, roadmap (C-Level)

---

## 9. TREINAMENTO

### 9.1 Usuários Finais
- **Onboarding:** 2h (novos usuários)
- **Avançado:** 3h workshop (admins)
- **Atualização:** 1h trimestral (novidades)

### 9.2 Equipe de Suporte
- **N1:** Treinamento inicial + refresher trimestral
- **N2/N3:** Contínuo (arquitetura, código, DevOps)

---

## 10. KPIs E METAS

| Métrica | Meta |
|---------|------|
| Tempo Resposta P1 | <1h |
| Tempo Resolução P1 | <4h |
| SLA Compliance | >95% |
| Uptime do Sistema | >99% |
| CSAT | >4.0/5.0 |
| Players Online | >95% |
| Taxa de Erros | <1% |

---

## 11. CONTINUIDADE DE NEGÓCIO

### 11.1 Plano de Contingência
- **Sistema Indisponível:** Players continuam com último conteúdo sincronizado
- **Falha de Hardware:** Servidor secundário em standby
- **Plano B:** Sistema Wiplay em standby por 6 meses

### 11.2 Teste Anual
- Simular cenários de falha
- Validar procedimentos de recuperação
- Documentar lições aprendidas

---

## ANEXOS

### A. Contatos de Emergência
- **Gestor TI:** Leonardo Fragoso - leonardo.fragoso@empresa.com
- **Helpdesk:** helpdesk@empresa.com - (11) 1234-5678
- **Dev Team:** ti-dev@empresa.com

### B. Links Úteis
- Portal: https://tvs.empresa.com
- KB: https://kb.empresa.com/tvs-platform
- Tickets: https://helpdesk.empresa.com
- Monitoring: https://monitoring.empresa.com/tvs-platform

---

**Documento preparado por:** Leonardo Fragoso  
**Data:** Novembro 2024  
**Versão:** 1.0  
**Status:** APROVADO
