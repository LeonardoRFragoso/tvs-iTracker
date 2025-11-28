# DOCUMENTAÇÃO COMPLETA DO SISTEMA TVS DIGITAL SIGNAGE PLATFORM
## PLTI-012a - Documento de Escopo As-Is / To-Be

---

## 1. IDENTIFICAÇÃO DO SISTEMA

### 1.1 Informações Básicas
- **Nome do Sistema:** TVS Digital Signage Platform (TVS iTracker)
- **Sigla:** TVS-DS
- **Versão Atual:** 1.0.0
- **Data de Implementação:** 2024
- **Proprietário do Sistema:** Setor de TI - ICTSI
- **Gestor Responsável:** Leonardo Fragoso
- **Criticidade:** Alta
- **Ambiente:** Produção

### 1.2 Objetivo do Sistema
Plataforma completa de sinalização digital corporativa desenvolvida para substituir o sistema Wiplay, oferecendo gestão centralizada de conteúdo multimídia, campanhas publicitárias, controle de players e monitoramento em tempo real para múltiplas localidades da organização.

### 1.3 Justificativa da Implementação
- **Necessidade de Negócio:** Centralizar e modernizar a comunicação visual corporativa
- **Problemas do Sistema Anterior (Wiplay):**
  - Limitações de personalização
  - Custos elevados de licenciamento
  - Falta de integração com sistemas internos
  - Suporte limitado para multi-site
  - Interface não customizável

---

## 2. ESCOPO AS-IS (SITUAÇÃO ANTERIOR - WIPLAY)

### 2.1 Descrição do Sistema Anterior
O sistema Wiplay era uma solução comercial de sinalização digital com as seguintes características:
- Gestão básica de conteúdo
- Agendamento simples de mídia
- Controle limitado de players
- Interface web padrão
- Licenciamento por dispositivo

### 2.2 Limitações Identificadas
1. **Técnicas:**
   - Arquitetura fechada e proprietária
   - Impossibilidade de customização
   - Integração limitada com outros sistemas
   - Baixa escalabilidade
   
2. **Operacionais:**
   - Complexidade na gestão multi-site
   - Relatórios limitados
   - Falta de monitoramento em tempo real
   - Processo manual de atualização de conteúdo

3. **Financeiras:**
   - Custo elevado de licenças anuais
   - Cobrança por player adicional
   - Custos de suporte técnico
   - Investimento em hardware específico

---

## 3. ESCOPO TO-BE (NOVA SOLUÇÃO - TVS DIGITAL SIGNAGE)

### 3.1 Visão Geral da Nova Solução
Sistema desenvolvido internamente utilizando tecnologias modernas e open-source, proporcionando controle total, customização ilimitada e redução significativa de custos operacionais.

### 3.2 Principais Funcionalidades

#### 3.2.1 Gestão de Conteúdo
- **Upload de Múltiplos Formatos:**
  - Vídeo (MP4, AVI, MOV, MKV)
  - Imagem (JPG, PNG, GIF, WEBP)
  - Áudio (MP3, WAV, OGG)
  - HTML/Web (páginas interativas)
  
- **Processamento Automático:**
  - Geração automática de thumbnails
  - Conversão de formatos
  - Otimização de mídia
  - Validação de integridade

- **Organização:**
  - Sistema de categorização
  - Tags personalizadas
  - Busca avançada
  - Versionamento de conteúdo

#### 3.2.2 Campanhas e Programação
- **Editor de Campanhas:**
  - Interface drag-and-drop intuitiva
  - Ordenação visual de conteúdo
  - Preview em tempo real
  - Templates pré-configurados

- **Agendamento Avançado:**
  - Programação até 180 dias antecipados
  - Recorrência (diária, semanal, mensal)
  - Horários específicos por dia da semana
  - Segmentação por região/localidade
  - Detecção automática de conflitos

- **Distribuição Inteligente:**
  - Priorização de conteúdo
  - Balanceamento de carga
  - Sincronização automática
  - Fallback de conteúdo

