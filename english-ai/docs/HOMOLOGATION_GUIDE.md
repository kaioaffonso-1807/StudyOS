# StudyOS — Guia de Homologação Local

## Objetivo
Executar o StudyOS localmente e validar os fluxos que não dependem de serviços externos reais.

## Pré-requisitos
- Node.js 22+
- Git
- Android Studio com um emulador **ou** Android físico
- Computador e celular na mesma rede para teste físico

## 1. Clonar e instalar
```bash
git clone https://github.com/kaioaffonso-1807/StudyOS.git
cd StudyOS/english-ai/apps/api
npm install
```

## 2. Configurar API
Copie `.env.example` para `.env`.

Para homologação sem Supabase/Stripe:
- `AUTH_REQUIRED=false`
- `BILLING_ENABLED=false`

Não adicione segredos reais.

## 3. Rodar API
```bash
npm run dev
```

Validar:
```
http://localhost:4000/health
```

## 4. Rodar testes da API
```bash
npm test
npm run typecheck
npm run build
```

## 5. Configurar Mobile
```bash
cd ../mobile
npm install
copy .env.example .env
```

### Importante para Android físico
`localhost` no celular aponta para o próprio celular. Configure `EXPO_PUBLIC_API_URL` com o IP LAN do computador, por exemplo:

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000
```

## 6. Rodar o aplicativo
Emulador Android:
```bash
npm run android
```

Ou iniciar o Expo:
```bash
npm start
```

## Resultado esperado
A homologação deve registrar cada teste como PASSOU, FALHOU ou BLOQUEADO.
