"""Ed521 (EdDSA over the Edwards curve E-521) signature verification, pure Python.

Curve E-521: x^2 + y^2 = 1 + d*x^2*y^2 over p = 2^521 - 1, d = -376014.
Encoding and hashing follow the Ed448 pattern (RFC 8032) with SHAKE256 and 66-byte little-endian points.
The domain prefix is a parameter because the exact one used by the TSE is what this module helps determine.
"""
import hashlib

P = 2**521 - 1
D = -376014 % P
Q = 2**519 - 337554763258501705789107630418782636071904961214051226618635150085779108655765
BY = 12
B_LEN = 66


def inv(x):
    return pow(x, P - 2, P)


def sqrt(a):
    # p = 3 mod 4
    r = pow(a, (P + 1) // 4, P)
    return r if r * r % P == a % P else None


def recover_x(y, sign):
    num = (y * y - 1) % P
    den = (D * y * y - 1) % P
    x = sqrt(num * inv(den) % P)
    if x is None:
        return None
    if x & 1 != sign:
        x = P - x
    return x


BX = recover_x(BY, 0)
B = (BX, BY)


def add(a, b):
    (x1, y1), (x2, y2) = a, b
    t = D * x1 * x2 * y1 * y2 % P
    x3 = (x1 * y2 + y1 * x2) * inv(1 + t) % P
    y3 = (y1 * y2 - x1 * x2) * inv(1 - t) % P
    return x3, y3


def mul(k, pt):
    r = (0, 1)
    while k:
        if k & 1:
            r = add(r, pt)
        pt = add(pt, pt)
        k >>= 1
    return r


def decode_point(b):
    v = int.from_bytes(b, "little")
    sign = v >> (8 * B_LEN - 1)
    y = v & ((1 << (8 * B_LEN - 1)) - 1)
    if y >= P:
        return None
    x = recover_x(y, sign)
    return None if x is None else (x, y)


def encode_point(pt):
    x, y = pt
    return (y | ((x & 1) << (8 * B_LEN - 1))).to_bytes(B_LEN, "little")


# projective coordinates (X:Y:Z), x = X/Z, y = Y/Z: no modular inversion per addition
def padd(p1, p2):
    x1, y1, z1 = p1
    x2, y2, z2 = p2
    a = z1 * z2 % P
    b = a * a % P
    c = x1 * x2 % P
    d = y1 * y2 % P
    e = D * c % P * d % P
    f = (b - e) % P
    g = (b + e) % P
    x3 = a * f % P * (((x1 + y1) * (x2 + y2) - c - d) % P) % P
    y3 = a * g % P * ((d - c) % P) % P
    return x3, y3, f * g % P


def pmul(k, pt):
    r = (0, 1, 1)
    q = (pt[0], pt[1], 1)
    while k:
        if k & 1:
            r = padd(r, q)
        q = padd(q, q)
        k >>= 1
    return r


def peq(p1, p2):
    return p1[0] * p2[2] % P == p2[0] * p1[2] % P and p1[1] * p2[2] % P == p2[1] * p1[2] % P


def verify(pub, msg, sig, dom=b""):
    if len(sig) != 2 * B_LEN or len(pub) != B_LEN:
        return False
    a = decode_point(pub)
    r = decode_point(sig[:B_LEN])
    s = int.from_bytes(sig[B_LEN:], "little")
    if a is None or r is None or s >= Q:
        return False
    k = int.from_bytes(hashlib.shake_256(dom + sig[:B_LEN] + pub + msg).digest(2 * B_LEN), "little") % Q
    return peq(pmul(s, B), padd((r[0], r[1], 1), pmul(k, a)))
