import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Accelerometer } from "expo-sensors";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");

// ======================================================
// SETTINGS
// ======================================================

const POUR_TIME = 3000;

// Total time required to drink 70% beer
const DRINK_TIME = 12000;

const MAX_BEER = 70;
const FOAM_PERCENT = 10;

// ======================================================
// RIGHT TILT SETTINGS
// ======================================================

const RIGHT_TILT_THRESHOLD = 0.55;

const RIGHT_TILT_DIRECTION: "positive" | "negative" =
  "positive";

// ======================================================
// BEER SHAKE SETTINGS
// ======================================================

// Maximum horizontal beer movement in pixels
const MAX_BEER_SHAKE = 42;

// How strongly phone horizontal movement affects beer
const SHAKE_SENSITIVITY = 65;

// ======================================================
// GAME STATE
// ======================================================

type GameState =
  | "idle"
  | "pouring"
  | "ready"
  | "drinking"
  | "finished";

export default function App() {
  // ====================================================
  // STATE
  // ====================================================

  const [gameState, setGameState] =
    useState<GameState>("idle");

  const [beerLevel, setBeerLevel] =
    useState(0);

  // ====================================================
  // REFS
  // ====================================================

  const beerLevelRef = useRef(0);

  const drinkingRef = useRef(false);

  const finishingRef = useRef(false);

  const gameStateRef =
    useRef<GameState>("idle");

  const drinkStartTimeRef =
    useRef<number | null>(null);

  // ====================================================
  // ANIMATIONS
  // ====================================================

  const pourProgress = useRef(
    new Animated.Value(0)
  ).current;

  const waveAnim = useRef(
    new Animated.Value(0)
  ).current;

  const bubbleAnim = useRef(
    new Animated.Value(0)
  ).current;

  const bubbleAnim2 = useRef(
    new Animated.Value(0)
  ).current;

  const bubbleAnim3 = useRef(
    new Animated.Value(0)
  ).current;

  const foamAnim = useRef(
    new Animated.Value(0)
  ).current;

  const pulseAnim = useRef(
    new Animated.Value(1)
  ).current;

  const shineAnim = useRef(
    new Animated.Value(0)
  ).current;

  const foamPulseAnim = useRef(
    new Animated.Value(0)
  ).current;

  // ====================================================
  // NEW:
  // HORIZONTAL BEER MOVEMENT
  // ====================================================

  const beerShakeX = useRef(
    new Animated.Value(0)
  ).current;

  // ====================================================
  // KEEP GAME STATE REF UPDATED
  // ====================================================

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // ====================================================
  // START BEER
  // ====================================================

  const startBeer = async () => {
    if (gameStateRef.current !== "idle") {
      return;
    }

    beerLevelRef.current = 0;

    setBeerLevel(0);

    drinkingRef.current = false;

    finishingRef.current = false;

    drinkStartTimeRef.current = null;

    pourProgress.setValue(0);

    beerShakeX.setValue(0);

    setGameState("pouring");

    await Haptics.impactAsync(
      Haptics.ImpactFeedbackStyle.Medium
    );

    // ==================================================
    // POUR TOP -> DOWN
    // ==================================================

    Animated.timing(pourProgress, {
      toValue: 1,
      duration: POUR_TIME,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      beerLevelRef.current = MAX_BEER;

      setBeerLevel(MAX_BEER);

      drinkStartTimeRef.current = null;

      setGameState("ready");

      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    });
  };

  // ====================================================
  // UPDATE BEER DURING POUR
  // ====================================================

  useEffect(() => {
    if (gameState !== "pouring") {
      return;
    }

    const timer = setInterval(() => {
      const progress =
        pourProgress.__getValue();

      const level = Math.min(
        MAX_BEER,
        progress * MAX_BEER
      );

      beerLevelRef.current = level;

      setBeerLevel(level);
    }, 40);

    return () => {
      clearInterval(timer);
    };
  }, [gameState, pourProgress]);

  // ====================================================
  // RIGHT TILT + LEFT/RIGHT SHAKE DETECTION
  // ====================================================

  useEffect(() => {
    Accelerometer.setUpdateInterval(50);

    let wasRightTilted = false;

    const subscription =
      Accelerometer.addListener(({ x }) => {
        const state =
          gameStateRef.current;

        // ==================================================
        // BEER LEFT / RIGHT MOVEMENT
        // ==================================================

        /*
          x represents horizontal phone movement.

          Negative x -> beer moves LEFT
          Positive x -> beer moves RIGHT
        */

        const rawShake =
          x * SHAKE_SENSITIVITY;

        const clampedShake =
          Math.max(
            -MAX_BEER_SHAKE,
            Math.min(
              MAX_BEER_SHAKE,
              rawShake
            )
          );

        Animated.spring(beerShakeX, {
          toValue: clampedShake,
          friction: 7,
          tension: 45,
          useNativeDriver: true,
        }).start();

        // ==================================================
        // GAME STATE CHECK
        // ==================================================

        if (
          state !== "ready" &&
          state !== "drinking"
        ) {
          wasRightTilted = false;
          return;
        }

        // ==================================================
        // DETECT RIGHT TILT
        // ==================================================

        const rightTilted =
          RIGHT_TILT_DIRECTION === "positive"
            ? x > RIGHT_TILT_THRESHOLD
            : x < -RIGHT_TILT_THRESHOLD;

        // ==================================================
        // RIGHT TILT START / RESUME
        // ==================================================

        if (
          rightTilted &&
          !wasRightTilted &&
          beerLevelRef.current > 0 &&
          !finishingRef.current
        ) {
          wasRightTilted = true;

          drinkingRef.current = true;

          drinkStartTimeRef.current =
            Date.now();

          setGameState("drinking");

          Haptics.impactAsync(
            Haptics.ImpactFeedbackStyle.Light
          );

          return;
        }

        // ==================================================
        // KEEP DRINKING WHILE RIGHT TILTED
        // ==================================================

        if (
          rightTilted &&
          wasRightTilted
        ) {
          return;
        }

        // ==================================================
        // PHONE RETURNED UPRIGHT
        // ==================================================

        if (
          !rightTilted &&
          wasRightTilted
        ) {
          wasRightTilted = false;

          drinkingRef.current = false;

          drinkStartTimeRef.current = null;

          if (
            beerLevelRef.current > 0 &&
            !finishingRef.current
          ) {
            setGameState("ready");
          }
        }
      });

    return () => {
      subscription.remove();

      wasRightTilted = false;

      drinkingRef.current = false;

      drinkStartTimeRef.current = null;

      beerShakeX.stopAnimation();

      beerShakeX.setValue(0);
    };
  }, [beerShakeX]);

  // ====================================================
  // CONTINUOUS DRINK TIMER
  // ====================================================

  useEffect(() => {
    const timer = setInterval(() => {
      if (!drinkingRef.current) {
        return;
      }

      if (finishingRef.current) {
        return;
      }

      if (beerLevelRef.current <= 0) {
        finishBeer();
        return;
      }

      if (
        drinkStartTimeRef.current === null
      ) {
        drinkStartTimeRef.current =
          Date.now();

        return;
      }

      const now = Date.now();

      const elapsed =
        now -
        drinkStartTimeRef.current;

      drinkStartTimeRef.current = now;

      const decrease =
        (elapsed / DRINK_TIME) *
        MAX_BEER;

      const nextLevel =
        Math.max(
          0,
          beerLevelRef.current -
            decrease
        );

      beerLevelRef.current =
        nextLevel;

      setBeerLevel(nextLevel);

      if (
        nextLevel <= 0 &&
        !finishingRef.current
      ) {
        finishBeer();
      }
    }, 40);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // ====================================================
  // FINISH BEER
  // ====================================================

  const finishBeer = async () => {
    if (finishingRef.current) {
      return;
    }

    finishingRef.current = true;

    drinkingRef.current = false;

    drinkStartTimeRef.current = null;

    beerLevelRef.current = 0;

    setBeerLevel(0);

    setGameState("finished");

    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success
    );

    setTimeout(() => {
      beerLevelRef.current = 0;

      setBeerLevel(0);

      drinkingRef.current = false;

      finishingRef.current = false;

      drinkStartTimeRef.current = null;

      pourProgress.setValue(0);

      beerShakeX.setValue(0);

      setGameState("idle");
    }, 1800);
  };

  // ====================================================
  // LIQUID WAVE
  // ====================================================

  useEffect(() => {
    if (
      gameState !== "pouring" &&
      gameState !== "ready" &&
      gameState !== "drinking"
    ) {
      return;
    }

    const animation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),

          Animated.timing(waveAnim, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [gameState, waveAnim]);

  // ====================================================
  // BUBBLE ANIMATIONS
  // ====================================================

  useEffect(() => {
    if (
      gameState !== "pouring" &&
      gameState !== "ready" &&
      gameState !== "drinking"
    ) {
      return;
    }

    const animation1 =
      Animated.loop(
        Animated.timing(
          bubbleAnim,
          {
            toValue: 1,
            duration: 2400,
            easing: Easing.linear,
            useNativeDriver: true,
          }
        )
      );

    const animation2 =
      Animated.loop(
        Animated.timing(
          bubbleAnim2,
          {
            toValue: 1,
            duration: 3100,
            easing: Easing.linear,
            useNativeDriver: true,
          }
        )
      );

    const animation3 =
      Animated.loop(
        Animated.timing(
          bubbleAnim3,
          {
            toValue: 1,
            duration: 1900,
            easing: Easing.linear,
            useNativeDriver: true,
          }
        )
      );

    animation1.start();
    animation2.start();
    animation3.start();

    return () => {
      animation1.stop();
      animation2.stop();
      animation3.stop();

      bubbleAnim.setValue(0);
      bubbleAnim2.setValue(0);
      bubbleAnim3.setValue(0);
    };
  }, [
    gameState,
    bubbleAnim,
    bubbleAnim2,
    bubbleAnim3,
  ]);

  // ====================================================
  // FOAM ANIMATION
  // ====================================================

  useEffect(() => {
    if (
      gameState !== "pouring" &&
      gameState !== "ready" &&
      gameState !== "drinking"
    ) {
      return;
    }

    const animation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            foamAnim,
            {
              toValue: 1,
              duration: 1100,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }
          ),

          Animated.timing(
            foamAnim,
            {
              toValue: 0,
              duration: 1100,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }
          ),
        ])
      );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [gameState, foamAnim]);

  // ====================================================
  // FOAM PULSE
  // ====================================================

  useEffect(() => {
    if (
      gameState !== "pouring" &&
      gameState !== "ready" &&
      gameState !== "drinking"
    ) {
      return;
    }

    const animation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            foamPulseAnim,
            {
              toValue: 1,
              duration: 1300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }
          ),

          Animated.timing(
            foamPulseAnim,
            {
              toValue: 0,
              duration: 1300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }
          ),
        ])
      );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [
    gameState,
    foamPulseAnim,
  ]);

  // ====================================================
  // BEER SHINE
  // ====================================================

  useEffect(() => {
    if (
      gameState !== "pouring" &&
      gameState !== "ready" &&
      gameState !== "drinking"
    ) {
      return;
    }

    const animation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            shineAnim,
            {
              toValue: 1,
              duration: 2200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }
          ),

          Animated.timing(
            shineAnim,
            {
              toValue: 0,
              duration: 2200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }
          ),
        ])
      );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [gameState, shineAnim]);

  // ====================================================
  // DRINKING PULSE
  // ====================================================

  useEffect(() => {
    if (gameState !== "drinking") {
      pulseAnim.stopAnimation();

      pulseAnim.setValue(1);

      return;
    }

    const animation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            pulseAnim,
            {
              toValue: 1.05,
              duration: 350,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }
          ),

          Animated.timing(
            pulseAnim,
            {
              toValue: 1,
              duration: 350,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }
          ),
        ])
      );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [gameState, pulseAnim]);

  // ====================================================
  // BEER HEIGHT
  // ====================================================

  const beerHeight =
    (beerLevel / MAX_BEER) *
    height *
    0.70;

  const foamHeight =
    beerLevel > 0
      ? Math.min(
          height * 0.095,
          beerHeight *
            (FOAM_PERCENT / 100) +
            25
        )
      : 0;

  const totalLiquidHeight =
    beerHeight +
    foamHeight;

  // ====================================================
  // POUR STREAM
  // ====================================================

  const pourHeight =
    pourProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [
        0,
        height * 0.80,
      ],
    });

  const pourOpacity =
    pourProgress.interpolate({
      inputRange: [
        0,
        0.05,
        0.82,
        0.95,
        1,
      ],
      outputRange: [
        0,
        1,
        1,
        0.8,
        0,
      ],
    });

  // ====================================================
  // WAVE TRANSFORM
  // ====================================================

  const waveTransform = {
    transform: [
      {
        translateX:
          waveAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [
              -18,
              18,
            ],
          }),
      },
    ],
  };

  // ====================================================
  // FOAM TRANSFORM
  // ====================================================

  const foamTransform = {
    transform: [
      {
        translateX:
          foamAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [
              -12,
              12,
            ],
          }),
      },
    ],
  };

  // ====================================================
  // BEER SHAKE TRANSFORM
  // ====================================================

  const beerShakeTransform = {
    transform: [
      {
        translateX: beerShakeX,
      },
    ],
  };

  // ====================================================
  // BUBBLE TRANSFORMS
  // ====================================================

  const bubbleTransform1 = {
    transform: [
      {
        translateY:
          bubbleAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [
              0,
              -height * 0.70,
            ],
          }),
      },
      {
        translateX:
          bubbleAnim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [
              0,
              12,
              -5,
            ],
          }),
      },
    ],
  };

  const bubbleTransform2 = {
    transform: [
      {
        translateY:
          bubbleAnim2.interpolate({
            inputRange: [0, 1],
            outputRange: [
              0,
              -height * 0.65,
            ],
          }),
      },
      {
        translateX:
          bubbleAnim2.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [
              0,
              -14,
              7,
            ],
          }),
      },
    ],
  };

  const bubbleTransform3 = {
    transform: [
      {
        translateY:
          bubbleAnim3.interpolate({
            inputRange: [0, 1],
            outputRange: [
              0,
              -height * 0.75,
            ],
          }),
      },
      {
        translateX:
          bubbleAnim3.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [
              0,
              8,
              -12,
            ],
          }),
      },
    ],
  };

  // ====================================================
  // SHINE
  // ====================================================

  const shineOpacity =
    shineAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [
        0.04,
        0.18,
        0.04,
      ],
    });

  // ====================================================
  // FOAM SCALE
  // ====================================================

  const foamScale =
    foamPulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.025],
    });

  // ====================================================
  // START SCREEN
  // ====================================================

  if (gameState === "idle") {
    return (
      <View style={styles.startScreen}>
        <StatusBar hidden />

        <Text style={styles.bigBeer}>
          🍺
        </Text>

        <Text style={styles.title}>
          BEER TIME
        </Text>

        <Text style={styles.subtitle}>
          Tilt right to drink
        </Text>

        <Pressable
          onPress={startBeer}
          style={({ pressed }) => [
            styles.startButton,
            pressed &&
              styles.startPressed,
          ]}
        >
          <Text style={styles.startText}>
            START
          </Text>
        </Pressable>
      </View>
    );
  }

  // ====================================================
  // MAIN SCREEN
  // ====================================================

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* ==================================================
          DARK TOP
      ================================================== */}

      <View
        pointerEvents="none"
        style={styles.darkTop}
      />

      {/* ==================================================
          REALISTIC BEER
      ================================================== */}

      {beerLevel > 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.liquidContainer,
            {
              height:
                totalLiquidHeight,
            },
          ]}
        >
          {/* ==============================================
              BEER
          ============================================== */}

          <Animated.View
            style={[
              styles.beerLayer,
              beerShakeTransform,
              {
                height:
                  beerHeight,
              },
            ]}
          >
            {/* Deep golden amber base */}

            <View
              style={styles.beerBase}
            />

            {/* Bright golden upper area */}

            <View
              style={styles.beerGolden}
            />

            {/* Deep amber lower area */}

            <View
              style={styles.beerDarkBottom}
            />

            {/* Subtle left reflection */}

            <View
              style={styles.glassReflection}
            />

            {/* Moving light */}

            <Animated.View
              style={[
                styles.movingShine,
                {
                  opacity:
                    shineOpacity,
                },
              ]}
            />

            {/* ==========================================
                BEER SURFACE
            ========================================== */}

            <Animated.View
              style={[
                styles.beerSurface,
                waveTransform,
              ]}
            >
              <View
                style={styles.surfaceHighlight}
              />

              <View
                style={styles.surfaceHighlight2}
              />
            </Animated.View>

            {/* ==========================================
                CARBONATION
            ========================================== */}

            <Animated.View
              style={[
                styles.microBubble,
                styles.microBubble1,
                bubbleTransform1,
              ]}
            />

            <Animated.View
              style={[
                styles.microBubble,
                styles.microBubble2,
                bubbleTransform2,
              ]}
            />

            <Animated.View
              style={[
                styles.microBubble,
                styles.microBubble3,
                bubbleTransform3,
              ]}
            />

            <Animated.View
              style={[
                styles.microBubbleSmall,
                styles.microBubble4,
                bubbleTransform2,
              ]}
            />

            <Animated.View
              style={[
                styles.microBubbleSmall,
                styles.microBubble5,
                bubbleTransform1,
              ]}
            />

            <Animated.View
              style={[
                styles.microBubbleSmall,
                styles.microBubble6,
                bubbleTransform3,
              ]}
            />

            <Animated.View
              style={[
                styles.microBubbleTiny,
                styles.microBubble7,
                bubbleTransform1,
              ]}
            />

            <Animated.View
              style={[
                styles.microBubbleTiny,
                styles.microBubble8,
                bubbleTransform2,
              ]}
            />

            <Animated.View
              style={[
                styles.microBubbleTiny,
                styles.microBubble9,
                bubbleTransform3,
              ]}
            />

            <Animated.View
              style={[
                styles.microBubbleTiny,
                styles.microBubble10,
                bubbleTransform1,
              ]}
            />

            <Animated.View
              style={[
                styles.microBubbleTiny,
                styles.microBubble11,
                bubbleTransform2,
              ]}
            />

            <Animated.View
              style={[
                styles.microBubbleTiny,
                styles.microBubble12,
                bubbleTransform3,
              ]}
            />
          </Animated.View>

          {/* ==============================================
              REALISTIC FOAM
          ============================================== */}

          <Animated.View
            style={[
              styles.foam,
              beerShakeTransform,
              {
                height:
                  foamHeight,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.foamWave,
                {
                  transform: [
                    {
                      translateX:
                        foamAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [
                            -12,
                            12,
                          ],
                        }),
                    },
                    {
                      scale:
                        foamScale,
                    },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.foamBubble,
                  styles.foam1,
                ]}
              />

              <View
                style={[
                  styles.foamBubble,
                  styles.foam2,
                ]}
              />

              <View
                style={[
                  styles.foamBubble,
                  styles.foam3,
                ]}
              />

              <View
                style={[
                  styles.foamBubble,
                  styles.foam4,
                ]}
              />

              <View
                style={[
                  styles.foamBubble,
                  styles.foam5,
                ]}
              />

              <View
                style={[
                  styles.foamBubble,
                  styles.foam6,
                ]}
              />

              <View
                style={[
                  styles.foamBubble,
                  styles.foam7,
                ]}
              />

              <View
                style={[
                  styles.foamBubble,
                  styles.foam8,
                ]}
              />

              <View
                style={[
                  styles.foamBubble,
                  styles.foam9,
                ]}
              />

              <View
                style={[
                  styles.foamBubble,
                  styles.foam10,
                ]}
              />

              <View
                style={[
                  styles.foamBubble,
                  styles.foam11,
                ]}
              />

              <View
                style={[
                  styles.foamBubble,
                  styles.foam12,
                ]}
              />
            </Animated.View>

            {/* Warm foam shadow */}

            <View
              style={styles.foamShadow}
            />
          </Animated.View>
        </View>
      )}

      {/* ==================================================
          REALISTIC POUR STREAM
      ================================================== */}

      {gameState === "pouring" && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pourContainer,
            {
              height:
                pourHeight,
              opacity:
                pourOpacity,
            },
          ]}
        >
          {/* Dark amber outer liquid */}

          <View
            style={styles.pourStreamOuter}
          />

          {/* Golden center */}

          <View
            style={styles.pourStreamInner}
          />

          {/* Bright liquid reflection */}

          <View
            style={styles.pourStreamHighlight}
          />

          {/* Foam at pouring point */}

          <View
            style={styles.pourFoam}
          />

          {/* Falling irregular drops */}

          <View
            style={[
              styles.pourDrop,
              styles.dropOne,
            ]}
          />

          <View
            style={[
              styles.pourDrop,
              styles.dropTwo,
            ]}
          />

          <View
            style={[
              styles.pourDrop,
              styles.dropThree,
            ]}
          />

          <View
            style={[
              styles.pourDrop,
              styles.dropFour,
            ]}
          />
        </Animated.View>
      )}

      {/* ==================================================
          TOP UI
      ================================================== */}

      <View style={styles.topUI}>
        <Text style={styles.topBeer}>
          🍺
        </Text>

        <Text style={styles.level}>
          {Math.ceil(beerLevel)}
          %
        </Text>
      </View>

      {/* ==================================================
          CENTER
      ================================================== */}

      <View style={styles.centerUI}>
        {gameState === "pouring" && (
          <>
            <Text
              style={styles.pouringText}
            >
              POURING...
            </Text>

            <Text
              style={styles.smallText}
            >
              Fresh beer
            </Text>
          </>
        )}

        {gameState === "ready" && (
          <>
            <Text
              style={styles.readyBeer}
            >
              🍺
            </Text>

            <Text
              style={styles.instruction}
            >
              TILT RIGHT TO DRINK
            </Text>

            <Text
              style={styles.pauseText}
            >
              Tilt back to pause
            </Text>
          </>
        )}

        {gameState === "drinking" && (
          <Animated.View
            style={{
              transform: [
                {
                  scale:
                    pulseAnim,
                },
              ],
            }}
          >
            <Text
              style={styles.drinking}
            >
              DRINKING...
            </Text>

            <Text
              style={styles.drinkingHint}
            >
              TILT BACK TO PAUSE
            </Text>
          </Animated.View>
        )}

        {gameState === "finished" && (
          <>
            <Text
              style={styles.finishedEmoji}
            >
              🍻
            </Text>

            <Text
              style={styles.finished}
            >
              EMPTY!
            </Text>
          </>
        )}
      </View>

      {/* ==================================================
          DRINKING EFFECT
      ================================================== */}

      {gameState === "drinking" && (
        <>
          <View
            style={styles.leftSplash}
          />

          <View
            style={styles.rightSplash}
          />

          <View
            style={styles.drinkingGlow}
          />

          <View
            style={styles.drinkingLines}
          />
        </>
      )}
    </View>
  );
}

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({
  // ====================================================
  // MAIN
  // ====================================================

  container: {
    flex: 1,
    backgroundColor: "#020202",
    overflow: "hidden",
  },

  // ====================================================
  // START
  // ====================================================

  startScreen: {
    flex: 1,
    backgroundColor: "#070707",
    alignItems: "center",
    justifyContent: "center",
  },

  bigBeer: {
    fontSize: 90,
    marginBottom: 15,
  },

  title: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 4,
  },

  subtitle: {
    color: "#999999",
    fontSize: 16,
    marginTop: 10,
    marginBottom: 45,
  },

  startButton: {
    width: 230,
    height: 72,
    borderRadius: 40,
    backgroundColor: "#f3a300",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#f3a300",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },

  startPressed: {
    transform: [
      {
        scale: 0.94,
      },
    ],
  },

  startText: {
    color: "#111111",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 3,
  },

  // ====================================================
  // DARK TOP
  // ====================================================

  darkTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.20,

    backgroundColor: "#020202",

    zIndex: 1,
  },

  // ====================================================
  // LIQUID CONTAINER
  // ====================================================

  liquidContainer: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    zIndex: 2,

    overflow: "hidden",
  },

  // ====================================================
  // BEER
  // ====================================================

  beerLayer: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    overflow: "hidden",
  },

  beerBase: {
    position: "absolute",

    left: 0,
    right: 0,
    top: 0,
    bottom: 0,

    backgroundColor: "#D98A08",
  },

  beerGolden: {
    position: "absolute",

    left: 0,
    right: 0,
    top: 0,

    height: "65%",

    backgroundColor:
      "rgba(255,190,55,0.42)",
  },

  beerDarkBottom: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    height: "48%",

    backgroundColor:
      "rgba(91,38,0,0.34)",
  },

  // ====================================================
  // REFLECTION
  // ====================================================

  glassReflection: {
    position: "absolute",

    left: width * 0.08,
    top: 0,
    bottom: 0,

    width: width * 0.075,

    backgroundColor:
      "rgba(255,255,255,0.10)",

    borderRadius: 100,
  },

  // ====================================================
  // MOVING SHINE
  // ====================================================

  movingShine: {
    position: "absolute",

    top: 0,
    bottom: 0,

    left: width * 0.40,

    width: width * 0.13,

    backgroundColor:
      "rgba(255,230,145,0.22)",

    transform: [
      {
        skewX: "-12deg",
      },
    ],
  },

  // ====================================================
  // BEER SURFACE
  // ====================================================

  beerSurface: {
    position: "absolute",

    top: -7,

    left: -50,
    right: -50,

    height: 28,

    borderRadius: 100,

    backgroundColor:
      "rgba(255,205,75,0.38)",
  },

  surfaceHighlight: {
    position: "absolute",

    left: width * 0.10,
    top: 8,

    width: width * 0.30,
    height: 5,

    borderRadius: 10,

    backgroundColor:
      "rgba(255,245,190,0.42)",
  },

  surfaceHighlight2: {
    position: "absolute",

    right: width * 0.10,
    top: 6,

    width: width * 0.20,
    height: 4,

    borderRadius: 10,

    backgroundColor:
      "rgba(255,230,150,0.28)",
  },

  // ====================================================
  // MICRO BUBBLES
  // ====================================================

  microBubble: {
    position: "absolute",

    width: 6,
    height: 6,

    borderRadius: 10,

    borderWidth: 1,

    borderColor:
      "rgba(255,245,190,0.55)",

    backgroundColor:
      "rgba(255,255,255,0.08)",
  },

  microBubbleSmall: {
    position: "absolute",

    width: 4,
    height: 4,

    borderRadius: 10,

    backgroundColor:
      "rgba(255,235,160,0.50)",
  },

  microBubbleTiny: {
    position: "absolute",

    width: 2.5,
    height: 2.5,

    borderRadius: 10,

    backgroundColor:
      "rgba(255,245,190,0.65)",
  },

  microBubble1: {
    left: width * 0.12,
    bottom: 20,
  },

  microBubble2: {
    left: width * 0.28,
    bottom: 65,
  },

  microBubble3: {
    left: width * 0.56,
    bottom: 35,
  },

  microBubble4: {
    left: width * 0.18,
    bottom: 130,
  },

  microBubble5: {
    left: width * 0.44,
    bottom: 90,
  },

  microBubble6: {
    right: width * 0.14,
    bottom: 150,
  },

  microBubble7: {
    left: width * 0.36,
    bottom: 180,
  },

  microBubble8: {
    left: width * 0.72,
    bottom: 210,
  },

  microBubble9: {
    left: width * 0.08,
    bottom: 250,
  },

  microBubble10: {
    right: width * 0.25,
    bottom: 280,
  },

  microBubble11: {
    left: width * 0.52,
    bottom: 320,
  },

  microBubble12: {
    right: width * 0.08,
    bottom: 380,
  },

  // ====================================================
  // FOAM
  // ====================================================

  foam: {
    position: "absolute",

    left: 0,
    right: 0,

    bottom: "70%",

    backgroundColor: "#F8E8BD",

    overflow: "hidden",
  },

  foamWave: {
    position: "absolute",

    left: -60,
    right: -60,

    top: -25,

    height: 90,
  },

  foamBubble: {
    position: "absolute",

    backgroundColor: "#FFF4D2",

    borderRadius: 100,

    shadowColor: "#B98232",

    shadowOpacity: 0.20,

    shadowRadius: 5,
  },

  foam1: {
    width: 105,
    height: 45,

    left: -15,
    top: 14,
  },

  foam2: {
    width: 135,
    height: 58,

    left: width * 0.10,
    top: -12,
  },

  foam3: {
    width: 90,
    height: 48,

    left: width * 0.32,
    top: 7,
  },

  foam4: {
    width: 140,
    height: 62,

    left: width * 0.50,
    top: -15,
  },

  foam5: {
    width: 90,
    height: 48,

    right: -12,
    top: 12,
  },

  foam6: {
    width: 55,
    height: 38,

    left: width * 0.04,
    top: 36,
  },

  foam7: {
    width: 65,
    height: 42,

    left: width * 0.27,
    top: 35,
  },

  foam8: {
    width: 52,
    height: 36,

    left: width * 0.54,
    top: 37,
  },

  foam9: {
    width: 60,
    height: 38,

    right: width * 0.06,
    top: 35,
  },

  foam10: {
    width: 38,
    height: 30,

    left: width * 0.18,
    top: 52,
  },

  foam11: {
    width: 42,
    height: 31,

    left: width * 0.67,
    top: 51,
  },

  foam12: {
    width: 32,
    height: 27,

    right: width * 0.20,
    top: 54,
  },

  foamShadow: {
    position: "absolute",

    left: 0,
    right: 0,

    bottom: 0,

    height: 12,

    backgroundColor:
      "rgba(176,116,35,0.18)",
  },

  // ====================================================
  // POUR STREAM
  // ====================================================

  pourContainer: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,

    alignItems: "center",

    zIndex: 10,
  },

  pourStreamOuter: {
    position: "absolute",

    width: 64,
    height: "100%",

    backgroundColor: "#B96802",

    borderRadius: 50,

    opacity: 0.96,
  },

  pourStreamInner: {
    position: "absolute",

    width: 42,
    height: "100%",

    backgroundColor: "#E7A21A",

    borderRadius: 50,

    opacity: 0.94,
  },

  pourStreamHighlight: {
    position: "absolute",

    width: 9,
    height: "100%",

    backgroundColor:
      "rgba(255,230,140,0.48)",

    borderRadius: 20,
  },

  pourFoam: {
    position: "absolute",

    width: 52,
    height: 20,

    top: 0,

    borderRadius: 50,

    backgroundColor:
      "rgba(255,244,210,0.82)",
  },

  pourDrop: {
    position: "absolute",

    backgroundColor: "#D98A08",

    borderRadius: 50,
  },

  dropOne: {
    width: 15,
    height: 30,

    left: width / 2 - 58,

    top: 190,
  },

  dropTwo: {
    width: 10,
    height: 22,

    left: width / 2 + 54,

    top: 320,
  },

  dropThree: {
    width: 13,
    height: 28,

    left: width / 2 + 22,

    top: 455,
  },

  dropFour: {
    width: 9,
    height: 20,

    left: width / 2 - 72,

    top: 530,
  },

  // ====================================================
  // TOP UI
  // ====================================================

  topUI: {
    position: "absolute",

    top: 35,
    left: 0,
    right: 0,

    alignItems: "center",

    zIndex: 30,
  },

  topBeer: {
    fontSize: 34,
  },

  level: {
    color: "#ffffff",

    fontSize: 20,

    fontWeight: "900",

    textShadowColor:
      "rgba(0,0,0,0.8)",

    textShadowRadius: 10,
  },

  // ====================================================
  // CENTER
  // ====================================================

  centerUI: {
    position: "absolute",

    top: height * 0.43,

    left: 0,
    right: 0,

    alignItems: "center",

    zIndex: 30,
  },

  pouringText: {
    color: "#ffffff",

    fontSize: 27,

    fontWeight: "900",

    letterSpacing: 3,

    textShadowColor: "#000000",

    textShadowRadius: 10,
  },

  smallText: {
    color: "#dddddd",

    fontSize: 14,

    marginTop: 8,
  },

  readyBeer: {
    fontSize: 45,

    marginBottom: 15,
  },

  instruction: {
    color: "#ffffff",

    fontSize: 18,

    fontWeight: "900",

    letterSpacing: 2,

    textAlign: "center",

    textShadowColor: "#000000",

    textShadowRadius: 10,
  },

  pauseText: {
    color: "#999999",

    fontSize: 13,

    marginTop: 10,
  },

  drinking: {
    color: "#ffffff",

    fontSize: 29,

    fontWeight: "900",

    letterSpacing: 3,

    textShadowColor: "#000000",

    textShadowRadius: 12,

    textAlign: "center",
  },

  drinkingHint: {
    color: "#bbbbbb",

    fontSize: 12,

    marginTop: 10,

    textAlign: "center",
  },

  finishedEmoji: {
    fontSize: 55,

    marginBottom: 10,
  },

  finished: {
    color: "#ffffff",

    fontSize: 30,

    fontWeight: "900",

    letterSpacing: 3,
  },

  // ====================================================
  // DRINKING EFFECT
  // ====================================================

  leftSplash: {
    position: "absolute",

    width: 22,
    height: 130,

    left: -5,

    top: height * 0.35,

    backgroundColor:
      "rgba(255,180,35,0.45)",

    borderRadius: 50,

    transform: [
      {
        rotate: "20deg",
      },
    ],

    zIndex: 20,
  },

  rightSplash: {
    position: "absolute",

    width: 22,
    height: 130,

    right: -5,

    top: height * 0.42,

    backgroundColor:
      "rgba(255,180,35,0.45)",

    borderRadius: 50,

    transform: [
      {
        rotate: "-20deg",
      },
    ],

    zIndex: 20,
  },

  drinkingGlow: {
    position: "absolute",

    left: 0,
    right: 0,

    bottom: 0,

    height: 120,

    backgroundColor:
      "rgba(255,170,20,0.08)",

    zIndex: 3,
  },

  drinkingLines: {
    position: "absolute",

    left: 0,
    right: 0,

    top: height * 0.25,

    height: 2,

    backgroundColor:
      "rgba(255,255,255,0.08)",

    zIndex: 8,
  },
});

i need real beer color full code need i when i shake the phone bear also must be sheak