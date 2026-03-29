# Focus Timer — App Desktop (Electron)

Timer, agenda e post-its para desktop Linux.

---

## Pré-requisitos

- Node.js instalado (verifique com `node -v` no terminal)

---

## Como rodar (desenvolvimento)

```bash
# 1. Entre na pasta do projeto
cd focus-timer

# 2. Instale as dependências (só na primeira vez)
npm install

# 3. Inicie o app
npm start
```

O app vai abrir como uma janela desktop normal.

---

## Como gerar o instalador (.AppImage / .deb)

```bash
npm run build
```

Os arquivos gerados ficam na pasta `dist/`:
- `Focus Timer-1.0.0.AppImage` — executável portátil (não precisa instalar)
- `focus-timer_1.0.0_amd64.deb` — pacote Debian/Ubuntu

Para rodar o AppImage:
```bash
chmod +x "dist/Focus Timer-1.0.0.AppImage"
./dist/"Focus Timer-1.0.0.AppImage"
```

---

## Estrutura do projeto

```
focus-timer/
├── package.json   ← dependências e configuração do build
├── main.js        ← processo principal: janela, bandeja, notificações nativas
├── preload.js     ← ponte segura entre Electron e a interface
├── index.html     ← o app completo (HTML + CSS + JS)
└── README.md      ← este arquivo
```

---

## Funcionalidades

- **Timers** — múltiplos timers com contagem regressiva, únicos ou recorrentes
- **Sons** — 4 opções: Bipe, Sino, Digital, Suave
- **Agenda** — eventos com data, hora e categoria; alarme no horário
- **Recorrências** — diário, dias da semana, intervalo em horas, dia do mês
- **Post-its** — notas arrastáveis que ficam visíveis em qualquer aba
- **Notificações nativas** — alertas do sistema mesmo com a janela minimizada
- **Bandeja do sistema** — clique no ícone para mostrar/ocultar; fechar minimiza
- **Persistência** — tudo salvo automaticamente via localStorage

---

## Dicas

- Fechar a janela **não encerra o app** — ele vai para a bandeja
- Para sair completamente: clique direito no ícone da bandeja → Sair
- Os dados ficam salvos em `~/.config/focus-timer/` no Linux
