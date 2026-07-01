import * as React from 'react';

/**
 * Structured SVG element tree used for color icons (CSP-safe alternative to
 * raw innerHTML strings).
 */
export type SvgNode = [
  tag: string,
  attrs: Record<string, string | Record<string, string>> | null,
  ...children: SvgNode[],
];

/** Matches the start of `url(#…)` references inside attribute values. */
const URL_REF = /url\(#/g;

/**
 * Recursively renders an {@link SvgNode} tree into React elements. When `prefix`
 * is set, every `id` definition and `url(#…)` reference is scoped with it so
 * repeated color icons don't collide in the global DOM id namespace.
 */
export const renderSvgNode = (node: SvgNode, key: number, prefix?: string): React.ReactElement => {
  const [tag, attrs, ...children] = node;
  let scoped = attrs;
  if (prefix && attrs) {
    const next: Record<string, string | Record<string, string>> = {};
    for (const k in attrs) {
      const v = attrs[k];
      next[k] =
        typeof v !== 'string'
          ? v
          : k === 'id'
            ? prefix + v
            : v.indexOf('url(#') < 0
              ? v
              : v.replace(URL_REF, `url(#${prefix}`);
    }
    scoped = next;
  }
  return React.createElement(tag, { ...scoped, key }, ...children.map((child, i) => renderSvgNode(child, i, prefix)));
};

/** Normalizes the icon width into a square viewBox dimension. */
export const computeViewBox = (width: string): string => (width === '1em' ? '20' : width);

/**
 * Pre-renders a color icon's `SvgNode[]` tree into React elements (keeping the
 * recursion out of the hot render path). When `prefix` is set, locally-scoped
 * `id`s (gradients, clip paths, filters) and their `url(#…)` references are
 * prefixed so repeated color icons don't collide in the global DOM id namespace.
 */
export const precomputeColorChildren = (nodes: SvgNode[], prefix?: string): React.ReactElement[] =>
  nodes.map((node, i) => renderSvgNode(node, i, prefix));

/**
 * Creates a per-component resolver for a color icon's rendered children.
 *
 * The shared (unscoped) precompute runs once here, at factory time. The returned
 * hook memoizes per instance on `idPrefix`, so re-renders reuse the element tree
 * and only rebuild when the prefix actually changes.
 */
export const createColorChildrenResolver = (nodes: SvgNode[]): ((idPrefix?: string) => React.ReactElement[]) => {
  const colorChildren = precomputeColorChildren(nodes);
  return function useColorChildren(idPrefix?: string) {
    return React.useMemo(() => (idPrefix ? precomputeColorChildren(nodes, idPrefix) : colorChildren), [idPrefix]);
  };
};

type RenderSvgState = { fill?: string };

/**
 * Renders the `<svg>` body for a **mono-color** icon from path `d` strings.
 * Deliberately references no color/`SvgNode` code so mono icons never bundle it.
 *
 * `state` must already carry className/fill/width/height/viewBox/xmlns/ref.
 */
export const renderMonoBody = <TState extends RenderSvgState>(state: TState, paths: string[]): React.ReactElement =>
  React.createElement('svg', state, ...paths.map((d) => React.createElement('path', { d, fill: state.fill })));

/**
 * Renders the `<svg>` body for a **color** icon from its pre-rendered
 * {@link createColorChildrenResolver} children.
 *
 * `state` must already carry className/fill/width/height/viewBox/xmlns/ref.
 */
export const renderColorBody = <TState extends RenderSvgState>(
  state: TState,
  colorChildren: React.ReactElement[],
): React.ReactElement => React.createElement('svg', state, ...colorChildren);

/**
 * Renders the `<svg>` element body for a sprite icon — references an external
 * symbol via `<use href>`. `state` must already carry
 * className/width/height/viewBox/xmlns/ref.
 */
export const renderSpriteBody = <TState extends object>(
  state: TState,
  iconId: string,
  spritePath?: string,
): React.ReactElement => {
  const href = spritePath ? `${spritePath}#${iconId}` : `#${iconId}`;
  return React.createElement('svg', state, React.createElement('use', { href }));
};
