import * as React from 'react';
import { mergeClasses } from '@griffel/react';
import { FluentIconsProps } from './FluentIconsProps.types';
import { useIconState } from './useIconState';
import { useRootStyles } from './createFluentIcon.styles';
import { iconClassName } from './constants';
import { computeViewBox, createColorChildrenResolver, renderColorBody } from '../core/svg';
import type { SvgNode } from '../core/svg';
import type { FluentIcon, CreateFluentIconOptions } from './createFluentMonoIcon';

export type { SvgNode, FluentIcon, CreateFluentIconOptions };

/**
 * Creates a multi-color (`Color` variant) Fluent icon component with Griffel styling.
 *
 * Renders the `SvgNode[]` element tree (gradients, clip paths, filters) and
 * supports per-instance `idPrefix` scoping to avoid global DOM id collisions when
 * the same color icon renders multiple times. All color-specific code lives here
 * so mono icons never pay for it.
 *
 * @param displayName - The display name for the component (used in React DevTools).
 * @param width - The intrinsic width/height of the icon (e.g. `"20"`, `"24"`, `"1em"`).
 * @param svg - Structured `SvgNode[]` element tree (CSP-safe).
 * @param options - Optional configuration.
 */
export const createFluentColorIcon = (
  displayName: string,
  width: string,
  svg: SvgNode[],
  options?: CreateFluentIconOptions,
): FluentIcon => {
  const viewBoxWidth = computeViewBox(width);
  // Resolve color children once per component; per-instance memoized `idPrefix` scoping.
  const useColorChildren = createColorChildrenResolver(svg);
  const Icon = React.forwardRef((props: FluentIconsProps, ref: React.Ref<HTMLElement>) => {
    const styles = useRootStyles();
    const iconState = useIconState(props, { flipInRtl: options?.flipInRtl });
    const colorChildren = useColorChildren(props.idPrefix);
    const state = {
      ...iconState,
      className: mergeClasses(iconClassName, iconState.className, styles.root),
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
