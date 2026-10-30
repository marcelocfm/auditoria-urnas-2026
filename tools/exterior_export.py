"""Presidential votes abroad grouped by country (both rounds) -> site/public/data/exterior.json.

The TSE files only name the city of each polling station abroad; the city -> country map below covers all of them.
`PRINCIPAIS` is the short list shown in the site's menu.
"""
import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
BU = (ROOT / "data" / "parquet" / "bu" / "*_ZZ_*.parquet").as_posix()
OUT = ROOT / "site" / "public" / "data" / "exterior.json"

PAIS = {
    "Estados Unidos": ["BOSTON", "MIAMI", "NOVA YORK", "ORLANDO", "ATLANTA", "LOS ANGELES", "WASHINGTON", "HOUSTON",
                       "SÃO FRANCISCO", "CHICAGO", "HARTFORD"],
    "Portugal": ["LISBOA", "PORTO", "FARO"],
    "Japão": ["NAGÓIA", "TÓQUIO", "HAMAMATSU"],
    "Reino Unido": ["LONDRES", "EDIMBURGO"],
    "Itália": ["MILÃO", "ROMA"],
    "França": ["PARIS", "MARSELHA"],
    "Alemanha": ["BERLIM", "MUNIQUE", "FRANKFURT"],
    "Espanha": ["MADRI", "BARCELONA"],
    "Canadá": ["TORONTO", "MONTREAL", "VANCOUVER", "OTTAWA"],
    "Irlanda": ["DUBLIN"],
    "Suíça": ["ZURIQUE", "GENEBRA"],
    "Países Baixos": ["AMSTERDÃ"],
    "Austrália": ["SYDNEY", "CAMBERRA"],
    "Argentina": ["BUENOS AIRES", "CÓRDOBA", "MENDOZA", "PUERTO IGUAZÚ", "PASO LOS LIBRES"],
    "Bélgica": ["BRUXELAS"],
    "Paraguai": ["CIUDAD DEL ESTE", "ASSUNÇÃO", "SALTO DEL GUAIRÁ", "PEDRO JUAN CABALLERO", "ENCARNACIÓN", "CONCEPCIÓN"],
    "Líbano": ["BEIRUTE"],
    "Israel": ["TEL AVIV"],
    "Suécia": ["ESTOCOLMO"],
    "Chile": ["SANTIAGO"],
    "México": ["MEXICO"],
    "China": ["XANGAI", "PEQUIM", "CANTÃO", "HONG KONG"],
    "Coreia do Sul": ["SEUL"],
    "Rússia": ["MOSCOU"],
    "Emirados Árabes": ["ABU DHABI"],
    "Uruguai": ["MONTEVIDÉU", "ARTIGAS", "RIO BRANCO"],
    "Bolívia": ["SANTA CRUZ DE LA SIERRA", "LA PAZ", "COCHABAMBA"],
    "Dinamarca": ["COPENHAGUE"],
    "Áustria": ["VIENA"],
    "Noruega": ["OSLO"],
    "Finlândia": ["HELSINQUE"],
    "Grécia": ["ATENAS"],
    "Nova Zelândia": ["WELLINGTON"],
    "África do Sul": ["PRETÓRIA", "CIDADE DO CABO"],
    "Índia": ["NOVA DELHI", "MUMBAI"],
    "Turquia": ["ISTAMBUL", "ANCARA"],
    "Guiana Francesa": ["CAIENA"],
    "Palestina": ["RAMALLAH"],
    "Jordânia": ["AMÃ"],
    "Peru": ["LIMA"],
    "Panamá": ["PANAMA"],
    "Colômbia": ["BOGOTÁ"],
    "Suriname": ["PARAMARIBO"],
    "Hungria": ["BUDAPESTE"],
    "República Tcheca": ["PRAGA"],
    "Costa Rica": ["SÃO JOSÉ"],
    "Polônia": ["VARSÓVIA"],
    "Catar": ["DOHA"],
    "Equador": ["QUITO"],
    "Singapura": ["SINGAPURA"],
    "Angola": ["LUANDA"],
    "Venezuela": ["CARACAS", "CIUDAD GUAYANA"],
    "Moçambique": ["MAPUTO"],
    "Taiwan": ["TAIPÉ"],
    "República Dominicana": ["SÃO DOMINGOS"],
    "Estônia": ["TALIN"],
    "Guatemala": ["GUATEMALA"],
    "Síria": ["DAMASCO"],
    "Tailândia": ["BANGKOK"],
    "Eslovênia": ["LIUBLIANA"],
    "Malásia": ["KUALA LUMPUR"],
    "Senegal": ["DACAR"],
    "Arábia Saudita": ["RIADE"],
    "Kuwait": ["KUAITE"],
    "Cabo Verde": ["PRAIA"],
    "Egito": ["CAIRO"],
    "El Salvador": ["SÃO SALVADOR"],
    "Nicarágua": ["MANÁGUA"],
    "Filipinas": ["MANILA"],
    "Romênia": ["BUCARESTE"],
    "Honduras": ["TEGUCIGALPA"],
    "Eslováquia": ["BRATISLAVA"],
    "Croácia": ["ZAGREB"],
    "Guiana": ["GEORGETOWN"],
    "Chipre": ["NICOSIA"],
    "Costa do Marfim": ["ABIDJÃ"],
    "Bulgária": ["SÓFIA"],
    "Timor-Leste": ["DÍLI"],
    "Sérvia": ["BELGRADO"],
    "Quênia": ["NAIRÓBI"],
    "Cuba": ["HAVANA"],
    "Guiné-Bissau": ["BISSAU"],
    "Bahrein": ["BAREIN"],
    "Indonésia": ["JACARTA"],
    "Marrocos": ["RABAT"],
    "Nigéria": ["LAGOS"],
    "Omã": ["MASCATE"],
    "Vietnã": ["HANÓI"],
    "Irã": ["TEERÃ"],
    "Argélia": ["ARGEL"],
    "Tunísia": ["TUNIS"],
    "Trinidad e Tobago": ["PORT OF SPAIN"],
    "Bahamas": ["NASSAU"],
    "Ucrânia": ["KIEV"],
    "Tanzânia": ["DAR ES SALAAM"],
    "Jamaica": ["KINGSTON-JAMAICA"],
    "Nepal": ["KATMANDU"],
    "Gana": ["ACCRA"],
    "Namíbia": ["WINDHOEK"],
    "Haiti": ["PORTO PRÍNCIPE"],
    "Líbia": ["TRÍPOLI"],
}

