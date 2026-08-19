# SubnetSmith

SubnetSmith is a zero-dependency Python CLI for inspecting, dividing, validating, and exporting IPv4 or IPv6 network plans using Python's standard `ipaddress` module.

## Features

- Inspect network address, broadcast address, masks, address counts, and usable host ranges
- Split a network into smaller equal-prefix subnets
- Check whether an IP address or subnet belongs to another network
- Export subnet plans to CSV
- Reject unsafe or invalid input with clear errors
- Supports both IPv4 and IPv6 and includes unit tests

## Requirements

Python 3.11 or newer. No third-party runtime packages are required.

## Usage

```bash
python -m subnetsmith.cli inspect 192.168.10.0/24
python -m subnetsmith.cli split 192.168.10.0/24 --new-prefix 27
python -m subnetsmith.cli contains 192.168.10.0/24 192.168.10.42
python -m subnetsmith.cli export 10.20.0.0/16 --new-prefix 24 --output vlan-plan.csv
```

Host addresses are not silently accepted as networks. Add `--allow-host-bits` when you intentionally want `192.168.10.42/24` normalized to `192.168.10.0/24`.

## Tests

```bash
python -m unittest discover -s tests -v
```

