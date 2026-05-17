import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { globToRegex } from '../src/convert.js';

// globToRegex expects an absolute forward-slash path pattern.
// We use a fake absolute root that works on all platforms for testing.
const ROOT = '/base';

function pat(glob) {
  return `${ROOT}/${glob}`;
}

describe('globToRegex', () => {
  describe('literal paths', () => {
    it('matches an exact path', () => {
      const re = globToRegex(pat('TestResults/foo.trx'));
      assert.ok(re.test(`${ROOT}/TestResults/foo.trx`));
    });

    it('does not match a different path', () => {
      const re = globToRegex(pat('TestResults/foo.trx'));
      assert.ok(!re.test(`${ROOT}/TestResults/bar.trx`));
    });

    it('escapes regex special chars in literal segments', () => {
      const re = globToRegex(pat('my.dir/test+result.trx'));
      assert.ok(re.test(`${ROOT}/my.dir/test+result.trx`));
      assert.ok(!re.test(`${ROOT}/myXdir/testYresult.trx`));
    });
  });

  describe('* wildcard', () => {
    it('matches any filename in a directory', () => {
      const re = globToRegex(pat('TestResults/*.trx'));
      assert.ok(re.test(`${ROOT}/TestResults/foo.trx`));
      assert.ok(re.test(`${ROOT}/TestResults/bar.trx`));
    });

    it('does not cross directory boundaries', () => {
      const re = globToRegex(pat('TestResults/*.trx'));
      assert.ok(!re.test(`${ROOT}/TestResults/sub/foo.trx`));
    });

    it('matches zero-length prefix (e.g. .trx)', () => {
      const re = globToRegex(pat('TestResults/*.trx'));
      // * matches zero or more non-slash chars, so .trx is a valid match
      assert.ok(re.test(`${ROOT}/TestResults/.trx`));
    });
  });

  describe('? wildcard', () => {
    it('matches exactly one non-slash character', () => {
      const re = globToRegex(pat('foo?.trx'));
      assert.ok(re.test(`${ROOT}/fooa.trx`));
      assert.ok(re.test(`${ROOT}/foob.trx`));
    });

    it('does not match zero characters', () => {
      const re = globToRegex(pat('foo?.trx'));
      assert.ok(!re.test(`${ROOT}/foo.trx`));
    });

    it('does not match a slash', () => {
      const re = globToRegex(pat('foo?bar.trx'));
      assert.ok(!re.test(`${ROOT}/foo/bar.trx`));
    });
  });

  describe('bracket character classes', () => {
    it('matches characters inside a class', () => {
      const re = globToRegex(pat('test[12].trx'));
      assert.ok(re.test(`${ROOT}/test1.trx`));
      assert.ok(re.test(`${ROOT}/test2.trx`));
    });

    it('does not match characters outside the class', () => {
      const re = globToRegex(pat('test[12].trx'));
      assert.ok(!re.test(`${ROOT}/test3.trx`));
    });

    it('supports negated classes with !', () => {
      const re = globToRegex(pat('test[!12].trx'));
      assert.ok(re.test(`${ROOT}/test3.trx`));
      assert.ok(!re.test(`${ROOT}/test1.trx`));
      assert.ok(!re.test(`${ROOT}/test2.trx`));
    });

    it('treats unmatched [ as a literal bracket', () => {
      const re = globToRegex(pat('test[.trx'));
      assert.ok(re.test(`${ROOT}/test[.trx`));
      assert.ok(!re.test(`${ROOT}/test1.trx`));
    });
  });

  describe('** globstar', () => {
    it('matches a top-level file (zero directory segments)', () => {
      const re = globToRegex(pat('**/foo.trx'));
      assert.ok(re.test(`${ROOT}/foo.trx`));
    });

    it('matches a file one directory deep', () => {
      const re = globToRegex(pat('**/foo.trx'));
      assert.ok(re.test(`${ROOT}/sub/foo.trx`));
    });

    it('matches a file multiple directories deep', () => {
      const re = globToRegex(pat('**/foo.trx'));
      assert.ok(re.test(`${ROOT}/a/b/c/foo.trx`));
    });

    it('respects the filename after **/', () => {
      const re = globToRegex(pat('**/foo.trx'));
      assert.ok(!re.test(`${ROOT}/sub/bar.trx`));
    });

    it('combines ** with a leading directory', () => {
      const re = globToRegex(pat('TestResults/**/foo.trx'));
      assert.ok(re.test(`${ROOT}/TestResults/foo.trx`));
      assert.ok(re.test(`${ROOT}/TestResults/sub/foo.trx`));
      assert.ok(!re.test(`${ROOT}/Other/foo.trx`));
    });

    it('combines ** with a trailing * wildcard', () => {
      const re = globToRegex(pat('**/TestResults/*.trx'));
      assert.ok(re.test(`${ROOT}/TestResults/a.trx`));
      assert.ok(re.test(`${ROOT}/sub/TestResults/a.trx`));
      assert.ok(!re.test(`${ROOT}/TestResults/sub/a.trx`));
    });
  });

  describe('Windows case-insensitive flag', () => {
    it('flag is set on win32 and unset on other platforms', () => {
      const re = globToRegex(pat('TestResults/foo.trx'));
      const flags = re.flags;
      if (process.platform === 'win32') {
        assert.ok(flags.includes('i'), 'expected case-insensitive flag on win32');
      } else {
        assert.ok(!flags.includes('i'), 'expected no case-insensitive flag on non-win32');
      }
    });
  });
});