PRINCIPAIS = ["Estados Unidos", "Portugal", "Japão", "Reino Unido", "Itália", "França", "Alemanha", "Espanha", "Canadá",
              "Irlanda", "Suíça", "Países Baixos", "Austrália", "Argentina", "Paraguai", "Bélgica", "Israel", "Líbano",
              "Chile", "México", "Suécia", "China", "Coreia do Sul", "Rússia", "Emirados Árabes"]


def main():
    con = duckdb.connect()
    cidade_pais = [(c, p) for p, cs in PAIS.items() for c in cs]
    con.execute("CREATE TABLE mapa (cidade VARCHAR, pais VARCHAR)")
    con.executemany("INSERT INTO mapa VALUES (?, ?)", cidade_pais)
    con.execute(f"""CREATE TABLE s AS
        SELECT turno, nm_municipio cidade, secao, min(aptos) aptos, min(comparecimento) comp,
               coalesce(sum(votos) FILTER (WHERE nr_votavel = 13 AND cd_tipo_votavel = 1), 0) lula,
               coalesce(sum(votos) FILTER (WHERE nr_votavel = 22 AND cd_tipo_votavel = 1), 0) flavio,
               coalesce(sum(votos) FILTER (WHERE cd_tipo_votavel = 1 AND nr_votavel NOT IN (13, 22)), 0) outros,
               coalesce(sum(votos) FILTER (WHERE ds_tipo_votavel = 'Branco'), 0) brancos,
               coalesce(sum(votos) FILTER (WHERE ds_tipo_votavel = 'Nulo'), 0) nulos
        FROM read_parquet('{BU}') WHERE cd_cargo IN (1, -1) GROUP BY ALL""")
    sem_pais = [r[0] for r in con.execute(
        "SELECT DISTINCT cidade FROM s WHERE cidade NOT IN (SELECT cidade FROM mapa) ORDER BY 1").fetchall()]
    if sem_pais:
        sys.exit(f"cidades sem país no mapa: {sem_pais}")

    def agrega(chave):
        cur = con.execute(f"""SELECT {chave}, turno, count(*) secoes, sum(aptos) aptos, sum(comp) comparecimento,
                                     sum(lula) lula, sum(flavio) flavio, sum(outros) outros, sum(brancos) brancos, sum(nulos) nulos
                              FROM s JOIN mapa USING (cidade) GROUP BY ALL ORDER BY ALL""")
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]

    paises = {}
    for r in agrega("pais"):
        p = paises.setdefault(r["pais"], {"pais": r["pais"], "turnos": {}, "cidades": {}})
        p["turnos"][r["turno"]] = {k: v for k, v in r.items() if k not in ("pais", "turno")}
    for r in agrega("pais, cidade"):
        c = paises[r["pais"]]["cidades"].setdefault(r["cidade"], {})
        c[r["turno"]] = {k: v for k, v in r.items() if k not in ("pais", "cidade", "turno")}
    total = agrega("'Exterior' AS pais")
    payload = {
        "principais": [paises[p] for p in PRINCIPAIS],
        "total": {r["turno"]: {k: v for k, v in r.items() if k not in ("pais", "turno")} for r in total},
        "paises_com_secao": len(paises),
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")
    for p in payload["principais"][:6]:
        print(p["pais"], p["turnos"].get(2))
    print("países com seção:", payload["paises_com_secao"], "| total 2t:", payload["total"].get(2))


if __name__ == "__main__":
    sys.exit(main())
