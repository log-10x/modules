// The k8s initializer on the forwarder inputs: the k8s fields each input's
// records resolve to, and the engine rules its extractors and scripts follow.
// The extractor stand-in follows the engine's JSON extractor: a captureField
// name matches a key path whose keys are joined by '.' as written, so the flat
// key "k8s.container.name" the OpenTelemetry Collector input writes matches it.
// The script stand-in runs each loaded class's constructor body with `this`
// holding the captured fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const modules = join(here, '..', 'pipelines', 'run', 'modules');
const k8sDir = join(modules, 'initialize', 'k8s');
const forwarderDir = join(modules, 'input', 'forwarder');

const ENV = {
  k8sExtractorName: 'fluentK8s',
  k8sNamespaceNameField: 'k8s_namespace',
  k8sContainerNameField: 'k8s_container',
  k8sPodNameField: 'k8s_pod',
  k8sTeamLabel: 'team',
  k8sTeamField: 'tenx_team',
};

const TenXEnv = { get: (name, def) => (name in ENV ? ENV[name] : def) };

const MATCH_ACTIONS = ['captureAll', 'captureFirst', 'captureLast', 'captureArrays',
  'captureFirstArray', 'captureLastArray', 'setOuterText'];

// A YAML scalar as these files write it: plain, '...' or "...", and a
// `$=yield <js>` value evaluated against TenXEnv.
function scalar(text) {
  let s = text.trim();
  if (s.startsWith("'")) s = s.slice(1, -1).replaceAll("''", "'");
  else if (s.startsWith('"')) s = JSON.parse(s);
  if (s.startsWith('$=yield ')) s = new Function('TenXEnv', 'return (' + s.slice(8) + ');')(TenXEnv);
  return s;
}

// The `extractor:` list of a file: name, filter and actions of each entry.
function extractors(file) {
  const out = {};
  let section = null;
  let cur = null;
  let inActions = false;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    let m;
    if ((m = /^(\w+):/.exec(line))) { section = m[1]; cur = null; inActions = false; continue; }
    if (section !== 'extractor') continue;
    if ((m = /^ {2}- name: (\S+)$/.exec(line))) { cur = out[m[1]] = { filter: null, actions: [] }; inActions = false; continue; }
    if (!cur) continue;
    if ((m = /^ {4}filter: (.+)$/.exec(line))) cur.filter = m[1];
    else if (/^ {4}actions:$/.test(line)) inActions = true;
    else if (inActions && (m = /^ {6}- (.+)$/.exec(line))) cur.actions.push(scalar(m[1]));
    else if (/^ {4}\S/.test(line)) inActions = false;
  }
  return out;
}

// The extractor names an input lists, with the empty ones left out.
function inputExtractors(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const at = lines.findIndex((l) => /^ {4}extractors:$/.test(l));
  assert.ok(at >= 0, `extractors list found in ${file}`);
  const names = [];
  for (const line of lines.slice(at + 1)) {
    const m = /^ {6}- (.+)$/.exec(line);
    if (!m) break;
    const name = scalar(m[1]);
    if (name) names.push(name);
  }
  return names;
}

const k8sExtractors = extractors(join(k8sDir, 'settings.yaml'));

function forwarder(name) {
  const file = join(forwarderDir, name, 'stream.yaml');
  const defs = { ...k8sExtractors, ...extractors(file) };
  return inputExtractors(file).map((n) => {
    assert.ok(defs[n], `${name} lists extractor ${n}, which is defined`);
    return { name: n, ...defs[n] };
  });
}

// Each key path of a record with its string value, in document order.
function paths(value, prefix = '', out = []) {
  for (const [key, v] of Object.entries(value)) {
    const p = prefix ? prefix + '.' + key : key;
    if (v && typeof v === 'object' && !Array.isArray(v)) paths(v, p, out);
    else if (typeof v === 'string') out.push([p, v]);
  }
  return out;
}

// The captureField values an input takes from a record: the first key path
// whose name ends with the action's name on a '.' boundary.
function captures(input, record) {
  const fields = {};
  const leaves = paths(record);
  for (const ext of input) {
    for (const action of ext.actions) {
      const m = /^captureField:(.+):([^:]+)$/.exec(action);
      if (!m) continue;
      const hit = leaves.find(([p]) => p === m[1] || p.endsWith('.' + m[1]));
      if (hit) fields[m[2]] = hit[1];
    }
  }
  return fields;
}

// The TenXObject classes of the k8s folder's scripts: file, name, shouldLoad
// body and constructor body.
function block(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
  }
  throw new Error('unbalanced block');
}

