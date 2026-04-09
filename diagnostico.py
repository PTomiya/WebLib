import sqlite3
from datetime import date

conn = sqlite3.connect('biblioteca.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()
h = date.today().isoformat()

print('Hoje:', h)

c.execute("SELECT COUNT(*) as t FROM emprestimo_livros WHERE devolvido=0")
print('Livros emprestados:', c.fetchone()['t'])

c.execute("SELECT COUNT(DISTINCT e.id) as t FROM emprestimos e WHERE e.status='ativo' AND e.data_prevista_devolucao < ?", (h,))
print('Pendentes atrasados:', c.fetchone()['t'])

print()
print('Emprestimos ativos:')
c.execute("SELECT e.id, e.data_prevista_devolucao, e.status FROM emprestimos e WHERE e.status='ativo'")
for r in c.fetchall():
    print(' ', dict(r))

conn.close()