#### 3.2.3 Gestão de Players
- **Monitoramento em Tempo Real:**
  - Status online/offline
  - Último heartbeat
  - Versão do software player
  - Recursos do sistema (CPU, memória, disco)
  - Resolução e configuração de display

- **Controle Remoto:**
  - Play/Pause de reprodução
  - Restart do player
  - Sincronização forçada
  - Atualização de configurações
  - Comando de screenshot

- **Suporte Multi-Plataforma:**
  - Android (APK nativo)
  - Windows (aplicação desktop)
  - Web Browser (HTML5)
  - Chromecast integration

#### 3.2.4 Multi-Site Management
- **Gestão de Localizações:**
  - Cadastro de múltiplas empresas/sites
  - Hierarquia organizacional
  - Atribuição de players por localidade
  - Configuração de horários de pico

- **Distribuição de Conteúdo:**
  - Campanha global ou por site específico
  - Replicação automática de conteúdo
  - Controle de bandwidth por localidade
  - Estatísticas individualizadas

#### 3.2.5 Dashboard e Analytics
- **Métricas em Tempo Real:**
  - Total de players ativos/inativos
  - Conteúdo em exibição
  - Armazenamento utilizado
  - Campanhas ativas
  - Alertas do sistema

- **Relatórios:**
  - Histórico de exibições
  - Taxa de reprodução por conteúdo
  - Performance dos players
  - Disponibilidade do sistema
  - Logs de atividades

#### 3.2.6 Editorias e RSS
- **Feeds Dinâmicos:**
  - Integração com APIs de notícias
  - Atualização automática de conteúdo
  - Templates personalizáveis
  - Cache inteligente

#### 3.2.7 Segurança e Controle de Acesso
- **Autenticação:**
  - JWT (JSON Web Token)
  - Sessões seguras
  - Timeout configurável
  - Políticas de senha

- **Autorização (RBAC):**
  - Admin: Acesso total ao sistema
  - Manager: Gestão de conteúdo e campanhas
  - Viewer: Visualização apenas
  - Permissões granulares por módulo

### 3.3 Benefícios da Nova Solução

#### 3.3.1 Técnicos
- Arquitetura moderna e escalável
- Código-fonte proprietário e customizável
- Integração facilitada com sistemas internos
- API RESTful documentada
- Comunicação em tempo real (WebSocket)
- Deploy containerizado (Docker ready)

#### 3.3.2 Operacionais
- Interface intuitiva e responsiva
- Gestão centralizada de múltiplos sites
- Automação de processos
- Monitoramento proativo
- Menor tempo de resposta a incidentes
- Flexibilidade de configuração

#### 3.3.3 Financeiros
- Eliminação de custos de licenciamento
- Redução de 100% dos custos anuais do Wiplay
- Sem limite de players
- Hardware genérico (qualquer dispositivo Android/Windows)
- Manutenção interna
- ROI em menos de 12 meses

---

## 4. ARQUITETURA TÉCNICA TO-BE

### 4.1 Stack Tecnológico

#### 4.1.1 Backend
```
Linguagem: Python 3.13+
Framework: Flask 3.0.0
ORM: SQLAlchemy 2.0.30+
Banco de Dados: MySQL 8.0+ / SQLite (dev)
WebSocket: Flask-SocketIO 5.3.6
Autenticação: Flask-JWT-Extended 4.6.0
Processamento de Mídia: FFmpeg, Pillow 10.0+
Scheduler: APScheduler 3.10.4
Chromecast: pychromecast 13.0+
```

#### 4.1.2 Frontend
```
Linguagem: JavaScript (ES6+)
Framework: React 18.2.0
UI Framework: Material-UI 5.14.0
HTTP Client: Axios 1.6.0
WebSocket: Socket.IO Client 4.7.2
Roteamento: React Router 6.8.0
Drag-and-Drop: @dnd-kit 6.1.0
Calendário: FullCalendar 6.1.14
Gráficos: Chart.js 4.4.0, Recharts 2.8.0
Data Pickers: @mui/x-date-pickers 6.20.2
```

