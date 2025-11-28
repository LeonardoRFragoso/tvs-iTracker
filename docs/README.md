# DOCUMENTAÇÃO DO SISTEMA TVS DIGITAL SIGNAGE PLATFORM
## Índice de Documentos - Governança de Sistemas PLTI-012

---

## 📋 VISÃO GERAL

Este diretório contém toda a documentação técnica e gerencial do sistema **TVS Digital Signage Platform**, desenvolvido para substituir o sistema Wiplay e centralizar a gestão de comunicação visual corporativa da organização.

---

## 📚 DOCUMENTOS DISPONÍVEIS

### 1. **DOCUMENTACAO_COMPLETA_SISTEMA.md**
**PLTI-012a - Documento de Escopo As-Is / To-Be**

Documento principal contendo:
- Identificação do sistema
- Comparação As-Is (Wiplay) vs To-Be (TVS Platform)
- Funcionalidades detalhadas
- Stack tecnológico
- Modelo de dados
- Benefícios e justificativas
- Requisitos não-funcionais
- Riscos e mitigações
- Conformidade e governança

**📄 Páginas:** 80+  
**👥 Público:** Gestores, Stakeholders, Equipe Técnica

---

### 2. **ARQUITETURA_DETALHADA.md**
**PLTI-012b - Arquitetura de TI To-Be**

Documentação técnica aprofundada:
- Diagrama de arquitetura em camadas
- Componentes do frontend (React)
- Componentes do backend (Flask)
- Fluxos de dados principais
- Segurança (autenticação, autorização, proteções)
- Performance e otimização
- Monitoramento e logs
- Escalabilidade (horizontal/vertical)

**📄 Páginas:** 50+  
**👥 Público:** Desenvolvedores, Arquitetos, Equipe DevOps

---

### 3. **GUIA_DEPLOY_E_CONFIGURACAO.md**
**PLTI-012c - As-Built (Documentação de Implementação)**

Guia completo de instalação e configuração:
- Pré-requisitos de hardware e software
- Instalação passo-a-passo do backend (Python/Flask)
- Instalação do frontend (React/Node.js)
- Configuração do banco de dados (MySQL)
- Configuração do Nginx (reverse proxy)
- Configuração de SSL/HTTPS
- Deploy como serviço (systemd/NSSM)
- Scripts de backup automático
- Procedimentos de atualização
- Troubleshooting de problemas comuns
- Checklist completo de deploy

**📄 Páginas:** 60+  
**👥 Público:** Administradores de Sistema, DevOps, Suporte N2/N3

---

### 4. **PLANO_MANUTENCAO_SUPORTE.md**
**PLTI-012d - Plano de Manutenção e Suporte da Aplicação**

Plano operacional de manutenção:
- Estrutura da equipe de suporte (N1, N2, N3)
- Níveis de severidade e SLA
- Manutenção preventiva (diária, semanal, mensal, trimestral)
- Manutenção corretiva (procedimentos de troubleshooting)
- Manutenção evolutiva (processo de mudanças, roadmap)
- Estratégia de backup e recuperação
- Monitoramento e alertas
- Comunicação e reporting
- Treinamento e capacitação
- KPIs e métricas
- Continuidade de negócio

**📄 Páginas:** 40+  
**👥 Público:** Equipe de Suporte, Gestores de TI, Operações

---

## 🎯 NAVEGAÇÃO RÁPIDA POR NECESSIDADE

### Preciso entender o sistema
→ **DOCUMENTACAO_COMPLETA_SISTEMA.md** (Seções 1-3)

### Preciso entender a arquitetura técnica
→ **ARQUITETURA_DETALHADA.md**

### Preciso instalar/configurar o sistema
→ **GUIA_DEPLOY_E_CONFIGURACAO.md**

### Preciso resolver um problema
→ **PLANO_MANUTENCAO_SUPORTE.md** (Seção 4 - Manutenção Corretiva)

### Preciso implementar uma melhoria
→ **PLANO_MANUTENCAO_SUPORTE.md** (Seção 5 - Manutenção Evolutiva)

### Preciso informações sobre SLA
→ **PLANO_MANUTENCAO_SUPORTE.md** (Seção 2)

### Preciso fazer backup/restore
→ **GUIA_DEPLOY_E_CONFIGURACAO.md** (Seção 7)  
→ **PLANO_MANUTENCAO_SUPORTE.md** (Seção 6)

---

## 📊 INFORMAÇÕES DO SISTEMA

### Dados Gerais
- **Nome:** TVS Digital Signage Platform
- **Versão:** 1.0.0
- **Status:** Em Produção (Piloto)
- **Proprietário:** Setor de TI - ICTSI
- **Gestor:** Leonardo Fragoso

### Stack Tecnológico
- **Backend:** Python 3.13, Flask 3.0, SQLAlchemy 2.0
- **Frontend:** React 18.2, Material-UI 5.14
- **Banco de Dados:** MySQL 8.0+ (prod), SQLite (dev)
- **WebSocket:** Flask-SocketIO 5.3
- **Infraestrutura:** Nginx, Linux/Windows Server

### Ambientes
- **Desenvolvimento:** http://localhost:3000
- **Produção:** https://tvs.empresa.com

---

## 📞 CONTATOS E SUPORTE

### Equipe de TI
- **Gestor de TI:** Leonardo Fragoso - leonardo.fragoso@empresa.com
- **Suporte N1 (Helpdesk):** helpdesk@empresa.com - (11) 1234-5678
- **Suporte N2/N3 (Dev):** ti-dev@empresa.com

### Horários de Atendimento
- **Suporte N1:** Segunda a Sexta, 8h-18h
- **Suporte N2/N3:** Segunda a Sexta, 8h-18h + On-call 24x7 (P1)

