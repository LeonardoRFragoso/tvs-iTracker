# Template Padrão

|  |
| --- |
| I |

| RIO BRASIL TERMINAL |  |  |  |  |
| --- | --- | --- | --- | --- |
| ARQUITETURA DE TI | ARQUITETURA DE TI | ARQUITETURA DE TI | ARQUITETURA DE TI | ARQUITETURA DE TI |

| Elaborador: | Leonardo R. Fragoso | Desenvolvedor Senior |
| --- | --- | --- |
| Revisor: | Neuza Maria Balassiano Hauben | Coordenadora de Sistemas |
| Aprovador: | Rodrigo Almeida de Abreu | Gerente de TI |

# OBJETIVO

Este documento descreve a arquitetura técnica do sistema iTracker - Sistema de Gestão de Conteúdo Digital para TVs Corporativas, definindo componentes, tecnologias, integrações, requisitos de infraestrutura e diretrizes de segurança necessárias para implementação e operação da solução.

# VISÃO GERAL DA ARQUITETURA

## Arquitetura de Alto Nível

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │   Mobile App    │    │   Admin Panel   │
│   (React.js)    │    │   (React.js)    │    │   (React.js)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │      Load Balancer        │
                    │        (Nginx)            │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │    Application Server    │
                    │      (Flask + uWSGI)     │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────┴─────────┐   ┌─────────┴─────────┐   ┌─────────┴─────────┐
