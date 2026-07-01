import * as React from 'react';
import { mergeClasses } from '@griffel/react';
import type { FluentIconsProps } from './FluentIconsProps.types';
import { useIconState } from './useIconState';
import { useRootStyles } from './createFluentIcon.styles';
import { iconClassName } from './constants';
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
    const styles = useRootStyles();
    const iconState = useIconState(props, { flipInRtl: options?.flipInRtl });
    return React.createElement('svg', {
      ...iconState,
      className: mergeClasses(iconClassName, iconState.className, styles.root),
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
 * Creates a Fluent icon React component.
 *
 * @deprecated Use {@link createFluentMonoIcon} for mono-color icons (path `d`
 * strings) or {@link createFluentColorIcon} for multi-color (`Color`) variants
 * (`SvgNode[]`). This delegator is kept for backwards compatibility only — it
 * references every factory, so importing it bundles color code even for mono
 * usage. Generated icons no longer use it.
 *
 * @param displayName - The display name for the component (used in React DevTools).
 * @param width - The intrinsic width/height of the icon (e.g. `"20"`, `"24"`, `"1em"`).
 * @param pathsOrSvg - Icon content in one of three forms:
 *   - `string[]` — Array of SVG path `d` attributes (mono-color icons).
 *   - `SvgNode[]` — Structured SVG element tree for color icons (CSP-safe).
 *   - `string` — Raw SVG innerHTML string (deprecated, CSP-unsafe).
 * @param options - Optional configuration.
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
