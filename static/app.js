const API = 'http://localhost:5000/api';
let sessao = null;
let todosLivros=[], todasPessoas=[], todosEmprestimos=[], todosAtrasados=[], todoHistorico=[];
let graficoRosca = null;
let livrosEmpCache = [];
let _confirmResolve = null;
let diasPadraoEmp = 14;
let itensPorPagina = 10;
const _pagAtual = { livros:1, pessoas:1, emprestimos:1, historico:1, funcionarios:1 };
let _listaFiltradaLivros=[], _listaFiltradaPessoas=[], _listaFiltradaEmp=[], _listaFiltradaHist=[], _listaFiltradaFunc=[];

/* ==LIMPA DATA FILTRO== */
function limparData(id) {
  var el = document.getElementById(id);
  if (el) { el.value = ''; el.dispatchEvent(new Event('change')); }
}
function limparDataFiltro(inputId, painelId, badgeId) {
  var el = document.getElementById(inputId);
  if (el) { el.value = ''; el.dispatchEvent(new Event('change')); }
  atualizarBadge(painelId, badgeId);
}
function toggleFiltros(painelId) {
  var painel = document.getElementById(painelId);
  var btnId = painelId.replace('filtros-','btn-filtros-');
  var btn = document.getElementById(btnId);
  if (!painel) return;
  var aberto = !painel.classList.contains('hidden');
  painel.classList.toggle('hidden', aberto);
  if (btn) btn.classList.toggle('ativo', !aberto);
}
function atualizarBadge(painelId, badgeId) {
  var badge = document.getElementById(badgeId);
  if (!badge) return;
  var painel = document.getElementById(painelId);
  if (!painel) return;
  var temFiltro = false;
  painel.querySelectorAll('input[type="date"]').forEach(function(el){ if(el.value) temFiltro=true; });
  painel.querySelectorAll('select').forEach(function(el){ if(el.value && el.value!=='todos') temFiltro=true; });
  badge.classList.toggle('hidden', !temFiltro);
  var btnId = painelId.replace('filtros-','btn-filtros-');
  var btn = document.getElementById(btnId);
  if (btn) btn.classList.toggle('ativo', temFiltro);
}
function limparTodosFiltros(painelId, badgeId) {
  var painel = document.getElementById(painelId);
  if (!painel) return;
  painel.querySelectorAll('input[type="date"]').forEach(function(el){ el.value=''; });
  painel.querySelectorAll('select').forEach(function(el){ el.selectedIndex=0; });
  atualizarBadge(painelId, badgeId);
  // Trigger appropriate filter function
  if(painelId.includes('emp')) aplicarFiltrosEmp();
  else if(painelId.includes('hist')) filtrarHistorico();
}
/* ══ TEMA ══ */
function setTema(t) {
  localStorage.setItem('bsys_tema', t); aplicarTema(t);
}
function aplicarTema(t) {
  const escuro = t==='dark' || (t==='system' && window.matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.setAttribute('data-theme', escuro?'dark':'light');
  // Destacar botão ativo
  ['light','dark','system'].forEach(id => {
    const btn = document.getElementById(`tema-${id}`);
    if (btn) btn.classList.toggle('active', id===t);
  });
  if (graficoRosca) setTimeout(atualizarCoresGrafico, 50);
}
window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => {
  if (localStorage.getItem('bsys_tema')==='system') aplicarTema('system');
});

/* ══ UTILS ══ */
function toast(msg, tipo='success') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast ${tipo}`; el.classList.remove('hidden');
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.add('hidden'), 3800);
}
function abrirModal(id) { document.getElementById(id).classList.remove('hidden'); }
function fecharModal(id) { document.getElementById(id).classList.add('hidden'); }
function fmtData(s) { if(!s) return '–'; const [y,m,d]=s.split('-'); return `${d}/${m}/${y}`; }
function hoje() { return new Date().toISOString().split('T')[0]; }
function diasAtraso(dv) { const v=new Date(dv+'T00:00:00'),n=new Date(); n.setHours(0,0,0,0); return Math.floor((n-v)/86400000); }
function validarEmail(e) { return !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/* ══ PAGINAÇÃO ══ */
function paginar(lista, pagina) {
  const total = lista.length;
  const totalPags = Math.max(1, Math.ceil(total / itensPorPagina));
  const pag = Math.min(Math.max(1, pagina), totalPags);
  const inicio = (pag - 1) * itensPorPagina;
  const fim = Math.min(inicio + itensPorPagina, total);
  return { itens: lista.slice(inicio, fim), pag, totalPags, total, inicio, fim };
}

function renderPaginacao(barId, secao, pag, totalPags, total, inicio, fim) {
  var bar = document.getElementById(barId);
  if (!bar) return;
  if (total === 0) { bar.innerHTML = ''; return; }
  var info = 'Mostrando ' + (inicio+1) + '\u2013' + fim + ' de ' + total + ' registros';
  var btns = '';
  btns += '<button class="pag-btn" onclick="irPagina(\'' + secao + '\',' + (pag-1) + ')" ' + (pag<=1?'disabled':'') + '>\u2039</button>';
  var delta = 2;
  var pages = [1];
  for (var i = Math.max(1, pag-delta); i <= Math.min(totalPags, pag+delta); i++) {
    if (pages.indexOf(i) === -1) pages.push(i);
  }
  if (pages.indexOf(totalPags) === -1) pages.push(totalPags);
  pages.sort(function(a,b){return a-b;});
  var prev = 0;
  pages.forEach(function(p) {
    if (prev && p - prev > 1) btns += '<span class="pag-btn" style="cursor:default;border:none;opacity:.4">\u2026</span>';
    btns += '<button class="pag-btn' + (p===pag?' active':'') + '" onclick="irPagina(\'' + secao + '\',' + p + ')">' + p + '</button>';
    prev = p;
  });
  btns += '<button class="pag-btn" onclick="irPagina(\'' + secao + '\',' + (pag+1) + ')" ' + (pag>=totalPags?'disabled':'') + '>\u203a</button>';
  bar.innerHTML = '<span class="pag-info">' + info + '</span><div class="pag-btns">' + btns + '</div>';
}

function irPagina(secao, pag) {
  _pagAtual[secao] = pag;
  if (secao==='livros') renderLivros(_listaFiltradaLivros);
  else if (secao==='pessoas') renderPessoas(_listaFiltradaPessoas);
  else if (secao==='emprestimos') renderEmprestimos(_listaFiltradaEmp);
  else if (secao==='historico') _renderHistoricoLista(_listaFiltradaHist);
  else if (secao==='funcionarios') _renderFuncionariosLista(_listaFiltradaFunc);
}

function getCssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function addDias(base, dias) {
  const d = new Date(base+'T00:00:00'); d.setDate(d.getDate()+dias);
  return d.toISOString().split('T')[0];
}

/* ══ CONFIRM ══ */
function confirmar(titulo, msg, btnLabel='Confirmar') {
  return new Promise(res => {
    _confirmResolve = res;
    document.getElementById('confirm-titulo').textContent = titulo;
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-sim').textContent = btnLabel;
    abrirModal('modal-confirm');
  });
}
function resolverConfirm(val) {
  fecharModal('modal-confirm');
  if (_confirmResolve) { _confirmResolve(val); _confirmResolve=null; }
}

/* ══ SESSÃO ══ */
function aplicarSessao(f) {
  sessao = f;
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-app').classList.add('active');
  document.getElementById('user-nome').textContent = f.nome;
  document.getElementById('user-email').textContent = '@'+f.username;
  document.getElementById('user-avatar').textContent = f.nome[0].toUpperCase();
  // Mobile topbar user info
  var ma=document.getElementById('mob-avatar'), mn=document.getElementById('mob-nome'), me=document.getElementById('mob-email');
  if(ma) ma.textContent=f.nome[0].toUpperCase();
  if(mn) mn.textContent=f.nome;
  if(me) me.textContent='@'+f.username;
  // Mobile nav: hide funcionarios/config for non-admin
  var mf=document.getElementById('mob-nav-func'), mc=document.getElementById('mob-nav-config');
  if(mf) mf.style.display='';
  if(mc) mc.style.display=f.admin?'':'none';
  // Config e funcionários: qualquer um acessa, mas controle dentro da página
  document.getElementById('nav-config').style.display = f.admin ? '' : 'none';
  document.getElementById('nav-funcionarios').style.display = '';
  iniciarDashboardData();
  carregarDashboard(); carregarLivros(); carregarPessoas(); carregarConfig();
}
function salvarSessaoLocal(f) { sessionStorage.setItem('bsys', JSON.stringify(f)); }
function limparSessaoLocal() { sessionStorage.removeItem('bsys'); }
function recuperarSessaoLocal() { try { const d=sessionStorage.getItem('bsys'); return d?JSON.parse(d):null; } catch { return null; } }

/* ══ AUTH ══ */
async function fazerLogin() {
  const username = document.getElementById('login-username').value.trim();
  const senha = document.getElementById('login-senha').value;
  const errEl = document.getElementById('login-erro');
  errEl.classList.add('hidden');
  if (!username||!senha) { errEl.textContent='Preencha usuário e senha.'; errEl.classList.remove('hidden'); return; }
  try {
    const r = await fetch(`${API}/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,senha})});
    const d = await r.json();
    if (d.ok) { salvarSessaoLocal(d.funcionario); aplicarSessao(d.funcionario); }
    else { errEl.textContent=d.msg||'Credenciais inválidas.'; errEl.classList.remove('hidden'); }
  } catch { errEl.textContent='Erro ao conectar. Verifique se o backend está rodando.'; errEl.classList.remove('hidden'); }
}
document.addEventListener('keydown', e => {
  if (e.key==='Enter' && document.getElementById('page-login').classList.contains('active')) fazerLogin();
});
function fazerLogout() { abrirModal('modal-logout'); }
function confirmarLogout() {
  fecharModal('modal-logout'); limparSessaoLocal(); sessao=null;
  // Resetar seção ativa para dashboard antes de mostrar login
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  var dash = document.getElementById('sec-dashboard');
  if (dash) dash.classList.add('active');
  document.getElementById('page-app').classList.remove('active');
  document.getElementById('page-login').classList.add('active');
  document.getElementById('login-username').value='';
  document.getElementById('login-senha').value='';
  if (graficoRosca) { graficoRosca.destroy(); graficoRosca=null; }
}