#### 4.1.3 Infraestrutura
- **Servidor Web:** Nginx (reverse proxy)
- **WSGI Server:** Gunicorn / Waitress
- **Banco de Dados:** MySQL 8.0+ (produção)
- **Cache:** Redis (opcional, futuro)
- **Storage:** Sistema de arquivos local / NAS
- **Backup:** Automatizado diário
- **Monitoramento:** Logs integrados + APM

### 4.2 Arquitetura de Software

#### 4.2.1 Padrão Arquitetural
- **Backend:** MVC (Model-View-Controller) com Blueprints
- **Frontend:** Component-Based Architecture (React)
- **API:** RESTful + WebSocket
- **Comunicação:** HTTP/HTTPS + WS/WSS

#### 4.2.2 Estrutura do Backend
```
backend/
├── app.py                 # Aplicação principal
├── database.py            # Configuração do banco
├── models/                # Modelos de dados (SQLAlchemy)
│   ├── user.py           # Usuários e autenticação
│   ├── location.py       # Localizações/Sites
│   ├── content.py        # Conteúdo de mídia
│   ├── campaign.py       # Campanhas
│   ├── schedule.py       # Agendamentos
│   ├── player.py         # Players/Dispositivos
│   ├── editorial.py      # Editorias RSS
│   ├── content_distribution.py  # Distribuição
│   └── system_config.py  # Configurações
├── routes/                # Rotas da API (Blueprints)
│   ├── auth.py           # Autenticação
│   ├── content.py        # Gestão de conteúdo
│   ├── campaign.py       # Gestão de campanhas
│   ├── schedule.py       # Agendamentos
│   ├── player.py         # Gestão de players
│   ├── location.py       # Gestão de sites
│   ├── dashboard.py      # Dashboard/Analytics
│   ├── settings.py       # Configurações
│   └── cast.py           # Chromecast
├── services/              # Lógica de negócio
├── monitoring/            # Monitoramento e métricas
├── realtime/              # Handlers WebSocket
├── migrations/            # Migrações de banco
└── uploads/               # Armazenamento de mídia
```

#### 4.2.3 Estrutura do Frontend
```
src/
├── App.js                 # Componente raiz
├── index.js               # Entry point
├── components/            # Componentes reutilizáveis
│   ├── Layout/           # Layout e navegação
│   ├── MediaUpload/      # Upload de mídia
│   ├── CampaignBuilder/  # Editor de campanhas
│   ├── PlayerCard/       # Card de player
│   └── ...
├── pages/                 # Páginas da aplicação
│   ├── Dashboard/        # Dashboard principal
│   ├── Content/          # Gestão de conteúdo
│   ├── Campaigns/        # Gestão de campanhas
│   ├── Players/          # Gestão de players
│   ├── Schedule/         # Agendamentos
│   ├── Locations/        # Gestão de sites
│   ├── Settings/         # Configurações
│   └── ...
├── contexts/              # React Contexts
│   ├── AuthContext.js    # Autenticação
│   ├── SocketContext.js  # WebSocket
│   └── ...
├── config/                # Configurações
└── utils/                 # Utilitários
```

### 4.3 Modelo de Dados

#### 4.3.1 Principais Entidades

**User (Usuário)**
- id, username, email, password_hash
- role (admin, manager, viewer)
- created_at, updated_at
- Relacionamentos: locations (N:N)

**Location (Localização)**
- id, name, timezone, peak_hours
- company_name, address, contact
- created_at, updated_at
- Relacionamentos: players (1:N), campaigns (1:N)

**Content (Conteúdo)**
- id, title, description, type (video, image, audio, html)
- filename, original_filename, file_path
- thumbnail_path, file_size, mime_type, duration
- metadata (JSON), tags
- created_by, created_at, updated_at
- Relacionamentos: campaigns (N:N), distributions (1:N)

