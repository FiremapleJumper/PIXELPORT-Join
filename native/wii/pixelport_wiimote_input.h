// Copyright 2026 PixelPort contributors
// SPDX-License-Identifier: GPL-2.0-or-later
#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <optional>
#include <string_view>

namespace PixelPortWii
{
struct Input
{
  std::uint32_t mask = 0;
  int stick_x = 128;
  int stick_y = 128;
  int tilt_x = 128;
};

// Uses the existing browser pad transport. This is a sideways, bare Wii Remote;
// Dolphin handles its native button rotation and report encoding.
inline std::optional<double> Override(const Input& input, std::string_view group,
                                      std::string_view control, double seconds)
{
  const auto held = [&](unsigned bit) { return (input.mask & (1u << bit)) != 0; };
  if (group == "Buttons")
  {
    if (control == "2") return held(0) ? 1.0 : 0.0;
    if (control == "1") return held(1) ? 1.0 : 0.0;
    if (control == "A") return held(2) ? 1.0 : 0.0;
    if (control == "B") return held(3) ? 1.0 : 0.0;
    if (control == "+") return held(4) ? 1.0 : 0.0;
    if (control == "-") return held(7) ? 1.0 : 0.0;
    if (control == "Home") return held(20) ? 1.0 : 0.0;
  }
  if (group == "D-Pad")
  {
    const bool up = held(8) || held(12) || input.stick_y > 176;
    const bool down = held(9) || held(13) || input.stick_y < 80;
    const bool left = held(10) || held(14) || input.stick_x < 80;
    const bool right = held(11) || held(15) || input.stick_x > 176;
    if (control == "Up") return up && !down ? 1.0 : 0.0;
    if (control == "Down") return down && !up ? 1.0 : 0.0;
    if (control == "Left") return left && !right ? 1.0 : 0.0;
    if (control == "Right") return right && !left ? 1.0 : 0.0;
  }
  if (group == "IMUAccelerometer")
  {
    constexpr double gravity = 9.80665;
    constexpr double pi = 3.14159265358979323846;
    const double tilt = std::clamp((input.tilt_x - 128.0) / 96.0, -1.0, 1.0) * pi / 3.0;
    const double shake = held(5) ? std::sin(seconds * pi * 16.0) * gravity * 2.5 : 0.0;
    if (control == "X") return shake * 0.4;
    if (control == "Y") return gravity * std::sin(tilt);
    if (control == "Z") return gravity * std::cos(tilt) + shake;
  }
  return std::nullopt;
}
}  // namespace PixelPortWii
