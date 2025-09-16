# TVS Digital Signage Platform

Uma plataforma completa de sinalização digital para substituir a Wiplay, desenvolvida com Flask (backend) e React (frontend).

## 🚀 Funcionalidades

### Gestão de Conteúdo
- Upload e organização de mídias (vídeo, imagem, áudio, HTML)
- Sistema de thumbnails automático
- Preview de conteúdo integrado
- Categorização e tags

### Campanhas e Programação
- Criação de campanhas com drag-and-drop
- Agendamento avançado (até 180 dias)
- Segmentação por região, horário e dia da semana
- Detecção de conflitos de programação

### Gestão de Players
- Monitoramento em tempo real
- Controle remoto (play, pause, restart, sync)
- Suporte para Android e Windows
- Configuração de rede e display

### Multi-site
- Gestão de múltiplas localizações
- Distribuição inteligente de conteúdo
- Configuração de horários de pico
- Estatísticas por sede

### Dashboard e Monitoramento
- Estatísticas em tempo real
- Alertas de sistema
- Monitoramento de saúde dos players
- Métricas de armazenamento e performance

### Editorias (RSS)
- Feeds automáticos de notícias
- Integração com APIs externas
- Conteúdo dinâmico

## 🛠️ Stack Tecnológico

### Backend
- **Flask** - Framework web Python
- **SQLAlchemy** - ORM para banco de dados
- **SQLite** - Banco de dados
- **SocketIO** - Comunicação em tempo real
- **JWT** - Autenticação
- **FFmpeg** - Processamento de vídeo
- **PIL** - Processamento de imagem

### Frontend
- **React** - Framework JavaScript
- **Material-UI** - Componentes de interface
- **Axios** - Cliente HTTP
- **Socket.IO Client** - WebSocket
- **React Router** - Roteamento

## 📦 Instalação

### Pré-requisitos
- Python 3.13+
- Node.js 16+
- FFmpeg (para thumbnails de vídeo)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python init_db.py
python start_server.py
```

### Frontend
```bash
npm install
npm start
```

## 🔧 Configuração

### Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto:
```
FLASK_ENV=development
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///tvs_platform.db
```

### Usuários Padrão
- **Admin**: admin / admin123
- **Manager**: manager / manager123

## 🌐 Acesso

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **WebSocket**: ws://localhost:5000

## 📁 Estrutura do Projeto

```
Tvs-Project/
├── backend/                 # Servidor Flask
│   ├── models/             # Modelos do banco de dados
│   ├── routes/             # Rotas da API
│   ├── migrations/         # Scripts de migração
│   ├── services/           # Serviços e lógica de negócio
│   └── app.py             # Aplicação principal
├── src/                    # Frontend React
│   ├── components/        # Componentes reutilizáveis
│   ├── pages/            # Páginas da aplicação
│   ├── contexts/         # Contextos React
│   └── config/           # Configurações
├── public/               # Arquivos públicos
└── uploads/             # Arquivos de mídia
```

## 🔄 Funcionalidades em Tempo Real

- Controle remoto de players via WebSocket
- Notificações de sistema
- Atualizações de status em tempo real
- Sincronização automática de conteúdo

## 🎯 Casos de Uso

- **TV Corporativa**: Comunicação interna e institucional
- **Sinalização Digital**: Publicidade e informações
- **Menu Boards**: Cardápios digitais para restaurantes
- **Informações Públicas**: Aeroportos, hospitais, escolas

## 📱 Suporte a Dispositivos

- **Web Players**: Qualquer navegador moderno
- **Android**: APK dedicado (em desenvolvimento)
- **Windows**: Aplicação desktop (em desenvolvimento)
- **Chromecast**: Suporte nativo

## 🔒 Segurança

- Autenticação JWT
- Controle de acesso baseado em roles
- Validação de uploads
- Sanitização de dados

## 🚀 Deploy

### Desenvolvimento
```bash
# Backend
python start_server.py

# Frontend
npm start
```

### Produção
- Configure um servidor web (nginx/apache)
- Use um banco de dados robusto (PostgreSQL/MySQL)
- Configure SSL/HTTPS
- Use um gerenciador de processos (PM2/systemd)

## 📈 Roadmap

- [ ] Aplicativo mobile para gestão
- [ ] Suporte a mais formatos de mídia
- [ ] Analytics avançados
- [ ] Integração com redes sociais
- [ ] API pública para integrações
- [ ] Suporte a múltiplos idiomas

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

## 📞 Suporte

Para suporte técnico ou dúvidas, entre em contato através dos issues do GitHub.
