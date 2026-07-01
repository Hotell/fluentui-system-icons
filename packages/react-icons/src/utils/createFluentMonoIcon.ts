import * as React from 'react';
import { mergeClasses } from '@griffel/react';
import { FluentIconsProps } from './FluentIconsProps.types';
import { useIconState } from './useIconState';
import { useRootStyles } from './createFluentIcon.styles';
import { iconClassName } from './constants';
import { computeViewBox, renderMonoBody } from '../core/svg';

export type FluentIcon = React.FC<FluentIconsProps>;

export type CreateFluentIconOptions = {
  flipInRtl?: boolean;
};

/**
 * Creates a mono-color Fluent icon React component with Griffel styling.
 *
 * This is the lightweight factory used by the vast majority of icons. It
 * deliberately references **no** color/`SvgNode`/`idPrefix` code, so mono icons
 * never bundle it. Multi-color (`Color`) variants use {@link createFluentColorIcon}.
 *
 * @param displayName - The display name for the component (used in React DevTools).
 * @param width - The intrinsic width/height of the icon (e.g. `"20"`, `"24"`, `"1em"`).
 * @param paths - Array of SVG path `d` attributes.
 * @param options - Optional configuration.
 */
export const createFluentMonoIcon = (
  displayName: string,
  width: string,
  paths: string[],
  options?: CreateFluentIconOptions,
): FluentIcon => {
  const viewBoxWidth = computeViewBox(width);
  const Icon = React.forwardRef((props: FluentIconsProps, ref: React.Ref<HTMLElement>) => {
    const styles = useRootStyles();
    const iconState = useIconState(props, { flipInRtl: options?.flipInRtl });
    const state = {
      ...iconState,
      className: mergeClasses(iconClassName, iconState.className, styles.root),
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