### Canais de Suporte
- **Sistema de Tickets:** https://helpdesk.empresa.com (preferencial)
- **Email:** helpdesk@empresa.com
- **Telefone:** (11) 1234-5678 (urgências)
- **Chat:** Canal #suporte-tvs (Microsoft Teams/Slack)

---

## 🔗 LINKS ÚTEIS

### Aplicação
- **Portal Web:** https://tvs.empresa.com
- **API Documentation:** https://tvs.empresa.com/api/docs (futuro)

### Suporte e Documentação
- **Base de Conhecimento:** https://kb.empresa.com/tvs-platform
- **Sistema de Tickets:** https://helpdesk.empresa.com
- **Manual do Usuário:** https://docs.empresa.com/tvs-platform/user-manual

### Monitoramento e Operações
- **Dashboard de Monitoramento:** https://monitoring.empresa.com/tvs-platform
- **Logs:** https://logs.empresa.com/tvs-platform
- **Status Page:** https://status.empresa.com (futuro)

### Desenvolvimento
- **Repositório Git:** https://github.com/empresa/tvs-itracker (privado)
- **CI/CD Pipeline:** https://ci.empresa.com/tvs-platform (futuro)
- **Issue Tracker:** https://jira.empresa.com/projects/TVS

---

## 📝 HISTÓRICO DE VERSÕES DA DOCUMENTAÇÃO

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 1.0 | Novembro 2024 | Leonardo Fragoso | Versão inicial - Documentação completa |

---

## 📖 GUIA DE LEITURA RECOMENDADO

### Para Novos na Equipe
1. Ler **DOCUMENTACAO_COMPLETA_SISTEMA.md** (Seções 1-3) - Entender o sistema
2. Ler **ARQUITETURA_DETALHADA.md** (Seção 1) - Visão geral da arquitetura
3. Seguir treinamento de onboarding conforme **PLANO_MANUTENCAO_SUPORTE.md** (Seção 11)

### Para Administradores de Sistema
1. Ler **GUIA_DEPLOY_E_CONFIGURACAO.md** completo
2. Praticar instalação em ambiente de desenvolvimento
3. Familiarizar-se com procedimentos de backup (Seção 7)
4. Conhecer troubleshooting comum (Seção 10)

### Para Equipe de Suporte
1. Ler **DOCUMENTACAO_COMPLETA_SISTEMA.md** (Seções 1, 3) - Funcionalidades
2. Estudar **PLANO_MANUTENCAO_SUPORTE.md** (Seções 1-4) - Processos de suporte
3. Conhecer procedimentos de troubleshooting
4. Familiarizar-se com base de conhecimento

### Para Desenvolvedores
1. Ler **ARQUITETURA_DETALHADA.md** completo - Entender arquitetura
2. Explorar código-fonte no repositório Git
3. Configurar ambiente de desenvolvimento local
4. Conhecer processo de mudanças (**PLANO_MANUTENCAO_SUPORTE.md** Seção 5)

### Para Gestores e Stakeholders
1. Ler **DOCUMENTACAO_COMPLETA_SISTEMA.md** (Seções 1-3, 10) - Visão geral e benefícios
2. Revisar KPIs e métricas (**PLANO_MANUTENCAO_SUPORTE.md** Seção 10)
3. Acompanhar relatórios mensais/trimestrais (Seção 8)
4. Conhecer roadmap de melhorias (Seção 5.2)

---

## ✅ CONFORMIDADE

Esta documentação está alinhada com:
- **PLTI-012 - Governança de Sistemas** (Política de TI da organização)
- **ISO 20000** (Gestão de Serviços de TI)
- **ITIL v4** (Melhores práticas de ITSM)
- **LGPD** (Lei Geral de Proteção de Dados)

---

## 🔄 MANUTENÇÃO DESTA DOCUMENTAÇÃO

### Responsável
**Leonardo Fragoso** (Gestor de TI)

### Frequência de Revisão
- **Trimestral:** Revisão de conteúdo e atualização de informações
- **Anual:** Revisão completa e reestruturação se necessário
- **Ad-hoc:** Sempre que houver mudanças significativas no sistema

### Como Sugerir Melhorias
1. Abrir issue no repositório Git com tag "documentation"
2. Ou enviar email para: ti-dev@empresa.com
3. Ou mencionar durante reuniões de revisão trimestral

---

## 📌 NOTAS IMPORTANTES

### ⚠️ Confidencialidade
Todos os documentos contêm informações confidenciais da organização. **NÃO compartilhar externamente.**

### 🔒 Segurança
- Senhas e chaves secretas não estão incluídas nesta documentação
- Credenciais devem ser gerenciadas via vault seguro
- Acessos devem seguir princípio do menor privilégio

### 📱 Versão Mobile
Para visualização em dispositivos móveis, recomenda-se usar um visualizador Markdown compatível.

---

## 🎓 RECURSOS ADICIONAIS

### Treinamentos
- **Treinamento de Usuários:** Agendamento via helpdesk@empresa.com
- **Treinamento Técnico:** Coordenar com ti-dev@empresa.com

### Comunidade (Interna)
- **Canal Teams/Slack:** #tvs-platform
- **Wiki Interno:** https://wiki.empresa.com/tvs-platform

### Materiais Complementares
- Vídeos tutoriais (em produção)
- Webinars gravados (trimestral)
- FAQ atualizado na base de conhecimento

---

**Última Atualização:** Novembro 2024  
**Mantido por:** Leonardo Fragoso (leonardo.fragoso@empresa.com)  
**Status:** ✅ APROVADO
