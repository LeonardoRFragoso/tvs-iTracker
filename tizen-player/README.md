# iTracker TV Player - Versão Tizen

Player minimalista para TVs Samsung com sistema Tizen, otimizado para exibição de conteúdo do sistema TVs iTracker.

## Características

- **Compatibilidade com TVs antigas**: Desenvolvido especificamente para TVs Samsung com sistema Tizen
- **Tecnologia minimalista**: Utiliza apenas HTML e JavaScript nativo, sem dependências externas
- **Baixo consumo de recursos**: Otimizado para TVs com hardware limitado
- **Suporte completo**: Reproduz vídeos e imagens conforme agendamento
- **Comunicação com backend**: Integração com a API do TVs iTracker
- **Telemetria**: Envia eventos de reprodução para monitoramento
- **Recuperação automática**: Tratamento de erros e reconexão automática

## Arquivos

- `entrada.html` - Página inicial para inserir código de acesso
- `index.html` - Player principal
- `player.js` - Lógica de reprodução e comunicação com API

## Como usar

### Método 1: Acesso por código

1. Abra o arquivo `entrada.html` no navegador da TV
2. Digite o código de acesso do player (fornecido pelo administrador)
3. Clique em "Acessar"

### Método 2: Acesso direto

Acesse diretamente através de uma das URLs:

- `index.html?code=CODIGO` - Usando código de acesso
- `index.html?id=ID_DO_PLAYER` - Usando ID do player

### Configuração em TVs Samsung Tizen

1. Abra o navegador da TV Samsung
2. Acesse a URL onde o player está hospedado
3. Adicione aos favoritos para fácil acesso
4. Para inicialização automática, configure o navegador para abrir o favorito ao iniciar

## Solução de problemas

### Tela preta ou conteúdo não carrega

- Verifique se o código de acesso está correto
- Certifique-se de que há conteúdo agendado para o player
- Verifique a conexão com a internet

### Vídeos não reproduzem

- Verifique se o formato do vídeo é compatível com a TV (recomendado: MP4 com codec H.264)
- Reduza a resolução do vídeo se a TV tiver dificuldade para reproduzir

### Problemas de conexão

- O player tentará reconectar automaticamente em caso de falhas
- Verifique se o backend está acessível na rede da TV

## Limitações conhecidas

- Não suporta streaming adaptativo (HLS, DASH)
- Não suporta conteúdo com DRM
- Performance limitada para vídeos de alta resolução (4K)
- Sem suporte a efeitos de transição complexos

## Teclas de atalho

- **F** - Alternar modo tela cheia
- **ESC** - Sair do modo tela cheia
