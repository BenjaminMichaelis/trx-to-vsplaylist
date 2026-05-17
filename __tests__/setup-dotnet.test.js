import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInstalledVersionCompatible,
  normalizeDotnetChannel,
} from '../src/setup-dotnet.js';

describe('normalizeDotnetChannel', () => {
  it('normalizes major wildcard channels', () => {
    assert.equal(normalizeDotnetChannel('10.x'), '10.0');
  });

  it('normalizes minor wildcard channels', () => {
    assert.equal(normalizeDotnetChannel('10.0.x'), '10.0');
  });

  it('keeps concrete major channels unchanged', () => {
    assert.equal(normalizeDotnetChannel('10'), '10');
  });

  it('trims whitespace while normalizing', () => {
    assert.equal(normalizeDotnetChannel(' 10.0.x '), '10.0');
  });
});

describe('isInstalledVersionCompatible', () => {
  describe('exact minor channel (e.g. "10.0")', () => {
    it('matches when installed version equals the channel', () => {
      assert.ok(isInstalledVersionCompatible('10.0', '10.0'));
    });

    it('matches when installed version is a patch release of the channel', () => {
      assert.ok(isInstalledVersionCompatible('10.0.3', '10.0'));
      assert.ok(isInstalledVersionCompatible('10.0.100', '10.0'));
    });

    it('does not match a different minor version', () => {
      assert.ok(!isInstalledVersionCompatible('10.1.0', '10.0'));
      assert.ok(!isInstalledVersionCompatible('9.0.0', '10.0'));
    });
  });

  describe('major-only channel (e.g. "10")', () => {
    it('matches any 10.x.y installed version', () => {
      assert.ok(isInstalledVersionCompatible('10.0.0', '10'));
      assert.ok(isInstalledVersionCompatible('10.0.3', '10'));
      assert.ok(isInstalledVersionCompatible('10.5.2', '10'));
    });

    it('does not match a different major version', () => {
      assert.ok(!isInstalledVersionCompatible('9.0.0', '10'));
      assert.ok(!isInstalledVersionCompatible('11.0.0', '10'));
    });
  });

  describe('.x suffix channel (e.g. "10.x" or "10.0.x")', () => {
    it('normalizes major wildcard to a concrete minor channel', () => {
      assert.ok(isInstalledVersionCompatible('10.0.0', '10.x'));
      assert.ok(isInstalledVersionCompatible('10.0.5', '10.x'));
    });

    it('strips .x suffix — minor channel', () => {
      assert.ok(isInstalledVersionCompatible('10.0.0', '10.0.x'));
      assert.ok(isInstalledVersionCompatible('10.0.100', '10.0.x'));
    });

    it('does not match wrong major when using .x suffix', () => {
      assert.ok(!isInstalledVersionCompatible('9.0.0', '10.x'));
    });

    it('does not match a different minor when using major wildcard syntax', () => {
      assert.ok(!isInstalledVersionCompatible('10.1.0', '10.x'));
    });
  });

  describe('empty / blank channel', () => {
    it('returns true for empty string (no constraint)', () => {
      assert.ok(isInstalledVersionCompatible('10.0.0', ''));
    });

    it('returns true for whitespace-only channel', () => {
      assert.ok(isInstalledVersionCompatible('10.0.0', '   '));
    });
  });

  describe('mismatch cases', () => {
    it('returns false when major differs', () => {
      assert.ok(!isInstalledVersionCompatible('8.0.0', '10.0'));
    });

    it('returns false when minor differs in minor channel', () => {
      assert.ok(!isInstalledVersionCompatible('10.1.0', '10.0'));
    });
  });
});
