import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PluginChartService } from './plugin-chart.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Exercises PluginChartService.resolveJoin directly off the class prototype (see
// plugin-chart.service.spec.ts for the same pattern applied to the aggregation logic).

describe('PluginChartService.resolveJoin (cross-table join resolution)', () => {
  const makeService = (txClient: unknown) => {
    const service = Object.create(PluginChartService.prototype) as PluginChartService;
    Object.assign(service, { prismaService: { txClient: () => txClient } });
    return service;
  };

  it('returns null when the query has no join configured', async () => {
    const service = makeService({});
    const result = await (service as any).resolveJoin('tblOrders', 'orders_db', undefined);
    expect(result).toBeNull();
  });

  it('resolves a supported ManyOne join (Orders -> Profiles) into join + field info', async () => {
    const txClient = {
      field: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'fldLink',
          options: JSON.stringify({
            relationship: 'manyOne',
            foreignTableId: 'tblProfiles',
            fkHostTableName: 'orders_db',
            selfKeyName: '__id',
            foreignKeyName: '__fk_profile',
          }),
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'fldProvince',
            dbFieldName: 'fld_province',
            name: 'Province',
            type: 'singleSelect',
            cellValueType: 'string',
            isMultipleCellValue: false,
          },
        ]),
      },
      tableMeta: {
        findUnique: vi.fn().mockResolvedValue({ dbTableName: 'profiles_db' }),
      },
    };
    const service = makeService(txClient);
    const result = await (service as any).resolveJoin('tblOrders', 'orders_db', {
      linkFieldId: 'fldLink',
    });
    expect(result).toEqual({
      foreignDbTableName: 'profiles_db',
      foreignKeyName: '__fk_profile',
      foreignFields: [
        {
          id: 'fldProvince',
          dbFieldName: 'fld_province',
          name: 'Province',
          type: 'singleSelect',
          cellValueType: 'string',
          isMultipleCellValue: false,
        },
      ],
    });
  });

  it('rejects an unsupported many-to-many join with a clear BadRequestException', async () => {
    const txClient = {
      field: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'fldLink',
          options: JSON.stringify({
            relationship: 'manyMany',
            foreignTableId: 'tblProfiles',
            fkHostTableName: 'junction_table',
            selfKeyName: '__id',
            foreignKeyName: '__fk_profile',
          }),
        }),
      },
    };
    const service = makeService(txClient);
    await expect(
      (service as any).resolveJoin('tblOrders', 'orders_db', { linkFieldId: 'fldLink' })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a OneMany join whose foreign key lives on the linked table', async () => {
    const txClient = {
      field: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'fldLink',
          options: JSON.stringify({
            relationship: 'oneMany',
            foreignTableId: 'tblProfiles',
            fkHostTableName: 'profiles_db',
            selfKeyName: '__id',
            foreignKeyName: '__fk_order',
          }),
        }),
      },
    };
    const service = makeService(txClient);
    await expect(
      (service as any).resolveJoin('tblOrders', 'orders_db', { linkFieldId: 'fldLink' })
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the link field does not exist on the charted table', async () => {
    const txClient = {
      field: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = makeService(txClient);
    await expect(
      (service as any).resolveJoin('tblOrders', 'orders_db', { linkFieldId: 'fldMissing' })
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the linked table itself cannot be found', async () => {
    const txClient = {
      field: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'fldLink',
          options: JSON.stringify({
            relationship: 'manyOne',
            foreignTableId: 'tblGhost',
            fkHostTableName: 'orders_db',
            selfKeyName: '__id',
            foreignKeyName: '__fk_profile',
          }),
        }),
      },
      tableMeta: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = makeService(txClient);
    await expect(
      (service as any).resolveJoin('tblOrders', 'orders_db', { linkFieldId: 'fldLink' })
    ).rejects.toThrow(NotFoundException);
  });
});
