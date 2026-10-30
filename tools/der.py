"""Minimal schema-less DER/BER reader used to inspect and extract TSE ballot-box files."""


def parse(data, offset=0, end=None):
    """Yield (tag, constructed, value_bytes_or_children) for each TLV between offset and end."""
    end = len(data) if end is None else end
    out = []
    while offset < end:
        tag = data[offset]
        offset += 1
        if tag & 0x1F == 0x1F:
            t = 0
            while data[offset] & 0x80:
                t = (t << 7) | (data[offset] & 0x7F)
                offset += 1
            t = (t << 7) | data[offset]
            offset += 1
            tag = (tag << 16) | t
        length = data[offset]
        offset += 1
        if length & 0x80:
            n = length & 0x7F
            length = int.from_bytes(data[offset:offset + n], "big")
            offset += n
        constructed = bool((tag >> 16 if tag > 0xFF else tag) & 0x20)
        value = data[offset:offset + length]
        out.append((tag, constructed, parse(data, offset, offset + length) if constructed else bytes(value)))
        offset += length
    return out


def show(nodes, depth=0, max_depth=6, max_items=8):
    for i, (tag, cons, val) in enumerate(nodes):
        if i == max_items:
            print("  " * depth + f"... (+{len(nodes) - max_items})")
            break
        if cons:
            print("  " * depth + f"{tag:02x} [{len(val)}]")
            if depth < max_depth:
                show(val, depth + 1, max_depth, max_items)
        else:
            txt = val.decode("latin-1") if val and all(32 <= b < 127 for b in val) else val.hex()
            print("  " * depth + f"{tag:02x} {txt[:60]}")


def integer(b):
    return int.from_bytes(b, "big", signed=True)
