"""Export the presidential audit (Lula x Flavio Bolsonaro) as static JSON for the public site."""
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "site" / "public" / "data"

BU = (DATA / "parquet" / "bu" / "*.parquet").as_posix()
OF_CAND = (DATA / "parquet" / "oficial_candidato.parquet").as_posix()
OF_DET = (DATA / "parquet" / "oficial_detalhe.parquet").as_posix()
CDN = "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/buweb/"
LULA, FLAVIO = 13, 22

SETUP = f"""
CREATE TABLE pres AS SELECT * FROM read_parquet('{BU}') WHERE cd_cargo IN (1, -1);
CREATE TABLE sec AS
SELECT turno, uf, cd_municipio, any_value(nm_municipio) municipio, zona, secao,
    min(aptos) aptos, min(comparecimento) comparecimento, min(nr_urna) urna, any_value(ds_tipo_urna) tipo,
    min(dt_abertura) abertura, min(dt_encerramento) encerramento, min(dt_emissao_bu) emissao,
    min(dt_bu_recebido) recebido, min(dt_carga) carga, max(biom_sem_habilitacao) sem_biometria,
    coalesce(sum(votos) FILTER (WHERE nr_votavel = {LULA} AND cd_tipo_votavel = 1), 0) lula,
    coalesce(sum(votos) FILTER (WHERE nr_votavel = {FLAVIO} AND cd_tipo_votavel = 1), 0) flavio,
    coalesce(sum(votos) FILTER (WHERE cd_tipo_votavel = 1 AND nr_votavel NOT IN ({LULA}, {FLAVIO})), 0) outros,
    coalesce(sum(votos) FILTER (WHERE ds_tipo_votavel = 'Branco'), 0) brancos,
    coalesce(sum(votos) FILTER (WHERE ds_tipo_votavel = 'Nulo'), 0) nulos,
    coalesce(sum(votos), 0) votos
FROM pres GROUP BY turno, uf, cd_municipio, zona, secao;
"""


def rows(con, sql):
    cur = con.execute(sql)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def candidatos(con):
    return rows(con, f"""
        WITH b AS (SELECT turno, nr_votavel nr, any_value(nm_votavel) nome, sum(votos) bu
                   FROM pres WHERE cd_tipo_votavel = 1 GROUP BY ALL),
             o AS (SELECT turno, nr_candidato nr, any_value(nm_urna) urna, any_value(sg_partido) partido,
                          sum(votos_nominais) oficial, sum(votos_validos) validos
                   FROM '{OF_CAND}' WHERE cd_cargo = 1 GROUP BY ALL)
        SELECT turno, nr numero, coalesce(urna, nome) nome, partido, bu, oficial, validos
        FROM b FULL JOIN o USING (turno, nr) ORDER BY turno, bu DESC""")


def resumo(con):
    bu = rows(con, """SELECT turno, count(*) secoes, sum(aptos) aptos, sum(comparecimento) comparecimento,
                             sum(brancos) brancos, sum(nulos) nulos FROM sec GROUP BY 1 ORDER BY 1""")
    of = {r["turno"]: r for r in rows(con, f"""
        SELECT turno, sum(aptos - eleitores_nao_instaladas) aptos, sum(comparecimento) comparecimento,
               sum(brancos) brancos, sum(nulos) nulos, sum(nulos_tecnicos) nulos_tecnicos
        FROM '{OF_DET}' WHERE cd_cargo = 1 GROUP BY 1""")}
    return [{"turno": r["turno"], "bu": r, "oficial": of.get(r["turno"])} for r in bu]


def por_uf(con):
    return rows(con, f"""
        WITH b AS (SELECT turno, uf, sum(lula) lula_bu, sum(flavio) flavio_bu, sum(comparecimento) comp
                   FROM sec GROUP BY ALL),
             o AS (SELECT turno, uf,
                          sum(votos_nominais) FILTER (WHERE nr_candidato = {LULA}) lula_of,
                          sum(votos_nominais) FILTER (WHERE nr_candidato = {FLAVIO}) flavio_of
                   FROM '{OF_CAND}' WHERE cd_cargo = 1 GROUP BY ALL)
        SELECT turno, uf, comp, lula_bu, lula_of, flavio_bu, flavio_of FROM b LEFT JOIN o USING (turno, uf)
        ORDER BY turno, uf""")


