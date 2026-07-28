import type { PluginPosition } from '@teable/openapi';

export interface IPageParams {
  baseId: string;
  pluginInstallId: string;
  positionId: string;
  positionType: PluginPosition;
  pluginId: string;
  tableId?: string;
}