│   Database        │   │   File Storage    │   │   Cache Layer     │
│   (SQLite/PgSQL)  │   │   (Local/NFS)     │   │   (Redis)         │
└───────────────────┘   └───────────────────┘   └───────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │    Media Streaming        │
                    │   (HTTP/WebSocket)        │
                    └─────────────┬─────────────┘
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    │                             │                             │
┌───┴────┐              ┌─────────┴─────────┐              ┌───┴────┐
│Chromecast│              │   Android TV      │              │Web TV  │
│Players   │              │   Players         │              │Players │
└──────────┘              └───────────────────┘              └────────┘
```

# COMPONENTES DA ARQUITETURA

## 1. Camada de Apresentação (Frontend)

### 1.1 Aplicação Web Administrativa
- **Tecnologia**: React.js 18.x
- **UI Framework**: Material-UI (MUI) 5.x
- **Estado Global**: React Context API
- **Roteamento**: React Router 6.x
- **Comunicação**: Axios + Socket.IO Client
- **Build Tool**: Create React App / Vite

### 1.2 Player Web (Kiosk Mode)
- **Tecnologia**: React.js (modo simplificado)
- **Funcionalidades**: Reprodução de mídia, controle remoto
- **Comunicação**: Socket.IO para comandos em tempo real
- **Suporte**: Fullscreen API, Media API

### 1.3 Recursos Frontend
- **Responsividade**: Design adaptativo para desktop/tablet/mobile
- **PWA**: Service Workers para cache e offline
- **Internacionalização**: Suporte a PT-BR
- **Acessibilidade**: WCAG 2.1 AA

## 2. Camada de Aplicação (Backend)

### 2.1 Servidor de Aplicação
- **Framework**: Python Flask 2.x
- **WSGI Server**: uWSGI / Gunicorn
- **Comunicação Real-time**: Flask-SocketIO
- **API**: RESTful + WebSocket
- **Autenticação**: JWT (JSON Web Tokens)

### 2.2 Módulos Principais
- **Auth Module**: Autenticação e autorização
- **Content Module**: Gestão de conteúdo digital
- **Campaign Module**: Gestão de campanhas
- **Schedule Module**: Agendamento e execução
- **Player Module**: Controle de dispositivos
- **Analytics Module**: Métricas e relatórios
- **Monitor Module**: Monitoramento de sistema

### 2.3 Serviços de Background
- **Schedule Executor**: Execução de agendamentos (APScheduler)
- **Media Processor**: Processamento de mídia (FFmpeg)
- **Device Discovery**: Descoberta de Chromecasts (Zeroconf)
- **Health Monitor**: Monitoramento de saúde do sistema

## 3. Camada de Dados

### 3.1 Banco de Dados Principal
- **Desenvolvimento**: SQLite 3.x
- **Produção**: PostgreSQL 14.x
- **ORM**: SQLAlchemy 2.x
- **Migrations**: Flask-Migrate (Alembic)

### 3.2 Estrutura de Dados
```sql
-- Principais tabelas
users (id, email, password_hash, role, company, created_at)
companies (id, name, domain, settings)
locations (id, name, company_id, address, timezone)
content (id, title, filename, type, size, company_id)
campaigns (id, name, company_id, start_date, end_date)
campaign_contents (campaign_id, content_id, order_index, duration)
players (id, name, type, location_id, access_code, status)
schedules (id, campaign_id, player_id, start_time, end_time, days_of_week)
```

### 3.3 Cache e Sessões
- **Cache**: Redis 7.x (opcional)
- **Sessões**: Flask-Session
- **Armazenamento**: File-based ou Redis

## 4. Camada de Armazenamento

### 4.1 Armazenamento de Mídia
- **Desenvolvimento**: Sistema de arquivos local
- **Produção**: NFS / Shared Storage
- **Estrutura**: `/uploads/{company_id}/{content_id}/`
- **Backup**: Sincronização automática

### 4.2 Tipos de Mídia Suportados
- **Vídeo**: MP4, AVI, MOV, MKV (H.264/H.265)
- **Imagem**: JPG, PNG, GIF, WEBP
- **Áudio**: MP3, WAV, AAC
- **Tamanho Máximo**: 2GB por arquivo

## 5. Camada de Rede e Comunicação

### 5.1 Protocolos de Comunicação
- **HTTP/HTTPS**: API REST e serving de arquivos
- **WebSocket**: Comunicação em tempo real
- **DLNA/UPnP**: Descoberta de dispositivos Chromecast
- **mDNS**: Resolução de nomes na rede local

### 5.2 Streaming de Mídia
- **HTTP Range Requests**: Streaming progressivo
- **Adaptive Bitrate**: Ajuste automático de qualidade
- **CDN Ready**: Preparado para CDN externa

## 6. Dispositivos de Reprodução

### 6.1 Google Chromecast
- **SDK**: Google Cast SDK
- **Protocolos**: Cast Protocol, DIAL
- **Formatos**: MP4, WebM, JPEG, PNG
- **Controle**: Cast API via Python

### 6.2 Android TV
- **Aplicação**: Web App em navegador
- **Controle**: Kiosk mode via WebSocket
- **Hardware**: Android 7.0+ com Chrome

### 6.3 Web Players
- **Navegadores**: Chrome, Firefox, Safari, Edge
- **APIs**: Media API, Fullscreen API
- **Controle**: Socket.IO para comandos remotos

# REQUISITOS DE INFRAESTRUTURA

## 1. Servidor de Aplicação

### 1.1 Especificações Mínimas
- **CPU**: 4 cores (Intel i5 ou AMD equivalente)
- **RAM**: 8GB DDR4
- **Storage**: 500GB SSD
- **Rede**: 1Gbps Ethernet

### 1.2 Especificações Recomendadas
- **CPU**: 8 cores (Intel i7 ou AMD equivalente)
- **RAM**: 16GB DDR4
- **Storage**: 1TB NVMe SSD
- **Rede**: 1Gbps Ethernet + Wi-Fi 6

### 1.3 Sistema Operacional
- **Recomendado**: Ubuntu Server 22.04 LTS
- **Alternativas**: CentOS 8, RHEL 8, Debian 11
- **Containerização**: Docker + Docker Compose

## 2. Rede e Conectividade

### 2.1 Requisitos de Rede
- **Largura de Banda**: 100Mbps mínimo
- **Latência**: < 50ms para dispositivos locais
- **Portas**: 80, 443, 5000, 8008 (Chromecast)
- **Protocolos**: TCP, UDP, Multicast

### 2.2 Configuração de Firewall
```bash
# Portas necessárias
80/tcp    # HTTP
443/tcp   # HTTPS
5000/tcp  # Flask Development
8008/tcp  # Chromecast
8009/tcp  # Chromecast TLS
1900/udp  # UPnP/SSDP
5353/udp  # mDNS
```

## 3. Backup e Recuperação

### 3.1 Estratégia de Backup
- **Banco de Dados**: Backup diário automático
- **Arquivos de Mídia**: Sincronização contínua
- **Configurações**: Versionamento no Git
- **Retenção**: 30 dias locais, 1 ano offsite

### 3.2 Plano de Recuperação
- **RTO**: 4 horas (Recovery Time Objective)
- **RPO**: 24 horas (Recovery Point Objective)
- **Testes**: Mensais de recuperação
- **Documentação**: Procedimentos detalhados

# SEGURANÇA E CONFORMIDADE

## 1. Autenticação e Autorização

### 1.1 Política de Senhas (ICTSI Password Policy)
- **Complexidade**: Mínimo 8 caracteres, maiúsculas, minúsculas, números
- **Expiração**: 90 dias
- **Histórico**: Últimas 12 senhas
- **Bloqueio**: 3 tentativas inválidas

### 1.2 Controle de Acesso (Access Control Policy)
- **Princípio**: Menor privilégio
- **Roles**: Admin, HR, User
- **Segregação**: Por empresa/localização
- **Auditoria**: Logs completos de acesso

### 1.3 Multi-Factor Authentication (MFA)
- **Implementação**: TOTP (Time-based OTP)
- **Aplicativos**: Google Authenticator, Authy
- **Backup Codes**: Códigos de recuperação
- **Obrigatório**: Para administradores

## 2. Proteção de Dados (LGPD)

### 2.1 Dados Pessoais Tratados
- **Identificação**: Nome, email, empresa
- **Acesso**: Logs de IP, timestamp, ações
- **Base Legal**: Legítimo interesse operacional
- **Retenção**: Conforme política interna

### 2.2 Medidas de Proteção
- **Criptografia**: TLS 1.3 em trânsito
- **Hash**: Senhas com bcrypt
- **Anonimização**: Logs após período de retenção
- **Acesso**: Controle baseado em roles

## 3. Monitoramento e Auditoria

### 3.1 Logs de Segurança
- **Autenticação**: Sucessos e falhas
- **Autorização**: Tentativas de acesso negado
- **Modificações**: Alterações em dados críticos
- **Sistema**: Erros e exceções

### 3.2 Monitoramento Contínuo
- **SIEM**: Integração com sistema corporativo
- **Alertas**: Atividades suspeitas
- **Dashboards**: Métricas de segurança
- **Relatórios**: Mensais para governança

# INTEGRAÇÕES

## 1. Sistemas Corporativos

### 1.1 Active Directory (Futuro)
- **Protocolo**: LDAP/LDAPS
- **Sincronização**: Usuários e grupos
- **SSO**: Single Sign-On corporativo
- **Implementação**: Fase 2 do projeto

### 1.2 Sistema de Monitoramento
- **Métricas**: Prometheus/Grafana
- **Logs**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Alertas**: PagerDuty/Slack
- **APM**: Application Performance Monitoring

## 2. Serviços Externos

### 2.1 Google Cast
- **SDK**: Cast Application Framework
- **Registro**: Google Cast Console
- **Certificação**: Cast Connect compliance
- **Monitoramento**: Cast Analytics

### 2.2 CDN (Futuro)
- **Provider**: CloudFlare/AWS CloudFront
- **Cache**: Arquivos estáticos e mídia
- **Otimização**: Compressão e minificação
- **Geolocalização**: Distribuição global

# PERFORMANCE E ESCALABILIDADE

## 1. Otimizações de Performance

### 1.1 Backend
- **Cache**: Redis para sessões e dados frequentes
- **Database**: Índices otimizados, connection pooling
- **Async**: Processamento assíncrono para uploads
- **Compression**: Gzip para responses HTTP

### 1.2 Frontend
- **Bundle Splitting**: Code splitting por rotas
- **Lazy Loading**: Componentes sob demanda
- **CDN**: Assets estáticos
- **Service Workers**: Cache offline

### 1.3 Streaming
- **HTTP Range**: Suporte a range requests
- **Transcoding**: FFmpeg para otimização
- **Adaptive**: Bitrate baseado na conexão
- **Prefetch**: Pré-carregamento inteligente

## 2. Escalabilidade Horizontal

### 2.1 Load Balancing
- **Nginx**: Reverse proxy e load balancer
- **Algoritmo**: Round-robin com health checks
- **Session Affinity**: Sticky sessions se necessário
- **SSL Termination**: Certificados centralizados

### 2.2 Microserviços (Futuro)
- **Decomposição**: Por domínio de negócio
- **Comunicação**: REST + Message Queue
- **Orquestração**: Kubernetes
- **Service Mesh**: Istio para observabilidade

# MONITORAMENTO E OBSERVABILIDADE

## 1. Métricas de Sistema

### 1.1 Infraestrutura
- **CPU**: Utilização por core
- **Memória**: Uso e disponibilidade
- **Disco**: Espaço e I/O
- **Rede**: Throughput e latência

### 1.2 Aplicação
- **Response Time**: Tempo de resposta das APIs
- **Throughput**: Requests por segundo
- **Error Rate**: Taxa de erro por endpoint
- **Uptime**: Disponibilidade do serviço

### 1.3 Negócio
- **Players Online**: Dispositivos conectados
- **Content Delivery**: Taxa de sucesso de streaming
- **User Activity**: Usuários ativos
- **Campaign Performance**: Efetividade das campanhas

## 2. Alertas e Notificações

### 2.1 Critérios de Alerta
- **Crítico**: Serviço indisponível (< 1min)
- **Alto**: Performance degradada (< 5min)
- **Médio**: Recursos limitados (< 15min)
- **Baixo**: Tendências preocupantes (< 1h)

### 2.2 Canais de Notificação
- **Email**: Equipe de TI
- **Slack**: Canal dedicado
- **SMS**: Emergências críticas
- **Dashboard**: Visualização em tempo real

# PLANO DE IMPLANTAÇÃO

## 1. Ambientes

### 1.1 Desenvolvimento
- **Localização**: Máquina do desenvolvedor
- **Dados**: Dados de teste sintéticos
- **Integração**: Mocks para serviços externos
- **Acesso**: Apenas equipe de desenvolvimento

### 1.2 Homologação/QA
- **Localização**: Servidor dedicado
- **Dados**: Cópia sanitizada da produção
- **Integração**: Serviços reais em ambiente de teste
- **Acesso**: Equipe de TI e usuários de teste

### 1.3 Produção
- **Localização**: Datacenter corporativo
- **Dados**: Dados reais de produção
- **Integração**: Todos os serviços corporativos
- **Acesso**: Usuários finais e equipe de suporte

## 2. Estratégia de Deploy

### 2.1 Blue-Green Deployment
- **Vantagem**: Zero downtime
- **Rollback**: Instantâneo
- **Validação**: Testes automatizados
- **Monitoramento**: Métricas em tempo real

### 2.2 CI/CD Pipeline
- **Source Control**: Git (GitLab/GitHub)
- **Build**: Automated testing e building
- **Deploy**: Automated deployment
- **Monitoring**: Post-deployment validation

# MANUTENÇÃO E SUPORTE

## 1. Níveis de Suporte

### 1.1 Nível 1 - Help Desk
- **Escopo**: Problemas básicos de usuário
- **Horário**: 8h às 18h (dias úteis)
- **SLA**: 4 horas para resposta
- **Escalação**: Para Nível 2 se não resolvido

### 1.2 Nível 2 - Suporte Técnico
- **Escopo**: Problemas técnicos complexos
- **Horário**: 24x7 para críticos
- **SLA**: 2 horas para críticos, 8h para normais
- **Escalação**: Para Nível 3 ou fornecedor

### 1.3 Nível 3 - Especialistas
- **Escopo**: Problemas arquiteturais
- **Horário**: Sob demanda
- **SLA**: 1 hora para críticos
- **Recursos**: Desenvolvedores e arquitetos

## 2. Procedimentos de Manutenção

### 2.1 Manutenção Preventiva
- **Frequência**: Mensal
- **Atividades**: Updates, limpeza, otimização
- **Janela**: Fins de semana
- **Comunicação**: Aviso prévio de 48h

### 2.2 Manutenção Corretiva
- **Triggers**: Alertas automáticos
- **Priorização**: Por impacto no negócio
- **Documentação**: Registro completo
- **Post-mortem**: Análise de causa raiz

# CONFORMIDADE E AUDITORIA

## 1. Políticas Corporativas

### 1.1 ICTSI Global Policies
- **Password Policy**: Implementação completa
- **Access Control**: Controle baseado em roles
- **Data Protection**: Conformidade com LGPD
- **Change Management**: Processo formal

### 1.2 Frameworks de Governança
- **ITIL**: Gestão de serviços
- **COBIT**: Governança de TI
- **ISO 27001**: Segurança da informação
- **ISO 20000**: Gestão de serviços de TI

## 2. Auditoria e Compliance

### 2.1 Auditorias Internas
- **Frequência**: Trimestral
- **Escopo**: Segurança e processos
- **Evidências**: Logs e documentação
- **Relatórios**: Para governança

### 2.2 Auditorias Externas
- **Frequência**: Anual
- **Certificações**: ISO 27001, SOC 2
- **Preparação**: 30 dias de antecedência
- **Remediação**: Plano de ação para gaps

# EVOLUÇÃO E ROADMAP

## 1. Roadmap Técnico

### 1.1 Fase 1 - MVP (3 meses)
- Sistema básico de gestão de conteúdo
- Suporte a Chromecast e Web Players
- Interface administrativa completa
- Agendamento básico

### 1.2 Fase 2 - Expansão (6 meses)
- Suporte a Android TV nativo
- Analytics avançados
- Integração com Active Directory
- Mobile app para gestão

### 1.3 Fase 3 - Otimização (12 meses)
- CDN para distribuição global
- Machine Learning para otimização
- APIs públicas para integrações
- Microserviços architecture

## 2. Tecnologias Emergentes

### 2.1 Inteligência Artificial
- **Recomendação**: Conteúdo baseado em audiência
- **Otimização**: Horários ideais para campanhas
- **Análise**: Sentiment analysis de feedback
- **Automação**: Criação automática de campanhas

### 2.2 Edge Computing
- **Cache Local**: Conteúdo em edge servers
- **Processamento**: Transcoding distribuído
- **Latência**: Redução para < 10ms
- **Resiliência**: Operação offline

# APROVAÇÃO TÉCNICA

Este documento de arquitetura foi elaborado seguindo as melhores práticas de arquitetura de software e as diretrizes da Política de Governança de Sistemas PLTI-012.

**Data de Elaboração**: 26/09/2025
**Versão**: 1.0
**Status**: Aguardando Aprovação Técnica

---

**Assinaturas**:

**Elaborador**: _________________ Data: ___/___/___
Leonardo R. Fragoso - Desenvolvedor Senior

**Revisor**: _________________ Data: ___/___/___
Neuza Maria Balassiano Hauben - Coordenadora de Sistemas

**Aprovador**: _________________ Data: ___/___/___
Rodrigo Almeida de Abreu - Gerente de TI
