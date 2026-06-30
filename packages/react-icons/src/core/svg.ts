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
 * Pre-renders color SVG node trees so the recursion stays out of the hot render
 * path. Returns `undefined` for mono-color (path `string[]`) icons. When
 * `prefix` is set, locally-scoped `id`s (gradients, clip paths, filters) and
 * their `url(#…)` references are prefixed so repeated color icons don't collide
 * in the global DOM id namespace.
 */
export const precomputeColorChildren = (
  pathsOrSvg: string[] | string | SvgNode[],
  options?: { color?: boolean },
  prefix?: string,
): React.ReactElement[] | undefined =>
  typeof pathsOrSvg !== 'string' && (options?.color || Array.isArray(pathsOrSvg[0]))
    ? (pathsOrSvg as SvgNode[]).map((node, i) => renderSvgNode(node, i, prefix))
    : undefined;

/** Shared mono-color resolver — calls no hooks and allocates nothing per component. */
const noColorChildren = (): React.ReactElement[] | undefined => undefined;

/**
 * Creates a per-component resolver for a color icon's rendered children.
 *
 * Color detection and the shared (unscoped) precompute run once here, at factory
 * time. The returned hook:
 * - for mono-color icons, is a shared no-op returning `undefined` (no React hook,
 *   no per-component or per-instance allocation);
 * - for color icons, memoizes per instance on `idPrefix`, so re-renders reuse the
 *   element tree and only rebuild when the prefix actually changes.
 *
 * Branching here (an icon's "color-ness" is fixed at factory time) keeps hook
 * order stable per component, so only color icons ever pay for the memo hook.
 */
export const createColorChildrenResolver = (
  pathsOrSvg: string[] | string | SvgNode[],
  options?: { color?: boolean },
): ((idPrefix?: string) => React.ReactElement[] | undefined) => {
  const colorChildren = precomputeColorChildren(pathsOrSvg, options);
  if (!colorChildren) {
    return noColorChildren;
  }
  return function useColorChildren(idPrefix?: string) {
    return React.useMemo(
      () => (idPrefix ? precomputeColorChildren(pathsOrSvg, options, idPrefix) : colorChildren),
      [idPrefix],
    );
  };
};

type RenderSvgState = { fill?: string };

/**
 * Renders the `<svg>` element body for an already-resolved element `state`.
 * Handles the three content forms:
 * - raw innerHTML `string` (deprecated, CSP-unsafe `dangerouslySetInnerHTML`),
 * - pre-rendered color children ({@link createColorChildrenResolver}),
 * - mono-color path `d` strings.
 *
 * `state` must already carry className/fill/width/height/viewBox/xmlns/ref.
 */
export const renderSvgBody = <TState extends RenderSvgState>(
  state: TState,
  pathsOrSvg: string[] | string | SvgNode[],
  colorChildren: React.ReactElement[] | undefined,
): React.ReactElement => {
  if (typeof pathsOrSvg === 'string') {
    return React.createElement('svg', { ...state, dangerouslySetInnerHTML: { __html: pathsOrSvg } });
  }
  if (colorChildren) {
    return React.createElement('svg', state, ...colorChildren);
  }
  return React.createElement(
    'svg',
    state,
    ...(pathsOrSvg as string[]).map((d) => React.createElement('path', { d, fill: state.fill })),
  );
};

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
