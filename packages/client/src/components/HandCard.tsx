import { motion, useIsPresent, type HTMLMotionProps } from 'framer-motion';

export function HandCard(props: HTMLMotionProps<'div'>) {
  const present = useIsPresent();
  // Exit animations retain DOM nodes. Removed cards must immediately stop
  // appearing as playable controls to keyboard users and assistive technology.
  return (
    <motion.div
      {...props}
      inert={!present}
      aria-hidden={!present ? true : undefined}
      aria-disabled={!present || props['aria-disabled']}
      tabIndex={present ? props.tabIndex : -1}
    />
  );
}
