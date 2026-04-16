from flask import Flask, request, jsonify, send_from_directory, make_response
import sqlite3, hashlib
from datetime import date

app = Flask(__name__, static_folder='static')

@app.after_request
def add_cors(r):
    r.headers['Access-Control-Allow-Origin'] = '*'
    r.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    r.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    return r

@app.route('/api/<path:path>', methods=['OPTIONS'])
def opt(path): return make_response('', 204)

DB_PATH = 'biblioteca.db'
def get_db():
    c = sqlite3.connect(DB_PATH); c.row_factory = sqlite3.Row; return c

def init_db():
    conn = get_db(); c = conn.cursor()

    # funcionarios
    c.execute("PRAGMA table_info(funcionarios)")
    cols = [r['name'] for r in c.fetchall()]
    if 'email' in cols and 'username' not in cols:
        c.execute("ALTER TABLE funcionarios RENAME TO _func_old")
        c.execute('''CREATE TABLE funcionarios(id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,email TEXT UNIQUE,senha TEXT NOT NULL,
            admin INTEGER DEFAULT 0,criado_em TEXT DEFAULT CURRENT_TIMESTAMP)''')
        c.execute("INSERT INTO funcionarios(id,nome,username,email,senha,admin,criado_em) SELECT id,nome,email,email,senha,admin,criado_em FROM _func_old")
        c.execute("DROP TABLE _func_old")
    elif not cols:
        c.execute('''CREATE TABLE funcionarios(id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,email TEXT UNIQUE,senha TEXT NOT NULL,
            admin INTEGER DEFAULT 0,criado_em TEXT DEFAULT CURRENT_TIMESTAMP)''')
    else:
        if 'email' not in cols: c.execute("ALTER TABLE funcionarios ADD COLUMN email TEXT")

    c.execute('''CREATE TABLE IF NOT EXISTS livros(id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,autor TEXT NOT NULL,isbn TEXT,editora TEXT,ano INTEGER,
        quantidade INTEGER DEFAULT 1,disponivel INTEGER DEFAULT 1,criado_em TEXT DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS pessoas(id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,email TEXT,telefone TEXT,documento TEXT,endereco TEXT,
        criado_em TEXT DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS emprestimos(id INTEGER PRIMARY KEY AUTOINCREMENT,
        pessoa_id INTEGER NOT NULL,funcionario_id INTEGER NOT NULL,data_emprestimo TEXT NOT NULL,
        data_prevista_devolucao TEXT NOT NULL,data_devolucao TEXT,status TEXT DEFAULT 'ativo',
        FOREIGN KEY(pessoa_id) REFERENCES pessoas(id),FOREIGN KEY(funcionario_id) REFERENCES funcionarios(id))''')
    c.execute('''CREATE TABLE IF NOT EXISTS emprestimo_livros(id INTEGER PRIMARY KEY AUTOINCREMENT,
        emprestimo_id INTEGER NOT NULL,livro_id INTEGER NOT NULL,devolvido INTEGER DEFAULT 0,
        data_devolucao TEXT,FOREIGN KEY(emprestimo_id) REFERENCES emprestimos(id),
        FOREIGN KEY(livro_id) REFERENCES livros(id))''')

    c.execute("PRAGMA table_info(emprestimo_livros)")
    el = [r['name'] for r in c.fetchall()]
    if 'devolvido' not in el:
        c.execute("ALTER TABLE emprestimo_livros ADD COLUMN devolvido INTEGER DEFAULT 0")
        c.execute("ALTER TABLE emprestimo_livros ADD COLUMN data_devolucao TEXT")
        c.execute("UPDATE emprestimo_livros SET devolvido=1 WHERE emprestimo_id IN (SELECT id FROM emprestimos WHERE status='devolvido')")

    # Migração: coluna inativo em pessoas, livros e funcionarios
    for tbl, col in [('pessoas','inativo'),('livros','inativo'),('funcionarios','inativo')]:
        c.execute(f"PRAGMA table_info({tbl})")
        tc = [r['name'] for r in c.fetchall()]
        if col not in tc:
            c.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} INTEGER DEFAULT 0")

    # Configs de campos obrigatórios de pessoa
    for cfg in ['campo_obrig_email','campo_obrig_telefone','campo_obrig_documento','campo_obrig_endereco']:
        c.execute("INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES(?,?)", (cfg,'0'))

    # tabela de configurações
    c.execute('''CREATE TABLE IF NOT EXISTS configuracoes(chave TEXT PRIMARY KEY,valor TEXT)''')
    c.execute("INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES('dias_emprestimo','14')")
    c.execute("INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES('modelo_impressao','a4')")
    c.execute("INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES('paginacao','10')")

    h = hashlib.sha256('admin123'.encode()).hexdigest()
    c.execute("INSERT OR IGNORE INTO funcionarios(nome,username,email,senha,admin) VALUES(?,?,?,?,?)",
              ('Administrador','admin','admin@biblioteca.com',h,1))
    conn.commit(); conn.close()

