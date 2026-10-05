import pkg from '../../../package.json';

import licences from './licences.json';

// Web-only: not part of the Android or iOS app.
const NOT_IN_APP = new Set(['react-dom']);

describe('licences.json', () => {
  it('has every library the app depends on (run `npm run build:licences` if this fails)', () => {
    const listed = new Map(licences.packages.map((p) => [p.name, p.version]));
    const missing = Object.keys(pkg.dependencies).filter(
      (name) => !NOT_IN_APP.has(name) && !listed.has(name),
    );
    expect(missing).toEqual([]);
  });

  it('points only at licence texts that exist', () => {
    for (const p of licences.packages) {
      if (p.text !== null) expect(licences.texts[p.text]).toEqual(expect.any(String));
    }
  });
});
