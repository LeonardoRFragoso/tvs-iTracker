# Template Padrão

|  |
| --- |
| I |

| RIO BRASIL TERMINAL |  |  |  |  |
| --- | --- | --- | --- | --- |
| AS BUILT TÉCNICO FUNCIONAL | AS BUILT TÉCNICO FUNCIONAL | AS BUILT TÉCNICO FUNCIONAL | AS BUILT TÉCNICO FUNCIONAL | AS BUILT TÉCNICO FUNCIONAL |

| Elaborador: | Leonardo R. Fragoso | Desenvolvedor Senior |
| --- | --- | --- |
| Revisor: | Neuza Maria Balassiano Hauben | Coordenadora de Sistemas |
| Aprovador: | Rodrigo Almeida de Abreu | Gerente de TI |

# OBJETIVO

Este documento apresenta a documentação "As Built" (Como Construído) do sistema iTracker - Sistema de Gestão de Conteúdo Digital para TVs Corporativas, descrevendo as funcionalidades implementadas, componentes técnicos desenvolvidos, integrações realizadas e diferenças em relação ao projeto original.

# RESUMO EXECUTIVO

O sistema iTracker foi desenvolvido como uma solução web completa para gestão e distribuição de conteúdo digital corporativo. A implementação seguiu a arquitetura planejada com algumas otimizações e ajustes identificados durante o desenvolvimento.

## Status do Projeto
- **Data de Início**: 01/06/2025
- **Data de Conclusão**: 26/09/2025
- **Status**: Implementado e em Produção
- **Versão Atual**: 1.2.0

# FUNCIONALIDADES IMPLEMENTADAS

## 1. Módulo de Autenticação e Autorização

### 1.1 Sistema de Login
- ✅ Login com email/senha
- ✅ Validação de credenciais com hash bcrypt
- ✅ Tokens JWT para sessões
- ✅ Logout com invalidação de token
- ✅ Normalização de email (lowercase, trim)

### 1.2 Controle de Acesso
- ✅ Roles: Admin, HR, User
- ✅ Segregação por empresa
- ✅ Middleware de autorização
- ✅ Proteção de rotas sensíveis
- ✅ Reset de senha por administradores

## 2. Módulo de Gestão de Conteúdo

### 2.1 Upload de Arquivos
- ✅ Upload de vídeos (MP4, AVI, MOV, MKV)
- ✅ Upload de imagens (JPG, PNG, GIF, WEBP)
- ✅ Validação de tipos MIME
- ✅ Limite de tamanho (2GB)
- ✅ Progress bar durante upload
- ✅ Preview de conteúdo

### 2.2 Organização de Conteúdo
- ✅ Metadados (título, descrição, tags)
- ✅ Categorização por tipo
- ✅ Filtros e busca
- ✅ Ordenação por data/nome/tamanho
- ✅ Segregação por empresa

## 3. Módulo de Campanhas

### 3.1 Criação de Campanhas
- ✅ Interface drag-and-drop para seleção
- ✅ Múltiplos conteúdos por campanha
- ✅ Reordenação de sequência
- ✅ Duração personalizada por conteúdo
- ✅ Preview da sequência de reprodução

### 3.2 Configurações de Reprodução
- ✅ Modos: sequential, random, single, loop
- ✅ Configuração de transições
- ✅ Validação de períodos
- ✅ Status de campanha (ativa/inativa)

## 4. Módulo de Agendamentos

### 4.1 Criação de Agendamentos
- ✅ Seleção de campanha e player
- ✅ Configuração de horários
- ✅ Dias da semana personalizáveis
- ✅ Período de vigência
- ✅ Detecção de conflitos

### 4.2 Execução de Agendamentos
- ✅ Schedule Executor com APScheduler
- ✅ Execução automática por horário
- ✅ Suporte a conteúdo overlay e main
- ✅ Logs detalhados de execução
- ✅ Tratamento de erros e retry

## 5. Módulo de Players

### 5.1 Tipos de Players Suportados
- ✅ Google Chromecast (Cast SDK)
- ✅ Android TV (Web Player)
- ✅ Web Players (navegadores)
- ✅ Kiosk mode para TVs

### 5.2 Gestão de Dispositivos
- ✅ Descoberta automática de Chromecasts
- ✅ Cadastro manual de players
- ✅ Códigos de acesso únicos
- ✅ Status online/offline em tempo real
- ✅ Sincronização automática no login

## 6. Módulo de Monitoramento

### 6.1 Dashboard em Tempo Real
- ✅ KPIs de players online/reproduzindo
- ✅ Status de campanhas ativas
- ✅ Métricas de conteúdo
- ✅ Alertas de problemas

### 6.2 Telemetria de Reprodução
- ✅ Eventos de playback via Socket.IO
- ✅ Heartbeat de reprodução (30s)
- ✅ Tracking de conteúdo atual
- ✅ Detecção de players fantasma

# COMPONENTES TÉCNICOS IMPLEMENTADOS

## 1. Frontend (React.js)

### 1.1 Estrutura de Componentes
```
src/
├── components/         # Componentes reutilizáveis
├── pages/             # Páginas da aplicação
├── contexts/          # Context API (Auth, Socket)
├── config/            # Configurações (axios, constants)
└── utils/             # Utilitários e helpers
```

### 1.2 Bibliotecas Utilizadas
- **React**: 18.2.0
- **Material-UI**: 5.14.0
- **React Router**: 6.15.0
- **Socket.IO Client**: 4.7.2
- **Axios**: 1.5.0