def hs(s): return hashlib.sha256(s.encode()).hexdigest()

# ── AUTH ──
@app.route('/api/login', methods=['POST'])
def login():
    d = request.json; conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM funcionarios WHERE username=? AND senha=?", (d['username'], hs(d['senha'])))
    f = c.fetchone(); conn.close()
    if f:
        if f['inativo']:
            return jsonify({'ok':False,'msg':'Usuário inativo. Contate o administrador.'}), 401
        return jsonify({'ok':True,'funcionario':{'id':f['id'],'nome':f['nome'],'username':f['username'],'email':f['email'] or '','admin':f['admin']}})
    return jsonify({'ok':False,'msg':'Usuário ou senha inválidos'}), 401

# ── DASHBOARD ──
@app.route('/api/dashboard')
def dashboard():
    conn = get_db(); c = conn.cursor(); h = date.today().isoformat()
    c.execute("SELECT COUNT(*) as t FROM emprestimo_livros WHERE devolvido=0"); emp = c.fetchone()['t']
    c.execute("SELECT COUNT(DISTINCT e.id) as t FROM emprestimos e WHERE e.status='ativo' AND e.data_prevista_devolucao<?", (h,)); pend = c.fetchone()['t']
    c.execute("SELECT COALESCE(SUM(quantidade),0) as t FROM livros"); tl = c.fetchone()['t']
    c.execute("SELECT COUNT(*) as t FROM pessoas"); tp = c.fetchone()['t']
    conn.close()
    return jsonify({'emprestados':emp,'pendentes':pend,'total_livros':tl,'total_pessoas':tp})

# ── CONFIGURAÇÕES ──
@app.route('/api/configuracoes')
def get_config():
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT chave,valor FROM configuracoes")
    cfg = {r['chave']:r['valor'] for r in c.fetchall()}; conn.close()
    return jsonify(cfg)

@app.route('/api/configuracoes', methods=['POST'])
def set_config():
    data = request.json; conn = get_db(); c = conn.cursor()
    for k,v in data.items():
        c.execute("INSERT OR REPLACE INTO configuracoes(chave,valor) VALUES(?,?)", (k,str(v)))
    conn.commit(); conn.close(); return jsonify({'ok':True})

# ── EMPRÉSTIMOS ATRASADOS ──
@app.route('/api/emprestimos/atrasados')
def emprestimos_atrasados():
    conn = get_db(); c = conn.cursor(); h = date.today().isoformat()
    c.execute('''SELECT e.id,p.nome as pessoa_nome,f.nome as funcionario_nome,
                 e.data_emprestimo,e.data_prevista_devolucao,e.status
                 FROM emprestimos e JOIN pessoas p ON e.pessoa_id=p.id
                 JOIN funcionarios f ON e.funcionario_id=f.id
                 WHERE e.status='ativo' AND e.data_prevista_devolucao<? ORDER BY e.data_prevista_devolucao ASC''', (h,))
    emp = []
    for r in c.fetchall():
        row = dict(r); c2 = conn.cursor()
        c2.execute("SELECT l.id,l.titulo,el.devolvido FROM emprestimo_livros el JOIN livros l ON el.livro_id=l.id WHERE el.emprestimo_id=? AND el.devolvido=0", (row['id'],))
        row['livros'] = [{'id':x['id'],'titulo':x['titulo']} for x in c2.fetchall()]
        if row['livros']: emp.append(row)
    conn.close(); return jsonify(emp)

