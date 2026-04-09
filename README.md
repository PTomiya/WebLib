# 📚 BiblioSys — Sistema de Gestão de Biblioteca

Sistema web completo para gerenciamento de biblioteca com login de funcionários,
cadastro de livros, pessoas, empréstimos e devoluções.

---

## 🚀 Como Rodar

### 1. Pré-requisitos
- Python 3.8 ou superior

### 2. Instalar dependências

```bash
pip install flask flask-cors
```

Ou usando o requirements.txt:

```bash
pip install -r requirements.txt
```

### 3. Iniciar o servidor

```bash
python app.py
```

### 4. Acessar no navegador

Abra: **http://localhost:5000**

---

## 🔐 Login Padrão

| Email | Senha |
|-------|-------|
| admin@biblioteca.com | admin123 |

---

## 📋 Funcionalidades

| Módulo | Funcionalidades |
|--------|----------------|
| **Dashboard** | Visão geral: livros emprestados, pendentes de devolução, total de livros e pessoas |
| **Livros** | Cadastrar, editar, excluir e buscar livros |
| **Pessoas** | Cadastrar, editar, excluir e buscar pessoas |
| **Empréstimos** | Registrar empréstimos (múltiplos livros), registrar devoluções, filtrar por status |
| **Funcionários** | Cadastrar, editar e excluir funcionários (somente admins) |

---

## 📁 Estrutura de Arquivos

```
biblioteca/
├── app.py              ← Backend Python (Flask + SQLite)
├── requirements.txt    ← Dependências Python
├── biblioteca.db       ← Banco de dados (gerado automaticamente)
└── static/
    ├── index.html      ← Interface principal
    ├── style.css       ← Estilos
    └── app.js          ← Lógica frontend
```

---

## 🛠️ Tecnologias

- **Backend**: Python + Flask + SQLite
- **Frontend**: HTML5 + CSS3 + JavaScript (puro, sem frameworks)
- **Fontes**: Playfair Display + DM Sans (Google Fonts)

---

## 📖 Banco de Dados (SQLite)

Tabelas criadas automaticamente:
- `funcionarios` — usuários do sistema
- `livros` — acervo da biblioteca
- `pessoas` — cadastro de usuários da biblioteca
- `emprestimos` — registro de empréstimos
- `emprestimo_livros` — relação livro↔empréstimo (múltiplos livros por empréstimo)