**Campaign (Campanha)**
- id, name, description, is_active
- location_id, priority
- start_date, end_date
- content_order (JSON array)
- created_by, created_at, updated_at
- Relacionamentos: location (N:1), contents (N:N), schedules (1:N)

**Schedule (Agendamento)**
- id, campaign_id, location_id
- start_date, end_date
- start_time, end_time
- days_of_week (JSON array)
- is_active, priority
- recurrence_rule (JSON)
- created_at, updated_at
- Relacionamentos: campaign (N:1), location (N:1)

**Player (Player/Dispositivo)**
- id, name, location_id, player_key (UUID)
- device_type (android, windows, web)
- ip_address, mac_address
- resolution, user_agent
- status (online, offline), last_seen
- current_campaign_id, current_content_id
- system_info (JSON)
- created_at, updated_at
- Relacionamentos: location (N:1)

### 4.4 APIs e Integrações

#### 4.4.1 API RESTful (Backend)
```
Autenticação:
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me

Conteúdo:
GET    /api/content
POST   /api/content
GET    /api/content/:id
PUT    /api/content/:id
DELETE /api/content/:id
POST   /api/content/upload

Campanhas:
GET    /api/campaigns
POST   /api/campaigns
GET    /api/campaigns/:id
PUT    /api/campaigns/:id
DELETE /api/campaigns/:id
POST   /api/campaigns/:id/contents

Agendamentos:
GET    /api/schedules
POST   /api/schedules
GET    /api/schedules/:id
PUT    /api/schedules/:id
DELETE /api/schedules/:id
GET    /api/schedules/conflicts

Players:
GET    /api/players
POST   /api/players
GET    /api/players/:id
PUT    /api/players/:id
DELETE /api/players/:id
POST   /api/players/:id/command

Localizações:
GET    /api/locations
POST   /api/locations
GET    /api/locations/:id
PUT    /api/locations/:id
DELETE /api/locations/:id

Dashboard:
GET    /api/dashboard/stats
GET    /api/dashboard/alerts
GET    /api/dashboard/activity

Settings:
GET    /api/settings
PUT    /api/settings

Chromecast:
GET    /api/cast/devices
POST   /api/cast/play
POST   /api/cast/stop
```

#### 4.4.2 WebSocket Events
```
Client → Server:
- player_register: Registro de novo player
- player_heartbeat: Heartbeat do player
- player_status_update: Atualização de status

Server → Client:
- player_command: Comando para player (play, pause, sync, restart)
- content_update: Atualização de conteúdo
- campaign_update: Atualização de campanha
- system_alert: Alerta do sistema
- player_status_changed: Mudança de status de player
```

#### 4.4.3 Integrações Externas
- **FFmpeg:** Processamento de vídeo (thumbnails, conversão)
- **Pillow:** Processamento de imagem (resize, thumbnails)
- **Chromecast API:** Transmissão para dispositivos Chromecast
- **News APIs:** Feeds RSS para editorias (futuro)
- **Weather APIs:** Informações meteorológicas (futuro)

### 4.5 Segurança

#### 4.5.1 Autenticação e Autorização
- JWT com refresh token
- Bcrypt para hash de senhas
- RBAC (Role-Based Access Control)
- Sessões com timeout configurável
- Proteção contra CSRF

#### 4.5.2 Comunicação
- HTTPS obrigatório em produção
- WSS (WebSocket Secure)
- CORS configurado
- Rate limiting (futuro)

#### 4.5.3 Dados
- Validação de inputs
- Sanitização de uploads
- Validação de tipos de arquivo
- Limite de tamanho de upload (50MB default)
- Proteção contra SQL Injection (ORM)
- Proteção contra XSS

#### 4.5.4 Infraestrutura
- Firewall configurado
- Acesso SSH restrito
- Backup automatizado
- Logs de auditoria
- Monitoramento de intrusão

### 4.6 Performance e Escalabilidade