# ── HISTÓRICO ──
@app.route('/api/historico')
def historico():
    conn = get_db(); c = conn.cursor()
    c.execute('''SELECT el.id, p.nome as pessoa_nome, l.titulo as livro_titulo,
                 e.data_emprestimo, el.data_devolucao, el.devolvido,
                 e.data_prevista_devolucao, e.id as emprestimo_id
                 FROM emprestimo_livros el
                 JOIN emprestimos e ON el.emprestimo_id=e.id
                 JOIN pessoas p ON e.pessoa_id=p.id
                 JOIN livros l ON el.livro_id=l.id
                 ORDER BY e.data_emprestimo DESC''')
    rows = [dict(r) for r in c.fetchall()]; conn.close()
    return jsonify(rows)

# ── LIVROS ──
@app.route('/api/livros')
def listar_livros():
    conn = get_db(); c = conn.cursor()
    incl = request.args.get('inativos','0')
    cond = "" if incl=='1' else "WHERE l.inativo=0"
    order = "ORDER BY l.inativo, l.titulo" if incl=='1' else "ORDER BY l.titulo"
    c.execute(f'''SELECT l.*,(l.quantidade-COALESCE((SELECT COUNT(*) FROM emprestimo_livros el WHERE el.livro_id=l.id AND el.devolvido=0),0)) as disponivel FROM livros l {cond} {order}''')
    r = [dict(x) for x in c.fetchall()]; conn.close(); return jsonify(r)

@app.route('/api/livros/<int:lid>/inativar', methods=['POST'])
def inativar_livro(lid):
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE livros SET inativo=1 WHERE id=?", (lid,))
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/livros/<int:lid>/reativar', methods=['POST'])
def reativar_livro(lid):
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE livros SET inativo=0 WHERE id=?", (lid,))
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/livros', methods=['POST'])
def criar_livro():
    d = request.json; conn = get_db(); c = conn.cursor(); q = d.get('quantidade',1)
    c.execute("INSERT INTO livros(titulo,autor,isbn,editora,ano,quantidade,disponivel) VALUES(?,?,?,?,?,?,?)",
              (d['titulo'],d['autor'],d.get('isbn',''),d.get('editora',''),d.get('ano'),q,q))
    conn.commit(); lid = c.lastrowid; conn.close(); return jsonify({'ok':True,'id':lid})

@app.route('/api/livros/<int:lid>', methods=['PUT'])
def editar_livro(lid):
    d = request.json; conn = get_db(); c = conn.cursor(); nq = int(d.get('quantidade',1))
    c.execute("SELECT COUNT(*) as t FROM emprestimo_livros el WHERE el.livro_id=? AND el.devolvido=0", (lid,))
    em = c.fetchone()['t']
    if nq < em: conn.close(); return jsonify({'ok':False,'msg':f'Há {em} exemplar(es) emprestado(s). Mínimo: {em}.'}), 400
    c.execute("UPDATE livros SET titulo=?,autor=?,isbn=?,editora=?,ano=?,quantidade=?,disponivel=? WHERE id=?",
              (d['titulo'],d['autor'],d.get('isbn',''),d.get('editora',''),d.get('ano'),nq,nq-em,lid))
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/livros/<int:lid>', methods=['DELETE'])
def deletar_livro(lid):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT COUNT(*) as t FROM emprestimo_livros WHERE livro_id=?", (lid,))
    if c.fetchone()['t']>0: conn.close(); return jsonify({'ok':False,'msg':'Livro possui empréstimos e não pode ser excluído.'}), 400
    c.execute("DELETE FROM livros WHERE id=?", (lid,)); conn.commit(); conn.close(); return jsonify({'ok':True})

# ── PESSOAS ──
@app.route('/api/pessoas')
def listar_pessoas():
    conn = get_db(); c = conn.cursor()
    incl = request.args.get('inativos','0')
    if incl == '1':
        c.execute("SELECT * FROM pessoas ORDER BY COALESCE(inativo,0), nome")
    else:
        c.execute("SELECT * FROM pessoas WHERE COALESCE(inativo,0)=0 ORDER BY nome")
    r = [dict(x) for x in c.fetchall()]; conn.close(); return jsonify(r)

