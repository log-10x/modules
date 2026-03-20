#!/usr/bin/env python3
"""
Extract log analysis data from dev app output and generate a shareable web URL.

Usage:
  python extract_for_web.py [path] [--daily-gb=100] [--url=URL] [--open] [--json] [--local]

Path can be:
  - The output directory containing aggregated.csv (e.g., ./output)
  - The parent directory containing input/ and output/ subdirectories
  - Omitted to use current directory

Examples:
  python extract_for_web.py                                    # Use current dir
  python extract_for_web.py ./output                           # Direct output dir
  python extract_for_web.py ./my-logs --daily-gb=50            # With daily volume estimate
  python extract_for_web.py ./output --open                    # Open URL in browser
  python extract_for_web.py ./output --json                    # Include JSON data in output
  python extract_for_web.py ./output --local                   # Local-only mode (no URL)
  python extract_for_web.py ./output --url=http://localhost:9001/dev.html  # Local testing

Privacy Options:
  By default, the script generates a URL that opens the Log10x Console with your
  analysis data embedded. If you prefer not to send data externally:

  1. Use --local to output JSON only (no URL generated)
  2. Open console.log10x.com and navigate to the Dev step
  3. All processing happens in your browser - data never leaves your machine
"""

import csv
import json
import base64
import zlib
import os
import sys
import subprocess
from pathlib import Path
from collections import defaultdict
from typing import Optional, Tuple, List, Dict

# Target URL for the web viewer (console Dev step)
WEB_VIEWER_URL = "https://console.log10x.com"

# Known enrichment column mappings: CSV column name -> enrichment type key
# The enrichment type key is used in the web viewer's ENRICHMENTS config
ENRICHMENT_COLUMNS = {
    'severity_level': 'level',
    'http_status_class': 'http',
    'http_code': 'http',
    'log_group': 'group',
    'geo_country': 'geo',
    'geo_region': 'geo',
}

# Columns that are NOT enrichments (standard aggregation fields)
STANDARD_COLUMNS = {
    'message_pattern', 'tenx_user_service', 'summaryVolume', 'summaryBytes',
    'count', 'total_bytes', 'avg_bytes', 'first_seen', 'last_seen'
}


def detect_enrichment_columns(csv_path: Path) -> Dict[str, str]:
    """
    Detect enrichment columns present in the CSV.
    Returns dict mapping CSV column name -> enrichment type key.
    """
    enrichments = {}
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        for col in headers:
            # Skip standard columns
            if col in STANDARD_COLUMNS:
                continue
            # Check known mappings
            if col in ENRICHMENT_COLUMNS:
                enrichments[col] = ENRICHMENT_COLUMNS[col]
            # Auto-detect unknown enrichment columns (heuristic: contains underscore, not a metric)
            elif '_' in col and not col.startswith('summary') and not col.endswith('Bytes'):
                # Use column name as-is for unknown enrichments
                enrichments[col] = col.replace('_', '')

    return enrichments


def truncate_value(value: str, enrichment_type: str) -> str:
    """Truncate enrichment value for compact URL encoding."""
    if enrichment_type == 'level':
        # Level uses 4-char codes: UNCL, CRIT, ERRO, INFO, WARN, TRAC, DEBU
        return (value or 'UNCLASSIFIED')[:4].upper()
    elif enrichment_type == 'http':
        # HTTP uses category: 2xx, 3xx, 4xx, 5xx
        return value[:3] if value else ''
    else:
        # Other enrichments: truncate to 10 chars
        return (value or '')[:10]


