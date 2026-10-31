"""For every AC URNA machine (2nd round), fetch its vota.vsc from the TSE and record the
machine certificate's notBefore/serial. Resumable: skips prefixes already in the output."""
import csv, json, os, sys, time, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor
from cryptography import x509

DIR = sys.argv[1]
LISTA, SAIDA = os.path.join(DIR, 'lista.csv'), os.path.join(DIR, 'datas.csv')
BASE = 'https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/3221/dados'
UA = {'User-Agent': 'Mozilla/5.0 auditoria-urnas-2026'}
lock = threading.Lock()


def get(url, tries=6):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read()
        except Exception as e:
            if getattr(e, 'code', None) == 404:
                raise
            time.sleep(2 ** i)
    raise RuntimeError('falhou: ' + url)


def certs(b):
    out = []
    for i in range(len(b) - 4):
        if b[i] == 0x30 and b[i + 1] == 0x82:
            n = (b[i + 2] << 8 | b[i + 3]) + 4
            try:
                c = x509.load_der_x509_certificate(b[i:i + n])
            except Exception:
                continue
            out.append(c)
    return out


def um(prefixo, cn):
    uf, mun, z, s = prefixo[6:8], prefixo[8:13], prefixo[13:17], prefixo[17:21]
    pasta = f'{BASE}/{uf}/{mun}/{z}/{s}'
    aux = json.loads(get(f'{pasta}/p003221-{uf}-m{mun}-z{z}-s{s}-aux.json'))
    linhas = []
    for h in aux['hashes']:
        for a in h['arq']:
            if a['nm'].endswith('.vsc'):
                for c in certs(get(f"{pasta}/{h['hash']}/{a['nm']}")):
                    if 'AC URNA' in c.issuer.rfc4514_string():
                        linhas.append([prefixo, cn, h['st'], c.subject.rfc4514_string().split('CN=')[-1].upper(),
                                       c.not_valid_before_utc.isoformat(), hex(c.serial_number)])
    return linhas or [[prefixo, cn, 'sem_cert', '', '', '']]


feitos = set()
if os.path.exists(SAIDA):
    feitos = {r[0] for r in csv.reader(open(SAIDA, encoding='utf-8'))}
todos = [r for r in csv.DictReader(open(LISTA, encoding='utf-8')) if r['prefixo'] not in feitos]
print('faltam', len(todos), flush=True)
f = open(SAIDA, 'a', newline='', encoding='utf-8'); w = csv.writer(f); n = [0]


def tarefa(r):
    try:
        linhas = um(r['prefixo'], r['cn'])
    except Exception as e:
        linhas = [[r['prefixo'], r['cn'], 'erro', str(e)[:80], '', '']]
    with lock:
        w.writerows(linhas); n[0] += 1
        if n[0] % 2000 == 0:
            f.flush(); print(n[0], time.strftime('%H:%M:%S'), flush=True)


with ThreadPoolExecutor(12) as ex:
    list(ex.map(tarefa, todos))
f.close(); print('fim', n[0], flush=True)