#### 4.6.1 Otimizações
- Lazy loading de imagens
- Paginação de listagens
- Cache de thumbnails
- Compressão de mídia
- Minificação de assets
- CDN para distribuição de conteúdo (futuro)

#### 4.6.2 Escalabilidade
- Arquitetura stateless
- Load balancer ready
- Database pooling
- Horizontal scaling ready
- Microservices ready (futuro)

---

## 5. AS-BUILT (IMPLEMENTAÇÃO ATUAL)

### 5.1 Ambiente de Desenvolvimento
- **Sistema Operacional:** Windows 10/11
- **IDE:** Visual Studio Code
- **Controle de Versão:** Git
- **Repositório:** GitHub/GitLab (privado)

### 5.2 Ambiente de Produção

#### 5.2.1 Servidor
- **Sistema Operacional:** Windows Server 2019/2022 ou Linux Ubuntu 20.04+
- **Processador:** Mínimo 4 cores
- **RAM:** Mínimo 8GB
- **Armazenamento:** 500GB+ SSD (escalável conforme conteúdo)
- **Rede:** 100Mbps+ (1Gbps recomendado)

#### 5.2.2 Banco de Dados
- **SGBD:** MySQL 8.0+
- **Engine:** InnoDB
- **Character Set:** utf8mb4
- **Collation:** utf8mb4_unicode_ci
- **Backup:** Diário automatizado

#### 5.2.3 Web Server
- **Reverse Proxy:** Nginx 1.18+
- **WSGI Server:** Gunicorn (Linux) / Waitress (Windows)
- **Workers:** 4-8 (baseado em CPU)
- **Timeout:** 120s

### 5.3 Configuração de Deploy

#### 5.3.1 Backend
```bash
# Instalação de dependências
pip install -r requirements.txt

# Configuração de variáveis de ambiente
cp .env.example .env
# Editar .env com configurações de produção

# Migração de banco de dados
flask db upgrade

# Inicialização do servidor
gunicorn -w 4 -b 0.0.0.0:5000 --timeout 120 app:app
```

#### 5.3.2 Frontend
```bash
# Instalação de dependências
npm install

# Build de produção
npm run build

# Deploy
# Copiar pasta build/ para diretório do Nginx
```

#### 5.3.3 Nginx Configuration
```nginx
server {
    listen 80;
    server_name tvs.empresa.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tvs.empresa.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # Frontend
    location / {
        root /var/www/tvs-frontend/build;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Uploads/Media
    location /uploads/ {
        alias /path/to/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 5.4 Estrutura de Diretórios em Produção
```
/opt/tvs-platform/
├── backend/
│   ├── app.py
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── uploads/          # Mídia armazenada
│   ├── venv/             # Virtual environment
│   ├── .env              # Configurações
│   └── logs/             # Logs da aplicação
├── frontend/
│   └── build/            # Build de produção React
├── scripts/
│   ├── backup.sh         # Script de backup
│   ├── deploy.sh         # Script de deploy
│   └── health-check.sh   # Health check
└── docs/
    └── ...
