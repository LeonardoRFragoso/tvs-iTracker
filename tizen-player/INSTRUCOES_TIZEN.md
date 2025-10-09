# Instruções para Configurar o iTracker TV Player em TVs Samsung Tizen

Este documento contém instruções detalhadas para configurar o player minimalista do iTracker em TVs Samsung com sistema Tizen.

## Requisitos

- TV Samsung com sistema Tizen (modelos a partir de 2015)
- Acesso ao navegador da TV
- Conexão à rede local onde o servidor iTracker está disponível
- Código de acesso do player (fornecido pelo administrador do sistema)

## Passo a Passo para Instalação

### 1. Acessar o Navegador da TV

1. Pressione o botão Home no controle remoto
2. Navegue até "APPS" ou "Aplicativos"
3. Localize e selecione o aplicativo "Internet" ou "Web Browser"

### 2. Acessar o Player

Existem duas formas de acessar o player:

#### Opção 1: Usando a Página de Entrada

1. Digite o endereço do servidor iTracker na barra de endereços do navegador:
   ```
   http://[ENDEREÇO_IP_DO_SERVIDOR]/tv
   ```
   Substitua `[ENDEREÇO_IP_DO_SERVIDOR]` pelo IP do seu servidor (ex: 192.168.0.4)

2. Na página de entrada, digite o código de acesso do player
3. Clique no botão "Acessar"

#### Opção 2: Usando o Link Direto

1. Digite o link direto com o código de acesso:
   ```
   http://[ENDEREÇO_IP_DO_SERVIDOR]/k/[CÓDIGO_DE_ACESSO]
   ```
   Substitua `[CÓDIGO_DE_ACESSO]` pelo código de 6 dígitos do player

### 3. Configurar para Inicialização Automática

Para que o player inicie automaticamente quando a TV for ligada:

1. Com o player aberto, pressione o botão de menu do navegador (geralmente nos três pontos ou no botão de opções)
2. Selecione "Adicionar aos Favoritos" ou "Adicionar à Tela Inicial"
3. Dê um nome como "iTracker TV Player"
4. Confirme a adição

5. Para configurar como página inicial:
   - Acesse as configurações do navegador
   - Procure a opção "Página Inicial" ou "Inicialização"
   - Selecione "Site específico" e digite o URL completo do player
   - Salve as configurações

6. Ative a opção "Iniciar o navegador automaticamente quando a TV ligar" (se disponível nas configurações do navegador)

### 4. Ajustes de Desempenho na TV

Para melhorar o desempenho do player na TV:

1. **Modo de Jogo/PC**: Ative o "Modo Jogo" ou "Modo PC" nas configurações de imagem da TV para reduzir o processamento de imagem e diminuir a latência

2. **Desativar Economia de Energia**: Nas configurações da TV, desative ou reduza as opções de economia de energia que possam fazer a tela escurecer ou desligar

3. **Limpar Cache do Navegador**: Periodicamente, limpe o cache do navegador através das configurações do aplicativo

4. **Atualizar Firmware**: Mantenha o firmware da TV atualizado para melhor compatibilidade com tecnologias web

## Solução de Problemas

### Tela Preta ou Conteúdo Não Carrega

- Verifique se a TV está conectada à mesma rede que o servidor iTracker
- Confirme que o código de acesso está correto
- Verifique se há conteúdo agendado para o player
- Tente limpar o cache do navegador

### Vídeos Não Reproduzem

- Verifique se os vídeos estão em formato compatível (MP4/H.264)
- Reduza a resolução dos vídeos se a TV tiver dificuldade para reproduzir
- Verifique se o volume está adequado (caso o áudio esteja habilitado)

### Problemas de Conexão

- Verifique a conexão Wi-Fi ou Ethernet da TV
- Confirme que o servidor iTracker está acessível na rede
- Reinicie o roteador e a TV

### Desempenho Lento

- Feche outros aplicativos que possam estar rodando na TV
- Reinicie o navegador ou a TV
- Reduza a resolução dos conteúdos se necessário

## Configurações Avançadas

Se necessário, você pode ajustar as configurações do player editando o arquivo `config.js`. Consulte o administrador do sistema para mais detalhes.

## Suporte

Em caso de problemas persistentes, entre em contato com o suporte técnico fornecendo:

1. Modelo exato da TV Samsung
2. Versão do sistema Tizen (pode ser encontrada nas configurações da TV)
3. Código de acesso do player
4. Descrição detalhada do problema
5. Fotos ou vídeos do problema, se possível