/* ══ INIT ══ */
document.addEventListener('DOMContentLoaded', () => {
  aplicarTema(localStorage.getItem('bsys_tema')||'dark');
  const s = recuperarSessaoLocal();
    if (s) {
      // Validar sessão no servidor antes de restaurar
      fetch(`${API}/login`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({username: s.username, _validar_sessao: true, senha: s._senha_hash || ''})
      }).catch(() => {});
      // Restaurar direto pois temos a sessão válida — o servidor bloqueará na próxima ação se inativo
      aplicarSessao(s);
    }
  // validação email pessoa
  const eI=document.getElementById('pessoa-email'), eE=document.getElementById('pessoa-email-erro');
  if (eI&&eE) {
    eI.addEventListener('blur',()=>{ if(!validarEmail(eI.value.trim())){eE.textContent='Email inválido.';eE.classList.remove('hidden');}else eE.classList.add('hidden'); });
    eI.addEventListener('input',()=>{ if(validarEmail(eI.value.trim())) eE.classList.add('hidden'); });
  }
  document.querySelectorAll('.modal-overlay').forEach(o=>{
    o.addEventListener('click',e=>{ if(e.target===o&&!['modal-confirm','modal-logout'].includes(o.id)) o.classList.add('hidden'); });
  });
});

/* ══ NAVEGAÇÃO ══ */
function showSection(nome) {
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item,.mob-nav-item').forEach(n=>n.classList.remove('active'));
  var sec = document.getElementById('sec-'+nome);
  if (sec) sec.classList.add('active');
  document.querySelectorAll('.nav-item,.mob-nav-item').forEach(n=>{
    if(n.getAttribute('onclick')?.includes("'"+nome+"'")) n.classList.add('active');
  });
  ({dashboard:carregarDashboard,livros:carregarLivros,pessoas:carregarPessoas,
    emprestimos:carregarEmprestimos,historico:carregarHistorico,
    funcionarios:carregarFuncionarios,config:carregarConfig})[nome]?.();
  // Scroll to top on mobile
  if(window.innerWidth<=767) window.scrollTo(0,0);
}

