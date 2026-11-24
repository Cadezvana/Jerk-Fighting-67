#!/bin/bash
# Runs the deterministic combat suite and prints a one-line verdict.
cd "$(dirname "$0")/.."
node test/sim.cjs > /tmp/simout.txt 2>&1
python3 - <<'PY'
import json, re
raw = open('/tmp/simout.txt').read()
m = re.search(r'@@TESTS@@(.*)', raw)
if not m:
    print('NO TEST OUTPUT:\n' + raw[:1500]); raise SystemExit(1)
tests = json.loads(m.group(1).strip())
bad = []
for t in tests:
    if t.get('error'):
        bad.append(t['name']); continue
    if t.get('ok') is False or t.get('hit') is False or t.get('allOk') is False \
       or t.get('allHit') is False or t.get('allNormals') is False:
        bad.append(t['name'])
print(f'{len(tests) - len(bad)}/{len(tests)} PASS')
for n in bad: print('  FAIL:', n)
errs = [l for l in raw.splitlines() if l.startswith('ERRORS:')]
if errs: print(errs[-1][:600])
PY
