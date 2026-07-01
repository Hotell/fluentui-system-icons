import * as React from 'react';

import type { FluentIconsProps } from './shared';
import { iconClassName, cx } from './shared';
import { useIconState } from './useIconState';
import { computeViewBox, createColorChildrenResolver, renderColorBody } from '../core/svg';
import type { SvgNode } from '../core/svg';
import type { FluentIcon, CreateFluentIconOptions } from './createFluentMonoIcon';

export type { SvgNode, FluentIcon, CreateFluentIconOptions };

/**
 * Headless multi-color (`Color` variant) icon factory — no Griffel.
 *
 * Renders the `SvgNode[]` element tree plus per-instance `idPrefix` scoping. All
 * color-specific code lives here so mono icons never bundle it.
 *
 * @access private
 * @alpha
 */
export const createFluentColorIcon = (
  displayName: string,
  width: string,
  svg: SvgNode[],
  options?: CreateFluentIconOptions,
): FluentIcon => {
  const viewBoxWidth = computeViewBox(width);
  const useColorChildren = createColorChildrenResolver(svg);
  const Icon = React.forwardRef((props: FluentIconsProps, ref: React.Ref<HTMLElement>) => {
    const iconState = useIconState(props, { flipInRtl: options?.flipInRtl });
    const colorChildren = useColorChildren(props.idPrefix);
    const state = {
      ...iconState,
      className: cx(iconClassName, iconState.className),
      ref,
      width,
      height: width,
      viewBox: `0 0 ${viewBoxWidth} ${viewBoxWidth}`,
      xmlns: 'http://www.w3.org/2000/svg',
    };
    return renderColorBody(state, colorChildren);
  }) as FluentIcon;
  Icon.displayName = displayName;
  return Icon;
};