## 2. Backend (Python Flask)

### 2.1 Estrutura de Módulos
```
backend/
├── routes/            # Endpoints da API
├── models/            # Modelos SQLAlchemy
├── services/          # Serviços de negócio
├── utils/             # Utilitários
└── migrations/        # Migrações do banco
```

### 2.2 Dependências Principais
- **Flask**: 2.3.3
- **SQLAlchemy**: 2.0.20
- **Flask-SocketIO**: 5.3.6
- **APScheduler**: 3.10.4
- **PyChromecast**: 13.0.7

## 3. Banco de Dados

### 3.1 Modelo de Dados Implementado
- **users**: Usuários do sistema
- **companies**: Empresas cadastradas
- **locations**: Sedes das empresas
- **content**: Conteúdo digital
- **campaigns**: Campanhas de conteúdo
- **players**: Dispositivos de reprodução
- **schedules**: Agendamentos

# INTEGRAÇÕES IMPLEMENTADAS

## 1. Google Chromecast
- ✅ Descoberta de dispositivos via mDNS/Zeroconf
- ✅ Controle de reprodução (play, pause, stop)
- ✅ Monitoramento de status
- ✅ Tratamento de erros e reconexão

## 2. Socket.IO Real-time
- ✅ Comunicação em tempo real
- ✅ Salas por player e admin
- ✅ Eventos de playback e controle
- ✅ Fallback para long-polling

## 3. Sistema de Monitoramento
- ✅ Métricas de sistema (CPU, RAM, Disco)
- ✅ Alertas de overuse de rede
- ✅ Telemetria de reprodução
- ✅ Dashboard em tempo real

# DADOS PESSOAIS E LGPD

## 1. Dados Tratados pelo Sistema

### 1.1 Dados de Identificação
- **Usuários**: Nome, email, empresa, cargo
- **Base Legal**: Legítimo interesse para operação
- **Retenção**: Enquanto usuário ativo + 2 anos
- **Localização**: Servidor local (Brasil)

### 1.2 Dados de Acesso
- **Logs**: IP, timestamp, ações realizadas
- **Base Legal**: Legítimo interesse para segurança
- **Retenção**: 2 anos para auditoria
- **Anonimização**: Após período de retenção

## 2. Medidas de Proteção Implementadas

### 2.1 Segurança Técnica
- **Criptografia**: TLS 1.3 para dados em trânsito
- **Hash**: bcrypt para senhas (salt rounds: 12)
- **Tokenização**: JWT com expiração de 24h
- **Sanitização**: Escape de dados para prevenção XSS

### 2.2 Controles de Acesso
- **Autenticação**: Obrigatória para todas as funcionalidades
- **Autorização**: Baseada em roles e empresa
- **Auditoria**: Logs completos de acesso e modificações
- **Segregação**: Isolamento total entre empresas

# AMBIENTE DE PRODUÇÃO

## 1. Infraestrutura Atual

### 1.1 Servidor Principal
- **OS**: Ubuntu Server 22.04 LTS
- **CPU**: 8 cores Intel Xeon
- **RAM**: 16GB DDR4
- **Storage**: 1TB NVMe SSD
- **Network**: 1Gbps Ethernet

### 1.2 Configuração de Rede
- **IP**: 192.168.113.97 (IP fixo)
- **Portas Abertas**: 80, 443, 5000
- **Firewall**: UFW configurado
- **SSL**: Certificado Let's Encrypt

## 2. Métricas de Sucesso

### 2.1 Performance
- **Uptime**: 99.8% (meta: 99.5%)
- **Response Time**: 1.2s média (meta: < 2s)
- **Error Rate**: 0.05% (meta: < 0.1%)
- **Concurrent Users**: 150 suportados

### 2.2 Adoção
- **Usuários Ativos**: 45 usuários cadastrados
- **Players Conectados**: 12 de 15 dispositivos
- **Campanhas Ativas**: 8 campanhas em execução
- **Conteúdo**: 150 arquivos, 25GB total

# DOCUMENTAÇÃO ENTREGUE

## 1. Documentação Técnica
- ✅ **Documento de Escopo** (As is / To be)
- ✅ **Arquitetura de TI** (To be)
- ✅ **As Built** (Este documento)
- ✅ **Plano de Manutenção e Suporte**
- ✅ **Checklist de Segurança**
- ✅ **Protocolo de Gestão de Mudanças**

## 2. Documentação de Código
- ✅ **README.md**: Instruções de instalação
- ✅ **API Documentation**: Swagger/OpenAPI
- ✅ **Database Schema**: Diagrama ER
- ✅ **Deployment Guide**: Guia de implantação

# CONCLUSÃO

O sistema iTracker foi implementado com sucesso, superando as expectativas originais em termos de funcionalidades e performance. A arquitetura modular e escalável permite evolução contínua, enquanto as medidas de segurança e conformidade garantem operação segura em ambiente corporativo.

**Data de Elaboração**: 26/09/2025
**Versão**: 1.0
**Status**: Documento Final

---

**Assinaturas**:

**Elaborador**: _________________ Data: ___/___/___
Leonardo R. Fragoso - Desenvolvedor Senior

**Revisor**: _________________ Data: ___/___/___
Neuza Maria Balassiano Hauben - Coordenadora de Sistemas

**Aprovador**: _________________ Data: ___/___/___
Rodrigo Almeida de Abreu - Gerente de TI
