# Template Padrão

|  |
| --- |
| I |

| RIO BRASIL TERMINAL |  |  |  |  |
| --- | --- | --- | --- | --- |
| DOCUMENTO DE ESCOPO | DOCUMENTO DE ESCOPO | DOCUMENTO DE ESCOPO | DOCUMENTO DE ESCOPO | DOCUMENTO DE ESCOPO |

| Elaborador: | Leonardo R. Fragoso | Desenvolvedor Senior |
| --- | --- | --- |
| Revisor: | Neuza Maria Balassiano Hauben | Coordenadora de Sistemas |
| Aprovador: | Rodrigo Almeida de Abreu | Gerente de TI |

# OBJETIVO

Este documento tem por objetivo descrever o escopo funcional e técnico do sistema iTracker - Sistema de Gestão de Conteúdo Digital para TVs Corporativas, definindo os requisitos de negócio, funcionalidades, recursos necessários e objetivos a serem alcançados pela solução.

# DESCRIÇÃO DO SISTEMA

O iTracker é um sistema web desenvolvido para gerenciar e distribuir conteúdo digital (vídeos, imagens, apresentações) para dispositivos de exibição corporativos como TVs, monitores e displays digitais em ambientes empresariais.

## PROCESSO ATUAL (AS IS)

Atualmente, a gestão de conteúdo para TVs corporativas é realizada de forma manual e descentralizada:

- Conteúdo armazenado em drives locais ou compartilhamentos de rede
- Atualização manual de conteúdo em cada dispositivo
- Falta de controle centralizado sobre o que está sendo exibido
- Dificuldade para agendar conteúdo específico por horário/data
- Ausência de métricas sobre reprodução e efetividade
- Processo manual e propenso a erros
- Impossibilidade de gestão remota dos dispositivos

## PROCESSO PROPOSTO (TO BE)

O sistema iTracker proporcionará:

- **Gestão Centralizada**: Interface web para upload, organização e gestão de todo conteúdo digital
- **Distribuição Automática**: Envio automático de conteúdo para dispositivos conectados
- **Agendamento Inteligente**: Programação de campanhas por horário, data e localização
- **Monitoramento em Tempo Real**: Acompanhamento do status dos dispositivos e reprodução
- **Controle de Acesso**: Sistema de permissões por empresa e localização
- **Analytics**: Relatórios de reprodução e efetividade das campanhas
- **Suporte Multi-dispositivo**: Compatibilidade com Chromecast, Android TV, Web Players

# FUNCIONALIDADES PRINCIPAIS

## 1. Gestão de Conteúdo
- Upload de vídeos (MP4, AVI, MOV)
- Upload de imagens (JPG, PNG, GIF)
- Organização por categorias e tags
- Preview de conteúdo
- Controle de versões
- Gestão de metadados

## 2. Gestão de Campanhas
- Criação de campanhas com múltiplos conteúdos
- Configuração de sequência de reprodução
- Duração personalizada por conteúdo
- Modos de reprodução (sequencial, aleatório, loop)

## 3. Agendamento
- Programação por data e horário
- Recorrência (diária, semanal, mensal)
- Filtros por localização
- Priorização de campanhas
- Gestão de conflitos

## 4. Gestão de Dispositivos
- Cadastro de players (Chromecast, Android TV, Web)
- Monitoramento de status (online/offline)
- Controle remoto de reprodução
- Atualização de configurações

## 5. Monitoramento e Analytics
- Dashboard com KPIs em tempo real
- Relatórios de reprodução
- Métricas de efetividade
- Alertas de problemas
- Logs de atividade

## 6. Controle de Acesso
- Autenticação de usuários
- Perfis de permissão (Admin, HR, Usuário)
- Segregação por empresa
- Auditoria de acessos

# REQUISITOS TÉCNICOS

## Tecnologias Utilizadas
- **Frontend**: React.js, Material-UI, Socket.IO Client
- **Backend**: Python Flask, SQLAlchemy, Socket.IO
- **Banco de Dados**: SQLite (desenvolvimento), PostgreSQL (produção)
- **Infraestrutura**: Docker, Nginx
- **Protocolos**: HTTP/HTTPS, WebSocket, DLNA/UPnP

## Requisitos de Hardware
- **Servidor**: 4 CPU cores, 8GB RAM, 500GB storage
- **Rede**: Conexão estável 100Mbps
- **Dispositivos**: Chromecast, Android TV, navegadores modernos

## Integrações
- Google Cast SDK para Chromecast
- Socket.IO para comunicação em tempo real
- Sistema de arquivos para armazenamento de mídia

# USUÁRIOS E STAKEHOLDERS