```

### 5.5 Monitoramento Implementado

#### 5.5.1 Logs
- **Backend:** Log file rotativo (logs/app.log)
- **Nginx:** Access log e error log
- **Sistema:** Syslog

#### 5.5.2 Métricas
- Health check endpoint: /api/health
- Status de players em tempo real
- Alertas de sistema no dashboard
- Monitoramento de disco/storage

### 5.6 Backup e Recuperação

#### 5.6.1 Backup
- **Frequência:** Diário (automático)
- **Retenção:** 30 dias
- **Escopo:**
  - Banco de dados MySQL (dump)
  - Arquivos de mídia (/uploads)
  - Configurações (.env)
  
#### 5.6.2 Recuperação
- **RTO (Recovery Time Objective):** 4 horas
- **RPO (Recovery Point Objective):** 24 horas
- **Procedimento documentado:** docs/recovery-procedure.md

---

## 6. PLANO DE MANUTENÇÃO E SUPORTE

### 6.1 Equipe de Suporte

#### 6.1.1 Estrutura
- **Gestor de TI:** Leonardo Fragoso
- **Desenvolvedor Principal:** Leonardo Fragoso
- **Suporte N1:** Equipe de Helpdesk (2 pessoas)
- **Suporte N2/N3:** Equipe de Desenvolvimento (1 pessoa)

#### 6.1.2 Horário de Atendimento
- **Suporte N1:** Segunda a Sexta, 8h às 18h
- **Suporte N2/N3:** Segunda a Sexta, 8h às 18h (on-call 24x7 para criticidade alta)
- **SLA:** Definido por criticidade do incidente

### 6.2 Níveis de Severidade e SLA

| Severidade | Descrição | Tempo de Resposta | Tempo de Resolução |
|------------|-----------|-------------------|-------------------|
| **Crítica** | Sistema completamente inoperante | 1 hora | 4 horas |
| **Alta** | Funcionalidade crítica indisponível | 2 horas | 8 horas |
| **Média** | Funcionalidade não-crítica com problema | 4 horas | 24 horas |
| **Baixa** | Dúvida, melhoria ou problema menor | 8 horas | 48 horas |

### 6.3 Manutenção Preventiva

#### 6.3.1 Diária
- Verificação automática de status dos players
- Limpeza de logs antigos (>30 dias)
- Verificação de espaço em disco

#### 6.3.2 Semanal
- Revisão de alertas do sistema
- Análise de performance
- Verificação de backup

#### 6.3.3 Mensal
- Atualização de segurança
- Revisão de logs de erro
- Otimização de banco de dados
- Teste de recuperação de backup

#### 6.3.4 Trimestral
- Atualização de dependências
- Revisão de capacidade
- Planejamento de melhorias
- Treinamento de usuários

### 6.4 Manutenção Corretiva

#### 6.4.1 Processo de Incidentes
1. **Detecção:** Via monitoramento ou chamado de usuário
2. **Registro:** Abertura de ticket no sistema de helpdesk
3. **Classificação:** Determinação de severidade e prioridade
4. **Atribuição:** Direcionamento para equipe adequada
5. **Resolução:** Correção do problema
6. **Validação:** Teste da solução com usuário
7. **Documentação:** Registro da solução na base de conhecimento
8. **Encerramento:** Fechamento do ticket

#### 6.4.2 Procedimentos Comuns

**Player Offline:**
1. Verificar conectividade de rede
2. Reiniciar player remotamente
3. Verificar logs do player
4. Se necessário, acesso físico ao dispositivo

**Problema de Sincronização:**
1. Verificar status da campanha
2. Forçar sincronização via comando remoto
3. Verificar espaço em disco do player
4. Reiniciar serviço se necessário

**Erro de Upload:**
1. Verificar tamanho e formato do arquivo
2. Verificar espaço em disco do servidor
3. Verificar permissões de diretório
4. Revisar logs do backend

**Performance Lenta:**
1. Verificar carga do servidor
2. Analisar queries lentas no banco
3. Verificar uso de memória
4. Otimizar índices se necessário

### 6.5 Manutenção Evolutiva

#### 6.5.1 Processo de Mudanças
1. **Solicitação:** Via formulário de mudança
2. **Análise:** Avaliação de impacto e viabilidade
3. **Aprovação:** Comitê de mudanças
4. **Desenvolvimento:** Implementação em ambiente de dev
5. **Testes:** QA em ambiente de homologação
6. **Deploy:** Implementação em produção (janela de manutenção)
7. **Validação:** Testes pós-deploy
8. **Documentação:** Atualização de documentação

#### 6.5.2 Roadmap de Melhorias
**Curto Prazo (3 meses):**
- Aplicativo mobile para gestão (iOS/Android)
- API pública para integrações
- Relatórios avançados com exportação

**Médio Prazo (6 meses):**
- Multi-idioma (PT, EN, ES)
- Integração com redes sociais
- Analytics avançados com BI
- Suporte a mais formatos de mídia

**Longo Prazo (12 meses):**
- Machine Learning para otimização de conteúdo
- Reconhecimento de público (câmeras)
- Interatividade (touch screens)
- Edge computing para players

### 6.6 Treinamento e Documentação

#### 6.6.1 Documentação Disponível
- **Manual do Usuário:** Guia completo de uso do sistema
- **Manual de Administrador:** Configuração e gestão avançada
- **API Documentation:** Swagger/OpenAPI
- **FAQ:** Perguntas frequentes
- **Base de Conhecimento:** Artigos e tutoriais
- **Vídeos Tutoriais:** Screencast das principais funcionalidades

#### 6.6.2 Treinamento
- **Onboarding:** Treinamento inicial para novos usuários (2h)
- **Treinamento Avançado:** Para administradores (4h)
- **Workshops:** Trimestrais sobre novas funcionalidades
- **Suporte Online:** Chat e email para dúvidas

### 6.7 Monitoramento e Alertas

#### 6.7.1 Métricas Monitoradas
- Disponibilidade do sistema (uptime)
- Tempo de resposta das APIs
- Taxa de erros
- Uso de recursos (CPU, RAM, disco)
- Número de players online/offline
- Taxa de sucesso de sincronização
- Espaço em disco

#### 6.7.2 Alertas Automáticos
- **Crítico:** Sistema offline, banco de dados inacessível
- **Alto:** >50% players offline, disco >90% cheio
- **Médio:** Erros recorrentes, performance degradada
- **Baixo:** Avisos gerais, logs de atenção

### 6.8 Continuidade de Negócio

#### 6.8.1 Plano de Contingência
- **Backup de contingência:** Sistema anterior (Wiplay) mantido por 6 meses
- **Failover:** Servidor secundário (manual)
- **Comunicação:** Plano de comunicação com stakeholders

#### 6.8.2 Disaster Recovery
- **Backup offsite:** Cópia semanal em localidade separada
- **Documentação:** Procedimento de recuperação total
- **Teste de DR:** Anual

---

## 7. REQUISITOS NÃO FUNCIONAIS

### 7.1 Performance
- Tempo de resposta da interface: <2s para 95% das requisições
- Tempo de carregamento de página: <3s
- Suporte a 100+ players simultâneos
- Upload de arquivos: até 100MB
- Streaming de vídeo: buffer <5s

### 7.2 Disponibilidade
- Uptime: 99% (disponibilidade 24x7)
- Janela de manutenção: Domingos, 02h-06h (se necessário)
- Redundância: Banco de dados com replicação

### 7.3 Usabilidade
- Interface responsiva (desktop, tablet, mobile)
- Suporte a navegadores modernos (Chrome, Firefox, Edge, Safari)
- Acessibilidade: WCAG 2.1 Level AA (futuro)
- Multi-idioma: PT-BR (atual), EN, ES (futuro)

### 7.4 Segurança
- Autenticação obrigatória
- HTTPS/SSL obrigatório em produção
- Criptografia de senhas (bcrypt)
- Logs de auditoria
- Backup criptografado

### 7.5 Compatibilidade
- **Backend:** Python 3.13+, qualquer OS
- **Frontend:** Navegadores modernos (últimas 2 versões)
- **Players:** Android 8+, Windows 10+, Web (Chrome 90+)
- **Banco de Dados:** MySQL 8.0+ / SQLite 3.35+

### 7.6 Manutenibilidade
- Código documentado
- Testes automatizados (futuro)
- CI/CD pipeline (futuro)
- Logs estruturados
- Métricas de código (linting, formatting)

---

## 8. RISCOS E MITIGAÇÕES

### 8.1 Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Falha de hardware do servidor | Baixa | Alto | Backup diário, servidor de contingência |
| Corrupção de banco de dados | Baixa | Crítico | Backup automático, replicação |
| Ataque de segurança | Média | Alto | Firewall, HTTPS, atualizações regulares |
| Perda de conectividade de rede | Média | Médio | Players com cache local, retry automático |
| Sobrecarga do servidor | Baixa | Médio | Monitoramento, escalabilidade horizontal |

### 8.2 Riscos Operacionais

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Falta de treinamento de usuários | Média | Baixo | Treinamentos regulares, documentação |
| Resistência à mudança | Baixa | Baixo | Change management, suporte dedicado |
| Conflito de agendamentos | Média | Baixo | Detecção automática, validação |
| Conteúdo inadequado publicado | Baixa | Médio | Aprovação em múltiplos níveis, logs |

### 8.3 Riscos de Projeto

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Atraso no desenvolvimento | Baixa | Baixo | Sistema já implementado |
| Bugs críticos em produção | Média | Médio | Testes rigorosos, rollback plan |
| Dependência de desenvolvedor único | Alta | Alto | Documentação, treinamento de equipe |

---

## 9. CONFORMIDADE E GOVERNANÇA

### 9.1 Políticas de TI
- Alinhado com PLTI-012 - Governança de Sistemas
- Política de backup e recuperação
- Política de segurança da informação
- Política de controle de acesso

### 9.2 Auditoria
- Logs de todas as ações críticas
- Rastreabilidade de mudanças
- Relatórios de compliance (trimestral)

### 9.3 LGPD (Lei Geral de Proteção de Dados)
- Armazenamento apenas de dados necessários
- Criptografia de dados sensíveis
- Direito de acesso e exclusão de dados
- Políticas de privacidade documentadas

---

## 10. CONCLUSÃO

### 10.1 Resumo dos Benefícios
O sistema TVS Digital Signage Platform representa um avanço significativo em relação à solução anterior (Wiplay), proporcionando:

1. **Autonomia Tecnológica:** Controle total do código-fonte e infraestrutura
2. **Redução de Custos:** Eliminação de licenças anuais
3. **Flexibilidade:** Customização ilimitada conforme necessidades
4. **Escalabilidade:** Suporte ilimitado de players e sites
5. **Modernização:** Stack tecnológico atual e de fácil manutenção
6. **Integração:** Facilidade de integração com outros sistemas internos

### 10.2 Status Atual
- **Desenvolvimento:** 100% concluído
- **Testes:** 95% concluído
- **Documentação:** 90% concluída
- **Deploy:** Em produção (piloto)
- **Treinamento:** Em andamento

### 10.3 Próximos Passos
1. Conclusão do rollout para todos os sites (1 mês)
2. Treinamento completo de todos os usuários (2 semanas)
3. Desativação do sistema Wiplay (após 3 meses de operação estável)
4. Implementação de melhorias do roadmap (contínuo)

---

## ANEXOS

### A. Glossário de Termos
- **Digital Signage:** Sinalização digital, sistema de exibição de conteúdo em telas
- **Player:** Dispositivo que reproduz o conteúdo nas telas
- **Campaign:** Conjunto de conteúdos organizados para exibição
- **Schedule:** Agendamento de campanhas com horários específicos
- **WebSocket:** Protocolo de comunicação bidirecional em tempo real
- **JWT:** JSON Web Token, padrão de autenticação
- **RBAC:** Role-Based Access Control, controle de acesso baseado em papéis
- **SLA:** Service Level Agreement, acordo de nível de serviço

### B. Referências
- Flask Documentation: https://flask.palletsprojects.com/
- React Documentation: https://react.dev/
- Material-UI Documentation: https://mui.com/
- SQLAlchemy Documentation: https://docs.sqlalchemy.org/

### C. Contatos
- **Gestor do Sistema:** Leonardo Fragoso - leonardo.fragoso@empresa.com
- **Suporte N1:** helpdesk@empresa.com
- **Suporte N2/N3:** ti-dev@empresa.com

---

**Documento preparado por:** Leonardo Fragoso  
**Data:** Novembro 2024  
**Versão:** 1.0  
**Status:** APROVADO
