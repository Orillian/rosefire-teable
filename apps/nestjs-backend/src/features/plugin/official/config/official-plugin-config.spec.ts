import { existsSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { chart2Config } from './chart2';
import { sheetFormConfig } from './sheet-form-view';

describe('official plugin config registry', () => {
  const officialPluginConfigs = [chart2Config, sheetFormConfig];

  it('no longer registers the removed legacy chart plugin (plgchart)', () => {
    const ids = officialPluginConfigs.map((config) => config.id);
    expect(ids).not.toContain('plgchart');
  });

  it('keeps chartv2 (plgchartV2) as the sole chart plugin', () => {
    const ids = officialPluginConfigs.map((config) => config.id);
    expect(ids).toContain('plgchartV2');
    expect(chart2Config.id).toBe('plgchartV2');
  });

  it('does not have a legacy chart config module on disk', () => {
    expect(existsSync(join(__dirname, 'chart.ts'))).toBe(false);
  });
});