@app.route('/api/pessoas', methods=['POST'])
def criar_pessoa():
    d = request.json; conn = get_db(); c = conn.cursor()
    c.execute("INSERT INTO pessoas(nome,email,telefone,documento,endereco) VALUES(?,?,?,?,?)",
              (d['nome'],d.get('email',''),d.get('telefone',''),d.get('documento',''),d.get('endereco','')))
    conn.commit(); pid = c.lastrowid; conn.close(); return jsonify({'ok':True,'id':pid})

@app.route('/api/pessoas/<int:pid>', methods=['PUT'])
def editar_pessoa(pid):
    d = request.json; conn = get_db(); c = conn.cursor()
    c.execute("UPDATE pessoas SET nome=?,email=?,telefone=?,documento=?,endereco=? WHERE id=?",
              (d['nome'],d.get('email',''),d.get('telefone',''),d.get('documento',''),d.get('endereco',''),pid))
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/pessoas/<int:pid>', methods=['DELETE'])
def deletar_pessoa(pid):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT COUNT(*) as t FROM emprestimos WHERE pessoa_id=?", (pid,))
    if c.fetchone()['t']>0: conn.close(); return jsonify({'ok':False,'msg':'Pessoa possui empréstimos e não pode ser excluída.'}), 400
    c.execute("DELETE FROM pessoas WHERE id=?", (pid,)); conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/pessoas/<int:pid>/inativar', methods=['POST'])
def inativar_pessoa(pid):
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE pessoas SET inativo=1 WHERE id=?", (pid,))
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/pessoas/<int:pid>/reativar', methods=['POST'])
def reativar_pessoa(pid):
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE pessoas SET inativo=0 WHERE id=?", (pid,))
    conn.commit(); conn.close(); return jsonify({'ok':True})

# ── EMPRÉSTIMOS ──
@app.route('/api/emprestimos')
def listar_emprestimos():
    conn = get_db(); c = conn.cursor()
    c.execute('''SELECT e.id,p.nome as pessoa_nome,f.nome as funcionario_nome,
                 e.data_emprestimo,e.data_prevista_devolucao,e.data_devolucao,e.status
                 FROM emprestimos e JOIN pessoas p ON e.pessoa_id=p.id
                 JOIN funcionarios f ON e.funcionario_id=f.id ORDER BY e.data_emprestimo DESC''')
    emp = []
    for r in c.fetchall():
        row = dict(r); c2 = conn.cursor()
        c2.execute("SELECT el.id,l.titulo,el.devolvido,el.data_devolucao FROM emprestimo_livros el JOIN livros l ON el.livro_id=l.id WHERE el.emprestimo_id=?", (row['id'],))
        row['livros'] = [dict(x) for x in c2.fetchall()]; emp.append(row)
    conn.close(); return jsonify(emp)

@app.route('/api/emprestimos', methods=['POST'])
def criar_emprestimo():
    d = request.json; conn = get_db(); c = conn.cursor()
    for lid in d['livros']:
        c.execute("SELECT (l.quantidade-COALESCE((SELECT COUNT(*) FROM emprestimo_livros el WHERE el.livro_id=l.id AND el.devolvido=0),0)) as disp FROM livros l WHERE l.id=?", (lid,))
        l = c.fetchone()
        if not l or l['disp']<1: conn.close(); return jsonify({'ok':False,'msg':f'Livro ID {lid} não disponível'}), 400
    h = date.today().isoformat()
    c.execute("INSERT INTO emprestimos(pessoa_id,funcionario_id,data_emprestimo,data_prevista_devolucao) VALUES(?,?,?,?)",
              (d['pessoa_id'],d['funcionario_id'],h,d['data_prevista_devolucao']))
    eid = c.lastrowid
    for lid in d['livros']:
        c.execute("INSERT INTO emprestimo_livros(emprestimo_id,livro_id,devolvido) VALUES(?,?,0)", (eid,lid))
        c.execute("UPDATE livros SET disponivel=quantidade-(SELECT COUNT(*) FROM emprestimo_livros el WHERE el.livro_id=livros.id AND el.devolvido=0) WHERE id=?", (lid,))
    conn.commit(); conn.close(); return jsonify({'ok':True,'id':eid})

