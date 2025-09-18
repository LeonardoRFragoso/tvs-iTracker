#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Discover a TV or device on the local network by its friendly name and report
its IP and MAC address.

Search strategies (in order):
1) mDNS/Zeroconf dynamic discovery for multiple services (Android TV, HTTP, etc.)
2) DNS/LLMNR hostname resolution attempts from friendly name
3) SSDP/UPnP (best-effort)
4) Google Cast discovery (pychromecast) ONLY if it yields a valid IP

The script performs careful lifecycle cleanup to avoid Zeroconf issues
(ensuring browsers are stopped and instances are closed).

Usage (Windows):
  python backend/discover_device.py --name "itracker auditorio" --timeout 20

Requirements (already present in this repo):
  - pychromecast
  - zeroconf
  - requests
"""

import argparse
import logging
import platform
import re
import socket
import subprocess
import sys
import time
import unicodedata
import ipaddress
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple

import requests

try:
    import pychromecast  # type: ignore
except Exception:
    pychromecast = None

try:
    from zeroconf import ServiceBrowser, Zeroconf  # type: ignore
except Exception:
    Zeroconf = None  # type: ignore
    ServiceBrowser = None  # type: ignore


def normalize(text: str) -> str:
    s = (text or "").strip().lower()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[\s_\-]+", " ", s)
    return s


def name_matches(candidate: str, target: str) -> bool:
    c = normalize(candidate)
    t = normalize(target)
    return c == t or t in c or c in t


def is_valid_ip(ip: Optional[str]) -> bool:
    if not ip:
        return False
    try:
        ipaddress.ip_address(ip)
        return True
    except Exception:
        return False


@dataclass
class FoundDevice:
    name: str
    ip: str
    mac: Optional[str] = None
    source: Optional[str] = None
    port: Optional[int] = None
    extra: Optional[Dict] = None


# -------------------------
# MAC address resolution
# -------------------------

def ping_ip(ip: str, timeout_ms: int = 800) -> None:
    try:
        if platform.system().lower().startswith("win"):
            subprocess.run(["ping", "-n", "1", "-w", str(timeout_ms), ip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            # -c 1 one packet, -W timeout seconds (convert ms to s, min 1)
            sec = max(1, int(timeout_ms / 1000))
            subprocess.run(["ping", "-c", "1", "-W", str(sec), ip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def get_mac_for_ip(ip: str) -> Optional[str]:
    if not is_valid_ip(ip):
        return None

    # Nudge ARP table first
    ping_ip(ip)

    mac_regex = re.compile(r"([0-9A-Fa-f]{2}([:\-])){5}([0-9A-Fa-f]{2})")
    try:
        if platform.system().lower().startswith("win"):
            # Windows: arp -a <ip>
            out = subprocess.check_output(["arp", "-a", ip], text=True, errors="ignore")
        else:
            # Linux/mac: try arp -n <ip> else fallback to arp <ip>
            try:
                out = subprocess.check_output(["arp", "-n", ip], text=True, errors="ignore")
            except Exception:
                out = subprocess.check_output(["arp", ip], text=True, errors="ignore")
        m = mac_regex.search(out or "")
        if m:
            return m.group(0).lower()
    except Exception:
        return None
    return None


# -------------------------
# Strategy 0: DNS/LLMNR hostname
# -------------------------

def find_by_hostname_variations(target_name: str) -> Optional[FoundDevice]:
    variants = {
        target_name,
        target_name.replace(" ", "-"),
        target_name.replace(" ", ""),
        normalize(target_name).replace(" ", "-"),
        normalize(target_name).replace(" ", ""),
    }
    for host in list(variants):
        try:
            infos = socket.getaddrinfo(host, None)
            for family, _, _, canonname, sockaddr in infos:
                ip = sockaddr[0] if isinstance(sockaddr, tuple) else None
                if is_valid_ip(ip):
                    return FoundDevice(name=target_name, ip=ip, source="dns/llmnr")
        except Exception:
            continue
    return None


# -------------------------
# Strategy 1: Google Cast (fallback only)
# -------------------------

def find_by_pychromecast(target_name: str, timeout: int = 10) -> Optional[FoundDevice]:
    if pychromecast is None:
        return None

    browser = None
    try:
        chromecasts, browser = pychromecast.get_chromecasts(timeout=timeout)
        best: Optional[FoundDevice] = None
        for cast in chromecasts:
            try:
                cast_name = getattr(cast, "name", None) or getattr(cast, "friendly_name", None) or ""
                if not cast_name:
                    continue
                if not name_matches(cast_name, target_name):
                    continue

                # Light wait to populate socket_client host
                try:
                    cast.wait(timeout=2)
                except Exception:
                    pass

                ip = getattr(cast, "host", None) or getattr(cast, "ip", None)
                if not ip and getattr(cast, "socket_client", None):
                    ip = getattr(cast.socket_client, "host", None)
                port = getattr(cast, "port", None) or (getattr(cast, "socket_client", None) and getattr(cast.socket_client, "port", None)) or 8009

                # Only accept if IP is valid
                if not is_valid_ip(ip):
                    continue

                uuid_str = None
                try:
                    uuid_val = getattr(cast, "uuid", None)
                    if uuid_val is not None:
                        uuid_str = str(uuid_val)
                except Exception:
                    pass

                best = FoundDevice(
                    name=cast_name,
                    ip=str(ip),
                    port=int(port) if isinstance(port, int) else 8009,
                    source="pychromecast",
                    extra={
                        "uuid": uuid_str,
                        "model": getattr(cast, "model_name", None),
                        "cast_type": getattr(cast, "cast_type", None),
                        "manufacturer": getattr(cast, "manufacturer", None),
                    },
                )
                if normalize(cast_name) == normalize(target_name):
                    break
            except Exception:
                continue
        return best
    except Exception as e:
        logging.debug(f"pychromecast discovery error: {e}")
        return None
    finally:
        try:
            if browser is not None:
                pychromecast.discovery.stop_discovery(browser)  # important cleanup
        except Exception:
            pass


# -------------------------
# Strategy 2: mDNS/Zeroconf
# -------------------------

class _MdnsListener:
    def __init__(self, target_name: str):
        self.target_name = target_name
        self.found: Optional[FoundDevice] = None

    def remove_service(self, zc: Zeroconf, service_type: str, name: str) -> None:  # type: ignore[valid-type]
        return

    def add_service(self, zc: Zeroconf, service_type: str, name: str) -> None:  # type: ignore[valid-type]
        try:
            info = zc.get_service_info(service_type, name, timeout=2000)
            if not info:
                return
            instance = name.split(".")[0]
            props = {k.decode(errors="ignore"): v.decode(errors="ignore") for k, v in (info.properties or {}).items() if isinstance(k, (bytes, bytearray))}

            friendly = props.get("fn") or props.get("n") or instance
            if not name_matches(friendly, self.target_name) and not name_matches(instance, self.target_name):
                return

            addrs = []
            try:
                addrs = info.parsed_addresses()  # type: ignore[attr-defined]
            except Exception:
                pass
            ip = addrs[0] if addrs else None

            if is_valid_ip(ip):
                self.found = FoundDevice(
                    name=friendly,
                    ip=str(ip),
                    port=info.port or None,
                    source=f"mdns:{service_type}",
                    extra={
                        "server": getattr(info, "server", None),
                        "properties": props,
                    },
                )
        except Exception:
            return

    def update_service(self, zc: Zeroconf, service_type: str, name: str) -> None:  # type: ignore[valid-type]
        # Treat updates the same as adds for our purposes
        self.add_service(zc, service_type, name)


class _ServiceTypeListener:
    """Collects service types and starts browsers for each type dynamically."""
    def __init__(self, zc: Zeroconf, mdns_listener: _MdnsListener):
        self.zc = zc
        self.mdns_listener = mdns_listener
        self.seen: set = set()
        self.browsers: List[ServiceBrowser] = []  # type: ignore[type-arg]

    def add_service(self, zc: Zeroconf, service_type: str, name: str) -> None:  # type: ignore[valid-type]
        st = name if name.endswith(".") else name + "."
        if st in self.seen:
            return
        self.seen.add(st)
        try:
            self.browsers.append(ServiceBrowser(self.zc, st, listener=self.mdns_listener))
        except Exception:
            pass

    def remove_service(self, zc: Zeroconf, service_type: str, name: str) -> None:  # type: ignore[valid-type]
        return

    def update_service(self, zc: Zeroconf, service_type: str, name: str) -> None:  # type: ignore[valid-type]
        # Same handling as add
        self.add_service(zc, service_type, name)


def find_by_mdns(target_name: str, timeout: int = 12) -> Optional[FoundDevice]:
    if Zeroconf is None or ServiceBrowser is None:
        return None

    zc = None
    browsers: List[ServiceBrowser] = []  # type: ignore[type-arg]
    services_browser = None
    try:
        zc = Zeroconf()
        listener = _MdnsListener(target_name)

        # Start with known relevant services
        initial_service_types = [
            "_androidtvremote2._tcp.local.",
            "_adb-tls-connect._tcp.local.",
            "_googlecast._tcp.local.",
            "_airplay._tcp.local.",
            "_http._tcp.local.",
        ]
        for st in initial_service_types:
            try:
                browsers.append(ServiceBrowser(zc, st, listener=listener))
            except Exception:
                continue

        # Dynamically discover all service types and browse them too
        type_listener = _ServiceTypeListener(zc, listener)
        try:
            services_browser = ServiceBrowser(zc, "_services._dns-sd._udp.local.", listener=type_listener)
        except Exception:
            services_browser = None

        deadline = time.time() + timeout
        while time.time() < deadline:
            if listener.found:
                return listener.found
            time.sleep(0.2)
        return listener.found
    except Exception as e:
        logging.debug(f"mDNS discovery error: {e}")
        return None
    finally:
        # Zeroconf cleanup is critical to avoid loop errors
        try:
            if zc is not None:
                zc.close()
        except Exception:
            pass


# -------------------------
# Strategy 3: SSDP/UPnP
# -------------------------

def _ssdp_discover(timeout: int = 4) -> List[Dict[str, str]]:
    """Minimal SSDP discovery; returns list of response headers."""
    MCAST_GRP = "239.255.255.250"
    MCAST_PORT = 1900
    msg = (
        "M-SEARCH * HTTP/1.1\r\n"
        f"HOST: {MCAST_GRP}:{MCAST_PORT}\r\n"
        "MAN: \"ssdp:discover\"\r\n"
        "MX: 2\r\n"
        "ST: ssdp:all\r\n\r\n"
    ).encode("ascii")

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.settimeout(timeout)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    except Exception:
        pass
    try:
        sock.sendto(msg, (MCAST_GRP, MCAST_PORT))
        responses: List[Dict[str, str]] = []
        start = time.time()
        while time.time() - start < timeout:
            try:
                data, addr = sock.recvfrom(65507)
                text = data.decode(errors="ignore")
                headers: Dict[str, str] = {}
                for line in text.splitlines():
                    if ":" in line:
                        k, v = line.split(":", 1)
                        headers[k.strip().lower()] = v.strip()
                headers["_from_ip"] = addr[0]
                responses.append(headers)
            except socket.timeout:
                break
            except Exception:
                break
        return responses
    finally:
        try:
            sock.close()
        except Exception:
            pass


def find_by_ssdp(target_name: str, timeout: int = 8) -> Optional[FoundDevice]:
    try:
        headers_list = _ssdp_discover(timeout=max(2, timeout // 2))
        seen_locations: set = set()
        for headers in headers_list:
            loc = headers.get("location") or headers.get("location".upper())
            if not loc or loc in seen_locations:
                continue
            seen_locations.add(loc)

            # Fetch device description XML and parse friendlyName
            try:
                resp = requests.get(loc, timeout=2)
                if resp.status_code != 200:
                    continue
                text = resp.text
                m = re.search(r"<friendlyName>(.*?)</friendlyName>", text, flags=re.IGNORECASE | re.DOTALL)
                friendly = m.group(1).strip() if m else None
                if friendly and name_matches(friendly, target_name):
                    try:
                        from urllib.parse import urlparse
                        ip = urlparse(loc).hostname
                    except Exception:
                        ip = headers.get("_from_ip")
                    if not is_valid_ip(ip):
                        continue
                    return FoundDevice(name=friendly, ip=ip, source="ssdp", extra={"location": loc})
            except Exception:
                continue
        return None
    except Exception as e:
        logging.debug(f"SSDP discovery error: {e}")
        return None


# -------------------------
# Listing helpers (mDNS/SSDP/Cast)
# -------------------------

class _MdnsCollector:
    def __init__(self):
        self.items: Dict[str, FoundDevice] = {}

    def _add(self, name: str, ip: Optional[str], service_type: str, port: Optional[int], props: Dict[str, str]):
        if not is_valid_ip(ip):
            return
        key = f"{ip}|{service_type}"
        if key in self.items:
            return
        self.items[key] = FoundDevice(
            name=name,
            ip=str(ip),
            port=port or None,
            source=f"mdns:{service_type}",
            extra={"properties": props},
        )

    def add_service(self, zc: Zeroconf, service_type: str, name: str) -> None:  # type: ignore[valid-type]
        try:
            info = zc.get_service_info(service_type, name, timeout=1500)
            if not info:
                return
            instance = name.split(".")[0]
            props = {k.decode(errors="ignore"): v.decode(errors="ignore") for k, v in (info.properties or {}).items() if isinstance(k, (bytes, bytearray))}
            friendly = props.get("fn") or props.get("n") or instance
            try:
                addrs = info.parsed_addresses()  # type: ignore[attr-defined]
            except Exception:
                addrs = []
            ip = addrs[0] if addrs else None
            self._add(friendly, ip, service_type, info.port or None, props)
        except Exception:
            return

    def remove_service(self, zc: Zeroconf, service_type: str, name: str) -> None:  # type: ignore[valid-type]
        return

    def update_service(self, zc: Zeroconf, service_type: str, name: str) -> None:  # type: ignore[valid-type]
        self.add_service(zc, service_type, name)


class _ServiceTypeCollector:
    def __init__(self, zc: Zeroconf, mdns_collector: _MdnsCollector):
        self.zc = zc
        self.mdns_collector = mdns_collector
        self.seen: set = set()
        self.browsers: List[ServiceBrowser] = []  # type: ignore[type-arg]

    def add_service(self, zc: Zeroconf, service_type: str, name: str) -> None:  # type: ignore[valid-type]
        st = name if name.endswith(".") else name + "."
        if st in self.seen:
            return
        self.seen.add(st)
        try:
            self.browsers.append(ServiceBrowser(self.zc, st, listener=self.mdns_collector))
        except Exception:
            pass

    def remove_service(self, zc: Zeroconf, service_type: str, name: str) -> None:  # type: ignore[valid-type]
        return

    def update_service(self, zc: Zeroconf, service_type: str, name: str) -> None:  # type: ignore[valid-type]
        self.add_service(zc, service_type, name)


def collect_mdns_candidates(timeout: int = 10) -> List[FoundDevice]:
    if Zeroconf is None or ServiceBrowser is None:
        return []
    zc = None
    browsers: List[ServiceBrowser] = []  # type: ignore[type-arg]
    try:
        zc = Zeroconf()
        collector = _MdnsCollector()
        # Seed with likely relevant services
        initial = [
            "_androidtvremote2._tcp.local.",
            "_adb-tls-connect._tcp.local.",
            "_googlecast._tcp.local.",
            "_airplay._tcp.local.",
            "_http._tcp.local.",
        ]
        for st in initial:
            try:
                browsers.append(ServiceBrowser(zc, st, listener=collector))
            except Exception:
                continue
        # Dynamic service discovery
        try:
            type_collector = _ServiceTypeCollector(zc, collector)
            browsers.append(ServiceBrowser(zc, "_services._dns-sd._udp.local.", listener=type_collector))
        except Exception:
            pass

        deadline = time.time() + timeout
        while time.time() < deadline:
            time.sleep(0.2)
        return list(collector.items.values())
    except Exception:
        return []
    finally:
        try:
            if zc is not None:
                zc.close()
        except Exception:
            pass


def collect_ssdp_candidates(timeout: int = 6) -> List[FoundDevice]:
    out: List[FoundDevice] = []
    try:
        headers_list = _ssdp_discover(timeout=max(2, timeout))
        seen_locations: set = set()
        for headers in headers_list:
            loc = headers.get("location") or headers.get("location".upper())
            if not loc or loc in seen_locations:
                continue
            seen_locations.add(loc)
            try:
                resp = requests.get(loc, timeout=2)
                if resp.status_code != 200:
                    continue
                text = resp.text
                m = re.search(r"<friendlyName>(.*?)</friendlyName>", text, flags=re.IGNORECASE | re.DOTALL)
                friendly = m.group(1).strip() if m else None
                from urllib.parse import urlparse
                ip = None
                try:
                    ip = urlparse(loc).hostname
                except Exception:
                    ip = headers.get("_from_ip")
                if friendly and is_valid_ip(ip):
                    out.append(FoundDevice(name=friendly, ip=str(ip), source="ssdp", extra={"location": loc}))
            except Exception:
                continue
    except Exception:
        return out
    return out


def collect_cast_candidates(timeout: int = 8) -> List[FoundDevice]:
    out: List[FoundDevice] = []
    if pychromecast is None:
        return out
    browser = None
    try:
        chromecasts, browser = pychromecast.get_chromecasts(timeout=timeout)
        for cast in chromecasts:
            try:
                name = getattr(cast, "name", None) or getattr(cast, "friendly_name", None) or ""
                if not name:
                    continue
                try:
                    cast.wait(timeout=1)
                except Exception:
                    pass
                ip = getattr(cast, "host", None) or getattr(cast, "ip", None)
                if not ip and getattr(cast, "socket_client", None):
                    ip = getattr(cast.socket_client, "host", None)
                if not is_valid_ip(ip):
                    continue
                port = getattr(cast, "port", None) or (getattr(cast, "socket_client", None) and getattr(cast.socket_client, "port", None)) or 8009
                out.append(FoundDevice(name=name, ip=str(ip), port=int(port) if isinstance(port, int) else None, source="pychromecast"))
            except Exception:
                continue
    except Exception:
        return out
    finally:
        try:
            if browser is not None:
                pychromecast.discovery.stop_discovery(browser)
        except Exception:
            pass
    return out


def list_candidates(timeout: int = 15, include_cast: bool = True) -> List[FoundDevice]:
    agg: Dict[str, FoundDevice] = {}
    for d in collect_mdns_candidates(timeout=min(timeout, 10)):
        key = d.ip or d.name
        if key not in agg:
            agg[key] = d
    for d in collect_ssdp_candidates(timeout=min(timeout, 8)):
        key = d.ip or d.name
        if key not in agg:
            agg[key] = d
    if include_cast:
        for d in collect_cast_candidates(timeout=min(timeout, 8)):
            key = d.ip or d.name
            if key not in agg:
                agg[key] = d
    return list(agg.values())


# -------------------------
# Orchestration
# -------------------------

def discover_device_by_name(name: str, timeout: int = 15) -> Optional[FoundDevice]:
    # 1) Try mDNS first (Android TV services and dynamic types)
    dev = find_by_mdns(name, timeout=min(timeout, 12))
    if dev and is_valid_ip(dev.ip):
        return dev

    # 2) Try DNS/LLMNR hostname guesses
    dev = find_by_hostname_variations(name)
    if dev and is_valid_ip(dev.ip):
        return dev

    # 3) Try SSDP
    dev = find_by_ssdp(name, timeout=min(timeout, 10))
    if dev and is_valid_ip(dev.ip):
        return dev

    # 4) Fallback: Google Cast (only if valid IP)
    dev = find_by_pychromecast(name, timeout=min(timeout, 10))
    if dev and is_valid_ip(dev.ip):
        return dev

    return None


def configure_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Discover device by friendly name and print IP/MAC.")
    parser.add_argument("--name", "-n", required=False, default="itracker auditorio", help="Device friendly name to search")
    parser.add_argument("--timeout", "-t", type=int, default=15, help="Total discovery timeout (seconds)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logs")
    parser.add_argument("--list", action="store_true", help="List candidates discovered via mDNS/SSDP (and Cast)")
    parser.add_argument("--contains", help="Optional substring filter for --list (case-insensitive)")
    parser.add_argument("--with-mac", action="store_true", help="When using --list, also resolve MAC addresses (slower)")
    args = parser.parse_args(argv)

    configure_logging(args.verbose)
    logging.info(f"Procurando por dispositivo: '{args.name}' (timeout: {args.timeout}s)")

    if args.list:
        devices = list_candidates(timeout=args.timeout, include_cast=True)
        if args.contains:
            pat = normalize(args.contains)
            devices = [d for d in devices if pat in normalize(d.name) or pat in (d.ip or "")]
        if not devices:
            print("Nenhum dispositivo encontrado.")
            return 0
        print("\n=== Dispositivos Descobertos ===")
        for idx, d in enumerate(devices, 1):
            mac = None
            if args.with_mac and is_valid_ip(d.ip):
                mac = get_mac_for_ip(d.ip)
            print(f"{idx}. Nome: {d.name} | IP: {d.ip} | Fonte: {d.source or '?'}" + (f" | MAC: {mac}" if mac else ""))
        print("================================\n")
        return 0

    device = discover_device_by_name(args.name, timeout=args.timeout)

    if not device:
        logging.error("Dispositivo não encontrado. Certifique-se de que está na mesma rede e ligado.")
        logging.info("Dicas: permita tráfego Multicast/mDNS no firewall do Windows (Rede Privada), aumente o timeout (-t 30), e verifique se o Android TV está na mesma VLAN.")
        return 2

    # Resolve MAC (preferir de propriedades mDNS, ex.: AirPlay 'deviceid')
    mac = None
    if isinstance(device.extra, dict):
        props = device.extra.get("properties") if isinstance(device.extra.get("properties"), dict) else None
        if props:
            mac = extract_mac_from_props(props)
    if not mac:
        mac = get_mac_for_ip(device.ip)
    device.mac = mac

    # Print result in a clean way
    print("\n=== Dispositivo Encontrado ===")
    print(f"Nome: {device.name}")
    print(f"IP:   {device.ip}")
    print(f"MAC:  {device.mac or 'não encontrado (tente pingar o IP e executar novamente)'}")
    print(f"Fonte: {device.source}")
    if device.port:
        print(f"Porta: {device.port}")
    if device.extra:
        for k, v in device.extra.items():
            if v:
                print(f"{k}: {v}")
    print("==============================\n")

    return 0


def extract_mac_from_props(props: Dict[str, str]) -> Optional[str]:
    candidates = [
        "deviceid", "device-id", "device_id",
        "mac", "macaddress", "mac-address",
    ]
    for key in candidates:
        val = props.get(key)
        if not val:
            continue
        s = val.strip().upper().replace('-', ':')
        # Exact MAC pattern?
        if re.fullmatch(r"([0-9A-F]{2}:){5}[0-9A-F]{2}", s):
            return s
        # Try to rebuild from raw hex
        raw = re.sub(r"[^0-9A-F]", "", s)
        if len(raw) == 12:
            return ":".join(raw[i:i+2] for i in range(0, 12, 2))
    return None


if __name__ == "__main__":
    sys.exit(main())
