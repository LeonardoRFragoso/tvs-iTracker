# Setup de Produção com Chromecast

## Visão Geral

Este guia explica como configurar o sistema TVS Digital Signage para funcionar com dispositivos Chromecast em ambiente de produção.

## Pré-requisitos

### Hardware
- Dispositivos Chromecast (uma por TV)
- TVs com entrada HDMI
- Rede WiFi estável (mínimo 10 Mbps por dispositivo)
- Servidor para hospedar o sistema

### Software
- Conta Google Developer Console
- Certificado SSL (obrigatório para Cast API)
- Domínio público para Cast Receiver

## 1. Configuração do Google Cast

### 1.1 Registrar Cast Receiver App

1. Acesse [Google Cast Developer Console](https://cast.google.com/publish/)
2. Crie novo projeto "TVS Digital Signage"
3. Registre Cast Receiver App:
   - **Nome**: TVS Digital Signage
   - **URL**: `https://seudominio.com/cast-receiver.html`
   - **Categoria**: Media
4. Anote o **Application ID** gerado

### 1.2 Atualizar Cast Receiver

Edite `public/cast-receiver.html`:
```javascript
context.setOptions({
  receiverApplicationId: 'SEU_APPLICATION_ID_AQUI', // Substitua pelo ID real
  autoJoinPolicy: window.cast.framework.AutoJoinPolicy.ORIGIN_SCOPED
});
```

### 1.3 Configurar HTTPS

O Google Cast exige HTTPS. Configure certificado SSL:
```nginx
server {
    listen 443 ssl;
    server_name seudominio.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
    }
    
    location /api/ {
        proxy_pass http://localhost:5000;
    }
}
```

## 2. Setup Físico

### 2.1 Instalação dos Chromecasts

1. Conecte Chromecast na TV via HDMI
2. Configure WiFi usando Google Home app
3. Anote nome e IP de cada dispositivo
4. Teste conectividade: `ping IP_DO_CHROMECAST`

### 2.2 Configuração de Rede

**Requisitos de rede:**
- Todos os dispositivos na mesma VLAN
- Portas abertas: 8008, 8009 (Chromecast)
- mDNS habilitado para descoberta automática
- QoS configurado para priorizar tráfego de mídia

## 3. Configuração do Sistema

### 3.1 Aplicar Migração

Execute migração para suporte a Chromecast:
```bash
cd backend
python migrations/add_chromecast_support.py
```

### 3.2 Configurar Players

Para cada TV:

1. Acesse **Players** → **Novo Player**
2. Preencha informações básicas:
   - **Nome**: TV Recepção
   - **Localização**: Sede São Paulo
   - **Sala**: Recepção

3. Configure Chromecast:
   - **Chromecast ID**: `cc_recepcao_001`
   - **Nome do Chromecast**: TV Recepção
   - **Platform**: Chromecast

4. Salve e teste conexão

### 3.3 Descoberta Automática

O sistema pode descobrir Chromecasts automaticamente:

```bash
# Instalar dependência para descoberta mDNS
pip install zeroconf

# Executar scan
curl -X POST https://seudominio.com/api/cast/devices/scan
```

## 4. Operação

### 4.1 Conectar a Chromecast

1. Acesse **Players** → **Detalhes do Player**
2. Clique em **Conectar Cast**
3. Selecione dispositivo Chromecast
4. Aguarde confirmação de conexão

### 4.2 Enviar Conteúdo

```javascript
// Via API
POST /api/cast/players/PLAYER_ID/cast/load
{
  "content_url": "https://seudominio.com/api/content/media/video.mp4",
  "content_type": "video/mp4",
  "title": "Vídeo Institucional",
  "description": "Apresentação da empresa"
}
```

### 4.3 Controles Disponíveis

- **Play/Pause**: Controlar reprodução
- **Volume**: Ajustar volume do Chromecast
- **Next/Previous**: Navegar playlist
- **Stop**: Parar reprodução

## 5. Monitoramento

### 5.1 Status dos Dispositivos

```bash
# Verificar status de todos os Chromecasts
curl https://seudominio.com/api/cast/devices

# Status específico
curl https://seudominio.com/api/cast/players/PLAYER_ID/cast/status
```

### 5.2 Logs e Debug

Logs importantes:
- **Cast Receiver**: Console do navegador no Chromecast
- **Cast Sender**: Console do dashboard web
- **Backend**: Logs do Flask

## 6. Troubleshooting

### Problema: Chromecast não encontrado

**Solução:**
1. Verificar se está na mesma rede
2. Reiniciar Chromecast
3. Verificar firewall/portas bloqueadas

### Problema: Conteúdo não carrega

**Solução:**
1. Verificar HTTPS no servidor
2. Confirmar URLs de mídia acessíveis
3. Verificar CORS headers

### Problema: Comandos não funcionam

**Solução:**
1. Verificar WebSocket connection
2. Confirmar Application ID correto
3. Testar com Cast Receiver de desenvolvimento

## 7. Produção vs. Desenvolvimento

### Desenvolvimento
- Usar Default Media Receiver (`CC1AD845`)
- HTTP localhost permitido
- Cast Receiver local

### Produção
- Application ID personalizado obrigatório
- HTTPS obrigatório
- Cast Receiver em domínio público
- Certificados SSL válidos

## 8. Custos Estimados

**Por TV:**
- Chromecast: R$ 200-400
- Instalação: R$ 50
- **Total**: R$ 250-450 por TV

**Comparado com mini PCs:**
- Mini PC: R$ 800-1500
- **Economia**: 60-70% por dispositivo

## 9. Limitações

- Dependente de internet estável
- Requer rede WiFi robusta
- Limitado a formatos suportados pelo Chromecast
- Latência maior que players locais

## 10. Próximos Passos

1. Registrar Application ID no Google Cast Console
2. Configurar HTTPS em produção
3. Testar com dispositivos físicos
4. Implementar descoberta automática real
5. Adicionar métricas de performance Cast