@app.route('/api/emprestimos/<int:eid>', methods=['DELETE'])
def deletar_emprestimo(eid):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT COUNT(*) as t FROM emprestimo_livros WHERE emprestimo_id=? AND devolvido=1", (eid,))
    if c.fetchone()['t']>0: conn.close(); return jsonify({'ok':False,'msg':'Empréstimo possui devoluções parciais e não pode ser excluído.'}), 400
    # Restaurar disponibilidade dos livros
    c.execute("SELECT livro_id FROM emprestimo_livros WHERE emprestimo_id=?", (eid,))
    for row in c.fetchall():
        c.execute("UPDATE livros SET disponivel=quantidade-(SELECT COUNT(*) FROM emprestimo_livros el WHERE el.livro_id=livros.id AND el.devolvido=0 AND el.emprestimo_id!=?) WHERE id=?", (eid,row['livro_id']))
    c.execute("DELETE FROM emprestimo_livros WHERE emprestimo_id=?", (eid,))
    c.execute("DELETE FROM emprestimos WHERE id=?", (eid,))
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/emprestimos/<int:eid>/devolver-livro', methods=['POST'])
def devolver_livro(eid):
    d = request.json; el_id = d.get('emprestimo_livro_id')
    conn = get_db(); c = conn.cursor(); h = date.today().isoformat()
    c.execute("SELECT livro_id FROM emprestimo_livros WHERE id=? AND emprestimo_id=?", (el_id,eid))
    row = c.fetchone()
    if not row: conn.close(); return jsonify({'ok':False,'msg':'Não encontrado'}), 404
    lid = row['livro_id']
    c.execute("UPDATE emprestimo_livros SET devolvido=1,data_devolucao=? WHERE id=?", (h,el_id))
    c.execute("UPDATE livros SET disponivel=quantidade-(SELECT COUNT(*) FROM emprestimo_livros el WHERE el.livro_id=livros.id AND el.devolvido=0) WHERE id=?", (lid,))
    c.execute("SELECT COUNT(*) as t FROM emprestimo_livros WHERE emprestimo_id=? AND devolvido=0", (eid,))
    rest = c.fetchone()['t']
    if rest==0: c.execute("UPDATE emprestimos SET status='devolvido',data_devolucao=? WHERE id=?", (h,eid))
    conn.commit(); conn.close(); return jsonify({'ok':True,'todos_devolvidos':rest==0})

@app.route('/api/emprestimos/<int:eid>/devolver', methods=['POST'])
def devolver_emprestimo(eid):
    conn = get_db(); c = conn.cursor(); h = date.today().isoformat()
    c.execute("SELECT livro_id,id FROM emprestimo_livros WHERE emprestimo_id=? AND devolvido=0", (eid,))
    for row in c.fetchall():
        c.execute("UPDATE emprestimo_livros SET devolvido=1,data_devolucao=? WHERE id=?", (h,row['id']))
        c.execute("UPDATE livros SET disponivel=quantidade-(SELECT COUNT(*) FROM emprestimo_livros el WHERE el.livro_id=livros.id AND el.devolvido=0) WHERE id=?", (row['livro_id'],))
    c.execute("UPDATE emprestimos SET status='devolvido',data_devolucao=? WHERE id=?", (h,eid))
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/emprestimos/<int:eid>/renovar', methods=['POST'])
def renovar_emprestimo(eid):
    d = request.json; nd = d.get('nova_data')
    if not nd: return jsonify({'ok':False,'msg':'Informe a nova data'}), 400
    if nd<=date.today().isoformat(): return jsonify({'ok':False,'msg':'Data deve ser futura'}), 400
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT status FROM emprestimos WHERE id=?", (eid,))
    e = c.fetchone()
    if not e or e['status']!='ativo': conn.close(); return jsonify({'ok':False,'msg':'Empréstimo não ativo'}), 400
    c.execute("UPDATE emprestimos SET data_prevista_devolucao=? WHERE id=?", (nd,eid))
    conn.commit(); conn.close(); return jsonify({'ok':True})

# ── FUNCIONÁRIOS ──
@app.route('/api/funcionarios')
def listar_funcionarios():
    conn = get_db(); c = conn.cursor()
    incl = request.args.get('inativos','0')
    if incl == '1':
        c.execute("SELECT id,nome,username,email,admin,COALESCE(inativo,0) as inativo,criado_em FROM funcionarios ORDER BY inativo, nome")
    else:
        c.execute("SELECT id,nome,username,email,admin,COALESCE(inativo,0) as inativo,criado_em FROM funcionarios WHERE COALESCE(inativo,0)=0 ORDER BY nome")
    r = [dict(x) for x in c.fetchall()]; conn.close(); return jsonify(r)

