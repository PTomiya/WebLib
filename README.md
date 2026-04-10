# 📚 BiblioSys — Sistema de Gestão de Biblioteca

Sistema web completo para gerenciamento de biblioteca com autenticação, controle de acervo, empréstimos, devoluções, renovações e impressão de comprovantes.

---

## 🚀 Como Rodar

### 1. Pré-requisitos
- Python 3.8 ou superior

### 2. Instalar dependência

```bash
pip install flask
```

### 3. Iniciar o servidor

```bash
cd C:\Users\Paulo\Desktop\WebLib
python app.py
```

### 4. Acessar no navegador

```
http://localhost:5000
```

---

## 🔐 Login Padrão

| Usuário | Senha    |
|---------|----------|
| admin   | admin123 |

> Usuários inativos não conseguem fazer login.

---

## 📁 Estrutura de Arquivos

```
WebLib\
├── app.py              ← Backend Python (Flask + SQLite)
├── biblioteca.db       ← Banco de dados (gerado automaticamente)
└── static\
    ├── index.html      ← Interface principal
    ├── style.css       ← Estilos (tema claro/escuro/sistema)
    └── app.js          ← Lógica frontend
```

---

## 📋 Funcionalidades

### 🔑 Autenticação
- Login com **usuário + senha** (sem email)
- Sessão mantida ao recarregar a página (sessionStorage)
- Logout com confirmação via modal do próprio sistema
- Usuários inativos são bloqueados no login

### 📊 Dashboard
- Contadores: livros emprestados, pendentes de devolução (atrasados), total de livros, pessoas cadastradas
- **Gráfico de rosca** com situação do acervo (disponíveis, emprestados em dia, atrasados)
- Ações rápidas: Livros, Pessoas, Empréstimos, Devoluções
- Card "Pendentes de Devolução" clicável — abre modal com lista de atrasados
- Empréstimos atrasados: busca por nome/data, ordenação múltipla, expansão para ver livros pendentes

### 📚 Livros
- Cadastrar, editar livros (título, autor, ISBN, editora, ano, estoque)
- Disponibilidade calculada automaticamente: `estoque − emprestados`
- Validação de estoque mínimo ao editar (não permite reduzir abaixo do total emprestado)
- Busca por título, autor, editora ou ano
- **Inativar / Reativar** livros — inativos ficam ocultos por padrão; checkbox "Mostrar inativos" exibe todos
- Exclusão bloqueada se houver empréstimos vinculados

### 👤 Pessoas
- Cadastrar, editar pessoas (nome, email, telefone, documento, endereço)
- Validação de formato de email
- **Campos obrigatórios configuráveis** (veja Configurações)
- **Inativar / Reativar** pessoas
- Exclusão bloqueada se houver empréstimos vinculados

### 🔖 Empréstimos
- Registrar empréstimos com múltiplos livros
- Busca de livros por título, autor, editora ou ano no modal
- **Devolução parcial**: escolher quais livros devolver individualmente
- **Renovação**: estender data de devolução
- **Reimprimir comprovante** 🖨️ disponível em todos os empréstimos (ativo, atrasado ou devolvido)
- Filtros: texto, data de empréstimo, data de devolução, status (todos/ativos/atrasados/devolvidos)
- Ordenação: mais recentes, mais antigos, nome A→Z, nome Z→A
- Paginação configurável

### 📋 Histórico
- Listagem completa de todos os livros emprestados (por livro)
- Filtros por texto, data de empréstimo e data de devolução
- Status: Devolvido, Atrasado, Em aberto
- Paginação configurável

### 🖨️ Comprovante de Empréstimo
- Preview na tela antes de imprimir
- Conteúdo: logo BiblioSys, dados do leitor, dados do empréstimo, tabela de livros, campo de assinatura (leitor + funcionário), declaração de recebimento
- Tipos: Renovação (badge azul) ou Empréstimo (badge escuro)
- Pergunta automática após novo empréstimo ou renovação
- Impressão limpa via iframe (sem menus ou sidebar)
- **Modelos**: Folha A4 ou Papel Térmico (80mm) — configurável

### 👥 Funcionários
- Cadastrar com nome, usuário, email, senha e perfil (Admin ou Funcionário)
- Usuário e email únicos
- **Permissões**: Funcionários comuns editam apenas o próprio perfil; apenas Admin cria, edita outros e exclui
- **Inativar / Reativar** funcionários
- Mostrar inativos via checkbox

### ⚙️ Configurações
- **Empréstimos**: dias padrão para devolução (prazo sugerido ao criar)
- **Campos Obrigatórios — Pessoa**: marcar quais campos (email, telefone, documento, endereço) são obrigatórios nos cadastros
- **Modelo de Impressão**: Folha A4 ou Papel Térmico (80mm)
- **Paginação**: 5, 10, 20, 50 ou 100 registros por página (afeta todas as listagens)
- Botão Salvar fica transparente enquanto não há alterações; ativa automaticamente ao modificar qualquer campo

### 🎨 Temas
- Claro (fundo RGB 239,236,237), Escuro e Seguir Sistema Operacional
- Seletor fixo no canto superior direito, visível em todas as páginas
- Preferência salva no localStorage

### 📱 Mobile (≤ 765px)
- Barra superior fixa com navegação rápida para: Livros, Pessoas, Empréstimos, Histórico
- Sidebar oculta; ações rápidas do dashboard também ocultas (já disponíveis na barra superior)

### 📄 Paginação
- Todas as listagens paginadas (Livros, Pessoas, Empréstimos, Histórico, Funcionários)
- Navegação com botões de página, indicador de posição e reticências para muitos páginas
- Quantidade configurável em Configurações (padrão: 10 por página)

---

## 🗄️ Banco de Dados (SQLite)

Tabelas criadas automaticamente com migração automática:

| Tabela | Descrição |
|--------|-----------|
| `funcionarios` | Usuários do sistema (username, email, senha, admin, inativo) |
| `livros` | Acervo da biblioteca (quantidade, disponível, inativo) |
| `pessoas` | Cadastro de leitores (inativo) |
| `emprestimos` | Cabeçalho dos empréstimos |
| `emprestimo_livros` | Livros por empréstimo (devolvido, data_devolucao) |
| `configuracoes` | Chave-valor para todas as configurações do sistema |

---

## 🛠️ Tecnologias

- **Backend**: Python 3 + Flask + SQLite (sem ORM, SQL puro)
- **Frontend**: HTML5 + CSS3 + JavaScript (vanilla, sem frameworks)
- **Gráfico**: Chart.js 4.4
- **Fontes**: Open Sans (Google Fonts)
