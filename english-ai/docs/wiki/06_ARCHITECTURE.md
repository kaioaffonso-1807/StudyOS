# Arquitetura

## Componentes

### Mobile
Aplicativo React Native/Expo para iOS e Android.

### API
Backend TypeScript responsável por:
- autenticação e autorização
- regras de negócio
- limites
- billing
- integração com IA
- privacidade
- health/readiness

### Banco
Persistência de usuários, progresso, memória, erros e dados necessários ao produto.

### Serviços externos
Configurados somente em ambientes reais:
- autenticação/banco
- IA
- pagamentos
- infraestrutura

## Princípios
- Segredos fora do código
- Backend como autoridade para regras críticas
- Separação de ambientes
- CI como gate de qualidade
- Docker para portabilidade
