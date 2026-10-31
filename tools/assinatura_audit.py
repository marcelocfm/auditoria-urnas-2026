"""Verify each machine's Ed521 signature on its signature file (vota.vsc), plus who issued its certificate.

Chain checked: every published file's SHA-512 is listed in the signed content (urna_audit.py already checks that);
h = SHA-512(content) is stored next to the signature; the machine key signs SHA-512(h) with PureEd521
(ITI DOC-ICP-01.01, dom "SigEd521", phflag 0, empty context). The certificate's own signature by the TSE CA
(AC UE2022) is not checked: the CA certificate is not in the published packages.

Usage: python -I tools/assinatura_audit.py <zip> [<zip> ...]   -> data/assinatura/<UF>.parquet
"""
import base64
import hashlib
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pyarrow as pa
from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID
import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parent))
import der  # noqa: E402
import ed521  # noqa: E402
from urna_audit import open_zip  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "assinatura"
DOM = b"SigEd521\x00\x00"


def cert_info(pem):
    b = base64.b64decode(b"".join(l for l in pem.split(b"\n") if l and not l.startswith(b"-----")))
    tbs = der.parse(b)[0][2][0][2]
    pub = [x for x in tbs if x[1] and x[2] and x[2][0][1] and len(x[2]) == 2 and x[2][1][0] == 0x03][0][2][1][2][1:]
    texto = b.decode("latin-1")
    cn = re.findall(r"(UE[A-Z]{2}\d{8}|AC UE\d{4})", texto)
    serial = tbs[1][2].hex() if tbs[1][0] == 0x02 else tbs[0][2].hex()
    return pub, cn, serial


def tlv_end(b, i):
    """End offset of the DER element starting at b[i]."""
    n = b[i + 1]
    if n & 0x80:
        k = n & 0x7F
        return i + 2 + k + int.from_bytes(b[i + 2:i + 2 + k], "big")
    return i + 2 + n


def pem_der(pem):
    return base64.b64decode(b"".join(l for l in pem.split(b"\n") if l and not l.startswith(b"-----")))


# public CA certificates from the TSE's own format documentation package (see data/certificados)
AC = {}
for _f in (ROOT / "data" / "certificados").glob("*.pem"):
    _der = pem_der(_f.read_bytes())
    _cn = re.findall(r"AC (?:UE\d{4}|URNA)", _der.decode("latin-1"))
    AC[_cn[-1] if _cn else _f.stem] = _der


def cadeia_ed521(cert_der, emissor):
    """Ed521 machine certificate: PureEd521 signature of the issuing CA over the raw tbsCertificate."""
    ac = AC.get(emissor)
    if ac is None:
        return None
    pub_ac, _, _ = cert_info(b"-----\n" + base64.b64encode(ac) + b"\n-----")
    i = 2 + (cert_der[1] & 0x7F if cert_der[1] & 0x80 else 0)
    j = tlv_end(cert_der, i)
    tbs = cert_der[i:j]
    k = tlv_end(cert_der, j)  # signatureAlgorithm
    sig = cert_der[k:tlv_end(cert_der, k)]
    hdr = 2 + (sig[1] & 0x7F if sig[1] & 0x80 else 0)
    return ed521.verify(pub_ac, tbs, sig[hdr + 1:], DOM)


def section(args):
    zip_path, prefix = args
    row = {"prefixo": prefix, "erro": None}
    try:
        z, names = open_zip(zip_path)
        vsc = next((prefix + s for s in ("vota.vsc", "red.vsc", "sa.vsc") if prefix + s in names), None)
        if not vsc:
            row["erro"] = "sem arquivo de assinatura"
            return row
        d = z.read(vsc)
        ents = der.parse(d)[0][2]
        e = ents[1][2]
        conteudo = e[3][2]
        sig = e[2][2][3][2]
        h, s = sig[1][2], sig[2][2]
        row["hash_confere"] = hashlib.sha512(conteudo).digest() == h
        cert = e[4][2]
        if cert.startswith(b"-----"):  # Ed521 machines: PEM certificate with the TSE's own algorithm OID
            pub, cn, serial = cert_info(cert)
            row["algoritmo"] = "Ed521"
            row["certificado"] = cn[1] if len(cn) > 1 else (cn[0] if cn else None)
            row["emissor"] = cn[0] if cn else None
            row["serial"] = serial
            row["assinatura_valida"] = ed521.verify(pub, hashlib.sha512(h).digest(), s, DOM)
            row["cadeia_valida"] = cadeia_ed521(pem_der(cert), row["emissor"])
        else:  # older machines: DER certificate, standard ECDSA P-521 / SHA-512 over h
            n = cert[1] & 0x7F if cert[1] & 0x80 else 0
            total = 2 + n + (int.from_bytes(cert[2:2 + n], "big") if n else cert[1])
            row["bytes_extras_certificado"] = len(cert) - total  # some files pad the DER certificate
            c = x509.load_der_x509_certificate(cert[:total])
            row["algoritmo"] = "ECDSA P-521"
            row["certificado"] = c.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
            row["emissor"] = c.issuer.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
            row["serial"] = format(c.serial_number, "x")
            try:
                c.public_key().verify(s, h, ec.ECDSA(hashes.SHA512()))
                row["assinatura_valida"] = True
            except InvalidSignature:
                row["assinatura_valida"] = False
            ac = AC.get(row["emissor"])
            if ac is None:
                row["cadeia_valida"] = None
            else:
                try:
                    c.verify_directly_issued_by(x509.load_der_x509_certificate(ac))
                    row["cadeia_valida"] = True
                except (InvalidSignature, ValueError, TypeError):
                    row["cadeia_valida"] = False
    except Exception as ex:  # report per section, keep going
        row["erro"] = f"{type(ex).__name__}: {ex}"[:200]
    return row


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sys.argv[1:]:
        uf = re.search(r"_(\dt)_([A-Z]{2})\.zip$", path)
        nome = f"{uf.group(2)}_{uf.group(1)}"
        z, names = open_zip(path)
        prefixes = sorted({n.rsplit("-", 1)[0] + "-" for n in names if n.endswith("-bu.dat")})
        with ProcessPoolExecutor(14) as pool:
            rows = list(pool.map(section, [(path, p) for p in prefixes], chunksize=16))
        pq.write_table(pa.Table.from_pylist(rows), OUT / f"{nome}.parquet")
        ok = sum(1 for r in rows if r.get("assinatura_valida"))
        print(nome, len(rows), "urnas,", ok, "assinaturas validas,", sum(1 for r in rows if r["erro"]), "erros", flush=True)


if __name__ == "__main__":
    sys.exit(main())