def parse_aggregated_csv(csv_path: Path) -> Tuple[List[dict], Dict[str, str]]:
    """
    Parse the aggregated.csv file into a list of records.
    Returns (records, enrichment_columns) where enrichment_columns maps CSV col -> type key.
    """
    # Detect enrichments first
    enrichment_cols = detect_enrichment_columns(csv_path)

    records = []
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            record = {
                'message_pattern': row.get('message_pattern', ''),
                'service': row.get('tenx_user_service', ''),
                'volume': int(row.get('summaryVolume', 0) or 0),
                'bytes': int(row.get('summaryBytes', 0) or 0),
                'dimensions': {},  # Will hold enrichment values
            }

            # Extract enrichment values
            for csv_col, enrichment_type in enrichment_cols.items():
                value = row.get(csv_col, '').strip()
                if value:
                    record['dimensions'][enrichment_type] = value

            # Default level to UNCLASSIFIED if level enrichment exists but is empty
            if 'level' in enrichment_cols.values() and not record['dimensions'].get('level'):
                record['dimensions']['level'] = 'UNCLASSIFIED'

            records.append(record)

    return records, enrichment_cols


def count_templates(templates_path: Path) -> int:
    """Count unique templates without loading full file into memory."""
    count = 0
    with open(templates_path, 'r') as f:
        for line in f:
            if line.strip():
                count += 1
    return count