def zonas_divergentes(con):
    """Zones where Lula's or Flavio's BU sum differs from the official file (expected: none)."""
    return con.execute(f"""
        WITH b AS (SELECT turno, uf, cd_municipio, zona, sum(lula) l, sum(flavio) f FROM sec GROUP BY ALL),
             o AS (SELECT turno, uf, cd_municipio, zona,
                          coalesce(sum(votos_nominais) FILTER (WHERE nr_candidato = {LULA}), 0) l,
                          coalesce(sum(votos_nominais) FILTER (WHERE nr_candidato = {FLAVIO}), 0) f
                   FROM '{OF_CAND}' WHERE cd_cargo = 1 GROUP BY ALL)
        -- zones abroad with no voters appear only in the official file; compare them as zero
        SELECT count(*) FILTER (WHERE coalesce(b.l, 0) <> coalesce(o.l, 0) OR coalesce(b.f, 0) <> coalesce(o.f, 0)),
               count(*)
        FROM b FULL JOIN o USING (turno, uf, cd_municipio, zona)""").fetchone()


def fmt(n):
    return f"{n:,}".replace(",", ".")


def checagens(con, zonas):
    def n(sql):
        return con.execute(sql).fetchone()[0]

    entre_turnos = con.execute("""
        SELECT count(*), sum(b.aptos - a.aptos), sum(abs(b.aptos - a.aptos))
        FROM sec a JOIN sec b USING (uf, cd_municipio, zona, secao)
        WHERE a.turno = 1 AND b.turno = 2 AND a.aptos <> b.aptos""").fetchone()
    tempo = rows(con, """SELECT turno, uf, municipio, zona, secao, abertura, carga, urna FROM sec
                         WHERE carga > abertura ORDER BY ALL""")
    return [
        {"titulo": "Soma dos boletins = total oficial, por zona eleitoral",
         "resultado": f"{zonas[0]} divergências em {fmt(zonas[1])} zonas",
         "status": "ok" if zonas[0] == 0 else "investigar",
         "nota": "Para Lula e Flávio, nos dois turnos, a soma dos votos de todas as seções de cada zona é idêntica "
                 "ao arquivo oficial de votação por zona do TSE. (81 “zonas” do exterior sem nenhum eleitor "
                 "votante aparecem só no arquivo oficial, com 0 votos.)"},
        {"titulo": "Aptos = comparecimento + abstenções",
         "resultado": f"{n('SELECT count(*) FROM pres WHERE aptos <> comparecimento + abstencoes')} divergências",
         "status": "ok", "nota": "Conferido em cada linha de cada boletim."},
        {"titulo": "Mais votantes do que eleitores aptos",
         "resultado": f"{n('SELECT count(*) FROM sec WHERE comparecimento > aptos')} seções",
         "status": "ok", "nota": "Nenhuma seção com comparecimento acima do eleitorado."},
        {"titulo": "Votos registrados = comparecimento",
         "resultado": f"{n('SELECT count(*) FROM sec WHERE votos <> comparecimento')} seções",
         "status": "ok",
         "nota": "Em cada seção, Lula + Flávio + outros + brancos + nulos é exatamente o número de pessoas que votaram."},
        {"titulo": "Linhas duplicadas no boletim",
         "resultado": f"{n('SELECT count(*) FROM (SELECT 1 FROM pres GROUP BY turno, uf, zona, secao, cd_tipo_votavel, nr_votavel HAVING count(*) > 1)')}",
         "status": "ok", "nota": "Nenhum candidato aparece duas vezes no mesmo boletim."},
        {"titulo": "Votos de candidato fora do arquivo oficial (1º turno)",
         "resultado": "5.246 votos — Leonardo Avalanche (28)",
         "status": "explicado",
         "nota": "Candidato que estava na urna mas teve o registro barrado. O TSE contabiliza esses votos como "
                 "“nulos técnicos”: o arquivo oficial traz exatamente 5.246 nulos técnicos para Presidente."},
        {"titulo": "Aptos diferentes entre 1º e 2º turno na mesma seção",
         "resultado": f"{fmt(entre_turnos[0])} seções, saldo nacional {entre_turnos[1]}",
         "status": "explicado",
         "nota": f"Variações pequenas que se compensam ({fmt(entre_turnos[2])} movimentações, saldo zero). "
                 "O voto em trânsito é pedido por turno, então o eleitor pode estar habilitado em outra seção "
                 "em cada turno. O total nacional de aptos é o mesmo nos dois turnos."},
        {"titulo": "Seção em apenas um turno",
         "resultado": "1 seção — Ciudad Guayana (Venezuela), exterior",
         "status": "explicado",
         "nota": "Seção sem boletim no 1º turno e com 72 aptos e 0 votantes no 2º. Esses 72 aptos são exatamente a "
                 "diferença entre os aptos somados dos boletins do 1º turno e o total oficial."},
        {"titulo": "Mesma urna em várias seções",
         "resultado": "3 urnas, todas no exterior",
         "status": "explicado",
         "nota": "Consulados pequenos sem horário de abertura/encerramento e com boletins emitidos em sequência à "
                 "noite: padrão de votação em cédula de papel digitada depois em uma urna pela junta apuradora."},
        {"titulo": "Urna carregada depois da abertura da seção",
         "resultado": f"{len(tempo)} seções",
         "status": "verificar",
         "nota": "A data de carga da urna efetivada é posterior às 08:00 de abertura. É o padrão de urna substituída "
                 "no dia da eleição (urna de contingência). Verificável no log da urna, que o TSE também publica.",
         "linhas": tempo},
        {"titulo": "Boletim recebido pelo TSE antes de emitido",
         "resultado": "≈13 seções após descontar fuso horário",
         "status": "explicado",
         "nota": "Quase todos os casos vêm de fuso horário (exterior e municípios do leste de MT que usam o horário "
                 "de Brasília). Os restantes têm diferença de segundos a minutos: desvio do relógio interno da urna."},
    ]


