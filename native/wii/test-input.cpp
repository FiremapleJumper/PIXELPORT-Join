// SPDX-License-Identifier: GPL-2.0-or-later
#include "pixelport_wiimote_input.h"
#include <cassert>
#include <cmath>
int main()
{
  using namespace PixelPortWii;
  Input input{};
  assert(Override(input, "Buttons", "2", 0) == 0);
  input.mask = 3;
  assert(Override(input, "Buttons", "1", 0) == 1);
  assert(Override(input, "Buttons", "2", 0) == 1);
  assert(Override(input, "Buttons", "A", 0) == 0);
  input.mask = (1u << 10) | (1u << 11);
  assert(Override(input, "D-Pad", "Left", 0) == 0);
  assert(Override(input, "D-Pad", "Right", 0) == 0);
  input = {}; input.stick_x = 224;
  assert(Override(input, "D-Pad", "Right", 0) == 1);
  input = {}; input.tilt_x = 224;
  const auto tilt = *Override(input, "IMUAccelerometer", "Y", 0);
  input.tilt_x = 32;
  assert(tilt > 8);
  assert(std::abs(*Override(input, "IMUAccelerometer", "Y", 0) + tilt) < 1e-8);
  input = {};
  assert(std::abs(*Override(input, "IMUAccelerometer", "Z", 0) - 9.80665) < 1e-8);
  input.mask = 1u << 5;
  assert(*Override(input, "IMUAccelerometer", "Z", 1.0 / 32) > 30);
  assert(*Override(input, "IMUAccelerometer", "Z", 3.0 / 32) < -10);
  input = {};
  assert(!Override(input, "Unknown", "Unknown", 0));
}
