import type React from 'react';
import type { IFieldEditorRo } from '../type';

interface FieldAiConfigProps {
  field: Partial<IFieldEditorRo>;
  onChange?: (partialField: Partial<IFieldEditorRo>) => void;
}

/**
 * Per-field AI config is a billing-gated upsell surface (community builds
 * never have `fieldAIEnable`, so it only ever rendered an "upgrade to Pro"
 * prompt). This is a community-only, self-hosted fork with no billing tier
 * to upgrade into, so the whole surface is suppressed rather than shipping
 * dead upsell UI.
 */
export const FieldAiConfig: React.FC<FieldAiConfigProps> = () => {
  return null;
};