## Usuários Finais
- **Administradores de TI**: Gestão completa do sistema
- **Equipe de RH**: Gestão de conteúdo da própria empresa
- **Usuários Finais**: Visualização de conteúdo nas TVs

## Stakeholders
- **Patrocinador**: Gerência de TI ICTSI
- **Sponsor Técnico**: Coordenação de Sistemas
- **Usuários de Negócio**: Equipes de RH e Comunicação

# BENEFÍCIOS ESPERADOS

## Operacionais
- Redução de 80% no tempo de atualização de conteúdo
- Eliminação de processos manuais
- Centralização da gestão
- Padronização de processos

## Estratégicos
- Melhoria na comunicação interna
- Maior efetividade das campanhas
- Controle e auditoria completos
- Escalabilidade para novas unidades

## Financeiros
- ROI estimado em 12 meses
- Redução de custos operacionais
- Otimização de recursos humanos

# RISCOS E CONTINGÊNCIAS

## Riscos Técnicos
- **Conectividade de rede**: Implementação de cache local
- **Compatibilidade de dispositivos**: Testes extensivos
- **Performance**: Otimização de streaming

## Riscos Operacionais
- **Resistência à mudança**: Treinamento e suporte
- **Falha de dispositivos**: Monitoramento proativo
- **Sobrecarga de rede**: QoS e limitação de banda

# CRONOGRAMA E RECURSOS

## Fases do Projeto
1. **Análise e Design** (2 semanas)
2. **Desenvolvimento Core** (8 semanas)
3. **Testes e Homologação** (3 semanas)
4. **Implantação** (2 semanas)
5. **Suporte Pós Go-Live** (8 semanas)

## Recursos Necessários
- **Equipe de Desenvolvimento**: 2 desenvolvedores full-stack
- **Infraestrutura**: Servidor de produção e homologação
- **Licenças**: Não aplicável (tecnologias open source)
- **Hardware**: Dispositivos para testes

# CRITÉRIOS DE ACEITAÇÃO

## Funcionais
- Sistema deve suportar upload de arquivos até 2GB
- Reprodução simultânea em até 50 dispositivos
- Interface responsiva para dispositivos móveis
- Tempo de resposta inferior a 3 segundos

## Não Funcionais
- Disponibilidade de 99.5%
- Backup automático diário
- Logs de auditoria completos
- Conformidade com LGPD

# TRATAMENTO DE DADOS PESSOAIS (LGPD)

## Dados Coletados
- **Dados de usuários**: Nome, email, empresa, perfil
- **Logs de acesso**: IP, timestamp, ações realizadas
- **Base Legal**: Legítimo interesse para operação do sistema

## Política de Retenção
- **Dados de usuários**: Mantidos enquanto ativo
- **Logs de sistema**: 2 anos
- **Conteúdo de mídia**: Conforme política da empresa

## Compartilhamento
- Dados não são compartilhados com terceiros
- Acesso restrito à equipe de TI para suporte

# CUSTOS ESTIMADOS

## Desenvolvimento
- **Recursos Humanos**: R$ 120.000 (16 semanas x 2 desenvolvedores)
- **Infraestrutura**: R$ 15.000 (servidor + licenças)
- **Testes**: R$ 8.000 (dispositivos e ambiente)

## Operação Anual
- **Infraestrutura**: R$ 24.000/ano
- **Suporte**: R$ 36.000/ano
- **Manutenção**: R$ 12.000/ano

**Total Investimento Inicial**: R$ 143.000
**Custo Operacional Anual**: R$ 72.000

# RETORNO SOBRE INVESTIMENTO (ROI)

## Economia Anual Estimada
- **Redução de horas de trabalho manual**: R$ 96.000/ano
- **Melhoria na efetividade das campanhas**: R$ 48.000/ano
- **Redução de retrabalho**: R$ 24.000/ano

**Total de Economia Anual**: R$ 168.000
**ROI**: 117% no primeiro ano

# APROVAÇÃO

Este documento foi elaborado seguindo as diretrizes da Política de Governança de Sistemas PLTI-012 e deve ser submetido ao Comitê de Governança de Sistemas para aprovação.

**Data de Elaboração**: 26/09/2025
**Versão**: 1.0
**Status**: Aguardando Aprovação

---

**Assinaturas**:

**Elaborador**: _________________ Data: ___/___/___
Leonardo R. Fragoso - Desenvolvedor Senior

**Revisor**: _________________ Data: ___/___/___
Neuza Maria Balassiano Hauben - Coordenadora de Sistemas

**Aprovador**: _________________ Data: ___/___/___
Rodrigo Almeida de Abreu - Gerente de TI
