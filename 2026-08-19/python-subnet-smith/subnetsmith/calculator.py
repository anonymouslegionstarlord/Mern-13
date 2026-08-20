import csv
import ipaddress
from pathlib import Path
from typing import Any


Network = ipaddress.IPv4Network | ipaddress.IPv6Network


def parse_network(value: str, strict: bool = True) -> Network:
    try:
        return ipaddress.ip_network(value, strict=strict)
    except ValueError as error:
        raise ValueError(f"invalid network '{value}': {error}") from error


def usable_range(network: Network) -> tuple[str, str, int]:
    if network.version == 4:
        if network.prefixlen == 32:
            return str(network.network_address), str(network.network_address), 1
        if network.prefixlen == 31:
            return str(network.network_address), str(network.broadcast_address), 2
        return str(network.network_address + 1), str(network.broadcast_address - 1), max(network.num_addresses - 2, 0)
    return str(network.network_address), str(network.broadcast_address), network.num_addresses


def describe(value: str, strict: bool = True) -> dict[str, Any]:
    network = parse_network(value, strict)
    first, last, usable = usable_range(network)
    result: dict[str, Any] = {
        "version": network.version,
        "network": str(network),
        "prefix_length": network.prefixlen,
        "network_address": str(network.network_address),
        "last_address": str(network.broadcast_address),
        "total_addresses": network.num_addresses,
        "usable_addresses": usable,
        "first_usable": first,
        "last_usable": last,
        "is_private": network.is_private,
    }
    if network.version == 4:
        result["netmask"] = str(network.netmask)
        result["hostmask"] = str(network.hostmask)
        result["broadcast_address"] = str(network.broadcast_address)
    return result


def split_network(value: str, new_prefix: int, strict: bool = True, limit: int = 4096) -> list[Network]:
    network = parse_network(value, strict)
    if new_prefix <= network.prefixlen or new_prefix > network.max_prefixlen:
        raise ValueError(f"new prefix must be between {network.prefixlen + 1} and {network.max_prefixlen}")
    count = 1 << (new_prefix - network.prefixlen)
    if count > limit:
        raise ValueError(f"split would create {count} subnets; limit is {limit}")
    return list(network.subnets(new_prefix=new_prefix))


def contains(parent: str, candidate: str, strict: bool = True) -> bool:
    network = parse_network(parent, strict)
    try:
        if "/" in candidate:
            child = parse_network(candidate, strict)
            return child.version == network.version and child.subnet_of(network)
        address = ipaddress.ip_address(candidate)
    except ValueError as error:
        raise ValueError(f"invalid address or network '{candidate}': {error}") from error
    return address.version == network.version and address in network


def export_csv(value: str, new_prefix: int, output: str | Path, strict: bool = True) -> Path:
    destination = Path(output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    subnets = split_network(value, new_prefix, strict)
    with destination.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Subnet", "Network Address", "Last Address", "First Usable", "Last Usable", "Usable Addresses"])
        for subnet in subnets:
            first, last, usable = usable_range(subnet)
            writer.writerow([str(subnet), str(subnet.network_address), str(subnet.broadcast_address), first, last, usable])
    return destination