/* ══ DASHBOARD ══ */
function iniciarDashboardData() {
  const d=new Date(), m=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  document.getElementById('data-hoje').textContent=`${d.getDate()} de ${m[d.getMonth()]} de ${d.getFullYear()}`;
}
async function carregarDashboard() {
  try {
    const d = await(await fetch(`${API}/dashboard`)).json();
    document.getElementById('stat-emprestados').textContent = d.emprestados;
    document.getElementById('stat-pendentes').textContent = d.pendentes;
    document.getElementById('stat-livros').textContent = d.total_livros;
    document.getElementById('stat-pessoas').textContent = d.total_pessoas;
    renderGrafico(d);
  } catch(e) { console.error(e); }
}
function atualizarCoresGrafico() {
  if (!graficoRosca) return;
  graficoRosca.data.datasets[0].backgroundColor=[getCssVar('--amber'),getCssVar('--red'),getCssVar('--green')];
  graficoRosca.update();
}
function renderGrafico(d) {
  const disp=Math.max(0,d.total_livros-d.emprestados), at=d.pendentes, normal=Math.max(0,d.emprestados-at);
  document.getElementById('chart-total-num').textContent=d.total_livros;
  const ctx=document.getElementById('grafico-rosca').getContext('2d');
  if (graficoRosca) graficoRosca.destroy();
  graficoRosca=new Chart(ctx,{
    type:'doughnut',
    data:{labels:['Emprestados (em dia)','Atrasados','Disponíveis'],
      datasets:[{data:[normal,at,disp],backgroundColor:[getCssVar('--amber'),getCssVar('--red'),getCssVar('--green')],borderWidth:0,hoverOffset:5}]},
    options:{cutout:'73%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.label}: ${c.parsed}`}}},animation:{duration:500}}
  });
  const cores=[getCssVar('--amber'),getCssVar('--red'),getCssVar('--green')];
  document.getElementById('chart-legend').innerHTML=[['Emprestados (em dia)',normal],['Atrasados',at],['Disponíveis',disp]]
    .map(([l,v],i)=>`<div class="legend-item"><span class="legend-dot" style="background:${cores[i]}"></span><span class="legend-label">${l}</span><span class="legend-val">${v}</span></div>`).join('');
}

/* ══ LIVROS ══ */
async function carregarLivros() {
  var incl = document.getElementById('show-inativos-livros');
  var url = incl && incl.checked ? `${API}/livros?inativos=1` : `${API}/livros`;
  todosLivros = await(await fetch(url)).json();
  _pagAtual.livros = 1;
  renderLivros(todosLivros);
}
function renderLivros(lista) {
  _listaFiltradaLivros = lista;
  const tbody=document.getElementById('tbody-livros');
  if (!lista.length){tbody.innerHTML='<tr><td colspan="8" class="empty-state">Nenhum livro cadastrado</td></tr>';renderPaginacao('pag-livros','livros',1,1,0,0,0);return;}
  const {itens,pag,totalPags,total,inicio,fim} = paginar(lista, _pagAtual.livros);
  tbody.innerHTML=itens.map(l=>`
    <tr class="${l.inativo?'row-inativo':''}">
      <td data-label="Título"><strong>${l.titulo}</strong>${l.inativo?' <span class="badge badge-inativo">Inativo</span>':''}</td>
      <td data-label="Autor">${l.autor}</td>
      <td data-label="ISBN">${l.isbn||'–'}</td>
      <td data-label="Editora">${l.editora||'–'}</td>
      <td data-label="Ano">${l.ano||'–'}</td>
      <td data-label="Estoque">${l.quantidade}</td>
      <td data-label="Disponível"><span class="badge ${l.disponivel>0?'badge-green':'badge-red'}">${l.inativo?'–':l.disponivel}</span></td>
      <td data-label="Ações"><div class="tbl-actions">
        ${!l.inativo?`<button class="btn-icon" onclick="editarLivro(${l.id})">✏️ Editar</button>`:''}
        ${!l.inativo?`<button class="btn-icon danger" onclick="inativarRegistro('livros',${l.id})">⛔ Inativar</button>`
                    :`<button class="btn-icon" onclick="reativarRegistro('livros',${l.id})">✅ Reativar</button>`}
      </div></td>
    </tr>`).join('');
  renderPaginacao('pag-livros','livros',pag,totalPags,total,inicio,fim);
}
function filtrarLivros() {
  _pagAtual.livros=1;
  const q=document.getElementById('search-livros').value.toLowerCase();
  renderLivros(todosLivros.filter(l=>l.titulo.toLowerCase().includes(q)||l.autor.toLowerCase().includes(q)||(l.editora||'').toLowerCase().includes(q)||(l.ano||'').toString().includes(q)));
}
function limparFormLivro() {
  document.getElementById('livro-id').value='';
  ['livro-titulo','livro-autor','livro-isbn','livro-editora','livro-ano'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('livro-quantidade').value='1';
  document.getElementById('livro-qtd-hint').classList.add('hidden');
  document.getElementById('modal-livro-titulo').textContent='Cadastrar Livro';
}
function editarLivro(id) {
  const l=todosLivros.find(x=>x.id===id);if(!l)return;
  document.getElementById('livro-id').value=l.id;
  document.getElementById('livro-titulo').value=l.titulo;
  document.getElementById('livro-autor').value=l.autor;
  document.getElementById('livro-isbn').value=l.isbn||'';
  document.getElementById('livro-editora').value=l.editora||'';
  document.getElementById('livro-ano').value=l.ano||'';
  document.getElementById('livro-quantidade').value=l.quantidade;
  const em=l.quantidade-l.disponivel, hint=document.getElementById('livro-qtd-hint');
  if(em>0){hint.textContent=`⚠️ ${em} exemplar(es) emprestado(s). Mínimo: ${em}`;hint.classList.remove('hidden');}
  else hint.classList.add('hidden');
  document.getElementById('modal-livro-titulo').textContent='Editar Livro';
  abrirModal('modal-livro');
}
async function salvarLivro() {
  const id=document.getElementById('livro-id').value;
  const p={titulo:document.getElementById('livro-titulo').value.trim(),autor:document.getElementById('livro-autor').value.trim(),
    isbn:document.getElementById('livro-isbn').value.trim(),editora:document.getElementById('livro-editora').value.trim(),
    ano:document.getElementById('livro-ano').value||null,quantidade:parseInt(document.getElementById('livro-quantidade').value)||1};
  if(!p.titulo||!p.autor){toast('Preencha título e autor.','error');return;}
  const r=await fetch(id?`${API}/livros/${id}`:`${API}/livros`,{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
  const d=await r.json();
  if(d.ok){fecharModal('modal-livro');toast(id?'Livro atualizado!':'Livro cadastrado!');carregarLivros();carregarDashboard();}
  else toast(d.msg||'Erro ao salvar.','error');
}
async function deletarLivro(id) {
  if(!await confirmar('Excluir livro','Deseja excluir este livro permanentemente?','Excluir'))return;
  const d=await(await fetch(`${API}/livros/${id}`,{method:'DELETE'})).json();
  if(d.ok){toast('Livro excluído.');carregarLivros();carregarDashboard();}
  else toast(d.msg,'error');
}

/* ══ PESSOAS ══ */
async function carregarPessoas() {
  var incl = document.getElementById('show-inativos-pessoas');
  var url = incl && incl.checked ? `${API}/pessoas?inativos=1` : `${API}/pessoas`;
  todasPessoas = await(await fetch(url)).json();
  _pagAtual.pessoas = 1;
  renderPessoas(todasPessoas);
}
function renderPessoas(lista) {
  _listaFiltradaPessoas = lista;
  const tbody=document.getElementById('tbody-pessoas');
  if(!lista.length){tbody.innerHTML='<tr><td colspan="5" class="empty-state">Nenhuma pessoa cadastrada</td></tr>';renderPaginacao('pag-pessoas','pessoas',1,1,0,0,0);return;}
  const {itens,pag,totalPags,total,inicio,fim} = paginar(lista, _pagAtual.pessoas);
  tbody.innerHTML=itens.map(p=>`<tr>
    <td><strong>${p.nome}</strong></td><td>${p.email||'–'}</td><td>${p.telefone||'–'}</td><td>${p.documento||'–'}</td>
    <td><div class="tbl-actions">
      <button class="btn-icon" onclick="editarPessoa(${p.id})">✏️ Editar</button>
      <button class="btn-icon danger" onclick="deletarPessoa(${p.id})">🗑️</button>
    </div></td></tr>`).join('');
  renderPaginacao('pag-pessoas','pessoas',pag,totalPags,total,inicio,fim);
}
function filtrarPessoas() {
  _pagAtual.pessoas=1;
  const q=document.getElementById('search-pessoas').value.toLowerCase();
  renderPessoas(todasPessoas.filter(p=>p.nome.toLowerCase().includes(q)||(p.documento||'').toLowerCase().includes(q)));
}
function limparFormPessoa() {
  ['pessoa-id','pessoa-nome','pessoa-email','pessoa-telefone','pessoa-documento','pessoa-endereco'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pessoa-email-erro').classList.add('hidden');
  document.getElementById('modal-pessoa-titulo').textContent='Cadastrar Pessoa';
}
function editarPessoa(id) {
  const p=todasPessoas.find(x=>x.id===id);if(!p)return;
  document.getElementById('pessoa-id').value=p.id;
  document.getElementById('pessoa-nome').value=p.nome;
  document.getElementById('pessoa-email').value=p.email||'';
  document.getElementById('pessoa-telefone').value=p.telefone||'';
  document.getElementById('pessoa-documento').value=p.documento||'';
  document.getElementById('pessoa-endereco').value=p.endereco||'';
  document.getElementById('pessoa-email-erro').classList.add('hidden');
  document.getElementById('modal-pessoa-titulo').textContent='Editar Pessoa';
  abrirModal('modal-pessoa');
}
async function salvarPessoa() {
  const id=document.getElementById('pessoa-id').value;
  const email=document.getElementById('pessoa-email').value.trim();
  const errEl=document.getElementById('pessoa-email-erro');
  if(!validarEmail(email)){errEl.textContent='Email inválido.';errEl.classList.remove('hidden');return;}
  errEl.classList.add('hidden');
  const p={nome:document.getElementById('pessoa-nome').value.trim(),email,
    telefone:document.getElementById('pessoa-telefone').value.trim(),
    documento:document.getElementById('pessoa-documento').value.trim(),
    endereco:document.getElementById('pessoa-endereco').value.trim()};
  if(!p.nome){toast('Preencha o nome.','error');return;}
  // Validar campos obrigatórios configurados
  const obrigCfg = _configOriginal.campos_obrig || {};
  if(obrigCfg.email && !p.email){ toast('Email é obrigatório (configurado em Configurações).','error'); return; }
  if(obrigCfg.telefone && !p.telefone){ toast('Telefone é obrigatório (configurado em Configurações).','error'); return; }
  if(obrigCfg.documento && !p.documento){ toast('Documento é obrigatório (configurado em Configurações).','error'); return; }
  if(obrigCfg.endereco && !p.endereco){ toast('Endereço é obrigatório (configurado em Configurações).','error'); return; }
  const r = await fetch(id?`${API}/pessoas/${id}`:`${API}/pessoas`,{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
  const d = await r.json();
  if(d.ok){fecharModal('modal-pessoa');toast(id?'Pessoa atualizada!':'Pessoa cadastrada!');carregarPessoas();carregarDashboard();}
  else toast(d.msg||'Erro ao salvar.','error');
}
async function deletarPessoa(id) {
  if(!await confirmar('Excluir pessoa','Deseja excluir este cadastro?','Excluir'))return;
  const d=await(await fetch(`${API}/pessoas/${id}`,{method:'DELETE'})).json();
  if(d.ok){toast('Pessoa excluída.');carregarPessoas();carregarDashboard();}
  else toast(d.msg,'error');
}

/* ══ EMPRÉSTIMOS ══ */
async function carregarEmprestimos() {
  todosEmprestimos=await(await fetch(`${API}/emprestimos`)).json();
  aplicarFiltrosEmp();
}
function aplicarFiltrosEmp() {
  _pagAtual.emprestimos=1;
  const q=(document.getElementById('search-emp').value||'').toLowerCase();
  const dataEmp=document.getElementById('filter-emp-data-emp').value;
  const dataDev=document.getElementById('filter-emp-data-dev').value;
  const status=document.getElementById('filter-emp-status').value;
  const sort=document.getElementById('sort-emp').value;
  const hj=hoje();
  let lista=todosEmprestimos.filter(e=>{
    const nomeMatch=e.pessoa_nome.toLowerCase().includes(q)||e.livros.some(l=>l.titulo.toLowerCase().includes(q));
    const dataEmpMatch=!dataEmp||e.data_emprestimo===dataEmp;
    const dataDevMatch=!dataDev||e.livros.some(l=>l.data_devolucao===dataDev);
    const vencido=e.status==='ativo'&&e.data_prevista_devolucao<hj;
    let statusMatch=true;
    if(status==='ativo') statusMatch=e.status==='ativo'&&!vencido;
    else if(status==='atrasado') statusMatch=vencido;
    else if(status==='devolvido') statusMatch=e.status==='devolvido';
    return nomeMatch&&dataEmpMatch&&dataDevMatch&&statusMatch;
  });
  lista.sort((a,b)=>{
    if(sort==='data-asc') return a.data_emprestimo.localeCompare(b.data_emprestimo);
    if(sort==='data-desc') return b.data_emprestimo.localeCompare(a.data_emprestimo);
    if(sort==='nome-az') return a.pessoa_nome.localeCompare(b.pessoa_nome);
    if(sort==='nome-za') return b.pessoa_nome.localeCompare(a.pessoa_nome);
    return 0;
  });
  renderEmprestimos(lista);
}
function renderEmprestimos(lista) {
  _listaFiltradaEmp = lista;
  const tbody=document.getElementById('tbody-emprestimos');
  if(!lista.length){tbody.innerHTML='<tr><td colspan="7" class="empty-state">Nenhum empréstimo encontrado</td></tr>';renderPaginacao('pag-emprestimos','emprestimos',1,1,0,0,0);return;}
  const {itens:lista2,pag,totalPags,total,inicio,fim} = paginar(lista, _pagAtual.emprestimos);
  lista = lista2;
  const hj=hoje();
  tbody.innerHTML=lista.map(e=>{
    const vencido=e.status==='ativo'&&e.data_prevista_devolucao<hj;
    const pendentes=e.livros.filter(l=>!l.devolvido);
    const badge=e.status==='devolvido'?'<span class="badge badge-green">Devolvido</span>'
      :vencido?'<span class="badge badge-red">Atrasado</span>':'<span class="badge badge-amber">Ativo</span>';
    const totalLivros = e.livros.length;
    const devolvidos = e.livros.filter(l=>l.devolvido).length;
    const livrosHtml = `<span class="livros-resumo">${totalLivros} livro${totalLivros!==1?'s':''} <span class="livros-resumo-sub">(${devolvidos} devolvido${devolvidos!==1?'s':''})</span></span> <button class="btn-ver-livros" onclick="toggleLivrosEmp(this)">ver</button><div class="livros-detalhe hidden">${e.livros.map(l=>l.devolvido?`<div class="livro-row-devolvido">✅ ${l.titulo}</div>`:`<div class="livro-row-pendente">📕 ${l.titulo}</div>`).join('')}</div>`;
    const nenhum_devolvido=!e.livros.some(l=>l.devolvido);
    const btnImprimir = `<button class="btn-icon" onclick="reimprimirComprovante(${e.id})">🖨️ Imprimir</button>`;
    const btns=e.status==='ativo'&&pendentes.length>0?`
      <button class="btn-devolver" onclick="abrirDevolucao(${e.id})">↩ Devolver</button>
      <button class="btn-renovar" onclick="abrirRenovacao(${e.id})">🔄 Renovar</button>
      ${btnImprimir}
      ${nenhum_devolvido?`<button class="btn-icon danger" onclick="excluirEmprestimo(${e.id})" style="border-color:var(--red);color:var(--red)">🗑️</button>`:''}`:
      e.status==='ativo'?btnImprimir:
      `${btnImprimir}${nenhum_devolvido?`<button class="btn-icon danger" onclick="excluirEmprestimo(${e.id})" style="border-color:var(--red);color:var(--red)">🗑️</button>`:''}`;
    return `<tr><td><strong>${e.pessoa_nome}</strong></td><td style="max-width:200px">${livrosHtml}</td>
      <td>${e.funcionario_nome}</td><td>${fmtData(e.data_emprestimo)}</td>
      <td>${fmtData(e.data_prevista_devolucao)}</td><td>${badge}</td>
      <td><div class="tbl-actions">${btns}</div></td></tr>`;
  }).join('');
  renderPaginacao('pag-emprestimos','emprestimos',pag,totalPags,total,inicio,fim);
}
async function excluirEmprestimo(id) {
  if(!await confirmar('Excluir empréstimo','Deseja excluir este empréstimo? Esta ação não pode ser desfeita.','Excluir'))return;
  const d=await(await fetch(`${API}/emprestimos/${id}`,{method:'DELETE'})).json();
  if(d.ok){toast('Empréstimo excluído.');carregarEmprestimos();carregarLivros();carregarDashboard();}
  else toast(d.msg||'Não foi possível excluir.','error');
}

/* ── Modal empréstimo ── */
function filtrarLivrosEmprestimo() {
  const q=document.getElementById('search-emp-livros').value.toLowerCase();
  renderLivrosEmpLista(livrosEmpCache.filter(l=>l.titulo.toLowerCase().includes(q)||l.autor.toLowerCase().includes(q)||(l.editora||'').toLowerCase().includes(q)||(l.ano||'').toString().includes(q)));
}
function renderLivrosEmpLista(lista) {
  document.getElementById('emp-livros-lista').innerHTML=lista.length
    ?lista.map(l=>`<label class="livro-check-item"><input type="checkbox" value="${l.id}"><span>${l.titulo} <small style="color:var(--text2)">— ${l.autor}${l.ano?' ('+l.ano+')':''}</small></span><span class="livro-disp badge badge-green">Disp: ${l.disponivel}</span></label>`).join('')
    :'<p style="padding:10px;color:var(--text3);font-size:.82rem">Nenhum livro encontrado.</p>';
}
function prepararModalEmprestimo() {
  document.getElementById('emp-pessoa').innerHTML='<option value="">Selecione...</option>'+todasPessoas.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
  livrosEmpCache=todosLivros.filter(l=>l.disponivel>0);
  document.getElementById('search-emp-livros').value='';
  renderLivrosEmpLista(livrosEmpCache);
  document.getElementById('emp-data-devolucao').value=addDias(hoje(),diasPadraoEmp);
  document.getElementById('emp-data-devolucao').min=hoje();
}
async function salvarEmprestimo() {
  const pessoaId=document.getElementById('emp-pessoa').value;
  const dataDev=document.getElementById('emp-data-devolucao').value;
  const livrosIds=Array.from(document.querySelectorAll('#emp-livros-lista input:checked')).map(c=>parseInt(c.value));
  if(!pessoaId){toast('Selecione uma pessoa.','error');return;}
  if(!dataDev){toast('Informe a data de devolução.','error');return;}
  if(!livrosIds.length){toast('Selecione pelo menos um livro.','error');return;}
  const r=await fetch(`${API}/emprestimos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pessoa_id:parseInt(pessoaId),funcionario_id:sessao.id,data_prevista_devolucao:dataDev,livros:livrosIds})});
  const d=await r.json();
  if(d.ok){
    fecharModal('modal-emprestimo');
    toast('Empréstimo registrado!');
    await carregarEmprestimos();
    carregarLivros();
    carregarDashboard();
    // Perguntar sobre impressão
    const emp = todosEmprestimos.find(e=>e.id===d.id);
    perguntarImpressao('Deseja imprimir o comprovante deste empréstimo?', 'Comprovante de Empréstimo', emp||{id:d.id}, false);
  } else toast(d.msg||'Erro ao registrar.','error');
}

/* ── Devolução ── */
function abrirDevolucao(eid) {
  const emp=todosEmprestimos.find(e=>e.id===eid);if(!emp)return;
  document.getElementById('dev-emprestimo-id').value=eid;
  document.getElementById('dev-livros-lista').innerHTML=emp.livros.filter(l=>!l.devolvido)
    .map(l=>`<label class="livro-check-item"><input type="checkbox" value="${l.id}" checked><span>📕 ${l.titulo}</span></label>`).join('');
  abrirModal('modal-devolucao');
}
async function confirmarDevolucao() {
  const eid=parseInt(document.getElementById('dev-emprestimo-id').value);
  const sel=Array.from(document.querySelectorAll('#dev-livros-lista input:checked')).map(c=>parseInt(c.value));
  if(!sel.length){toast('Selecione pelo menos um livro.','error');return;}
  const emp=todosEmprestimos.find(e=>e.id===eid);
  const pend=emp.livros.filter(l=>!l.devolvido);
  if(sel.length===pend.length){await fetch(`${API}/emprestimos/${eid}/devolver`,{method:'POST'});}
  else {
    for(const lid of sel){
      const el=emp.livros.find(l=>l.id===lid&&!l.devolvido);
      if(el) await fetch(`${API}/emprestimos/${eid}/devolver-livro`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emprestimo_livro_id:el.id})});
    }
  }
  fecharModal('modal-devolucao');toast('Devolução registrada!');carregarEmprestimos();carregarLivros();carregarDashboard();
}

/* ── Renovação ── */
function abrirRenovacao(eid) {
  const emp=todosEmprestimos.find(e=>e.id===eid);if(!emp)return;
  document.getElementById('renov-emprestimo-id').value=eid;
  document.getElementById('renov-info').textContent=`Pessoa: ${emp.pessoa_nome} | Vencimento atual: ${fmtData(emp.data_prevista_devolucao)}`;
  const sugerida=addDias(emp.data_prevista_devolucao,7);
  const minStr=addDias(hoje(),1);
  document.getElementById('renov-data').value=sugerida>minStr?sugerida:minStr;
  document.getElementById('renov-data').min=minStr;
  abrirModal('modal-renovacao');
}
async function confirmarRenovacao() {
  const eid=parseInt(document.getElementById('renov-emprestimo-id').value);
  const nd=document.getElementById('renov-data').value;
  if(!nd){toast('Informe a nova data.','error');return;}
  const r=await fetch(`${API}/emprestimos/${eid}/renovar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nova_data:nd})});
  const d=await r.json();
  if(d.ok){
    fecharModal('modal-renovacao');
    toast('Empréstimo renovado!','info');
    await carregarEmprestimos();
    carregarDashboard();
    // Perguntar sobre impressão do comprovante atualizado
    const emp = todosEmprestimos.find(e=>e.id===eid);
    perguntarImpressao('Deseja imprimir o comprovante com a nova data de devolução?', 'Comprovante de Renovação', emp, true);
  } else toast(d.msg||'Erro ao renovar.','error');
}

/* ══ HISTÓRICO ══ */
async function carregarHistorico() {
  todoHistorico=await(await fetch(`${API}/historico`)).json(); filtrarHistorico();
}
function filtrarHistorico() {
  _pagAtual.historico=1;
  const q=(document.getElementById('search-hist').value||'').toLowerCase();
  const de=document.getElementById('hist-data-emp').value;
  const dd=document.getElementById('hist-data-dev').value;
  const lista=todoHistorico.filter(h=>{
    const tm=h.pessoa_nome.toLowerCase().includes(q)||h.livro_titulo.toLowerCase().includes(q);
    const dem=!de||h.data_emprestimo===de;
    const ddm=!dd||h.data_devolucao===dd;
    return tm&&dem&&ddm;
  });
  _renderHistoricoLista(lista);
}
function _renderHistoricoLista(lista) {
  _listaFiltradaHist = lista;
  const tbody=document.getElementById('tbody-historico');
  if(!lista.length){tbody.innerHTML='<tr><td colspan="6" class="empty-state">Nenhum registro encontrado</td></tr>';renderPaginacao('pag-historico','historico',1,1,0,0,0);return;}
  const {itens,pag,totalPags,total,inicio,fim} = paginar(lista, _pagAtual.historico);
  const hj=hoje();
  tbody.innerHTML=itens.map(h=>{
    const aberto=!h.devolvido;
    const atrasado=aberto&&h.data_prevista_devolucao<hj;
    const badge=h.devolvido?'<span class="badge badge-green">Devolvido</span>'
      :atrasado?'<span class="badge badge-red">Atrasado</span>':'<span class="badge badge-amber">Em aberto</span>';
    return `<tr><td><strong>${h.pessoa_nome}</strong></td><td>${h.livro_titulo}</td>
      <td>${fmtData(h.data_emprestimo)}</td><td>${fmtData(h.data_prevista_devolucao)}</td>
      <td>${fmtData(h.data_devolucao)}</td><td>${badge}</td></tr>`;
  }).join('');
  renderPaginacao('pag-historico','historico',pag,totalPags,total,inicio,fim);
}

/* ══ ATRASADOS ══ */
async function abrirAtrasados() {
  try {
    todosAtrasados = await (await fetch(`${API}/emprestimos/atrasados`)).json();
  } catch(e) { todosAtrasados = []; }
  const searchEl = document.getElementById('search-atrasados');
  const sortEl = document.getElementById('sort-atrasados');
  if (searchEl) searchEl.value = '';
  if (sortEl) sortEl.value = 'venc-asc';
  filtrarAtrasados();
  abrirModal('modal-atrasados');
}

function filtrarAtrasados() {
  const q = (document.getElementById('search-atrasados').value || '').toLowerCase();
  const s = document.getElementById('sort-atrasados').value;

  let lista = todosAtrasados.filter(function(e) {
    var nomeMatch = e.pessoa_nome.toLowerCase().includes(q);
    var vencMatch = fmtData(e.data_prevista_devolucao).includes(q);
    var empMatch  = fmtData(e.data_emprestimo).includes(q);
    return nomeMatch || vencMatch || empMatch;
  });

  // Ordenação segura sem depender de split
  lista.sort(function(a, b) {
    var campoA, campoB;
    if (s === 'venc-asc' || s === 'venc-desc') {
      campoA = a.data_prevista_devolucao; campoB = b.data_prevista_devolucao;
    } else if (s === 'nome-az') {
      campoA = a.pessoa_nome; campoB = b.pessoa_nome;
    } else if (s === 'emp-asc' || s === 'emp-desc') {
      campoA = a.data_emprestimo; campoB = b.data_emprestimo;
    } else {
      campoA = a.data_prevista_devolucao; campoB = b.data_prevista_devolucao;
    }
    var cmp = campoA.localeCompare(campoB);
    return (s === 'venc-desc' || s === 'emp-desc') ? -cmp : cmp;
  });

  var tbody = document.getElementById('tbody-atrasados');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum empréstimo atrasado encontrado</td></tr>';
    return;
  }

  // Construir linhas separadamente para garantir DOM correto
  var rows = '';
  lista.forEach(function(e) {
    var at = diasAtraso(e.data_prevista_devolucao);
    var livrosHtml = e.livros.length
      ? e.livros.map(function(l) { return '<div class="livro-pendente-item">' + l.titulo + '</div>'; }).join('')
      : '<div style="color:var(--text3);font-size:.82rem;padding:4px 0">Nenhum livro pendente</div>';

    rows += '<tr>';
    rows += '<td><button class="expand-btn" onclick="toggleDetalhe(this,' + e.id + ')">▶</button></td>';
    rows += '<td><strong>' + e.pessoa_nome + '</strong></td>';
    rows += '<td>' + fmtData(e.data_emprestimo) + '</td>';
    rows += '<td>' + fmtData(e.data_prevista_devolucao) + '</td>';
    rows += '<td><span class="badge badge-red">' + at + ' dia' + (at !== 1 ? 's' : '') + '</span></td>';
    rows += '<td>' + e.livros.length + ' livro' + (e.livros.length !== 1 ? 's' : '') + '</td>';
    rows += '</tr>';
    rows += '<tr class="row-detalhe" id="det-' + e.id + '" style="display:none">';
    rows += '<td colspan="6"><div class="livros-pendentes-lista">' + livrosHtml + '</div></td>';
    rows += '</tr>';
  });
  tbody.innerHTML = rows;
}

function toggleDetalhe(btn, eid) {
  var row = document.getElementById('det-' + eid);
  if (!row) return;
  var aberto = row.style.display !== 'none';
  row.style.display = aberto ? 'none' : 'table-row';
  btn.textContent = aberto ? '▶' : '▼';
}

/* ══ FUNCIONÁRIOS ══ */
async function carregarFuncionarios() {
  var incl = document.getElementById('show-inativos-funcionarios');
  var url = incl && incl.checked ? `${API}/funcionarios?inativos=1` : `${API}/funcionarios`;
  const funcs=await(await fetch(url)).json();
  const tbody=document.getElementById('tbody-funcionarios');
  // Não-admin só vê a si mesmo
  const lista=sessao.admin?funcs:funcs.filter(f=>f.id===sessao.id);
  if(!lista.length){tbody.innerHTML='<tr><td colspan="6" class="empty-state">Nenhum registro</td></tr>';return;}
  _renderFuncionariosLista(lista);
  document.getElementById('btn-novo-func').style.display=sessao.admin?'':'none';
}
function _renderFuncionariosLista(lista) {
  _listaFiltradaFunc = lista;
  const tbody=document.getElementById('tbody-funcionarios');
  if(!lista.length){tbody.innerHTML='<tr><td colspan="6" class="empty-state">Nenhum registro</td></tr>';renderPaginacao('pag-funcionarios','funcionarios',1,1,0,0,0);return;}
  const {itens,pag,totalPags,total,inicio,fim} = paginar(lista, _pagAtual.funcionarios);
  tbody.innerHTML=itens.map(f=>{
    const ehVoce=f.id===sessao.id;
    const podeEditar=(sessao.admin||ehVoce)&&!f.inativo;
    const podeInativar=sessao.admin&&!ehVoce&&!f.inativo;
    const podeReativar=sessao.admin&&f.inativo;
    return `<tr class="${f.inativo?'row-inativo':''}">
      <td><strong>${f.nome}</strong>${f.inativo?' <span class="badge badge-inativo">Inativo</span>':''}</td>
      <td><span style="color:var(--text2)">@</span>${f.username}</td>
      <td>${f.email||'–'}</td>
      <td><span class="badge ${f.admin?'badge-amber':'badge-blue'}">${f.admin?'Admin':'Funcionário'}</span>${ehVoce?' <span style="color:var(--text3);font-size:.7rem">(você)</span>':''}</td>
      <td>${fmtData(f.criado_em?.split(' ')[0])}</td>
      <td><div class="tbl-actions">
        ${podeEditar?`<button class="btn-icon" onclick="editarFuncionario(${f.id},'${f.nome}','${f.username}','${f.email||''}',${f.admin})">✏️ Editar</button>`:''}
        ${podeInativar?`<button class="btn-icon danger" onclick="inativarRegistro('funcionarios',${f.id})">⛔ Inativar</button>`:''}
        ${podeReativar?`<button class="btn-icon" onclick="reativarRegistro('funcionarios',${f.id})">✅ Reativar</button>`:''}
        ${!podeEditar&&!podeInativar&&!podeReativar&&!ehVoce?'<span style="color:var(--text3);font-size:.78rem">–</span>':''}
      </div></td></tr>`;
  }).join('');
  renderPaginacao('pag-funcionarios','funcionarios',pag,totalPags,total,inicio,fim);
}
function limparFormFuncionario() {
  document.getElementById('func-id').value='';
  ['func-nome','func-username','func-email','func-senha'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('func-admin').value='0';
  document.getElementById('func-email-erro').classList.add('hidden');
  document.getElementById('modal-func-titulo').textContent='Cadastrar Funcionário';
  document.getElementById('func-senha-hint').textContent='(obrigatória)';
  document.getElementById('func-perfil-wrap').style.display=sessao.admin?'':'none';
}
function editarFuncionario(id,nome,username,email,admin) {
  document.getElementById('func-id').value=id;
  document.getElementById('func-nome').value=nome;
  document.getElementById('func-username').value=username;
  document.getElementById('func-email').value=email||'';
  document.getElementById('func-senha').value='';
  document.getElementById('func-admin').value=admin;
  document.getElementById('func-email-erro').classList.add('hidden');
  document.getElementById('modal-func-titulo').textContent='Editar Funcionário';
  document.getElementById('func-senha-hint').textContent='(deixe em branco para não alterar)';
  document.getElementById('func-perfil-wrap').style.display=sessao.admin?'':'none';
  abrirModal('modal-funcionario');
}
async function salvarFuncionario() {
  const id=document.getElementById('func-id').value;
  const email=document.getElementById('func-email').value.trim();
  const errEl=document.getElementById('func-email-erro');
  if(!validarEmail(email)){errEl.textContent='Email inválido.';errEl.classList.remove('hidden');return;}
  errEl.classList.add('hidden');
  const p={nome:document.getElementById('func-nome').value.trim(),
    username:document.getElementById('func-username').value.trim().toLowerCase().replace(/\s+/g,'_'),
    email:email||null,senha:document.getElementById('func-senha').value,
    admin:parseInt(document.getElementById('func-admin').value),
    solicitante_id:sessao.id,solicitante_admin:sessao.admin};
  if(!p.nome||!p.username){toast('Preencha nome e usuário.','error');return;}
  if(!id&&!p.senha){toast('Informe uma senha.','error');return;}
  if(p.senha&&p.senha.length<6){toast('Senha deve ter ao menos 6 caracteres.','error');return;}
  const r=await fetch(id?`${API}/funcionarios/${id}`:`${API}/funcionarios`,{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
  const d=await r.json();
  if(d.ok){fecharModal('modal-funcionario');toast(id?'Funcionário atualizado!':'Funcionário cadastrado!');carregarFuncionarios();}
  else toast(d.msg||'Erro ao salvar.','error');
}
async function deletarFuncionario(id) {
  if(!await confirmar('Excluir funcionário','Deseja excluir este funcionário?','Excluir'))return;
  await fetch(`${API}/funcionarios/${id}`,{method:'DELETE'});
  toast('Funcionário excluído.'); carregarFuncionarios();
}

/* ══ CONFIGURAÇÕES ══ */
let _configOriginal = {};

async function carregarConfig() {
  try {
    const cfg = await(await fetch(`${API}/configuracoes`)).json();
    diasPadraoEmp = parseInt(cfg.dias_emprestimo)||14;
    itensPorPagina = parseInt(cfg.paginacao)||10;
    document.getElementById('cfg-dias').value = diasPadraoEmp;
    const modeloEl = document.getElementById('cfg-modelo');
    if (modeloEl) modeloEl.value = cfg.modelo_impressao || 'a4';
    const pagEl = document.getElementById('cfg-paginacao');
    if (pagEl) pagEl.value = String(itensPorPagina);
    const obrig = {
      email: cfg.campo_obrig_email === '1',
      telefone: cfg.campo_obrig_telefone === '1',
      documento: cfg.campo_obrig_documento === '1',
      endereco: cfg.campo_obrig_endereco === '1'
    };
    ['email','telefone','documento','endereco'].forEach(function(f) {
      var el = document.getElementById('cfg-obrig-' + f);
      if (el) el.checked = obrig[f];
    });
    _configOriginal = { dias: diasPadraoEmp, modelo: cfg.modelo_impressao || 'a4', paginacao: itensPorPagina, campos_obrig: obrig };
    // Preencher select de empréstimos ativos para reimprimir
    const ativos = (todosEmprestimos.length ? todosEmprestimos : await(await fetch(`${API}/emprestimos`)).json()).filter(e=>e.status==='ativo');
    const sel = document.getElementById('cfg-emp-imprimir');
    if (sel) sel.innerHTML = '<option value="">Selecione...</option>' + ativos.map(e=>`<option value="${e.id}">${e.pessoa_nome} — ${fmtData(e.data_emprestimo)}</option>`).join('');
    atualizarBtnSalvarConfig();
  } catch(e) { console.error(e); }
}

function marcarConfigAlterada() {
  atualizarBtnSalvarConfig();
}

function atualizarBtnSalvarConfig() {
  const btn = document.getElementById('btn-salvar-config');
  if (!btn) return;
  const diasAtual = parseInt(document.getElementById('cfg-dias')?.value)||14;
  const modeloAtual = document.getElementById('cfg-modelo')?.value || 'a4';
  const pagAtual = parseInt(document.getElementById('cfg-paginacao')?.value)||10;
  const obrigAtual = {
    email: !!(document.getElementById('cfg-obrig-email')?.checked),
    telefone: !!(document.getElementById('cfg-obrig-telefone')?.checked),
    documento: !!(document.getElementById('cfg-obrig-documento')?.checked),
    endereco: !!(document.getElementById('cfg-obrig-endereco')?.checked)
  };
  const obrigOrig = _configOriginal.campos_obrig || {};
  const obrigAlterado = ['email','telefone','documento','endereco'].some(function(f){ return obrigAtual[f] !== (obrigOrig[f]||false); });
  const alterado = diasAtual !== _configOriginal.dias || modeloAtual !== _configOriginal.modelo || pagAtual !== _configOriginal.paginacao || obrigAlterado;
  btn.disabled = !alterado;
  btn.style.opacity = alterado ? '1' : '0.35';
}

async function salvarConfig() {
  const dias = parseInt(document.getElementById('cfg-dias').value)||14;
  const modelo = document.getElementById('cfg-modelo')?.value || 'a4';
  const paginacao = parseInt(document.getElementById('cfg-paginacao')?.value)||10;
  const obrigSalvar = {
    campo_obrig_email: document.getElementById('cfg-obrig-email')?.checked ? '1' : '0',
    campo_obrig_telefone: document.getElementById('cfg-obrig-telefone')?.checked ? '1' : '0',
    campo_obrig_documento: document.getElementById('cfg-obrig-documento')?.checked ? '1' : '0',
    campo_obrig_endereco: document.getElementById('cfg-obrig-endereco')?.checked ? '1' : '0'
  };
  const r = await fetch(`${API}/configuracoes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({dias_emprestimo:dias, modelo_impressao:modelo, paginacao:paginacao}, obrigSalvar))});
  const d = await r.json();
  if (d.ok) {
    diasPadraoEmp = dias;
    itensPorPagina = paginacao;
    localStorage.setItem('bsys_modelo', modelo);
    _configOriginal = { dias, modelo, paginacao, campos_obrig: {
      email: obrigSalvar.campo_obrig_email==='1',
      telefone: obrigSalvar.campo_obrig_telefone==='1',
      documento: obrigSalvar.campo_obrig_documento==='1',
      endereco: obrigSalvar.campo_obrig_endereco==='1'
    }};
    const btn = document.getElementById('btn-salvar-config');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.35'; }
    toast('Configurações salvas!');
  } else toast('Erro ao salvar configurações.','error');
}

function imprimirComprovanteConfig() {
  const eid = parseInt(document.getElementById('cfg-emp-imprimir')?.value||'0');
  if (!eid) { toast('Selecione um empréstimo.','error'); return; }
  const modelo = document.getElementById('cfg-modelo')?.value || 'a4';
  reimprimirComprovante(eid, modelo);
}


/* ══ INATIVAR / REATIVAR ══ */
async function inativarRegistro(tipo, id) {
  const nomes = {livros:'este livro', pessoas:'esta pessoa', funcionarios:'este funcionário'};
  if (!await confirmar('Inativar', 'Deseja inativar ' + (nomes[tipo]||'este registro') + '? Ele não aparecerá mais nas listagens padrão.', 'Inativar')) return;
  const r = await fetch(`${API}/${tipo}/${id}/inativar`, {method:'POST'});
  const d = await r.json();
  if (d.ok) {
      toast('Registro inativado.', 'info');
      if (tipo==='livros') carregarLivros();
      else if (tipo==='pessoas') carregarPessoas();
      else if (tipo==='funcionarios') {
        // Marcar checkbox para mostrar inativos e recarregar
        var chk = document.getElementById('show-inativos-funcionarios');
        if (chk) chk.checked = true;
        carregarFuncionarios();
      }
    } else toast(d.msg || 'Erro ao inativar.', 'error');
}

async function reativarRegistro(tipo, id) {
  const r = await fetch(`${API}/${tipo}/${id}/reativar`, {method:'POST'});
  const d = await r.json();
  if (d.ok) {
    toast('Registro reativado!');
    if (tipo==='livros') carregarLivros();
    else if (tipo==='pessoas') carregarPessoas();
    else if (tipo==='funcionarios') carregarFuncionarios();
  } else toast(d.msg || 'Erro ao reativar.', 'error');
}

/* ══ COMPROVANTE ══ */
let _impResolve = null;

function perguntarImpressao(msg, titulo, emp, isRenovacao=false) {
  _impResolve = (imprimir) => {
    if (imprimir) abrirPreviewComprovante(emp, isRenovacao);
  };
  document.getElementById('perg-imp-titulo').textContent = titulo;
  document.getElementById('perg-imp-msg').textContent = msg;
  abrirModal('modal-perguntar-impressao');
}

function responderImpressao(sim) {
  fecharModal('modal-perguntar-impressao');
  if (_impResolve) { _impResolve(sim); _impResolve = null; }
}

function reimprimirComprovante(eid, modelo) {
  const emp = todosEmprestimos.find(e=>e.id===eid);
  if (!emp) { toast('Empréstimo não encontrado.','error'); return; }
  // Usar modelo salvo nas configurações se não especificado
  const mod = modelo || localStorage.getItem('bsys_modelo') || 'a4';
  abrirPreviewComprovante(emp, false, mod);
}

function abrirPreviewComprovante(emp, isRenovacao=false, modelo=null) {
  const modImp = modelo || localStorage.getItem('bsys_modelo') || 'a4';
  if (!emp) { toast('Dados do empréstimo não encontrados.','error'); return; }
  const pessoa = todasPessoas.find(p=>p.nome===emp.pessoa_nome) || {nome:emp.pessoa_nome,documento:'',email:'',telefone:'',endereco:''};
  const agora = new Date();
  const dataImp = `${String(agora.getDate()).padStart(2,'0')}/${String(agora.getMonth()+1).padStart(2,'0')}/${agora.getFullYear()} ${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`;
  const livrosPendentes = emp.livros ? emp.livros.filter(l=>!l.devolvido) : [];
  const qtd = livrosPendentes.length;

  const badgeClass = isRenovacao ? 'comp-tipo-badge renovacao' : 'comp-tipo-badge';
  const badgeText = isRenovacao ? 'RENOVAÇÃO DE EMPRÉSTIMO' : 'COMPROVANTE DE EMPRÉSTIMO';
  const renovacaoInfo = isRenovacao ? `
    <div class="comp-renovacao-info">
      <strong>📋 Empréstimo Renovado</strong>
      Nova data de devolução: <strong>${fmtData(emp.data_prevista_devolucao)}</strong>
    </div>` : '';

  const html = `
    <div class="comprovante" id="comp-para-imprimir">
      <div class="comp-logo-area">
        <div class="comp-logo-icon">📚</div>
        <div class="comp-logo-text">
          <h1>BiblioSys</h1>
          <p>Sistema de Gestão de Biblioteca</p>
        </div>
      </div>
      <hr class="comp-divider">
      <div class="${badgeClass}">${badgeText}</div>
      ${renovacaoInfo}

      <div class="comp-section-title">Dados do Leitor</div>
      <div class="comp-grid">
        <div class="comp-field"><span class="comp-field-label">Nome Completo</span><span class="comp-field-value">${pessoa.nome}</span></div>
        <div class="comp-field"><span class="comp-field-label">Documento (CPF/RG)</span><span class="comp-field-value">${pessoa.documento||'—'}</span></div>
        <div class="comp-field"><span class="comp-field-label">Email</span><span class="comp-field-value">${pessoa.email||'—'}</span></div>
        <div class="comp-field"><span class="comp-field-label">Telefone</span><span class="comp-field-value">${pessoa.telefone||'—'}</span></div>
      </div>
      ${pessoa.endereco ? `<div class="comp-field" style="margin-bottom:16px"><span class="comp-field-label">Endereço</span><span class="comp-field-value">${pessoa.endereco}</span></div>` : ''}
      <hr class="comp-divider-light">

      <div class="comp-section-title">Dados do Empréstimo</div>
      <div class="comp-grid">
        <div class="comp-field"><span class="comp-field-label">Data do Empréstimo</span><span class="comp-field-value">${fmtData(emp.data_emprestimo)}</span></div>
        <div class="comp-field"><span class="comp-field-label">Devolução Prevista</span><span class="comp-field-value">${fmtData(emp.data_prevista_devolucao)}</span></div>
        <div class="comp-field"><span class="comp-field-label">Atendido por</span><span class="comp-field-value">${emp.funcionario_nome}</span></div>
        <div class="comp-field"><span class="comp-field-label">Qtd. de Livros</span><span class="comp-field-value">${qtd} item${qtd!==1?'s':''}</span></div>
      </div>
      <hr class="comp-divider-light">

      <div class="comp-section-title">Livros Emprestados</div>
      <table class="comp-livros-table">
        <thead><tr><th>#</th><th>Título do Livro</th></tr></thead>
        <tbody>
          ${livrosPendentes.map((l,i)=>`<tr><td>${i+1}</td><td>${l.titulo}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="comp-total-row">Total: ${qtd} livro${qtd!==1?'s':''}</div>
      <hr class="comp-divider-light">

      <div class="comp-assinatura-area">
        <p class="comp-assinatura-texto">
          Declaro que recebi os livros acima listados em perfeito estado de conservação e me comprometo a devolvê-los até <strong>${fmtData(emp.data_prevista_devolucao)}</strong>, conforme as normas da biblioteca.
        </p>
        <div class="comp-assinaturas">
          <div class="comp-assinatura-box">
            <div class="comp-assinatura-linha">
              <div class="comp-assinatura-nome">${pessoa.nome}</div>
              <div class="comp-assinatura-cargo">Assinatura do Leitor</div>
            </div>
          </div>
          <div class="comp-assinatura-box">
            <div class="comp-assinatura-linha">
              <div class="comp-assinatura-nome">${emp.funcionario_nome}</div>
              <div class="comp-assinatura-cargo">Assinatura do Funcionário</div>
            </div>
          </div>
        </div>
      </div>

      <div class="comp-rodape">
        <span>BiblioSys — Sistema de Gestão de Biblioteca</span>
        <span>Impresso em ${dataImp}</span>
      </div>
    </div>`;

  document.getElementById('comp-preview').innerHTML = html;
  const compEl = document.getElementById('comp-para-imprimir');
  if (compEl) compEl.dataset.modelo = modImp;
  document.getElementById('comp-titulo').textContent = isRenovacao ? '📄 Comprovante de Renovação' : '📄 Comprovante de Empréstimo';
  abrirModal('modal-comprovante');
}

function fecharComprovante() {
  fecharModal('modal-comprovante');
}

function executarImpressao() {
  const comp = document.getElementById('comp-para-imprimir');
  if (!comp) return;
  const modImp = comp.dataset.modelo || localStorage.getItem('bsys_modelo') || 'a4';
  const isTermico = modImp === 'termico';
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();

  const termicoExtra = isTermico
    ? 'body{width:76mm;max-width:76mm}.comprovante{padding:6mm 4mm;font-size:11px}.comp-logo-text h1{font-size:1.1rem}.comp-logo-text p{font-size:9px}.comp-grid{grid-template-columns:1fr}.comp-assinaturas{grid-template-columns:1fr;gap:16px}.comp-field-value{font-size:.82rem}.comp-livros-table th,.comp-livros-table td{padding:3px 4px;font-size:10px}.comp-rodape{flex-direction:column;gap:2px;font-size:9px}'
    : '';

  const pageRule = isTermico
    ? '@page{margin:3mm;size:80mm auto}'
    : '@page{margin:1.2cm;size:A4}';

  const cssBase = [
    '*{box-sizing:border-box;margin:0;padding:0}',
    "body{font-family:'Open Sans',Arial,sans-serif;background:#fff;color:#111}",
    '.comprovante{padding:32px 40px;max-width:100%}',
    '.comp-logo-area{display:flex;align-items:center;gap:12px;margin-bottom:6px}',
    '.comp-logo-icon{font-size:2rem}',
    '.comp-logo-text h1{font-size:1.4rem;font-weight:800;color:#1a1a2e;margin:0}',
    '.comp-logo-text p{font-size:.72rem;color:#666;margin:0}',
    'hr.comp-divider{border:none;border-top:2px solid #1a1a2e;margin:10px 0 18px}',
    'hr.comp-divider-light{border:none;border-top:1px solid #ddd;margin:14px 0}',
    '.comp-tipo-badge{display:inline-block;background:#1a1a2e;color:#fff;font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:3px 10px;border-radius:3px;margin-bottom:16px}',
    '.comp-tipo-badge.renovacao{background:#2c5fa8}',
    '.comp-section-title{font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:8px}',
    '.comp-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:4px}',
    '.comp-field{display:flex;flex-direction:column;gap:1px;margin-bottom:6px}',
    '.comp-field-label{font-size:.64rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999}',
    '.comp-field-value{font-size:.86rem;font-weight:600;color:#111}',
    '.comp-livros-table{width:100%;border-collapse:collapse;margin-top:4px}',
    '.comp-livros-table th{font-size:.64rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999;padding:5px 6px;border-bottom:1px solid #ddd;text-align:left}',
    '.comp-livros-table td{padding:6px 6px;border-bottom:1px solid #eee;font-size:.84rem}',
    '.comp-total-row{font-weight:700;font-size:.76rem;color:#555;margin-top:5px}',
    '.comp-assinatura-area{margin-top:24px;padding-top:16px;border-top:1px solid #ddd}',
    '.comp-assinatura-texto{font-size:.79rem;color:#444;line-height:1.6;margin-bottom:24px}',
    '.comp-assinatura-texto strong{color:#111}',
    '.comp-assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:16px}',
    '.comp-assinatura-linha{border-top:1.5px solid #222;padding-top:5px;margin-top:32px}',
    '.comp-assinatura-nome{font-size:.76rem;font-weight:600;color:#333}',
    '.comp-assinatura-cargo{font-size:.66rem;color:#888}',
    '.comp-rodape{margin-top:28px;padding-top:10px;border-top:1px solid #eee;font-size:.65rem;color:#aaa;display:flex;justify-content:space-between}',
    '.comp-renovacao-info{background:#eef4ff;border:1px solid #c0d4f5;border-radius:4px;padding:8px 12px;margin-bottom:14px;font-size:.79rem;color:#2c5fa8}',
    '.comp-renovacao-info strong{display:block;margin-bottom:2px}',
    termicoExtra,
    pageRule
  ].join('\n');

  doc.write(
    '<!DOCTYPE html><html><head>' +
    '<meta charset="UTF-8">' +
    '<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">' +
    '<style>' + cssBase + '</style>' +
    '</head><body>' + comp.outerHTML + '</body></html>'
  );
  doc.close();
  setTimeout(function() {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(function() { document.body.removeChild(iframe); }, 1500);
  }, 600);
}

function imprimirComprovante(tipo) {
  const eid=parseInt(document.getElementById('cfg-emp-imprimir')?.value||'0');
  if(!eid){toast('Selecione um empréstimo.','error');return;}
  reimprimirComprovante(eid, tipo);
}

function toggleLivrosEmp(btn) {
  var detalhe = btn.nextElementSibling;
  var aberto = !detalhe.classList.contains('hidden');
  detalhe.classList.toggle('hidden', aberto);
  btn.textContent = aberto ? 'ver' : 'ocultar';
}