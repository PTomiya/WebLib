import urllib.request
import json

try:
    url = 'http://localhost:5000/api/dashboard'
    with urllib.request.urlopen(url) as r:
        data = json.loads(r.read())
    print('Resposta da API /dashboard:')
    print('  emprestados:', data.get('emprestados'))
    print('  pendentes:  ', data.get('pendentes'))
    print('  total_livros:', data.get('total_livros'))
    print('  total_pessoas:', data.get('total_pessoas'))
except Exception as e:
    print('Erro ao acessar a API:', e)