@app.route('/api/funcionarios', methods=['POST'])
def criar_funcionario():
    d = request.json; conn = get_db(); c = conn.cursor()
    c.execute("SELECT id FROM funcionarios WHERE username=?", (d['username'],))
    if c.fetchone(): conn.close(); return jsonify({'ok':False,'msg':'Nome de usuário já cadastrado'}), 400
    email = (d.get('email') or '').strip()
    if email:
        c.execute("SELECT id FROM funcionarios WHERE email=?", (email,))
        if c.fetchone(): conn.close(); return jsonify({'ok':False,'msg':'Email já cadastrado'}), 400
    try:
        c.execute("INSERT INTO funcionarios(nome,username,email,senha,admin) VALUES(?,?,?,?,?)",
                  (d['nome'],d['username'],email or None,hs(d['senha']),d.get('admin',0)))
        conn.commit(); fid = c.lastrowid; conn.close(); return jsonify({'ok':True,'id':fid})
    except sqlite3.IntegrityError:
        conn.close(); return jsonify({'ok':False,'msg':'Usuário ou email já cadastrado'}), 400

@app.route('/api/funcionarios/<int:fid>', methods=['PUT'])
def editar_funcionario(fid):
    d = request.json; conn = get_db(); c = conn.cursor()
    sol_id = d.get('solicitante_id'); sol_admin = d.get('solicitante_admin',False)
    if not sol_admin and sol_id!=fid: conn.close(); return jsonify({'ok':False,'msg':'Sem permissão'}), 403
    c.execute("SELECT id FROM funcionarios WHERE username=? AND id!=?", (d['username'],fid))
    if c.fetchone(): conn.close(); return jsonify({'ok':False,'msg':'Usuário já cadastrado'}), 400
    email = (d.get('email') or '').strip()
    if email:
        c.execute("SELECT id FROM funcionarios WHERE email=? AND id!=?", (email,fid))
        if c.fetchone(): conn.close(); return jsonify({'ok':False,'msg':'Email já cadastrado'}), 400
    if sol_admin: admin_val = d.get('admin',0)
    else:
        c.execute("SELECT admin FROM funcionarios WHERE id=?", (fid,)); admin_val = c.fetchone()['admin']
    try:
        if d.get('senha'):
            c.execute("UPDATE funcionarios SET nome=?,username=?,email=?,senha=?,admin=? WHERE id=?",
                      (d['nome'],d['username'],email or None,hs(d['senha']),admin_val,fid))
        else:
            c.execute("UPDATE funcionarios SET nome=?,username=?,email=?,admin=? WHERE id=?",
                      (d['nome'],d['username'],email or None,admin_val,fid))
        conn.commit(); conn.close(); return jsonify({'ok':True})
    except sqlite3.IntegrityError:
        conn.close(); return jsonify({'ok':False,'msg':'Usuário ou email já cadastrado'}), 400

@app.route('/api/funcionarios/<int:fid>', methods=['DELETE'])
def deletar_funcionario(fid):
    conn = get_db(); c = conn.cursor()
    c.execute("DELETE FROM funcionarios WHERE id=?", (fid,)); conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/funcionarios/<int:fid>/inativar', methods=['POST'])
def inativar_funcionario(fid):
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE funcionarios SET inativo=1 WHERE id=?", (fid,))
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/funcionarios/<int:fid>/reativar', methods=['POST'])
def reativar_funcionario(fid):
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE funcionarios SET inativo=0 WHERE id=?", (fid,))
    conn.commit(); conn.close(); return jsonify({'ok':True})

@app.route('/api/verificar-sessao', methods=['POST'])
def verificar_sessao():
    d = request.json
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT COALESCE(inativo,0) as inativo FROM funcionarios WHERE id=?", (d.get('id'),))
    f = c.fetchone(); conn.close()
    if not f: return jsonify({'ok': False}), 404
    if f['inativo']: return jsonify({'ok': False, 'inativo': True}), 401
    return jsonify({'ok': True})

@app.route('/')
def index(): return send_from_directory('static','index.html')
@app.route('/<path:path>')
def static_files(path): return send_from_directory('static',path)

if __name__ == '__main__':
    init_db(); app.run(debug=True, port=5000)