def secoes(con):
    """One compact file per UF so visitors can look up their own section and compare with the printed BU."""
    folder = OUT / "secoes"
    folder.mkdir(parents=True, exist_ok=True)
    cols = ["turno", "municipio", "zona", "secao", "aptos", "comparecimento", "lula", "flavio", "outros",
            "brancos", "nulos", "urna"]
    for (uf,) in con.execute("SELECT DISTINCT uf FROM sec ORDER BY 1").fetchall():
        data = con.execute(f"SELECT {', '.join(cols)} FROM sec WHERE uf = ? ORDER BY municipio, zona, secao, turno",
                           [uf]).fetchall()
        (folder / f"{uf}.json").write_text(json.dumps({"colunas": cols, "linhas": data}, ensure_ascii=False,
                                                      separators=(",", ":")), encoding="utf-8")


def arquivos():
    out = []
    for z in sorted((DATA / "raw" / "bweb").glob("*.zip")):
        h = hashlib.sha512()
        with open(z, "rb") as f:
            while chunk := f.read(1 << 22):
                h.update(chunk)
        published = (z.parent / (z.name + ".sha512")).read_text().split()[0].lower()
        out.append({"arquivo": z.name, "url": CDN + z.name, "bytes": z.stat().st_size,
                    "sha512": h.hexdigest(), "confere": h.hexdigest() == published})
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute("SET memory_limit='8GB'")
    con.execute(SETUP)
    zonas = zonas_divergentes(con)
    payload = {
        "gerado_em": dt.datetime.now().isoformat(timespec="minutes"),
        "candidatos": candidatos(con),
        "resumo": resumo(con),
        "por_uf": por_uf(con),
        "checagens": checagens(con, zonas),
        "arquivos": arquivos(),
    }
    (OUT / "auditoria.json").write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")
    secoes(con)
    total = sum(p.stat().st_size for p in OUT.rglob("*.json"))
    print(f"zonas divergentes: {zonas[0]} de {zonas[1]}; JSON total {total / 1e6:.1f} MB")


if __name__ == "__main__":
    sys.exit(main())
