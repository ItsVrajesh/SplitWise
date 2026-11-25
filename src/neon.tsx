import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { palette } from "./theme";

const contours = Array.from({ length: 16 }, (_, line) => {
  const points = Array.from({ length: 31 }, (_, index) => {
    const x = index * 10;
    const ridge = 51 * Math.exp(-Math.pow((x - 168) / 73, 2));
    const shoulder = 22 * Math.exp(-Math.pow((x - 260) / 36, 2));
    const ripple = Math.sin(x / 12 + line * 0.2) * 2.5;
    const y = 74 + line * 5.2 - ridge - shoulder + ripple;
    return `${index ? "L" : "M"}${x} ${y.toFixed(1)}`;
  });
  return points.join(" ");
});

export function ContourArt({ opacity = 0.55 }: { opacity?: number }) {
  const reducedMotion = useReducedMotion();
  const phase = useSharedValue(0);
  useEffect(() => {
    if (!reducedMotion) phase.set(withRepeat(withTiming(1, { duration: 3600 }), -1, true));
  }, [phase, reducedMotion]);
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: phase.get() * 7 }],
    opacity: opacity * (0.78 + phase.get() * 0.22),
  }));
  return <View pointerEvents="none" style={styles.frame}>
    <Animated.View style={[styles.art, motion]}>
      <Svg width="100%" height="100%" viewBox="0 0 300 170" preserveAspectRatio="xMidYMid slice">
        {contours.map((path, index) => <React.Fragment key={index}>
          <Path d={path} fill="none" stroke={palette.purple} strokeWidth="4" opacity="0.12" />
          <Path d={path} fill="none" stroke={index < 3 ? "#C69DFF" : palette.purple} strokeWidth="0.85" opacity={index < 3 ? 0.7 : 0.5} />
        </React.Fragment>)}
      </Svg>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  frame: { position: "absolute", top: 0, right: 0, bottom: 0, width: "68%", overflow: "hidden" },
  art: { flex: 1 },
});