const scripts = readdirSync(k8sDir).filter((f) => f.endsWith('.js')).sort();
const classes = scripts.flatMap((file) => {
  const src = readFileSync(join(k8sDir, file), 'utf8');
  return [...src.matchAll(/export class (\w+) extends TenXObject \{/g)].map((m) => {
    const body = block(src, m.index + m[0].length - 1);
    const should = /static shouldLoad\(config\) \{/.exec(body);
    const ctor = /constructor\(\) \{/.exec(body);
    return {
      file,
      name: m[1],
      shouldLoad: block(body, should.index + should[0].length - 1),
      ctor: block(body, ctor.index + ctor[0].length - 1),
    };
  });
});

// The k8s fields an event gets: each loaded class's constructor run on its captures.
function enrich(input, record) {
  const fields = captures(input, record);
  const out = {};
  const self = { ...fields, set: (name, v) => { out[name] = v; } };
  for (const c of classes) {
    if (!new Function('TenXEnv', 'config', c.shouldLoad)(TenXEnv, {})) continue;
    new Function('TenXEnv', c.ctor).call(self, TenXEnv);
  }
  for (const k of ['tenx_user_service', 'tenx_user_process']) if (self[k]) out[k] = self[k];
  return out;
}

const EXPECTED = {
  k8s_namespace: 'shop',
  k8s_container: 'cart',
  tenx_user_service: 'cart',
  tenx_team: 'payments',
  k8s_pod: 'cart-7d9f8-x2k4q',
  tenx_user_process: 'cart-7d9f8-x2k4q/cart',
};

// A record as the OpenTelemetry Collector input writes it: body, log-record
// attributes, then resource attributes, all as flat top-level keys.
const otlpRecord = {
  body: 'GET /cart 200',
  'log.iostream': 'stdout',
  'k8s.pod.name': 'cart-7d9f8-x2k4q',
  'k8s.namespace.name': 'shop',
  'k8s.container.name': 'cart',
  'k8s.node.name': 'node-1',
  'k8s.pod.labels.team': 'payments',
  tag: 'cart-7d9f8-x2k4q',
  _tenx_resource_keys: ['k8s.pod.name', 'k8s.namespace.name', 'k8s.container.name', 'k8s.node.name', 'k8s.pod.labels.team'],
};

const kubernetes = {
  container_name: 'cart',
  namespace_name: 'shop',
  pod_name: 'cart-7d9f8-x2k4q',
  labels: { team: 'payments' },
};

test('the collector input fills the k8s fields from the k8s.* resource attributes', () => {
  assert.deepEqual(enrich(forwarder('otel-collector'), otlpRecord), EXPECTED);
});

test('the collector input reads a Fluent Bit shaped kubernetes attribute first', () => {
  const record = { body: 'GET /cart 200', kubernetes, ...otlpRecord, 'k8s.container.name': 'cart-otel' };
  assert.deepEqual(enrich(forwarder('otel-collector'), record), EXPECTED);
});

test('the collector input without k8s attributes gets no k8s fields', () => {
  assert.deepEqual(enrich(forwarder('otel-collector'), { body: 'GET /cart 200', tag: 'otel' }), {});
});

for (const name of ['fluentbit', 'fluentd', 'vector', 'logstash']) {
  test(`${name} input fills the k8s fields from the kubernetes map`, () => {
    assert.deepEqual(enrich(forwarder(name), { log: 'GET /cart 200', kubernetes, tag: 'kube' }), EXPECTED);
  });
}

test('filebeat input fills the k8s fields from its kubernetes map', () => {
  ENV.k8sExtractorName = 'filebeatK8s';
  try {
    const record = {
      message: 'GET /cart 200',
      kubernetes: { namespace: 'shop', container: { name: 'cart' }, pod: { name: 'cart-7d9f8-x2k4q' }, labels: { team: 'payments' } },
    };
    assert.deepEqual(enrich(forwarder('filebeat'), record), EXPECTED);
  } finally {
    ENV.k8sExtractorName = 'fluentK8s';
  }
});

// The engine indexes an input's captured fields by name across its extractors.
const streams = readdirSync(forwarderDir).filter((n) => existsSync(join(forwarderDir, n, 'stream.yaml')));

for (const name of streams) {
  test(`${name} input captures each field once`, () => {
    const aliases = forwarder(name).flatMap((e) => e.actions)
      .map((a) => /^captureField:.+:([^:]+)$/.exec(a)).filter(Boolean).map((m) => m[1]);
    assert.deepEqual(aliases, [...new Set(aliases)]);
  });

  // The engine merges an input's JSON extractors with the same filter and takes
  // one extractor with no match action among them.
  test(`${name} input lists at most one capture-only extractor per filter`, () => {
    const byFilter = {};
    for (const e of forwarder(name)) {
      if (e.actions.some((a) => MATCH_ACTIONS.includes(a.split(':')[0]))) continue;
      byFilter[e.filter] = (byFilter[e.filter] ?? 0) + 1;
    }
    for (const n of Object.values(byFilter)) assert.ok(n <= 1);
  });
}

// The engine keeps one constructor per script file.
test('each k8s script holds at most one TenXObject class', () => {
  for (const file of scripts) assert.ok(classes.filter((c) => c.file === file).length <= 1, file);
});

// The engine takes a var declaration only at the top level of a constructor.
test('k8s constructors declare vars only at their top level', () => {
  for (const c of classes) {
    let depth = 0;
    for (const line of c.ctor.split('\n')) {
      if (/^\s*var /.test(line)) assert.equal(depth, 0, `${c.name}: ${line.trim()}`);
      depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    }
  }
});
