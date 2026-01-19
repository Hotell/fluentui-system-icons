import * as React from "react";
import { mergeClasses } from "@griffel/react";
import { FluentIconsProps } from "./FluentIconsProps.types";
import { useIconState } from "./useIconState";
import { useRootStyles } from "./createFluentIcon.styles";
import { iconClassName } from "./constants";

export type FluentIcon = React.FC<FluentIconsProps>

export type CreateFluentIconOptions = {
    flipInRtl?: boolean;
    color?: boolean;
}



export const createFluentIcon = (
  displayName: string,
  width: string,
  pathsOrSvg: string[] | string,
  options?: CreateFluentIconOptions,
): FluentIcon => {
  const Icon = React.forwardRef((props: FluentIconsProps, ref: React.Ref<HTMLElement>) => {
    const styles = useRootStyles();
    // Enables overriding the icon size dynamically via props
    const size = props.width ?? width;
    const viewBoxWidth = size === '1em' ? '20' : size;
    const iconState = useIconState(props, { flipInRtl: options?.flipInRtl }); // HTML attributes/props for things like accessibility can be passed in, and will be expanded on the svg object at the start of the object
    const state = {
      ...iconState,
      className: mergeClasses(iconClassName, iconState.className, styles.root),
      ref,
      width: size,
      height: size,
      viewBox: `0 0 ${viewBoxWidth} ${viewBoxWidth}`,
      xmlns: 'http://www.w3.org/2000/svg',
    };
    if (typeof pathsOrSvg === 'string') {
      // Color icon: render raw SVG children
      return React.createElement('svg', { ...state, dangerouslySetInnerHTML: { __html: pathsOrSvg } });
    } else {
      // Non-color icon: render paths as before
      return React.createElement(
        'svg',
        state,
        ...pathsOrSvg.map((d) => React.createElement('path', { d, fill: state.fill })),
      );
    }
  }) as FluentIcon;
  Icon.displayName = displayName;
  return Icon;
};
