import * as React from 'react';

import type { FluentIconsProps } from './shared';
import { iconClassName, cx } from './shared';
import { useIconState } from './useIconState';
import { computeViewBox, renderMonoBody } from '../core/svg';

export type FluentIcon = React.FC<FluentIconsProps>;

export type CreateFluentIconOptions = {
  flipInRtl?: boolean;
};

/**
 * Headless mono-color icon factory — no Griffel, no color/`idPrefix` code.
 *
 * The lightweight factory used by the vast majority of icons. Multi-color
 * (`Color`) variants use {@link createFluentColorIcon}.
 *
 * @access private
 * @alpha
 */
export const createFluentMonoIcon = (
  displayName: string,
  width: string,
  paths: string[],
  options?: CreateFluentIconOptions,
): FluentIcon => {
  const viewBoxWidth = computeViewBox(width);
  const Icon = React.forwardRef((props: FluentIconsProps, ref: React.Ref<HTMLElement>) => {
    const iconState = useIconState(props, { flipInRtl: options?.flipInRtl });
    const state = {
      ...iconState,
      className: cx(iconClassName, iconState.className),
      ref,
      width,
      height: width,
      viewBox: `0 0 ${viewBoxWidth} ${viewBoxWidth}`,
      xmlns: 'http://www.w3.org/2000/svg',
    };
    return renderMonoBody(state, paths);
  }) as FluentIcon;
  Icon.displayName = displayName;
  return Icon;
};
