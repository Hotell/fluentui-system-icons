import * as React from 'react';

import type { FluentIconsProps } from './shared';
import { iconClassName, cx } from './shared';
import { useIconState } from './useIconState';
import { computeViewBox } from '../core/svg';
import type { FluentIcon } from './createFluentMonoIcon';
import { createFluentMonoIcon } from './createFluentMonoIcon';
import { createFluentColorIcon } from './createFluentColorIcon';
import type { SvgNode } from '../core/svg';

export type { FluentIcon, SvgNode };

export type CreateFluentIconOptions = {
  flipInRtl?: boolean;
  /** @deprecated Construct color icons with `createFluentColorIcon` instead. */
  color?: boolean;
};

/**
 * Deprecated raw-innerHTML factory (CSP-unsafe `dangerouslySetInnerHTML`).
 * Isolated here so the legacy `string` form keeps working through
 * {@link createFluentIcon} without leaking innerHTML into the SvgNode-only
 * {@link createFluentColorIcon}.
 */
const createFluentHtmlIcon = (
  displayName: string,
  width: string,
  html: string,
  options?: CreateFluentIconOptions,
): FluentIcon => {
  const viewBoxWidth = computeViewBox(width);
  const Icon = React.forwardRef((props: FluentIconsProps, ref: React.Ref<HTMLElement>) => {
    const iconState = useIconState(props, { flipInRtl: options?.flipInRtl });
    return React.createElement('svg', {
      ...iconState,
      className: cx(iconClassName, iconState.className),
      ref,
      width,
      height: width,
      viewBox: `0 0 ${viewBoxWidth} ${viewBoxWidth}`,
      xmlns: 'http://www.w3.org/2000/svg',
      dangerouslySetInnerHTML: { __html: html },
    });
  }) as FluentIcon;
  Icon.displayName = displayName;
  return Icon;
};

/**
 * Headless createFluentIcon — SVG icon factory without styles.
 *
 * @deprecated Use {@link createFluentMonoIcon} for mono-color icons (path `d`
 * strings) or {@link createFluentColorIcon} for multi-color (`Color`) variants
 * (`SvgNode[]`). This delegator references every factory, so importing it
 * bundles color code even for mono usage. Generated icons no longer use it.
 *
 * @param displayName - The display name for the component (used in React DevTools).
 * @param width - The intrinsic width/height of the icon (e.g. `"20"`, `"24"`, `"1em"`).
 * @param pathsOrSvg - `string[]` path `d` attributes (mono), `SvgNode[]` element
 *   tree (color), or a raw SVG innerHTML `string` (deprecated).
 * @param options - Optional configuration.
 *
 * @access private
 * @alpha
 */
export const createFluentIcon = (
  displayName: string,
  width: string,
  pathsOrSvg: string[] | string | SvgNode[],
  options?: CreateFluentIconOptions,
): FluentIcon =>
  typeof pathsOrSvg === 'string'
    ? createFluentHtmlIcon(displayName, width, pathsOrSvg, options)
    : options?.color || Array.isArray((pathsOrSvg as unknown[])[0])
      ? createFluentColorIcon(displayName, width, pathsOrSvg as SvgNode[], options)
      : createFluentMonoIcon(displayName, width, pathsOrSvg as string[], options);