def extract_volume_reduction_samples(
    templates_path: Path,
    encoded_path: Path,
    num_templates: int = 10,
    events_per_template: int = 10,
    prefix: str = '~',
    delimiter: str = ',',
) -> Optional[dict]:
    """
    Extract high-impact templates and matching encoded events for the
    volume reduction proof dialog.

    Selects templates that best demonstrate volume reduction: long templates
    with many matching events (sorted by length * event_count).

    Returns dict with 'templates' (JSONL string) and 'encoded' (newline-
    separated encoded events), or None if files are missing.
    """
    if not templates_path.exists() or not encoded_path.exists():
        return None

    # 1. Load all templates, index by hash
    templates_by_hash = {}  # hash -> (length, json_line)
    with open(templates_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                t = json.loads(line)
                h = t['templateHash']
                tpl_body = t.get('template', '')
                templates_by_hash[h] = (len(tpl_body), line)
            except (json.JSONDecodeError, KeyError):
                continue

    if not templates_by_hash:
        return None

    # 2. Single pass: count events and accumulate encoded sizes per hash
    event_counts = defaultdict(int)
    enc_sizes = defaultdict(int)
    with open(encoded_path, 'r') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line:
                continue
            working = line
            if prefix and working.startswith(prefix):
                working = working[len(prefix):]
            delim_pos = working.find(delimiter)
            h = working[:delim_pos] if delim_pos != -1 else working
            if h in templates_by_hash:
                event_counts[h] += 1
                enc_sizes[h] += len(line)

    # 3. Score by reduction ratio (raw size / compact size), weighted by frequency.
    #    Pick templates that look impressive AND are common.
    candidates = []
    for h, (tpl_len, json_line) in templates_by_hash.items():
        count = event_counts.get(h, 0)
        if count < 2:
            continue
        avg_enc = enc_sizes[h] / count
        ratio = tpl_len / avg_enc if avg_enc > 0 else 0
        candidates.append((ratio, count, tpl_len, h, json_line))

    if not candidates:
        return None

    # Select: prefer ratio >= 2.0, sorted by ratio * count (impressive + frequent)
    good = [c for c in candidates if c[0] >= 2.0]
    if len(good) < num_templates:
        ok = [c for c in candidates if c[0] >= 1.5 and c[0] < 2.0]
        ok.sort(key=lambda c: c[0] * c[1], reverse=True)
        good.extend(ok)
    if len(good) < num_templates:
        rest = [c for c in candidates if c[0] < 1.5]
        rest.sort(key=lambda c: c[2] * c[1], reverse=True)
        good.extend(rest)

    good.sort(key=lambda c: c[0] * c[1], reverse=True)
    selected = good[:num_templates]
    target_hashes = {item[3] for item in selected}

    # 4. Scan encoded.log for matching events
    events_by_hash = defaultdict(list)
    needed = {h: events_per_template for h in target_hashes}

    with open(encoded_path, 'r') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line:
                continue

            working = line
            if prefix and working.startswith(prefix):
                working = working[len(prefix):]

            delim_pos = working.find(delimiter)
            h = working[:delim_pos] if delim_pos != -1 else working

            if h in needed and needed[h] > 0:
                events_by_hash[h].append(line)
                needed[h] -= 1

                if all(v <= 0 for v in needed.values()):
                    break

    # 5. Build output: templates (JSONL) and matching encoded events
    template_lines = []
    encoded_lines = []
    total_orig_volume = 0
    total_enc_volume = 0
    total_event_count = 0

    for ratio, count, tpl_len, h, tpl_json_line in selected:
        events = events_by_hash.get(h, [])
        if not events:
            continue
        template_lines.append(tpl_json_line)
        encoded_lines.extend(events)
        total_orig_volume += tpl_len * count
        total_enc_volume += enc_sizes.get(h, 0)
        total_event_count += count

    if not encoded_lines:
        return None

    return {
        'templates': '\n'.join(template_lines),
        'encoded': '\n'.join(encoded_lines),
        'events': total_event_count,
        'origBytes': total_orig_volume,
        'encBytes': total_enc_volume,
    }


def get_file_size(path: Path) -> int:
    """Get file size in bytes, return 0 if not exists."""
    return path.stat().st_size if path.exists() else 0


def find_output_dir(base_path: Path) -> Tuple[Path, Optional[Path]]:
    """
    Find the output directory and optionally input directory.
    Returns (output_dir, input_dir) where input_dir may be None.
    """
    # Check if base_path IS the output directory (contains aggregated.csv)
    if (base_path / 'aggregated.csv').exists():
        output_dir = base_path
        input_dir = base_path.parent / 'input'
        if not input_dir.exists():
            input_dir = None
        return output_dir, input_dir

    # Check if base_path contains output/ subdirectory
    if (base_path / 'output' / 'aggregated.csv').exists():
        return base_path / 'output', base_path / 'input' if (base_path / 'input').exists() else None

    # Check if current directory has output/
    if (Path('.') / 'output' / 'aggregated.csv').exists():
        return Path('.') / 'output', Path('.') / 'input' if (Path('.') / 'input').exists() else None

    raise FileNotFoundError(
        f"Could not find aggregated.csv in:\n"
        f"  - {base_path}/aggregated.csv\n"
        f"  - {base_path}/output/aggregated.csv\n"
        f"  - ./output/aggregated.csv\n"
        f"Run this script from a directory containing dev app output."
    )


def detect_decode_mode(output_dir: Path) -> Tuple[bool, int]:
    """
    Detect if running in decode validation mode.
    Returns (is_decode_mode, decoded_bytes).

    Decode mode: user placed encoded files in input, engine decoded them.
    In this case decoded.log will have content (the reconstructed originals).
    """
    decoded_path = output_dir / 'decoded.log'
    decoded_bytes = get_file_size(decoded_path)
    return (decoded_bytes > 0, decoded_bytes)


def extract_compact_data(base_path: Path, daily_gb: Optional[float] = None) -> Tuple[dict, bool, int]:
    """
    Extract minimal data needed for web visualization.
    Returns (data, is_decode_mode, decoded_bytes).
    """

    output_dir, input_dir = find_output_dir(base_path)

    # Check if running in decode validation mode
    is_decode_mode, decoded_bytes = detect_decode_mode(output_dir)

    # Parse aggregated data with enrichment detection
    aggregated_path = output_dir / 'aggregated.csv'
    records, enrichment_cols = parse_aggregated_csv(aggregated_path)

    # Get unique enrichment types present in data
    enrichment_types = set(enrichment_cols.values())

    # Calculate totals
    total_bytes = sum(r['bytes'] for r in records)
    total_volume = sum(r['volume'] for r in records)

    # Get file sizes for compression stats
    if input_dir and input_dir.exists():
        input_bytes = sum(f.stat().st_size for f in input_dir.glob('*.log'))
        if input_bytes == 0:
            input_bytes = sum(f.stat().st_size for f in input_dir.glob('*') if f.is_file())
    else:
        input_bytes = total_bytes

    encoded_bytes = get_file_size(output_dir / 'encoded.log')
    templates_path = output_dir / 'templates.json'
    unique_templates = count_templates(templates_path) if templates_path.exists() else 0

    # Compression ratio
    compression_pct = round((1 - (encoded_bytes / input_bytes)) * 100, 1) if input_bytes > 0 else 0

    # Top patterns by bytes (top 10) - v2 format with dimensions
    sorted_by_bytes = sorted(records, key=lambda r: r['bytes'], reverse=True)
    top_patterns = []
    for r in sorted_by_bytes[:10]:
        pct = round(r['bytes'] / total_bytes * 100, 2) if total_bytes > 0 else 0
        pattern = {
            'm': r['message_pattern'][:200],        # Truncate message
            'p': pct,                               # Percentage of total bytes
            's': r['service'][:40] if r['service'] else '',  # Service name
            'b': r['bytes'],                        # Raw bytes for ROI calc
        }

        # Add dimensions (enrichment values) - v2 format
        if r['dimensions']:
            pattern['d'] = {}
            for etype, value in r['dimensions'].items():
                pattern['d'][etype] = truncate_value(value, etype)

        top_patterns.append(pattern)

    # Build distributions for each enrichment type - v2 format
    distributions = {}
    for etype in enrichment_types:
        # Aggregate by this enrichment type
        type_agg = defaultdict(lambda: {'bytes': 0, 'volume': 0})
        for r in records:
            value = r['dimensions'].get(etype, '')
            if value:
                truncated = truncate_value(value, etype)
                type_agg[truncated]['bytes'] += r['bytes']
                type_agg[truncated]['volume'] += r['volume']

        # Convert to sorted list
        dist_list = []
        for value, agg_data in sorted(type_agg.items(), key=lambda x: x[1]['bytes'], reverse=True):
            pct = round(agg_data['bytes'] / total_bytes * 100, 1) if total_bytes > 0 else 0
            dist_list.append({
                'v': value,  # Value (truncated)
                'p': pct,    # Percentage
            })

        if dist_list:
            distributions[etype] = dist_list

    # Build compact payload - v2 format
    data = {
        'v': 2,                          # Schema version (v2 = flexible enrichments)
        'in': input_bytes,               # Input bytes
        'enc': encoded_bytes,            # Encoded bytes
        'cmp': compression_pct,          # Compression percentage
        'ev': total_volume,              # Total events
        'pat': len(records),             # Unique patterns
        'tpl': unique_templates,         # Unique templates
        'top': top_patterns,             # Top 10 patterns (with dimensions)
        'dist': distributions,           # Distribution by enrichment type
    }

    # Add daily GB estimate if provided
    if daily_gb:
        data['dgb'] = daily_gb

    # Extract volume reduction samples (longest templates + matching events)
    vr = extract_volume_reduction_samples(
        templates_path, output_dir / 'encoded.log',
        num_templates=10, events_per_template=1,
    )
    if vr:
        data['vr'] = vr

    return data, is_decode_mode, decoded_bytes


def encode_url(data: dict, base_url: str = None) -> str:
    """Encode data to a compact URL parameter."""
    # Convert to JSON (compact, no spaces)
    json_str = json.dumps(data, separators=(',', ':'))

    # Compress with zlib
    compressed = zlib.compress(json_str.encode('utf-8'), level=9)

    # Base64 encode (URL-safe)
    encoded = base64.urlsafe_b64encode(compressed).decode('ascii')

    # Remove padding for shorter URL
    encoded = encoded.rstrip('=')

    url = base_url or WEB_VIEWER_URL
    return f"{url}?step=1&d={encoded}"


def format_bytes(b: int) -> str:
    """Format bytes to human readable."""
    if b >= 1_000_000_000:
        return f"{b / 1_000_000_000:.1f}GB"
    elif b >= 1_000_000:
        return f"{b / 1_000_000:.1f}MB"
    elif b >= 1_000:
        return f"{b / 1_000:.1f}KB"
    return f"{b}B"


def main():
    # Parse arguments
    args = sys.argv[1:]
    positional_args = [a for a in args if not a.startswith('--')]
    optional_args = [a for a in args if a.startswith('--')]

    # Default to current directory if no path provided
    base_path = Path(positional_args[0]) if positional_args else Path('.')

    # Parse optional args
    daily_gb = None
    open_browser = False
    show_json = False
    local_only = False
    base_url = None
    for arg in optional_args:
        if arg.startswith('--daily-gb='):
            daily_gb = float(arg.split('=')[1])
        elif arg.startswith('--url='):
            base_url = arg.split('=', 1)[1]
        elif arg == '--open':
            open_browser = True
        elif arg == '--json':
            show_json = True
        elif arg == '--local':
            local_only = True
            show_json = True  # --local implies --json

    print(f"Extracting from: {base_path.resolve()}")

    # Extract data
    try:
        data, is_decode_mode, decoded_bytes = extract_compact_data(base_path, daily_gb)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)

    json_str = json.dumps(data, separators=(',', ':'))
    json_size = len(json_str)

    if local_only:
        # Local-only mode: no URL, just JSON output
        print(f"\n{'=' * 60}")
        print("LOCAL MODE - NO DATA SENT EXTERNALLY")
        print('=' * 60)
        print(f"  Data size: {json_size} bytes JSON")
        print(f"\n  To view results:")
        print(f"  1. Copy the JSON output below and use 'Paste Results' at https://console.log10x.com?step=1")
        print(f"  2. Or re-run with --open to generate a shareable URL:")
        print(f"     python3 {sys.argv[0]} {' '.join(positional_args)} --open")
        print(f"\n  All processing happens in your browser - no data is stored on our servers.")
        url = None
    else:
        # Generate URL
        url = encode_url(data, base_url)

        # Print URL first (most important output)
        print(f"\n{'=' * 60}")
        print("VIEW RESULTS")
        print('=' * 60)
        print(f"\n{url}\n")

        # Show URL stats
        url_size = len(url)
        print(f"  Data: {json_size} bytes JSON → {url_size} chars URL")

        if url_size > 2000:
            print(f"  ⚠️  URL is long ({url_size} chars). May not work in all browsers.")

    # Print summary
    print(f"\n{'=' * 60}")
    if is_decode_mode:
        print("DECODE VALIDATION MODE")
        print('=' * 60)
        print("  Input was 10x-encoded. Showing decoded results.")
        print(f"  Encoded input:   {format_bytes(data['in'])}")
        print(f"  Decoded output:  {format_bytes(decoded_bytes)}")
    else:
        print("ANALYSIS SUMMARY")
        print('=' * 60)
        print(f"  Input size:      {format_bytes(data['in'])}")
        print(f"  Encoded size:    {format_bytes(data['enc'])}")
        print(f"  Compression:     {data['cmp']}%")
    print(f"  Total events:    {data['ev']:,}")
    print(f"  Unique patterns: {data['pat']:,}")

    # Show top pattern
    if data['top']:
        top = data['top'][0]
        print(f"  Top pattern:     {top['m'][:40]}... ({top['p']}%)")

    # Show volume reduction samples
    if data.get('vr'):
        vr_tpl = len(data['vr']['templates'].split('\n'))
        vr_enc = len(data['vr']['encoded'].split('\n'))
        print(f"  VR samples:      {vr_tpl} templates, {vr_enc} encoded events")

    # Show detected enrichments
    if data.get('dist'):
        enrichments = list(data['dist'].keys())
        print(f"  Enrichments:     {', '.join(enrichments)}")

    # Print JSON data for local inspection (only with --json flag)
    if show_json:
        print(f"\n{'=' * 60}")
        print("JSON DATA (for local inspection)")
        print('=' * 60)
        print(json.dumps(data, indent=2))

    # Show decode mode validation tip
    if is_decode_mode:
        print(f"\n{'=' * 60}")
        print("VALIDATE LOSSLESS ENCODING")
        print('=' * 60)
        print("  Compare decoded.log with your original logs:")
        print("  diff output/decoded.log /path/to/original.log")

    # Open in browser if requested (only if URL was generated)
    if open_browser and url:
        print(f"\nOpening in browser...")
        if sys.platform == 'darwin':
            subprocess.run(['open', url])
        elif sys.platform == 'win32':
            subprocess.run(['start', url], shell=True)
        else:
            subprocess.run(['xdg-open', url])


if __name__ == '__main__':
    main()
